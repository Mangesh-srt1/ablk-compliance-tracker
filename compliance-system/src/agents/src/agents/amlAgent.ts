/**
 * AML Agent
 * Handles Anti-Money Laundering compliance checks
 */

import { BaseAgent } from './baseAgent';
import winston from 'winston';
import { ChainalysisClient } from '../tools/chainalysisClient';
import { OFACClient } from '../tools/ofacClient';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/aml-agent.log' }),
  ],
});

export interface AMLResult {
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
    chainalysisScore?: number;
    ofacHits?: any[];
    transactionPattern?: string;
    riskFactors?: string[];
  };
}

export class AMLAgent extends BaseAgent {
  private chainalysisClient: ChainalysisClient;
  private ofacClient: OFACClient;

  constructor(chainalysisClient: ChainalysisClient, ofacClient: OFACClient) {
    super('aml-agent');
    this.chainalysisClient = chainalysisClient;
    this.ofacClient = ofacClient;
  }

  /**
   * Execute AML check for a transaction
   */
  async check(transaction: any): Promise<AMLResult> {
    const startTime = Date.now();

    logger.info('Starting AML check', {
      transactionId: transaction.id,
      amount: transaction.amount,
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
    });

    try {
      const findings: AMLResult['findings'] = [];
      const recommendations: string[] = [];
      let riskScore = 0;

      // Check transaction amount thresholds
      const amountRisk = this.checkAmountThresholds(transaction.amount);
      if (amountRisk.score > 0) {
        findings.push(amountRisk.finding);
        riskScore += amountRisk.score;
      }

      // Check OFAC sanctions
      const ofacResult = await this.checkOFAC(transaction);
      if (ofacResult.hits.length > 0) {
        findings.push(...ofacResult.findings);
        riskScore += ofacResult.riskIncrease;
        recommendations.push(...ofacResult.recommendations);
      }

      // Check Chainalysis risk score
      const chainalysisResult = await this.checkChainalysis(transaction);
      if (chainalysisResult.score > 0.3) {
        findings.push(chainalysisResult.finding);
        riskScore += chainalysisResult.riskIncrease;
        recommendations.push(...chainalysisResult.recommendations);
      }

      // Analyze transaction patterns
      const patternResult = await this.analyzeTransactionPatterns(transaction);
      if (patternResult.riskScore > 0) {
        findings.push(...patternResult.findings);
        riskScore += patternResult.riskScore;
        recommendations.push(...patternResult.recommendations);
      }

      // Check for unusual activity
      const unusualActivity = await this.checkUnusualActivity(transaction);
      if (unusualActivity.detected) {
        findings.push(...unusualActivity.findings);
        riskScore += unusualActivity.riskIncrease;
        recommendations.push(...unusualActivity.recommendations);
      }

      // Determine overall status
      let status: AMLResult['status'] = 'approved';
      if (riskScore >= 0.8) {
        status = 'rejected';
      } else if (riskScore >= 0.4) {
        status = 'escalated';
      }

      const processingTime = Date.now() - startTime;

      logger.info('AML check completed', {
        transactionId: transaction.id,
        status,
        riskScore: Math.min(riskScore, 1.0),
        processingTime,
      });

      return {
        status,
        riskScore: Math.min(riskScore, 1.0),
        findings,
        recommendations,
        metadata: {
          chainalysisScore: chainalysisResult.score,
          ofacHits: ofacResult.hits,
          transactionPattern: patternResult.pattern,
          riskFactors: this.identifyRiskFactors(findings),
        },
      };
    } catch (error) {
      logger.error('AML check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.createEscalatedResult(
        `AML check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0.9
      );
    }
  }

  /**
   * Check transaction amount against AML thresholds
   */
  private checkAmountThresholds(amount: number): { score: number; finding?: any } {
    if (!amount || amount < 0) {
      return { score: 0 };
    }

    // SAR filing thresholds (simplified)
    if (amount >= 10000) {
      return {
        score: 0.3,
        finding: {
          type: 'amount_threshold',
          severity: 'medium',
          message: `Transaction amount $${amount} exceeds $10,000 threshold`,
          details: { amount, threshold: 10000 },
        },
      };
    }

    return { score: 0 };
  }

  /**
   * Check OFAC sanctions lists
   */
  private async checkOFAC(transaction: any): Promise<{
    hits: any[];
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
  }> {
    const hits = [];
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];

    try {
      // Check sender address
      if (transaction.fromAddress) {
        const fromResult = await this.ofacClient.checkAddress(transaction.fromAddress);
        if (fromResult.hit) {
          hits.push(fromResult);
          findings.push({
            type: 'ofac_sanctions',
            severity: 'critical',
            message: 'Sender address matches OFAC sanctions list',
            details: fromResult.details,
          });
          riskIncrease += 1.0;
          recommendations.push('Block transaction immediately');
        }
      }

      // Check receiver address
      if (transaction.toAddress) {
        const toResult = await this.ofacClient.checkAddress(transaction.toAddress);
        if (toResult.hit) {
          hits.push(toResult);
          findings.push({
            type: 'ofac_sanctions',
            severity: 'critical',
            message: 'Receiver address matches OFAC sanctions list',
            details: toResult.details,
          });
          riskIncrease += 1.0;
          recommendations.push('Block transaction immediately');
        }
      }

      // Check user information if available
      if (transaction.userId) {
        const userInfo = await this.getUserInfo(transaction.userId);
        if (userInfo) {
          const userResult = await this.ofacClient.checkEntity(userInfo.name, userInfo.country);
          if (userResult.hit) {
            hits.push(userResult);
            findings.push({
              type: 'ofac_sanctions',
              severity: 'critical',
              message: 'User matches OFAC sanctions list',
              details: userResult.details,
            });
            riskIncrease += 1.0;
            recommendations.push('Block transaction and freeze account');
          }
        }
      }
    } catch (error) {
      logger.error('OFAC check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      findings.push({
        type: 'ofac_check_error',
        severity: 'high',
        message: 'OFAC sanctions check failed',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      riskIncrease += 0.2;
      recommendations.push('Manual OFAC verification required');
    }

    return { hits, findings, riskIncrease, recommendations };
  }

  /**
   * Check Chainalysis risk score
   */
  private async checkChainalysis(transaction: any): Promise<{
    score: number;
    finding?: any;
    riskIncrease: number;
    recommendations: string[];
  }> {
    try {
      const score = await this.chainalysisClient.getAddressRiskScore(
        transaction.fromAddress || transaction.toAddress
      );

      if (score > 0.7) {
        return {
          score,
          finding: {
            type: 'chainalysis_risk',
            severity: 'high',
            message: `High Chainalysis risk score: ${(score * 100).toFixed(1)}%`,
            details: { score, address: transaction.fromAddress || transaction.toAddress },
          },
          riskIncrease: 0.6,
          recommendations: ['Enhanced due diligence required', 'Monitor transaction closely'],
        };
      } else if (score > 0.3) {
        return {
          score,
          finding: {
            type: 'chainalysis_risk',
            severity: 'medium',
            message: `Medium Chainalysis risk score: ${(score * 100).toFixed(1)}%`,
            details: { score, address: transaction.fromAddress || transaction.toAddress },
          },
          riskIncrease: 0.2,
          recommendations: ['Additional verification recommended'],
        };
      }

      return { score, riskIncrease: 0, recommendations: [] };
    } catch (error) {
      logger.error('Chainalysis check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        score: 0,
        finding: {
          type: 'chainalysis_error',
          severity: 'medium',
          message: 'Chainalysis risk assessment failed',
          details: { error: error instanceof Error ? error.message : String(error) },
        },
        riskIncrease: 0.1,
        recommendations: ['Manual risk assessment required'],
      };
    }
  }

  /**
   * Analyze transaction patterns for suspicious activity
   */
  private async analyzeTransactionPatterns(transaction: any): Promise<{
    pattern: string;
    riskScore: number;
    findings: any[];
    recommendations: string[];
  }> {
    const findings = [];
    const recommendations = [];
    let riskScore = 0;
    let pattern = 'normal';

    try {
      // Check for rapid succession transactions (smurfing)
      const recentTransactions = await this.getRecentUserTransactions(transaction.userId, 24); // Last 24 hours

      if (recentTransactions.length > 10) {
        pattern = 'high_frequency';
        findings.push({
          type: 'transaction_pattern',
          severity: 'medium',
          message: `High transaction frequency: ${recentTransactions.length} transactions in 24 hours`,
          details: { transactionCount: recentTransactions.length, timeWindow: '24h' },
        });
        riskScore += 0.3;
        recommendations.push('Review transaction frequency patterns');
      }

      // Check for round number amounts (structuring)
      if (this.isRoundNumber(transaction.amount)) {
        pattern = 'round_amounts';
        findings.push({
          type: 'transaction_pattern',
          severity: 'low',
          message: 'Transaction uses round number amount',
          details: { amount: transaction.amount },
        });
        riskScore += 0.1;
      }

      // Check for unusual timing (after hours)
      if (this.isUnusualTiming(transaction.timestamp)) {
        pattern = 'unusual_timing';
        findings.push({
          type: 'transaction_pattern',
          severity: 'low',
          message: 'Transaction occurred at unusual time',
          details: { timestamp: transaction.timestamp },
        });
        riskScore += 0.1;
      }
    } catch (error) {
      logger.error('Pattern analysis failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { pattern, riskScore, findings, recommendations };
  }

  /**
   * Check for unusual activity patterns
   */
  private async checkUnusualActivity(transaction: any): Promise<{
    detected: boolean;
    findings: any[];
    riskIncrease: number;
    recommendations: string[];
  }> {
    const findings = [];
    let riskIncrease = 0;
    const recommendations = [];

    try {
      // Check for first-time large transaction
      const userHistory = await this.getUserTransactionHistory(transaction.userId);
      const avgAmount = this.calculateAverageAmount(userHistory);

      if (transaction.amount > avgAmount * 5 && userHistory.length > 5) {
        findings.push({
          type: 'unusual_activity',
          severity: 'medium',
          message: `Transaction amount $${transaction.amount} is 5x higher than user's average`,
          details: { amount: transaction.amount, averageAmount: avgAmount },
        });
        riskIncrease += 0.3;
        recommendations.push('Verify transaction purpose');
      }

      // Check for geographic anomalies
      if (transaction.location) {
        const usualLocations = await this.getUserUsualLocations(transaction.userId);
        if (!usualLocations.includes(transaction.location)) {
          findings.push({
            type: 'unusual_activity',
            severity: 'low',
            message: 'Transaction from unusual geographic location',
            details: { location: transaction.location, usualLocations },
          });
          riskIncrease += 0.1;
          recommendations.push('Verify location authenticity');
        }
      }
    } catch (error) {
      logger.error('Unusual activity check failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      detected: findings.length > 0,
      findings,
      riskIncrease,
      recommendations,
    };
  }

  /**
   * Get user information for AML checks
   */
  private async getUserInfo(userId: string): Promise<any> {
    // This would query the database
    return {
      id: userId,
      name: 'John Doe',
      country: 'US',
    };
  }

  /**
   * Get recent transactions for pattern analysis
   */
  private async getRecentUserTransactions(userId: string, hours: number): Promise<any[]> {
    // This would query the database
    return [];
  }

  /**
   * Get user transaction history
   */
  private async getUserTransactionHistory(userId: string): Promise<any[]> {
    // This would query the database
    return [];
  }

  /**
   * Get user's usual transaction locations
   */
  private async getUserUsualLocations(userId: string): Promise<string[]> {
    // This would query the database
    return ['US', 'CA'];
  }

  /**
   * Check if amount is a round number
   */
  private isRoundNumber(amount: number): boolean {
    return amount % 1000 === 0 || amount % 10000 === 0;
  }

  /**
   * Check if transaction timing is unusual
   */
  private isUnusualTiming(timestamp: string): boolean {
    const date = new Date(timestamp);
    const hour = date.getHours();
    // Consider 2 AM - 6 AM as unusual
    return hour >= 2 && hour <= 6;
  }

  /**
   * Calculate average transaction amount
   */
  private calculateAverageAmount(transactions: any[]): number {
    if (transactions.length === 0) {
      return 0;
    }
    const sum = transactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);
    return sum / transactions.length;
  }

  /**
   * Identify risk factors from findings
   */
  private identifyRiskFactors(findings: any[]): string[] {
    const riskFactors = [];

    findings.forEach((finding) => {
      switch (finding.type) {
        case 'ofac_sanctions':
          riskFactors.push('sanctions');
          break;
        case 'chainalysis_risk':
          riskFactors.push('blockchain_risk');
          break;
        case 'amount_threshold':
          riskFactors.push('large_amount');
          break;
        case 'transaction_pattern':
          riskFactors.push('suspicious_pattern');
          break;
        case 'unusual_activity':
          riskFactors.push('unusual_activity');
          break;
      }
    });

    return [...new Set(riskFactors)]; // Remove duplicates
  }

  /**
   * Create escalated AML result
   */
  private createEscalatedResult(message: string, riskScore: number): AMLResult {
    return {
      status: 'escalated',
      riskScore,
      findings: [
        {
          type: 'aml_check',
          severity: 'high',
          message,
        },
      ],
      recommendations: ['Manual AML review required'],
      metadata: {},
    };
  }
}
