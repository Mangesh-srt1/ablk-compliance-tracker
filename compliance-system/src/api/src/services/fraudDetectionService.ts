/**
 * Fraud Detection Service
 * Analyzes transaction patterns for fraud indicators:
 * velocity anomalies, layering, and structuring
 *
 * FR-3.3: /fraud-detect endpoint
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { AppError, ErrorCode, ErrorCategory } from '../types/errors';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/fraud-detection.log' }),
  ],
});

export interface FraudTransaction {
  id: string;
  amount: number;
  currency: string;
  fromAddress?: string;
  toAddress?: string;
  timestamp: string;
  type?: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'exchange';
  counterparty?: string;
}

export interface FraudDetectionRequest {
  entityId: string;
  transactions: FraudTransaction[];
  jurisdiction?: string;
  metadata?: Record<string, unknown>;
}

export interface FraudFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: string;
}

export interface FraudDetectionResult {
  checkId: string;
  entityId: string;
  anomaly: boolean;
  reason: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: FraudFlag[];
  recommendations: string[];
  patterns: string[];
  processingTime: number;
  timestamp: string;
}

// Thresholds aligned with SEBI / FinCEN rules (configurable via env)
const VELOCITY_TX_COUNT = Number(process.env.FRAUD_VELOCITY_TX_COUNT ?? 20);
const VELOCITY_WINDOW_HOURS = Number(process.env.FRAUD_VELOCITY_WINDOW_HOURS ?? 24);
const HIGH_VALUE_THRESHOLD_USD = Number(process.env.FRAUD_HIGH_VALUE_USD ?? 10000);
const STRUCTURING_ROUND_THRESHOLD = Number(process.env.FRAUD_STRUCTURING_ROUND_USD ?? 9000);
const RAPID_SUCCESSION_SECONDS = Number(process.env.FRAUD_RAPID_SUCCESSION_SECONDS ?? 60);

interface CheckResult {
  flagged: boolean;
  flag: FraudFlag | undefined;
  riskIncrement: number;
}

export class FraudDetectionService {
  /**
   * Detect fraud anomalies in a set of transactions
   */
  async detectFraud(
    request: FraudDetectionRequest,
    userId?: string
  ): Promise<FraudDetectionResult> {
    const startTime = Date.now();
    const checkId = uuidv4();

    logger.info('Starting fraud detection', {
      checkId,
      entityId: request.entityId,
      transactionCount: request.transactions.length,
      userId,
    });

    try {
      const flags: FraudFlag[] = [];
      const patterns: string[] = [];
      let riskScore = 0;

      // 1. Velocity check – many transactions in short window
      const velocityResult = this.checkVelocity(request.transactions);
      if (velocityResult.flagged && velocityResult.flag) {
        flags.push(velocityResult.flag);
        patterns.push('high_velocity');
        riskScore += velocityResult.riskIncrement;
      }

      // 2. Structuring check – many transactions just below reporting threshold
      const structuringResult = this.checkStructuring(request.transactions);
      if (structuringResult.flagged && structuringResult.flag) {
        flags.push(structuringResult.flag);
        patterns.push('structuring');
        riskScore += structuringResult.riskIncrement;
      }

      // 3. Layering check – rapid back-and-forth between same addresses
      const layeringResult = this.checkLayering(request.transactions);
      if (layeringResult.flagged && layeringResult.flag) {
        flags.push(layeringResult.flag);
        patterns.push('layering');
        riskScore += layeringResult.riskIncrement;
      }

      // 4. High-value transaction check
      const highValueResult = this.checkHighValue(request.transactions);
      if (highValueResult.flagged && highValueResult.flag) {
        flags.push(highValueResult.flag);
        patterns.push('high_value');
        riskScore += highValueResult.riskIncrement;
      }

      // 5. Round-amount structuring (suspicious round amounts near threshold)
      const roundAmountResult = this.checkRoundAmounts(request.transactions);
      if (roundAmountResult.flagged && roundAmountResult.flag) {
        flags.push(roundAmountResult.flag);
        patterns.push('round_amount_structuring');
        riskScore += roundAmountResult.riskIncrement;
      }

      // Cap risk score at 100
      riskScore = Math.min(100, riskScore);

      const anomaly = riskScore > 30 || flags.some((f) => f.severity === 'CRITICAL');
      const riskLevel = this.getRiskLevel(riskScore);
      const reason = this.buildReason(flags, patterns);
      const recommendations = this.buildRecommendations(flags, riskScore, request.jurisdiction);

      const processingTime = Date.now() - startTime;

      logger.info('Fraud detection completed', {
        checkId,
        entityId: request.entityId,
        anomaly,
        riskScore,
        flagCount: flags.length,
        processingTime,
      });

      return {
        checkId,
        entityId: request.entityId,
        anomaly,
        reason,
        riskScore,
        riskLevel,
        flags,
        recommendations,
        patterns,
        processingTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Fraud detection failed', {
        checkId,
        entityId: request.entityId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorCategory.INTERNAL,
        'Fraud detection processing failed',
        500
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private analysis helpers
  // ---------------------------------------------------------------------------

  private checkVelocity(transactions: FraudTransaction[]): CheckResult {
    if (transactions.length < VELOCITY_TX_COUNT) {
      return { flagged: false, flag: undefined, riskIncrement: 0 };
    }

    // Sort by timestamp and find the most dense window
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const windowMs = VELOCITY_WINDOW_HOURS * 60 * 60 * 1000;
    for (let i = 0; i <= sorted.length - VELOCITY_TX_COUNT; i++) {
      const windowStart = new Date(sorted[i].timestamp).getTime();
      const windowEnd = windowStart + windowMs;
      const countInWindow = sorted.filter(
        (t) => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= windowStart && ts <= windowEnd;
        }
      ).length;

      if (countInWindow >= VELOCITY_TX_COUNT) {
        return {
          flagged: true,
          flag: {
            type: 'HIGH_VELOCITY',
            severity: 'HIGH',
            message: `${countInWindow} transactions detected within ${VELOCITY_WINDOW_HOURS}h window`,
            details: `Configurable threshold: ${VELOCITY_TX_COUNT} transactions per ${VELOCITY_WINDOW_HOURS}h window exceeded`,
          },
          riskIncrement: 35,
        };
      }
    }

    return { flagged: false, flag: undefined, riskIncrement: 0 };
  }

  private checkStructuring(transactions: FraudTransaction[]): CheckResult {
    // Count transactions just below the high-value reporting threshold
    const suspicious = transactions.filter(
      (t) => t.amount >= STRUCTURING_ROUND_THRESHOLD && t.amount < HIGH_VALUE_THRESHOLD_USD
    );

    if (suspicious.length >= 3) {
      return {
        flagged: true,
        flag: {
          type: 'STRUCTURING',
          severity: 'HIGH',
          message: `${suspicious.length} transactions structured just below $${HIGH_VALUE_THRESHOLD_USD} reporting threshold`,
          details: 'Structuring to evade CTR/STR reporting thresholds is prohibited under AML regulations',
        },
        riskIncrement: 40,
      };
    }

    return { flagged: false, flag: undefined, riskIncrement: 0 };
  }

  private checkLayering(transactions: FraudTransaction[]): CheckResult {
    // Detect rapid succession transactions (possible layering)
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let rapidSuccessionCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      const diff =
        new Date(sorted[i].timestamp).getTime() -
        new Date(sorted[i - 1].timestamp).getTime();
      if (diff < RAPID_SUCCESSION_SECONDS * 1000) {
        rapidSuccessionCount++;
      }
    }

    if (rapidSuccessionCount >= 5) {
      return {
        flagged: true,
        flag: {
          type: 'LAYERING',
          severity: 'CRITICAL',
          message: `${rapidSuccessionCount} transactions in rapid succession detected`,
          details: 'Rapid successive transfers are a common money laundering layering technique',
        },
        riskIncrement: 50,
      };
    }

    return { flagged: false, flag: undefined, riskIncrement: 0 };
  }

  private checkHighValue(transactions: FraudTransaction[]): CheckResult {
    const highValueTxs = transactions.filter((t) => t.amount >= HIGH_VALUE_THRESHOLD_USD);

    if (highValueTxs.length > 0) {
      const totalAmount = highValueTxs.reduce((sum, t) => sum + t.amount, 0);
      return {
        flagged: true,
        flag: {
          type: 'HIGH_VALUE_TRANSACTION',
          severity: highValueTxs.length > 3 ? 'HIGH' : 'MEDIUM',
          message: `${highValueTxs.length} high-value transaction(s) totalling $${totalAmount.toFixed(2)}`,
          details: `Transactions >= $${HIGH_VALUE_THRESHOLD_USD} require enhanced due diligence`,
        },
        riskIncrement: Math.min(25, highValueTxs.length * 5),
      };
    }

    return { flagged: false, flag: undefined, riskIncrement: 0 };
  }

  private checkRoundAmounts(transactions: FraudTransaction[]): CheckResult {
    // Transactions with suspiciously round amounts (e.g., exactly 9000, 9500)
    const roundAmountTxs = transactions.filter((t) => t.amount % 500 === 0 && t.amount > 1000);

    if (roundAmountTxs.length >= 3) {
      return {
        flagged: true,
        flag: {
          type: 'ROUND_AMOUNT_PATTERN',
          severity: 'MEDIUM',
          message: `${roundAmountTxs.length} transactions with suspiciously round amounts detected`,
          details: 'Round-number amounts are a known indicator of structuring / hawala activity',
        },
        riskIncrement: 15,
      };
    }

    return { flagged: false, flag: undefined, riskIncrement: 0 };
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 75) {
      return 'critical';
    }
    if (riskScore >= 50) {
      return 'high';
    }
    if (riskScore >= 30) {
      return 'medium';
    }
    return 'low';
  }

  private buildReason(flags: FraudFlag[], patterns: string[]): string {
    if (flags.length === 0) {
      return 'No fraud anomalies detected';
    }

    const criticalFlags = flags.filter((f) => f.severity === 'CRITICAL');
    const highFlags = flags.filter((f) => f.severity === 'HIGH');

    if (criticalFlags.length > 0) {
      return `Critical anomaly: ${criticalFlags[0].message}`;
    }

    if (highFlags.length > 0) {
      return `High-risk pattern detected: ${highFlags.map((f) => f.type).join(', ')}`;
    }

    return `Suspicious patterns detected: ${patterns.join(', ')}`;
  }

  private buildRecommendations(
    flags: FraudFlag[],
    riskScore: number,
    jurisdiction?: string
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore >= 75) {
      recommendations.push('Immediately escalate to compliance officer for manual review');
      recommendations.push('Consider transaction blocking pending investigation');
    } else if (riskScore >= 50) {
      recommendations.push('Enhanced due diligence required before proceeding');
      recommendations.push('Request additional documentation from entity');
    } else if (riskScore >= 30) {
      recommendations.push('Apply enhanced monitoring to entity');
    }

    if (flags.some((f) => f.type === 'STRUCTURING')) {
      const reportingBody =
        jurisdiction === 'IN'
          ? 'FIU-IND'
          : jurisdiction === 'EU'
            ? 'national FIU'
            : jurisdiction === 'US'
              ? 'FinCEN'
              : 'relevant FIU';
      recommendations.push(`File Suspicious Transaction Report (STR) with ${reportingBody}`);
    }

    if (flags.some((f) => f.type === 'HIGH_VALUE_TRANSACTION')) {
      recommendations.push('File Currency Transaction Report (CTR) if threshold exceeded');
    }

    if (flags.some((f) => f.type === 'LAYERING')) {
      recommendations.push('Investigate counterparty relationships for money laundering network');
    }

    return recommendations;
  }
}
