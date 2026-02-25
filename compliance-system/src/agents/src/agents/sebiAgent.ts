/**
 * SEBI Agent
 * Handles Securities and Exchange Board of India compliance checks
 */

import { BaseAgent } from './baseAgent';
import winston from 'winston';
import { SEBIClient } from '../tools/sebiClient';
import { BSEClient } from '../tools/bseClient';
import { NSEClient } from '../tools/nseClient';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/sebi-agent.log' })
  ]
});

export interface SEBIResult {
  status: 'approved' | 'rejected' | 'pending' | 'escalated';
  riskScore: number;
  findings: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
  }>;
  recommendations: string[];
  metadata: {
    sebiRegistration?: boolean;
    dematAccount?: boolean;
    tradingLimits?: any;
    insiderTrading?: boolean;
    marketManipulation?: boolean;
    complianceScore?: number;
  };
}

export class SEBIAgent extends BaseAgent {
  private sebiClient: SEBIClient;
  private bseClient: BSEClient;
  private nseClient: NSEClient;

  constructor(sebiClient: SEBIClient, bseClient: BSEClient, nseClient: NSEClient) {
    super('sebi-agent');
    this.sebiClient = sebiClient;
    this.bseClient = bseClient;
    this.nseClient = nseClient;
  }

  /**
   * Execute SEBI compliance check for a transaction
   */
  async check(transaction: any): Promise<SEBIResult> {
    const startTime = Date.now();

    logger.info('Starting SEBI compliance check', {
      transactionId: transaction.id,
      type: transaction.type,
      assetType: transaction.assetType,
      amount: transaction.amount
    });

    try {
      // Skip if not a securities transaction
      if (!this.isSecuritiesTransaction(transaction)) {
        return this.createApprovedResult('Non-securities transaction - SEBI check not required');
      }

      const findings: SEBIResult['findings'] = [];
      const recommendations: string[] = [];
      let riskScore = 0;

      // Check SEBI registration and compliance
      const registrationResult = await this.checkSEBIRegistration(transaction);
      if (!registrationResult.compliant) {
        findings.push(...registrationResult.findings);
        riskScore += registrationResult.riskIncrease;
        recommendations.push(...registrationResult.recommendations);
      }

      // Check demat account validity
      const dematResult = await this.checkDematAccount(transaction);
      if (!dematResult.valid) {
        findings.push(...dematResult.findings);
        riskScore += dematResult.riskIncrease;
        recommendations.push(...dematResult.recommendations);
      }

      // Check trading limits and exposure
      const limitsResult = await this.checkTradingLimits(transaction);
      if (!limitsResult.withinLimits) {
        findings.push(...limitsResult.findings);
        riskScore += limitsResult.riskIncrease;
        recommendations.push(...limitsResult.recommendations);
      }

      // Check for insider trading patterns
      const insiderResult = await this.checkInsiderTrading(transaction);
      if (insiderResult.detected) {
        findings.push(...insiderResult.findings);
        riskScore += insiderResult.riskIncrease;
        recommendations.push(...insiderResult.recommendations);
      }

      // Check for market manipulation
      const manipulationResult = await this.checkMarketManipulation(transaction);
      if (manipulationResult.detected) {
        findings.push(...manipulationResult.findings);
        riskScore += manipulationResult.riskIncrease;
        recommendations.push(...manipulationResult.recommendations);
      }

      // Check regulatory filings and disclosures
      const filingResult = await this.checkRegulatoryFilings(transaction);
      if (!filingResult.compliant) {
        findings.push(...filingResult.findings);
        riskScore += filingResult.riskIncrease;
        recommendations.push(...filingResult.recommendations);
      }

      // Determine overall status
      let status: SEBIResult['status'] = 'approved';
      if (riskScore >= 0.8) {
        status = 'rejected';
      } else if (riskScore >= 0.4) {
        status = 'escalated';
      }

      const processingTime = Date.now() - startTime;

      logger.info('SEBI compliance check completed', {
        transactionId: transaction.id,
        status,
        riskScore: Math.min(riskScore, 1.0),
        processingTime
      });

      return {
        status,
        riskScore: Math.min(riskScore, 1.0),
        findings,
        recommendations,
        metadata: {
          sebiRegistration: registrationResult.compliant,
          dematAccount: dematResult.valid,
          tradingLimits: limitsResult.limits,
          insiderTrading: insiderResult.detected,
          marketManipulation: manipulationResult.detected,
          complianceScore: this.calculateComplianceScore(findings)
        }
      };

    } catch (error) {
      logger.error('SEBI compliance check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createEscalatedResult(
        `SEBI check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0.9
      );
    }
  }

  /**
   * Check if transaction involves securities
   */
  private isSecuritiesTransaction(transaction: any): boolean {
    return transaction.type === 'security' ||
           transaction.assetType === 'equity' ||
           transaction.assetType === 'bond' ||
           transaction.assetType === 'derivative' ||
           transaction.assetType === 'mutual_fund' ||
           transaction.symbol?.match(/^[A-Z]{2,}\.NS$|^[A-Z]{2,}\.BO$/); // NSE/BSE symbols
  }

  /**
   * Check SEBI registration and intermediary compliance
   */
  private async checkSEBIRegistration(transaction: any): Promise<{
    compliant: boolean;
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
  }> {
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];
    let compliant = true;

    try {
      // Check if user/intermediary is SEBI registered
      const registrationStatus = await this.sebiClient.checkRegistration(transaction.userId);

      if (!registrationStatus.registered) {
        compliant = false;
        findings.push({
          type: 'sebi_registration',
          severity: 'critical',
          message: 'User/intermediary not registered with SEBI',
          details: registrationStatus.details
        });
        riskIncrease += 1.0;
        recommendations.push('Complete SEBI registration process');
      }

      // Check for disciplinary actions
      if (registrationStatus.disciplinaryActions?.length > 0) {
        compliant = false;
        findings.push({
          type: 'sebi_disciplinary',
          severity: 'high',
          message: 'SEBI disciplinary actions found',
          details: registrationStatus.disciplinaryActions
        });
        riskIncrease += 0.8;
        recommendations.push('Review disciplinary history');
      }

      // Check capital adequacy (for intermediaries)
      if (registrationStatus.capitalAdequacy < 0.8) {
        findings.push({
          type: 'capital_adequacy',
          severity: 'medium',
          message: `Capital adequacy below threshold: ${(registrationStatus.capitalAdequacy * 100).toFixed(1)}%`,
          details: { capitalAdequacy: registrationStatus.capitalAdequacy }
        });
        riskIncrease += 0.3;
        recommendations.push('Improve capital adequacy');
      }

    } catch (error) {
      logger.error('SEBI registration check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });

      compliant = false;
      findings.push({
        type: 'registration_check_error',
        severity: 'high',
        message: 'SEBI registration verification failed',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      riskIncrease += 0.4;
      recommendations.push('Manual SEBI registration verification required');
    }

    return { compliant, findings, riskIncrease, recommendations };
  }

  /**
   * Check demat account validity and status
   */
  private async checkDematAccount(transaction: any): Promise<{
    valid: boolean;
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
  }> {
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];
    let valid = true;

    try {
      const dematStatus = await this.sebiClient.checkDematAccount(transaction.dematAccountId || transaction.userId);

      if (!dematStatus.active) {
        valid = false;
        findings.push({
          type: 'demat_account',
          severity: 'critical',
          message: 'Demat account inactive or suspended',
          details: dematStatus.details
        });
        riskIncrease += 1.0;
        recommendations.push('Activate demat account');
      }

      // Check for transaction freeze
      if (dematStatus.frozen) {
        valid = false;
        findings.push({
          type: 'demat_freeze',
          severity: 'high',
          message: 'Demat account under transaction freeze',
          details: dematStatus.freezeDetails
        });
        riskIncrease += 0.9;
        recommendations.push('Resolve account freeze');
      }

      // Check KYC compliance
      if (!dematStatus.kycCompliant) {
        findings.push({
          type: 'demat_kyc',
          severity: 'medium',
          message: 'Demat account KYC not compliant',
          details: dematStatus.kycDetails
        });
        riskIncrease += 0.4;
        recommendations.push('Complete demat KYC requirements');
      }

    } catch (error) {
      logger.error('Demat account check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });

      valid = false;
      findings.push({
        type: 'demat_check_error',
        severity: 'high',
        message: 'Demat account verification failed',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      riskIncrease += 0.3;
      recommendations.push('Manual demat account verification required');
    }

    return { valid, findings, riskIncrease, recommendations };
  }

  /**
   * Check trading limits and position exposure
   */
  private async checkTradingLimits(transaction: any): Promise<{
    withinLimits: boolean;
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
    limits: any;
  }> {
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];
    let withinLimits = true;

    try {
      const limits = await this.sebiClient.getTradingLimits(transaction.userId);

      // Check position limits
      if (transaction.quantity > limits.maxPosition) {
        withinLimits = false;
        findings.push({
          type: 'position_limit',
          severity: 'high',
          message: `Position exceeds limit: ${transaction.quantity} > ${limits.maxPosition}`,
          details: { quantity: transaction.quantity, limit: limits.maxPosition }
        });
        riskIncrease += 0.6;
        recommendations.push('Reduce position size');
      }

      // Check daily turnover limits
      const dailyTurnover = await this.getUserDailyTurnover(transaction.userId);
      if (dailyTurnover + transaction.amount > limits.dailyTurnoverLimit) {
        withinLimits = false;
        findings.push({
          type: 'turnover_limit',
          severity: 'medium',
          message: `Daily turnover would exceed limit: ₹${(dailyTurnover + transaction.amount).toLocaleString()}`,
          details: {
            currentTurnover: dailyTurnover,
            transactionAmount: transaction.amount,
            limit: limits.dailyTurnoverLimit
          }
        });
        riskIncrease += 0.4;
        recommendations.push('Monitor daily turnover limits');
      }

      // Check concentration limits (single stock exposure)
      const concentration = await this.getStockConcentration(transaction.userId, transaction.symbol);
      if (concentration > limits.maxConcentration) {
        findings.push({
          type: 'concentration_limit',
          severity: 'medium',
          message: `Stock concentration exceeds limit: ${(concentration * 100).toFixed(1)}%`,
          details: { concentration, limit: limits.maxConcentration, symbol: transaction.symbol }
        });
        riskIncrease += 0.3;
        recommendations.push('Diversify portfolio');
      }

    } catch (error) {
      logger.error('Trading limits check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });

      withinLimits = false;
      findings.push({
        type: 'limits_check_error',
        severity: 'medium',
        message: 'Trading limits verification failed',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      riskIncrease += 0.2;
      recommendations.push('Manual limits verification required');
    }

    return { withinLimits, findings, riskIncrease, recommendations, limits };

  }

  /**
   * Check for insider trading patterns
   */
  private async checkInsiderTrading(transaction: any): Promise<{
    detected: boolean;
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
  }> {
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];
    let detected = false;

    try {
      // Check if user is an insider
      const insiderStatus = await this.sebiClient.checkInsiderStatus(transaction.userId);

      if (insiderStatus.isInsider) {
        detected = true;
        findings.push({
          type: 'insider_trading',
          severity: 'critical',
          message: 'Insider trading detected - user is designated as insider',
          details: insiderStatus.details
        });
        riskIncrease += 1.0;
        recommendations.push('Immediate regulatory reporting required');
      }

      // Check for unusual timing around corporate events
      const eventProximity = await this.checkCorporateEventProximity(transaction);
      if (eventProximity.close) {
        detected = true;
        findings.push({
          type: 'insider_timing',
          severity: 'high',
          message: 'Transaction timing close to corporate event',
          details: eventProximity.details
        });
        riskIncrease += 0.7;
        recommendations.push('Investigate transaction timing');
      }

      // Check for pattern of trading before price movements
      const pricePattern = await this.checkPriceMovementPattern(transaction);
      if (pricePattern.suspicious) {
        detected = true;
        findings.push({
          type: 'price_pattern',
          severity: 'medium',
          message: 'Trading pattern suggests potential insider activity',
          details: pricePattern.details
        });
        riskIncrease += 0.5;
        recommendations.push('Monitor for price manipulation');
      }

    } catch (error) {
      logger.error('Insider trading check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return { detected, findings, riskIncrease, recommendations };
  }

  /**
   * Check for market manipulation
   */
  private async checkMarketManipulation(transaction: any): Promise<{
    detected: boolean;
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
  }> {
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];
    let detected = false;

    try {
      // Check for wash trading
      const washTrade = await this.checkWashTrading(transaction);
      if (washTrade.detected) {
        detected = true;
        findings.push({
          type: 'market_manipulation',
          severity: 'critical',
          message: 'Wash trading pattern detected',
          details: washTrade.details
        });
        riskIncrease += 1.0;
        recommendations.push('Investigate for market manipulation');
      }

      // Check for spoofing
      const spoofing = await this.checkSpoofing(transaction);
      if (spoofing.detected) {
        detected = true;
        findings.push({
          type: 'market_manipulation',
          severity: 'high',
          message: 'Spoofing pattern detected',
          details: spoofing.details
        });
        riskIncrease += 0.8;
        recommendations.push('Monitor order book manipulation');
      }

      // Check for layering
      const layering = await this.checkLayering(transaction);
      if (layering.detected) {
        detected = true;
        findings.push({
          type: 'market_manipulation',
          severity: 'high',
          message: 'Layering pattern detected',
          details: layering.details
        });
        riskIncrease += 0.7;
        recommendations.push('Investigate order layering');
      }

    } catch (error) {
      logger.error('Market manipulation check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return { detected, findings, riskIncrease, recommendations };
  }

  /**
   * Check regulatory filings and disclosures
   */
  private async checkRegulatoryFilings(transaction: any): Promise<{
    compliant: boolean;
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
  }> {
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];
    let compliant = true;

    try {
      // Check for required disclosures
      const disclosures = await this.sebiClient.checkRequiredDisclosures(transaction.userId);

      if (disclosures.missing?.length > 0) {
        compliant = false;
        findings.push({
          type: 'regulatory_filings',
          severity: 'high',
          message: 'Required regulatory disclosures missing',
          details: { missing: disclosures.missing }
        });
        riskIncrease += 0.6;
        recommendations.push('Complete required disclosures');
      }

      // Check filing timeliness
      if (disclosures.overdue?.length > 0) {
        compliant = false;
        findings.push({
          type: 'filing_timeliness',
          severity: 'medium',
          message: 'Regulatory filings overdue',
          details: { overdue: disclosures.overdue }
        });
        riskIncrease += 0.4;
        recommendations.push('Submit overdue filings immediately');
      }

    } catch (error) {
      logger.error('Regulatory filings check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });

      compliant = false;
      findings.push({
        type: 'filings_check_error',
        severity: 'medium',
        message: 'Regulatory filings verification failed',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      riskIncrease += 0.2;
      recommendations.push('Manual filings verification required');
    }

    return { compliant, findings, riskIncrease, recommendations };
  }

  /**
   * Helper methods for various checks
   */
  private async getUserDailyTurnover(userId: string): Promise<number> {
    // This would query the database for today's turnover
    return 500000; // Mock value
  }

  private async getStockConcentration(userId: string, symbol: string): Promise<number> {
    // This would calculate portfolio concentration
    return 0.15; // Mock value
  }

  private async checkCorporateEventProximity(transaction: any): Promise<{ close: boolean; details: any }> {
    // Check proximity to earnings, dividends, etc.
    return { close: false, details: {} };
  }

  private async checkPriceMovementPattern(transaction: any): Promise<{ suspicious: boolean; details: any }> {
    // Analyze price movements before/after transactions
    return { suspicious: false, details: {} };
  }

  private async checkWashTrading(transaction: any): Promise<{ detected: boolean; details: any }> {
    // Check for wash trading patterns
    return { detected: false, details: {} };
  }

  private async checkSpoofing(transaction: any): Promise<{ detected: boolean; details: any }> {
    // Check for spoofing patterns
    return { detected: false, details: {} };
  }

  private async checkLayering(transaction: any): Promise<{ detected: boolean; details: any }> {
    // Check for layering patterns
    return { detected: false, details: {} };
  }

  /**
   * Calculate overall compliance score
   */
  private calculateComplianceScore(findings: any[]): number {
    if (findings.length === 0) return 1.0;

    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0
    };

    const totalWeight = findings.reduce((sum, finding) =>
      sum + severityWeights[finding.severity], 0);

    return Math.max(0, 1.0 - (totalWeight / findings.length));
  }

  /**
   * Create approved SEBI result
   */
  private createApprovedResult(message: string): SEBIResult {
    return {
      status: 'approved',
      riskScore: 0.0,
      findings: [{
        type: 'sebi_check',
        severity: 'low',
        message
      }],
      recommendations: [],
      metadata: {}
    };
  }

  /**
   * Create escalated SEBI result
   */
  private createEscalatedResult(message: string, riskScore: number): SEBIResult {
    return {
      status: 'escalated',
      riskScore,
      findings: [{
        type: 'sebi_check',
        severity: 'high',
        message
      }],
      recommendations: ['Manual SEBI compliance review required'],
      metadata: {}
    };
  }
}