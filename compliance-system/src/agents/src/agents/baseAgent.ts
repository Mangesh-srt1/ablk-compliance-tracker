/**
 * Base Agent
 * Abstract base class for all compliance agents
 */

import winston from 'winston';

export abstract class BaseAgent {
  protected name: string;
  protected logger: winston.Logger;

  constructor(name: string) {
    this.name = name;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `logs/${name}.log` })
      ]
    });
  }

  /**
   * Abstract method to be implemented by concrete agents
   */
  abstract check(transaction: any): Promise<any>;

  /**
   * Get agent name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Log agent activity
   */
  protected logActivity(level: string, message: string, meta?: any): void {
    this.logger.log(level as any, `[${this.name}] ${message}`, meta);
  }

  /**
   * Validate transaction data
   */
  protected validateTransaction(transaction: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!transaction) {
      errors.push('Transaction is null or undefined');
      return { valid: false, errors };
    }

    if (!transaction.id) {
      errors.push('Transaction ID is required');
    }

    if (!transaction.type) {
      errors.push('Transaction type is required');
    }

    if (transaction.amount !== undefined && typeof transaction.amount !== 'number') {
      errors.push('Transaction amount must be a number');
    }

    if (transaction.amount !== undefined && transaction.amount < 0) {
      errors.push('Transaction amount cannot be negative');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Handle errors consistently across agents
   */
  protected handleError(error: Error, context: string): any {
    this.logger.error(`Error in ${context}`, {
      error: error.message,
      stack: error.stack
    });

    return {
      status: 'escalated',
      riskScore: 0.9,
      findings: [{
        type: 'system_error',
        severity: 'high',
        message: `System error in ${context}: ${error.message}`,
        details: { error: error.message }
      }],
      recommendations: ['Manual review required due to system error'],
      metadata: {}
    };
  }

  /**
   * Create a standardized finding object
   */
  protected createFinding(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    details?: any
  ): any {
    return {
      type,
      severity,
      message,
      details
    };
  }

  /**
   * Calculate risk score based on findings
   */
  protected calculateRiskScore(findings: any[]): number {
    if (findings.length === 0) return 0;

    const severityWeights = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0
    };

    const totalScore = findings.reduce((sum, finding) =>
      sum + severityWeights[finding.severity], 0);

    return Math.min(1.0, totalScore / findings.length);
  }

  /**
   * Determine status based on risk score
   */
  protected determineStatus(riskScore: number): 'approved' | 'escalated' | 'rejected' {
    if (riskScore >= 0.8) return 'rejected';
    if (riskScore >= 0.4) return 'escalated';
    return 'approved';
  }
}