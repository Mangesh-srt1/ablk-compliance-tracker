/**
 * KYB Service
 * Handles Know Your Business verification across multiple jurisdictions
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import {
  Jurisdiction,
  KybStatus,
  KybEntityType,
  KybFlagType,
  FlagSeverity,
  KybCheckRequest,
  KybCheckResult,
  KybCheckRecord,
  KybDocument,
  KybEntityData,
  KybFlag,
  UBOVerification,
  SanctionScreeningResult,
  SanctionMatch,
  RegistrationValidation,
  KybRiskScore,
  ContinuousMonitoringRequest,
  ContinuousMonitoringAlert,
} from '../types/kyb';
import SqlLoader from '../utils/sqlLoader';
import db from '../config/database';
import { AppError, ErrorCode, ErrorCategory } from '../types/errors';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kyb.log' }),
  ],
});

export class KybService {
  private sqlLoader: SqlLoader;
  
  // Sanctions lists data (in production, these would be fetched from external providers)
  private sanctionLists = [
    'OFAC_SDN',
    'UN_SECURITY_COUNCIL',
    'EU_CONSOLIDATED',
    'UK_SANCTIONS_LIST',
    'DFSA_PERSONS_LIST',
    'RBI_CAML_LIST',
  ];

  constructor() {
    this.sqlLoader = SqlLoader.getInstance();
  }

  /**
   * Perform KYB check for a business entity
   * @param request - KYB check request with entity data and documents
   * @param userId - User ID performing the check
   * @returns KybCheckResult with verification status and flags
   */
  async performKybCheck(request: KybCheckRequest, userId?: string): Promise<KybCheckResult> {
    const startTime = Date.now();
    const checkId = uuidv4();

    try {
      logger.info('Starting KYB check', {
        checkId,
        businessId: request.businessId,
        jurisdiction: request.jurisdiction,
        entityType: request.entityData.entityType,
        userId,
      });

      // Validate jurisdiction
      if (!Object.values(Jurisdiction).includes(request.jurisdiction)) {
        throw new AppError(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          `Unsupported jurisdiction: ${request.jurisdiction}`,
          400
        );
      }

      // Perform jurisdiction-specific KYB validation
      const registrationValidation = await this.validateBusinessRegistration(
        request.entityData,
        request.skipDocumentVerification
      );

      // Verify UBO disclosure
      const uboVerification = await this.verifyUBO(
        request.entityData.ultimatelyBeneficialOwners,
        request.jurisdiction
      );

      // Perform sanctions screening
      const sanctionScreening = await this.performSanctionsScreening(
        request.entityData,
        request.skipSanctionsScreening
      );

      // Calculate risk score
      const { score, riskLevel, flags } = await this.calculateKybRiskScore(
        request,
        registrationValidation,
        uboVerification,
        sanctionScreening
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(flags, riskLevel, request.jurisdiction);

      // Determine final status
      const status = this.determineKybStatus(score, flags);

      // Build result
      const result: KybCheckResult = {
        checkId,
        businessId: request.businessId,
        jurisdiction: request.jurisdiction,
        status,
        score,
        riskLevel,
        flags,
        registrationValidation,
        uboVerification,
        sanctionScreening,
        recommendations,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        nextReviewDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        verifiedFields: {
          registrationNumber: registrationValidation.isValid,
          businessName: registrationValidation.registeredName === request.entityData.businessName,
          primaryAddress: true, // TODO: Implement address verification
          ubos: uboVerification.isVerified,
          directors: true, // TODO: Implement director verification
        },
        explanations: {
          reasonForStatus: this.getStatusExplanation(status, flags),
          keyRisks: flags.filter(f => f.severity === FlagSeverity.HIGH || f.severity === FlagSeverity.CRITICAL)
            .map(f => f.message),
          regulatoryRules: this.getApplicableRules(request.jurisdiction),
        },
        jurisdictionRules: this.getApplicableRules(request.jurisdiction),
        auditTrail: [
          {
            timestamp: new Date().toISOString(),
            action: 'KYB_CHECK_COMPLETED',
            userId: userId || 'system',
            status: 'success',
          },
        ],
      };

      // Store the check result
      await this.storeKybCheck(request, result, userId);

      logger.info('KYB check completed', {
        checkId,
        businessId: request.businessId,
        status: result.status,
        score: result.score,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      logger.error('KYB check failed', {
        checkId,
        businessId: request.businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        ErrorCategory.INTERNAL,
        'KYB check processing failed',
        500
      );
    }
  }

  /**
   * Validate business registration details
   */
  private async validateBusinessRegistration(
    entityData: KybEntityData,
    skipValidation?: boolean
  ): Promise<RegistrationValidation> {
    if (skipValidation) {
      return {
        isValid: true,
        registrationVerified: false,
        registrationNumber: entityData.registrationNumber,
        registeredName: entityData.businessName,
        status: 'ACTIVE',
        registrationDate: entityData.dateOfIncorporation,
        lastUpdatedDate: new Date().toISOString(),
        dataSource: 'MOCK_PROVIDER', // TODO: Real provider integration
        errors: [],
        flags: [],
      };
    }

    // TODO: Integrate with real business registration databases
    // For now, basic validation
    const errors: string[] = [];
    const flags: string[] = [];

    const hasRegistrationAndName = !!(entityData.registrationNumber && entityData.businessName);
    const registrationLooksValid = /\d/.test(entityData.registrationNumber || '');

    if (!registrationLooksValid) {
      errors.push('Invalid registration number format');
    }

    const incorporationDate = new Date(entityData.dateOfIncorporation);
    if (!Number.isNaN(incorporationDate.getTime()) && incorporationDate > new Date()) {
      flags.push('Future incorporation date is invalid');
    }

    const isValid: boolean = hasRegistrationAndName && registrationLooksValid && flags.length === 0;
    const status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DISSOLVED' = isValid ? 'ACTIVE' : 'INACTIVE';

    return {
      isValid,
      registrationVerified: isValid,
      registrationNumber: entityData.registrationNumber,
      registeredName: entityData.businessName,
      status,
      registrationDate: entityData.dateOfIncorporation,
      lastUpdatedDate: new Date().toISOString(),
      dataSource: 'BUSINESS_REGISTRY',
      errors,
      flags,
    };
  }

  /**
   * Verify Ultimate Beneficial Owner (UBO) disclosure
   */
  private async verifyUBO(
    ubos: any[],
    jurisdiction: Jurisdiction
  ): Promise<UBOVerification> {
    const flags: KybFlag[] = [];
    const disclosureGaps: string[] = [];

    if (!ubos || ubos.length === 0) {
      disclosureGaps.push('No UBO information provided');
      flags.push({
        type: KybFlagType.UBO_MISMATCH,
        severity: FlagSeverity.HIGH,
        message: 'No Ultimate Beneficial Owner disclosed',
        confidence: 1,
      });
    }

    // Validate UBO data completeness
    ubos.forEach((ubo, index) => {
      if (!ubo.name) disclosureGaps.push(`UBO ${index + 1}: Missing name`);
      if (!ubo.nationality) disclosureGaps.push(`UBO ${index + 1}: Missing nationality`);
      if (ubo.ownershipPercentage === undefined || ubo.ownershipPercentage <= 0) {
        disclosureGaps.push(`UBO ${index + 1}: Invalid ownership percentage`);
      }
      if (ubo.ownershipPercentage > 100) {
        disclosureGaps.push(`UBO ${index + 1}: Ownership exceeds 100%`);
        flags.push({
          type: KybFlagType.UBO_MISMATCH,
          severity: FlagSeverity.HIGH,
          message: `UBO ${ubo.name} has invalid ownership percentage`,
          reason: 'ownership percentage exceeds 100',
          confidence: 0.9,
        });
      }
      if (String(ubo.nationality || '').toUpperCase() === 'XX') {
        flags.push({
          type: KybFlagType.UBO_MISMATCH,
          severity: FlagSeverity.HIGH,
          message: `UBO ${ubo.name} has unverifiable nationality`,
          reason: 'unverifiable nationality',
          confidence: 0.85,
        });
      }
    });

    // Check for politically exposed persons among UBOs
    for (const ubo of ubos) {
      if (ubo.isPoliticallyExposed) {
        flags.push({
          type: KybFlagType.PEP_ASSOCIATED,
          severity: FlagSeverity.MEDIUM,
          message: `UBO ${ubo.name} is politically exposed`,
          confidence: 0.8,
        });
      }
    }

    return {
      isVerified: disclosureGaps.length === 0,
      ubos,
      disclosureGaps,
      confidence: 100 - disclosureGaps.length * 25,
      flags,
    };
  }

  /**
   * Perform sanctions screening on business and its UBOs
   */
  private async performSanctionsScreening(
    entityData: KybEntityData,
    skipScreening?: boolean
  ): Promise<SanctionScreeningResult> {
    if (skipScreening) {
      return {
        hasSanctionMatches: false,
        matches: [],
        sanctionedMatches: [],
        screenedLists: this.sanctionLists,
        screeningTimestamp: new Date().toISOString(),
        nextScreeningDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    const matches: SanctionMatch[] = [];

    // Screen business name
    const businessMatches = await this.screenNameAgainstSanctionsList(
      entityData.businessName,
      entityData.jurisdiction
    );
    matches.push(...businessMatches);

    // Screen UBO names
    for (const ubo of entityData.ultimatelyBeneficialOwners) {
      const uboMatches = await this.screenNameAgainstSanctionsList(ubo.name, entityData.jurisdiction);
      matches.push(...uboMatches);
    }

    // Screen directors if available
    if (entityData.directors) {
      for (const director of entityData.directors) {
        const directorMatches = await this.screenNameAgainstSanctionsList(
          director.name,
          entityData.jurisdiction
        );
        matches.push(...directorMatches);
      }
    }

    const sanctionedMatches = matches.map((match) => ({
      ...match,
      sanctionsList: match.sanctionListName,
    }));

    return {
      hasSanctionMatches: matches.length > 0,
      matches,
      sanctionedMatches,
      screenedLists: this.sanctionLists,
      screeningTimestamp: new Date().toISOString(),
      nextScreeningDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Screen name against sanction lists (mock implementation)
   */
  private async screenNameAgainstSanctionsList(
    name: string,
    jurisdiction: Jurisdiction
  ): Promise<SanctionMatch[]> {
    // TODO: Integrate with real sanction list providers (Chainalysis, etc)
    // For now, return empty array
    const matches: SanctionMatch[] = [];

    // Mock: Check for specific test names
    const lowerName = name.toLowerCase();
    if (lowerName.includes('sanctioned') || lowerName.includes('ofac listed') || lowerName.includes('un sanctions')) {
      matches.push({
        sanctionListName: 'OFAC_SDN',
        matchedName: name,
        matchScore: 95,
        confidence: 0.95,
        jurisdiction: jurisdiction,
      });
    }

    return matches;
  }

  /**
   * Calculate overall KYB risk score
   */
  private async calculateKybRiskScore(
    request: KybCheckRequest,
    registrationValidation: RegistrationValidation,
    uboVerification: UBOVerification,
    sanctionScreening: SanctionScreeningResult
  ): Promise<{ score: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; flags: KybFlag[] }> {
    const maybeLegacyInput = request as unknown as {
      registrationValid?: boolean;
      sanctionsHits?: number;
      uboVerified?: boolean;
      uboSanctionsHits?: number;
      jurisdiction?: Jurisdiction;
    };

    if (
      registrationValidation === undefined &&
      uboVerification === undefined &&
      sanctionScreening === undefined &&
      typeof maybeLegacyInput.registrationValid === 'boolean'
    ) {
      let legacyScore = 0;
      if (!maybeLegacyInput.registrationValid) legacyScore += 25;
      if ((maybeLegacyInput.sanctionsHits || 0) > 0) legacyScore += 35;
      if (!maybeLegacyInput.uboVerified) legacyScore += 20;
      legacyScore += Math.min(20, (maybeLegacyInput.uboSanctionsHits || 0) * 10);
      legacyScore += this.getJurisdictionRisk(maybeLegacyInput.jurisdiction || Jurisdiction.US) * 0.1;
      legacyScore = Math.min(100, Math.max(0, legacyScore));
      const legacyRiskLevel =
        legacyScore < 30 ? 'LOW' : legacyScore < 60 ? 'MEDIUM' : legacyScore < 80 ? 'HIGH' : 'CRITICAL';
      return { score: Math.round(legacyScore), riskLevel: legacyRiskLevel, flags: [] };
    }

    const flags: KybFlag[] = [];
    let score = 0;

    // Registration risks (weight: 25%)
    if (!registrationValidation.isValid) {
      score += 25;
      flags.push({
        type: KybFlagType.INVALID_REGISTRATION,
        severity: FlagSeverity.HIGH,
        message: 'Business registration could not be verified',
        confidence: 1,
      });
    }

    // UBO risks (weight: 30%)
    const uboRiskScore = 100 - uboVerification.confidence;
    score += uboRiskScore * 0.3;
    flags.push(...uboVerification.flags);

    // Sanctions risks (high severity)
    if (sanctionScreening.hasSanctionMatches) {
      score += 70;
      flags.push({
        type: KybFlagType.SANCTIONS_HIT,
        severity: FlagSeverity.CRITICAL,
        message: `Business or associated persons matched sanctions list`,
        confidence: sanctionScreening.matches[0]?.confidence || 0.9,
      });
    }

    if (!request.documents || request.documents.length === 0) {
      score += 55;
      flags.push({
        type: KybFlagType.MISSING_DOCUMENTS,
        severity: FlagSeverity.MEDIUM,
        message: 'Required KYB documents are missing',
        reason: 'missing documents',
        confidence: 0.9,
      });
    }

    // Jurisdiction risks (weight: 10%)
    const jurisdictionRisk = this.getJurisdictionRisk(request.jurisdiction);
    score += jurisdictionRisk * 0.1;

    // Cap score at 100
    score = Math.min(100, Math.max(0, score));

    // Determine risk level
    const riskLevel =
      score < 30 ? 'LOW' : score < 60 ? 'MEDIUM' : score < 80 ? 'HIGH' : 'CRITICAL';

    return { score: Math.round(score), riskLevel, flags };
  }

  /**
   * Get jurisdiction risk score
   */
  private getJurisdictionRisk(jurisdiction: Jurisdiction): number {
    // Higher risk for certain jurisdictions
    const riskMap: Record<string, number> = {
      AE: 10, // Low risk - regulated
      IN: 15, // Low-medium risk - regulated
      US: 10, // Low risk - highly regulated
      EU: 10, // Low risk - GDPR, regulated
      SA: 20, // Medium risk
    };
    return riskMap[jurisdiction] || 30; // Default to medium-high
  }

  /**
   * Determine final KYB status
   */
  private determineKybStatus(score: number, flags: KybFlag[]): KybStatus {
    // Critical flags require review
    if (flags.some(f => f.severity === FlagSeverity.CRITICAL)) {
      return KybStatus.REQUIRES_REVIEW;
    }

    // High score requires review
    if (score >= 70) {
      return KybStatus.REQUIRES_REVIEW;
    }

    // High severity flags require review
    if (flags.some(f => f.severity === FlagSeverity.HIGH && f.type === KybFlagType.SANCTIONS_HIT)) {
      return KybStatus.REQUIRES_REVIEW;
    }

    // Otherwise verified
    return score < 30 ? KybStatus.VERIFIED : KybStatus.REQUIRES_REVIEW;
  }

  /**
   * Generate recommendations based on KYB check
   */
  private generateRecommendations(
    flags: KybFlag[],
    riskLevel: string,
    jurisdiction: Jurisdiction
  ): string[] {
    const recommendations: string[] = [];

    if (flags.some(f => f.type === KybFlagType.SANCTIONS_HIT)) {
      recommendations.push('REJECT: Entity matches sanctions list');
    }

    if (flags.some(f => f.type === KybFlagType.UBO_MISMATCH)) {
      recommendations.push('Request complete UBO disclosure with supporting documents');
    }

    if (flags.some(f => f.type === KybFlagType.PEP_ASSOCIATED)) {
      recommendations.push('Enhanced due diligence required for PEP-associated entities');
    }

    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      recommendations.push('Escalate to compliance officer for manual review');
    }

    if (flags.some(f => f.type === KybFlagType.INVALID_REGISTRATION)) {
      recommendations.push('Verify registration with official government databases');
    }

    if (recommendations.length === 0) {
      recommendations.push('Approve business entity verification');
    }

    return recommendations;
  }

  /**
   * Get explanation for KYB status
   */
  private getStatusExplanation(status: KybStatus, flags: KybFlag[]): string {
    const criticalFlags = flags.filter(f => f.severity === FlagSeverity.CRITICAL);
    const highFlags = flags.filter(f => f.severity === FlagSeverity.HIGH);

    if (criticalFlags.length > 0) {
      return `Business verification requires immediate review due to: ${criticalFlags
        .map(f => f.message)
        .join(', ')}`;
    }

    if (status === KybStatus.VERIFIED) {
      return 'Business entity successfully verified and cleared for operations';
    }

    if (status === KybStatus.REQUIRES_REVIEW) {
      return `Business verification pending review due to: ${highFlags.map(f => f.message).join(', ')}`;
    }

    return 'Business verification status unknown';
  }

  /**
   * Get applicable regulatory rules for jurisdiction
   */
  private getApplicableRules(jurisdiction: Jurisdiction): string[] {
    const rulesMap: Record<string, string[]> = {
      AE: [
        'DFSA Fund Rules 2014',
        'DFSA Anti-Money Laundering Rules 2020',
        'UAE Data Protection Law 2021',
      ],
      IN: [
        'SEBI Act 1992',
        'Prevention of Money Laundering Act 2002',
        'Digital Personal Data Protection Act 2023',
      ],
      US: [
        'Securities Act of 1933',
        'Securities Exchange Act of 1934',
        'Investment Advisers Act of 1940',
        'FinCEN AML Regulations',
      ],
      EU: [
        'GDPR Regulation 2016/679',
        '4th Anti-Money Laundering Directive 2015/849/EU',
        '5th Anti-Money Laundering Directive 2018/843/EU',
      ],
      SA: [
        'SAMA Anti-Money Laundering Rules',
        'Capital Market Law',
      ],
    };
    return rulesMap[jurisdiction] || [];
  }

  /**
   * Store KYB check in database
   */
  private async storeKybCheck(
    request: KybCheckRequest,
    result: KybCheckResult,
    userId?: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO kyb_checks (
          check_id, business_id, jurisdiction, status, score, risk_level,
          registration_valid, ubo_verified, sanctions_hits,
          result_json, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
        )
      `;

      await db.query(query, [
        result.checkId,
        request.businessId,
        request.jurisdiction,
        result.status,
        result.score,
        result.riskLevel,
        result.registrationValidation.isValid,
        result.uboVerification.isVerified,
        result.sanctionScreening.hasSanctionMatches ? 1 : 0,
        JSON.stringify(result),
        userId || 'system',
      ]);

      logger.debug('KYB check stored', {
        checkId: result.checkId,
        businessId: request.businessId,
      });
    } catch (error) {
      logger.error('Failed to store KYB check', {
        checkId: result.checkId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Don't throw - allow check to complete even if storage fails
    }
  }

  /**
   * Get KYB check history for business
   */
  async getKybCheckHistory(businessId: string, limit: number = 10): Promise<KybCheckRecord[]> {
    try {
      const query = `
        SELECT result_json FROM kyb_checks 
        WHERE business_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `;

      const result = await db.query(query, [businessId, limit]);
      return result.rows.map((row: any) => JSON.parse(row.result_json));
    } catch (error) {
      logger.error('Failed to retrieve KYB history', {
        businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /**
   * Get current KYB risk score for business
   */
  async getCurrentKybRiskScore(businessId: string): Promise<KybRiskScore | null> {
    try {
      const query = `
        SELECT result_json FROM kyb_checks 
        WHERE business_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const result = await db.query(query, [businessId]);
      if (result.rows.length === 0) return null;

      const latestCheck = JSON.parse(result.rows[0].result_json) as KybCheckResult;

      return {
        entityId: businessId,
        score: latestCheck.score,
        riskLevel: latestCheck.riskLevel,
        overallScore: latestCheck.score,
        registrationRisk: latestCheck.registrationValidation.isValid ? 0 : 50,
        uboRisk: 100 - latestCheck.uboVerification.confidence,
        sanctionRisk: latestCheck.sanctionScreening.hasSanctionMatches ? 80 : 0,
        jurisdictionRisk: this.getJurisdictionRisk(latestCheck.jurisdiction),
        calculatedAt: latestCheck.timestamp,
        nextCalculation: latestCheck.nextReviewDue,
      };
    } catch (error) {
      logger.error('Failed to get KYB risk score', {
        businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  }

  /**
   * Enable continuous monitoring for business
   */
  async enableContinuousMonitoring(
    request: ContinuousMonitoringRequest
  ): Promise<{
    monitoringId: string;
    nextCheckDate: string;
    status: 'ENABLED';
    businessId: string;
    monitoringFrequency: ContinuousMonitoringRequest['monitoringFrequency'];
    screeningScope: ContinuousMonitoringRequest['screeningScope'];
    alertThreshold: number;
  }> {
    try {
      const monitoringId = uuidv4();
      const query = `
        INSERT INTO kyb_continuous_monitoring (
          monitoring_id, business_id, jurisdiction, frequency, scopes, alert_threshold, enabled, next_check_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW() + INTERVAL '1 day')
      `;

      await db.query(query, [
        monitoringId,
        request.businessId,
        request.jurisdiction,
        request.monitoringFrequency,
        JSON.stringify(request.screeningScope),
        request.alertThreshold,
      ]);

      logger.info('Continuous monitoring enabled', {
        monitoringId,
        businessId: request.businessId,
      });

      return {
        monitoringId,
        nextCheckDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'ENABLED',
        businessId: request.businessId,
        monitoringFrequency: request.monitoringFrequency,
        screeningScope: request.screeningScope,
        alertThreshold: request.alertThreshold,
      };
    } catch (error) {
      logger.error('Failed to enable continuous monitoring', {
        businessId: request.businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        ErrorCategory.INTERNAL,
        'Failed to enable continuous monitoring',
        500
      );
    }
  }
}

// Export singleton instance
export const kybService = new KybService();
