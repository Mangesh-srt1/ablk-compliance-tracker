/**
 * KYC Service
 * Handles Know Your Customer verification across multiple jurisdictions
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import {
  Jurisdiction,
  KycStatus,
  KycFlagType,
  FlagSeverity,
  KycCheckRequest,
  KycCheckResult,
  KycCheckRecord,
  KycDocument,
  KycEntityData,
  KycFlag,
} from '../types/kyc';
import SqlLoader from '../utils/sqlLoader';
import db from '../config/database';
import { AppError, ErrorCode, ErrorCategory } from '../types/errors';
import { kycProviderManager } from './providers/kycProviderManager';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kyc.log' }),
  ],
});

export class KycService {
  private sqlLoader: SqlLoader;

  constructor() {
    this.sqlLoader = SqlLoader.getInstance();
  }

  /**
   * Perform KYC check for an entity
   */
  async performKycCheck(request: KycCheckRequest, userId?: string): Promise<KycCheckResult> {
    const startTime = Date.now();
    const checkId = uuidv4();

    try {
      logger.info('Starting KYC check', {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
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

      // Perform jurisdiction-specific KYC validation
      const result = await this.performJurisdictionCheck(request, checkId);

      // Store the check result
      await this.storeKycCheck(request, result, userId);

      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;

      logger.info('KYC check completed', {
        checkId,
        entityId: request.entityId,
        status: result.status,
        score: result.score,
        processingTime,
      });

      return result;
    } catch (error) {
      logger.error('KYC check failed', {
        checkId,
        entityId: request.entityId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        ErrorCategory.INTERNAL,
        'KYC check processing failed',
        500
      );
    }
  }

  /**
   * Perform jurisdiction-specific KYC validation
   */
  private async performJurisdictionCheck(
    request: KycCheckRequest,
    checkId: string
  ): Promise<KycCheckResult> {
    let flags: KycFlag[] = [];
    let score = 100; // Start with perfect score
    let status = KycStatus.PASS;

    switch (request.jurisdiction) {
      case Jurisdiction.INDIA:
        ({ flags, score, status } = await this.performIndiaKyc(request));
        break;

      case Jurisdiction.EUROPEAN_UNION:
        ({ flags, score, status } = await this.performEuKyc(request));
        break;

      case Jurisdiction.UNITED_STATES:
        ({ flags, score, status } = await this.performUsKyc(request));
        break;
    }

    // Generate recommendations based on flags
    const recommendations = this.generateRecommendations(flags, request.jurisdiction);

    return {
      checkId,
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      status,
      score,
      flags,
      recommendations,
      processingTime: 0, // Will be set by caller
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Perform India-specific KYC validation (SEBI/DPDP compliance)
   */
  private async performIndiaKyc(request: KycCheckRequest): Promise<{
    flags: KycFlag[];
    score: number;
    status: KycStatus;
  }> {
    const flags: KycFlag[] = [];
    let score = 100;

    // Check for Aadhaar document
    const aadhaarDoc = request.documents.find((doc) => doc.type === 'aadhaar');
    if (!aadhaarDoc) {
      flags.push({
        type: KycFlagType.DOCUMENT_INVALID,
        severity: FlagSeverity.HIGH,
        message: 'Aadhaar document required for Indian KYC',
        details: 'SEBI regulations require Aadhaar verification for KYC',
      });
      score -= 30;
    }

    // Validate entity data
    if (!request.entityData.dateOfBirth) {
      flags.push({
        type: KycFlagType.DOCUMENT_INVALID,
        severity: FlagSeverity.MEDIUM,
        message: 'Date of birth required',
        details: 'Required for age verification under DPDP',
      });
      score -= 15;
    }

    // Check age (must be 18+)
    if (request.entityData.dateOfBirth) {
      const age = this.calculateAge(request.entityData.dateOfBirth);
      if (age < 18) {
        flags.push({
          type: KycFlagType.AGE_UNDERAGE,
          severity: FlagSeverity.CRITICAL,
          message: 'Entity underage',
          details: `Age ${age} is below minimum requirement of 18`,
        });
        score -= 50;
      }
    }

    // DPDP compliance checks
    if (!request.entityData.address) {
      flags.push({
        type: KycFlagType.DOCUMENT_INVALID,
        severity: FlagSeverity.MEDIUM,
        message: 'Address information required',
        details: 'DPDP requires complete address for data processing consent',
      });
      score -= 10;
    }

    const status =
      score >= 70 ? KycStatus.PASS : score >= 40 ? KycStatus.REQUIRES_REVIEW : KycStatus.FAIL;

    return { flags, score: Math.max(0, score), status };
  }

  /**
   * Perform EU-specific KYC validation (GDPR/eIDAS compliance)
   */
  private async performEuKyc(request: KycCheckRequest): Promise<{
    flags: KycFlag[];
    score: number;
    status: KycStatus;
  }> {
    const flags: KycFlag[] = [];
    let score = 100;

    // Check for valid EU ID documents
    const validDocs = request.documents.filter((doc) =>
      ['passport', 'national_id', 'drivers_license'].includes(doc.type)
    );

    if (validDocs.length === 0) {
      flags.push({
        type: KycFlagType.DOCUMENT_INVALID,
        severity: FlagSeverity.HIGH,
        message: 'Valid EU identity document required',
        details: 'eIDAS regulation requires electronic identification',
      });
      score -= 25;
    }

    // GDPR consent validation
    if (!request.entityData.email) {
      flags.push({
        type: KycFlagType.DOCUMENT_INVALID,
        severity: FlagSeverity.MEDIUM,
        message: 'Email address required for GDPR consent',
        details: 'GDPR requires explicit consent for data processing',
      });
      score -= 15;
    }

    // Age verification for EU
    if (request.entityData.dateOfBirth) {
      const age = this.calculateAge(request.entityData.dateOfBirth);
      if (age < 16) {
        flags.push({
          type: KycFlagType.AGE_UNDERAGE,
          severity: FlagSeverity.CRITICAL,
          message: 'Entity underage for EU regulations',
          details: `Age ${age} is below GDPR minimum of 16`,
        });
        score -= 40;
      }
    }

    const status =
      score >= 75 ? KycStatus.PASS : score >= 50 ? KycStatus.REQUIRES_REVIEW : KycStatus.FAIL;

    return { flags, score: Math.max(0, score), status };
  }

  /**
   * Perform US-specific KYC validation (FinCEN/CDD compliance)
   */
  private async performUsKyc(request: KycCheckRequest): Promise<{
    flags: KycFlag[];
    score: number;
    status: KycStatus;
  }> {
    const flags: KycFlag[] = [];
    let score = 100;

    // Check for valid US ID documents
    const validDocs = request.documents.filter((doc) =>
      ['passport', 'drivers_license'].includes(doc.type)
    );

    if (validDocs.length === 0) {
      flags.push({
        type: KycFlagType.DOCUMENT_INVALID,
        severity: FlagSeverity.HIGH,
        message: 'Valid US identity document required',
        details: 'FinCEN CDD requires government-issued photo ID',
      });
      score -= 20;
    }

    // Enhanced due diligence for US
    if (!request.entityData.address || !request.entityData.occupation) {
      flags.push({
        type: KycFlagType.DOCUMENT_INVALID,
        severity: FlagSeverity.MEDIUM,
        message: 'Complete entity information required',
        details: 'US CDD requires comprehensive customer information',
      });
      score -= 15;
    }

    // Age verification
    if (request.entityData.dateOfBirth) {
      const age = this.calculateAge(request.entityData.dateOfBirth);
      if (age < 18) {
        flags.push({
          type: KycFlagType.AGE_UNDERAGE,
          severity: FlagSeverity.CRITICAL,
          message: 'Entity underage',
          details: `Age ${age} is below US legal minimum of 18`,
        });
        score -= 45;
      }
    }

    const status =
      score >= 70 ? KycStatus.PASS : score >= 40 ? KycStatus.REQUIRES_REVIEW : KycStatus.FAIL;

    return { flags, score: Math.max(0, score), status };
  }

  /**
   * Generate recommendations based on flags and jurisdiction
   */
  private generateRecommendations(flags: KycFlag[], jurisdiction: Jurisdiction): string[] {
    const recommendations: string[] = [];

    // Jurisdiction-specific recommendations
    switch (jurisdiction) {
      case Jurisdiction.INDIA:
        if (flags.some((f) => f.type === KycFlagType.AGE_UNDERAGE)) {
          recommendations.push('Entity cannot be onboarded until reaching legal age (18+)');
        }
        if (flags.some((f) => f.type === KycFlagType.DOCUMENT_INVALID)) {
          recommendations.push('Submit valid Aadhaar card for SEBI compliance');
        }
        break;

      case Jurisdiction.EUROPEAN_UNION:
        if (flags.some((f) => f.type === KycFlagType.AGE_UNDERAGE)) {
          recommendations.push('Entity cannot be processed under GDPR until age 16');
        }
        if (flags.some((f) => f.type === KycFlagType.DOCUMENT_INVALID)) {
          recommendations.push('Submit eIDAS-compliant electronic identification');
        }
        break;

      case Jurisdiction.UNITED_STATES:
        if (flags.some((f) => f.type === KycFlagType.AGE_UNDERAGE)) {
          recommendations.push('Entity cannot be onboarded until reaching legal age (18+)');
        }
        if (flags.some((f) => f.type === KycFlagType.DOCUMENT_INVALID)) {
          recommendations.push('Submit government-issued photo ID for FinCEN CDD');
        }
        break;
    }

    // General recommendations
    if (flags.some((f) => f.severity === FlagSeverity.CRITICAL)) {
      recommendations.push('Immediate compliance review required');
    }

    if (flags.some((f) => f.severity === FlagSeverity.HIGH)) {
      recommendations.push('Enhanced due diligence recommended');
    }

    return recommendations;
  }

  /**
   * Store KYC check result in database
   */
  private async storeKycCheck(
    request: KycCheckRequest,
    result: KycCheckResult,
    userId?: string
  ): Promise<void> {
    const query = this.sqlLoader.getQuery('kyc_checks/insert_kyc_check');

    await db.query(query, [
      request.entityId,
      request.jurisdiction,
      result.status,
      result.score,
      JSON.stringify(result.flags),
      JSON.stringify(result.recommendations),
      JSON.stringify(request.documents),
      JSON.stringify(request.entityData),
      result.processingTime,
      userId || null,
    ]);
  }

  /**
   * Get KYC check by ID
   */
  async getKycCheck(checkId: string): Promise<KycCheckRecord | null> {
    const query = this.sqlLoader.getQuery('kyc_checks/get_kyc_check');

    const result = await db.query(query, [checkId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      flags: row.flags || [],
      recommendations: row.recommendations || [],
      documents: row.documents || [],
      entityData: row.entity_data || {},
    };
  }

  /**
   * Perform KYC verification using external providers
   */
  async performProviderKycCheck(
    request: KycCheckRequest,
    userId?: string
  ): Promise<KycCheckResult> {
    const checkId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Starting external provider KYC check', {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        userId,
      });

      // Convert internal request to provider format
      const providerRequest = {
        entityId: request.entityId,
        jurisdiction: request.jurisdiction as 'IN' | 'EU' | 'US',
        documents: (request.documents || []).map((doc) => ({
          type: doc.type,
          data: doc.data,
          filename: doc.metadata.filename,
          contentType: doc.metadata.contentType,
        })),
        entityData: {
          name: request.entityData?.name || '',
          dateOfBirth: request.entityData?.dateOfBirth,
          address: request.entityData?.address,
          phoneNumber: request.entityData?.phoneNumber,
          email: request.entityData?.email,
        },
      };

      // Perform verification with external provider
      const providerResult = await kycProviderManager.verify(providerRequest);

      // Convert provider result to internal format
      const flags: KycFlag[] = providerResult.flags.map((flag) => ({
        type: flag.type as KycFlagType,
        severity: flag.severity as FlagSeverity,
        message: flag.message,
        details: flag.details,
      }));

      const status = providerResult.verified
        ? KycStatus.PASS
        : flags.some((f) => f.severity === 'CRITICAL')
          ? KycStatus.FAIL
          : KycStatus.REQUIRES_REVIEW;

      const score = Math.round(providerResult.confidence * 100);

      const result: KycCheckResult = {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        status,
        score,
        flags,
        recommendations: [],
        processingTime: providerResult.processingTime,
        timestamp: new Date().toISOString(),
        providerResponse: providerResult,
      };

      // Store successful check result
      await this.storeKycCheck(request, result, userId);

      logger.info('External provider KYC check completed', {
        checkId,
        entityId: request.entityId,
        status: result.status,
        score: result.score,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      logger.error('External provider KYC check failed', {
        checkId,
        entityId: request.entityId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        ErrorCategory.INTERNAL,
        'KYC provider verification failed',
        500
      );
    }
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): number {
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }
}
