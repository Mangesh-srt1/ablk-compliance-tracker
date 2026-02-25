/**
 * AML Service
 * Handles Anti-Money Laundering risk scoring and sanctions screening
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import {
  Jurisdiction,
  AmlRiskLevel,
  AmlFlagType,
  ScreeningResult,
  AmlCheckRequest,
  AmlCheckResult,
  AmlCheckRecord,
  AmlTransaction,
  AmlEntityData,
  AmlFlag,
  ScreeningResults
} from '../types/aml';
import SqlLoader from '../utils/sqlLoader';
import db from '../config/database';
import { AppError, ErrorCode, ErrorCategory } from '../types/errors';
import { amlProviderManager } from './providers/amlProviderManager';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/aml.log' })
  ]
});

export class AmlService {
  private sqlLoader: SqlLoader;
  private amlProviderManager = amlProviderManager;

  constructor() {
    this.sqlLoader = SqlLoader.getInstance();
  }

  /**
   * Perform AML check for an entity
   */
  async performAmlCheck(
    request: AmlCheckRequest,
    userId?: string
  ): Promise<AmlCheckResult> {
    const startTime = Date.now();
    const checkId = uuidv4();

    try {
      logger.info('Starting AML check', {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        transactionCount: request.transactions.length,
        userId
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

      // Perform sanctions screening
      const screeningResults = await this.performSanctionsScreening(request);

      // Analyze transaction patterns
      const transactionFlags = this.analyzeTransactionPatterns(request.transactions);

      // Calculate overall risk score
      const { score, riskLevel, flags } = this.calculateRiskScore(
        request,
        screeningResults,
        transactionFlags
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(flags, riskLevel, request.jurisdiction);

      const result: AmlCheckResult = {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        score,
        riskLevel,
        flags,
        recommendations,
        screeningResults,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      // Store the check result
      await this.storeAmlCheck(request, result, userId);

      logger.info('AML check completed', {
        checkId,
        entityId: request.entityId,
        score,
        riskLevel,
        flagCount: flags.length,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      logger.error('AML check failed', {
        checkId,
        entityId: request.entityId,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        ErrorCategory.INTERNAL,
        'AML check processing failed',
        500
      );
    }
  }

  /**
   * Perform AML check using external providers
   */
  async performProviderAmlCheck(
    request: AmlCheckRequest,
    userId?: string
  ): Promise<AmlCheckResult> {
    const checkId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Starting external provider AML check', {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        userId
      });

      // Perform comprehensive AML check using provider manager
      const result = await this.amlProviderManager.performAmlCheck(request);

      // Store successful check result
      await this.storeAmlCheck(request, result, userId);

      const duration = Date.now() - startTime;
      logger.info('External provider AML check completed successfully', {
        checkId,
        entityId: request.entityId,
        score: result.score,
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('External provider AML check failed', {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      // Create failed result
      const failedResult: AmlCheckResult = {
        checkId,
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        score: 0,
        riskLevel: AmlRiskLevel.LOW,
        flags: [],
        recommendations: [],
        screeningResults: {
          ofac: ScreeningResult.CLEAR,
          euSanctions: ScreeningResult.CLEAR,
          pep: ScreeningResult.CLEAR
        },
        processingTime: duration,
        timestamp: new Date().toISOString()
      };

      // Store failed check
      await this.storeAmlCheck(request, failedResult, userId);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorCategory.EXTERNAL_SERVICE,
        'External AML provider check failed',
        503
      );
    }
  }

  /**
   * Perform sanctions screening against multiple lists
   */
  private async performSanctionsScreening(request: AmlCheckRequest): Promise<ScreeningResults> {
    const results: ScreeningResults = {
      ofac: ScreeningResult.CLEAR,
      euSanctions: ScreeningResult.CLEAR,
      pep: ScreeningResult.CLEAR
    };

    try {
      // OFAC screening (US sanctions)
      results.ofac = await this.screenAgainstOfac(request.entityData.name);

      // EU sanctions screening
      results.euSanctions = await this.screenAgainstEuSanctions(request.entityData.name);

      // PEP screening
      results.pep = await this.screenAgainstPep(request.entityData);

    } catch (error) {
      logger.warn('Sanctions screening error', {
        entityId: request.entityId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Mark as error but don't fail the entire check
      results.ofac = ScreeningResult.ERROR;
      results.euSanctions = ScreeningResult.ERROR;
      results.pep = ScreeningResult.ERROR;
    }

    return results;
  }

  /**
   * Screen against OFAC sanctions list
   */
  private async screenAgainstOfac(name: string): Promise<ScreeningResult> {
    // Mock implementation - in production, this would call OFAC API or local database
    const ofacList = [
      'John Doe',
      'Jane Smith',
      'Robert Johnson'
    ];

    const normalizedName = name.toLowerCase().trim();
    const hasMatch = ofacList.some(entry => entry.toLowerCase().includes(normalizedName));

    return hasMatch ? ScreeningResult.HIT : ScreeningResult.CLEAR;
  }

  /**
   * Screen against EU sanctions list
   */
  private async screenAgainstEuSanctions(name: string): Promise<ScreeningResult> {
    // Mock implementation - in production, this would call EU sanctions API
    const euList = [
      'Vladimir Putin',
      'Alexei Navalny',
      'Maria Ivanov'
    ];

    const normalizedName = name.toLowerCase().trim();
    const hasMatch = euList.some(entry => entry.toLowerCase().includes(normalizedName));

    return hasMatch ? ScreeningResult.HIT : ScreeningResult.CLEAR;
  }

  /**
   * Screen against PEP (Politically Exposed Persons) database
   */
  private async screenAgainstPep(entityData: AmlEntityData): Promise<ScreeningResult> {
    // Mock implementation - in production, this would call PEP database API
    const pepIndicators = [
      'president',
      'minister',
      'governor',
      'senator',
      'ambassador'
    ];

    const occupation = entityData.occupation?.toLowerCase() || '';
    const hasPepOccupation = pepIndicators.some(indicator => occupation.includes(indicator));

    return hasPepOccupation ? ScreeningResult.HIT : ScreeningResult.CLEAR;
  }

  /**
   * Analyze transaction patterns for suspicious activity
   */
  private analyzeTransactionPatterns(transactions: AmlTransaction[]): AmlFlag[] {
    const flags: AmlFlag[] = [];

    if (transactions.length === 0) {
      return flags;
    }

    // Check for large transactions
    const largeTransactions = transactions.filter(tx => tx.amount > 10000);
    if (largeTransactions.length > 0) {
      flags.push({
        type: AmlFlagType.LARGE_TRANSACTION,
        severity: 'MEDIUM',
        message: 'Large value transactions detected',
        details: `${largeTransactions.length} transactions over $10,000`,
        evidence: largeTransactions.map(tx => ({ id: tx.id, amount: tx.amount, currency: tx.currency }))
      });
    }

    // Check for frequent transactions
    const recentTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.timestamp);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return txDate >= thirtyDaysAgo;
    });

    if (recentTransactions.length > 20) {
      flags.push({
        type: AmlFlagType.FREQUENT_TRANSACTIONS,
        severity: 'MEDIUM',
        message: 'High frequency of transactions',
        details: `${recentTransactions.length} transactions in last 30 days`,
        evidence: { transactionCount: recentTransactions.length, period: '30 days' }
      });
    }

    // Check for round number transactions (structuring indicator)
    const roundNumberTransactions = transactions.filter(tx => {
      const amount = tx.amount;
      return amount % 1000 === 0 && amount >= 9000 && amount <= 11000;
    });

    if (roundNumberTransactions.length > 3) {
      flags.push({
        type: AmlFlagType.ROUND_NUMBER_TRANSACTIONS,
        severity: 'HIGH',
        message: 'Pattern of round number transactions',
        details: 'Multiple transactions in $9,000-$11,000 range (structuring indicator)',
        evidence: roundNumberTransactions.map(tx => ({ id: tx.id, amount: tx.amount }))
      });
    }

    // Check for unusual transaction patterns
    const transactionTypes = transactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalTransactions = transactions.length;
    const dominantType = Object.entries(transactionTypes)
      .sort(([,a], [,b]) => b - a)[0];

    if (dominantType && dominantType[1] / totalTransactions > 0.8) {
      flags.push({
        type: AmlFlagType.UNUSUAL_TRANSACTION_PATTERN,
        severity: 'LOW',
        message: 'Unusual transaction pattern detected',
        details: `${dominantType[0]} transactions dominate ${((dominantType[1] / totalTransactions) * 100).toFixed(1)}% of activity`,
        evidence: transactionTypes
      });
    }

    return flags;
  }

  /**
   * Calculate overall risk score based on screening results and transaction analysis
   */
  private calculateRiskScore(
    request: AmlCheckRequest,
    screeningResults: ScreeningResults,
    transactionFlags: AmlFlag[]
  ): { score: number; riskLevel: AmlRiskLevel; flags: AmlFlag[] } {
    let score = 100; // Start with low risk
    const flags: AmlFlag[] = [...transactionFlags];

    // Sanctions hits have highest impact
    if (screeningResults.ofac === ScreeningResult.HIT) {
      flags.push({
        type: AmlFlagType.SANCTIONS_MATCH,
        severity: 'CRITICAL',
        message: 'OFAC sanctions list match',
        details: 'Entity appears on US Office of Foreign Assets Control sanctions list'
      });
      score -= 50;
    }

    if (screeningResults.euSanctions === ScreeningResult.HIT) {
      flags.push({
        type: AmlFlagType.SANCTIONS_MATCH,
        severity: 'CRITICAL',
        message: 'EU sanctions list match',
        details: 'Entity appears on European Union sanctions list'
      });
      score -= 50;
    }

    if (screeningResults.pep === ScreeningResult.HIT) {
      flags.push({
        type: AmlFlagType.PEP_MATCH,
        severity: 'HIGH',
        message: 'Politically Exposed Person match',
        details: 'Entity identified as Politically Exposed Person'
      });
      score -= 30;
    }

    // High-risk country check
    const highRiskCountries = ['North Korea', 'Iran', 'Syria', 'Venezuela'];
    if (highRiskCountries.includes(request.entityData.country)) {
      flags.push({
        type: AmlFlagType.HIGH_RISK_COUNTRY,
        severity: 'HIGH',
        message: 'High-risk country of origin',
        details: `${request.entityData.country} is classified as high-risk jurisdiction`
      });
      score -= 25;
    }

    // Transaction pattern flags impact
    transactionFlags.forEach(flag => {
      switch (flag.severity) {
        case 'CRITICAL':
          score -= 20;
          break;
        case 'HIGH':
          score -= 15;
          break;
        case 'MEDIUM':
          score -= 10;
          break;
        case 'LOW':
          score -= 5;
          break;
      }
    });

    // Determine risk level
    let riskLevel: AmlRiskLevel;
    if (score >= 80) {
      riskLevel = AmlRiskLevel.LOW;
    } else if (score >= 60) {
      riskLevel = AmlRiskLevel.MEDIUM;
    } else if (score >= 40) {
      riskLevel = AmlRiskLevel.HIGH;
    } else {
      riskLevel = AmlRiskLevel.CRITICAL;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      riskLevel,
      flags
    };
  }

  /**
   * Generate recommendations based on flags and risk level
   */
  private generateRecommendations(
    flags: AmlFlag[],
    riskLevel: AmlRiskLevel,
    jurisdiction: Jurisdiction
  ): string[] {
    const recommendations: string[] = [];

    // Critical sanctions hits
    if (flags.some(f => f.type === AmlFlagType.SANCTIONS_MATCH)) {
      recommendations.push('Immediately freeze all accounts and assets');
      recommendations.push('Report to relevant authorities within 24 hours');
      recommendations.push('Do not process any transactions for this entity');
    }

    // PEP matches
    if (flags.some(f => f.type === AmlFlagType.PEP_MATCH)) {
      recommendations.push('Apply enhanced due diligence procedures');
      recommendations.push('Obtain source of funds documentation');
      recommendations.push('Monitor transactions closely for 12 months');
    }

    // High-risk patterns
    if (flags.some(f => f.type === AmlFlagType.ROUND_NUMBER_TRANSACTIONS)) {
      recommendations.push('Investigate for potential structuring activity');
      recommendations.push('File Suspicious Activity Report if required');
    }

    // Risk level based recommendations
    switch (riskLevel) {
      case AmlRiskLevel.CRITICAL:
        recommendations.push('Immediate compliance review and escalation required');
        break;
      case AmlRiskLevel.HIGH:
        recommendations.push('Enhanced monitoring and due diligence required');
        break;
      case AmlRiskLevel.MEDIUM:
        recommendations.push('Regular monitoring of transaction activity');
        break;
    }

    // Jurisdiction-specific recommendations
    switch (jurisdiction) {
      case Jurisdiction.INDIA:
        recommendations.push('Ensure compliance with PMLA (Prevention of Money Laundering Act)');
        break;
      case Jurisdiction.EUROPEAN_UNION:
        recommendations.push('Comply with EU AML Directive requirements');
        break;
      case Jurisdiction.UNITED_STATES:
        recommendations.push('File SAR with FinCEN if suspicious activity confirmed');
        break;
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Store AML check result in database
   */
  private async storeAmlCheck(
    request: AmlCheckRequest,
    result: AmlCheckResult,
    userId?: string
  ): Promise<void> {
    const query = this.sqlLoader.getQuery('aml_checks/insert_aml_check');

    await db.query(query, [
      request.entityId,
      request.jurisdiction,
      result.score,
      result.riskLevel,
      JSON.stringify(result.flags),
      JSON.stringify(result.recommendations),
      JSON.stringify(request.transactions),
      JSON.stringify(request.entityData),
      JSON.stringify(result.screeningResults),
      result.processingTime,
      userId || null
    ]);
  }

  /**
   * Get AML check by ID
   */
  async getAmlCheck(checkId: string): Promise<AmlCheckRecord | null> {
    const query = this.sqlLoader.getQuery('aml_checks/get_aml_check');

    const result = await db.query(query, [checkId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      flags: row.flags || [],
      recommendations: row.recommendations || [],
      transactions: row.transactions || [],
      entityData: row.entity_data || {},
      screeningResults: row.screening_results || {}
    };
  }
}