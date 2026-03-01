/**
 * SAR Threshold Engine
 * Evaluates transactions against suspicious activity triggers
 * Determines when to automatically generate SARs
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import {
  SARTriggerCondition,
  SARTriggerType,
  SARJurisdiction,
  TriggerEvaluationResult,
  SARCTRConfiguration,
} from '../types/sar-ctr.types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/sar-threshold-engine.log' }),
  ],
});

export class SARThresholdEngine {
  private config: Map<SARJurisdiction, SARCTRConfiguration> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default configurations per jurisdiction
   */
  private initializeDefaultConfigs(): void {
    const jurisdictions: SARJurisdiction[] = ['US', 'AE', 'IN', 'SA', 'EU'];

    jurisdictions.forEach((jurisdiction) => {
      this.config.set(jurisdiction, {
        jurisdiction,
        amlScoreThreshold: 70,
        hawalaScoreThreshold: 80,
        velocityMultiplier: 3,
        ctrAmountThreshold: 10000,
        ctrcurrency: jurisdiction === 'US' ? 'USD' : 'AED',
        escalationDays: 30,
        enableAutoFiling: true,
        enableAutoSubmission: false,
        reviewerEmail: undefined,
      });
    });
  }

  /**
   * Evaluate entity transactions against SAR triggers
   */
  async evaluateTriggers(request: {
    entityId: string;
    jurisdiction: SARJurisdiction;
    transactions: any[]; // Transaction array from TMS
    amlScore: number;
    hawalaScore?: number;
    sanctionsMatches?: string[];
    baselineProfile?: {
      avgAmount: number;
      stdDevAmount: number;
      avgDailyCount: number;
    };
  }): Promise<TriggerEvaluationResult> {
    const config = this.config.get(request.jurisdiction);
    if (!config) {
      throw new Error(`Unsupported jurisdiction: ${request.jurisdiction}`);
    }

    const evaluatedAt = new Date();
    const matchedTriggers: SARTriggerCondition[] = [];

    // Trigger 1: High AML Score
    if (request.amlScore >= config.amlScoreThreshold) {
      matchedTriggers.push({
        type: 'AML_SCORE_HIGH',
        isMatched: true,
        confidence: Math.min(100, (request.amlScore / 100) * 100),
        description: `AML risk score (${request.amlScore}) exceeds threshold (${config.amlScoreThreshold})`,
        evidence: [
          `Risk Score: ${request.amlScore}`,
          `Threshold: ${config.amlScoreThreshold}`,
          `Margin: ${request.amlScore - config.amlScoreThreshold} points`,
        ],
      });
    }

    // Trigger 2: High Hawala Score (structured transfers)
    if (request.hawalaScore && request.hawalaScore >= config.hawalaScoreThreshold) {
      matchedTriggers.push({
        type: 'HAWALA_SCORE_HIGH',
        isMatched: true,
        confidence: Math.min(100, (request.hawalaScore / 100) * 100),
        description: `Hawala pattern score (${request.hawalaScore}) indicates structured transfers`,
        evidence: [
          `Hawala Score: ${request.hawalaScore}`,
          `Threshold: ${config.hawalaScoreThreshold}`,
          `Pattern: Multiple transfers below reporting threshold`,
        ],
      });
    }

    // Trigger 3: Sanctions Match
    if (request.sanctionsMatches && request.sanctionsMatches.length > 0) {
      matchedTriggers.push({
        type: 'SANCTIONS_HIT',
        isMatched: true,
        confidence: 100,
        description: `Entity matches ${request.sanctionsMatches.length} sanctions list(s)`,
        evidence: request.sanctionsMatches,
      });
    }

    // Trigger 4: Structuring Pattern (multiple txs just below $10k)
    const structuringIndicator = this.detectStructuringPattern(
      request.transactions,
      config.ctrAmountThreshold
    );
    if (structuringIndicator.isPresent) {
      matchedTriggers.push({
        type: 'STRUCTURING_PATTERN',
        isMatched: true,
        confidence: structuringIndicator.confidence,
        description: `Detected structuring pattern: ${structuringIndicator.description}`,
        evidence: structuringIndicator.evidence,
      });
    }

    // Trigger 5: Velocity Anomaly (transaction >> baseline)
    if (request.baselineProfile) {
      const velocityData = this.detectVelocityAnomaly(
        request.transactions,
        request.baselineProfile,
        config.velocityMultiplier
      );
      if (velocityData.isAnomaly) {
        matchedTriggers.push({
          type: 'VELOCITY_ANOMALY',
          isMatched: true,
          confidence: velocityData.confidence,
          description: `Transaction amount ${velocityData.multiplier.toFixed(1)}x baseline average`,
          evidence: [
            `Current Transaction: $${velocityData.currentAmount.toFixed(2)}`,
            `Baseline Average: $${velocityData.baselineAverage.toFixed(2)}`,
            `Multiplier: ${velocityData.multiplier.toFixed(1)}x (threshold: ${config.velocityMultiplier}x)`,
          ],
        });
      }
    }

    // Trigger 6: High-Risk Counterparty (jurisdiction warning)
    const highRiskCountries = ['KP', 'IR', 'SY', 'CU']; // OFAC list
    const hasRiskCounterparty = request.transactions.some((tx) =>
      highRiskCountries.includes(tx.destination_country?.toUpperCase())
    );
    if (hasRiskCounterparty) {
      matchedTriggers.push({
        type: 'COUNTERPARTY_RISK',
        isMatched: true,
        confidence: 90,
        description: 'Transaction involves high-risk jurisdiction',
        evidence: [
          'Destination: OFAC-listed/high-risk country',
          'Risk Level: Critical',
          'Recommended Action: Immediate escalation',
        ],
      });
    }

    // Determine overall recommendation
    const shouldGenerateSAR = matchedTriggers.length > 0;
    const shouldGenerateCTR =
      request.transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0) >= config.ctrAmountThreshold;
    const overallConfidence = matchedTriggers.length > 0
      ? Math.round(
          matchedTriggers.reduce((sum, t) => sum + t.confidence, 0) / matchedTriggers.length
        )
      : 0;

    const riskFactors = matchedTriggers.map(
      (t) => `${t.type}: ${t.description}`
    );

    const recommendations = this.generateRecommendations(matchedTriggers, request.jurisdiction);

    logger.info('SAR trigger evaluation complete', {
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      matchedTriggers: matchedTriggers.length,
      shouldGenerateSAR,
      shouldGenerateCTR,
      overallConfidence,
    });

    return {
      entityId: request.entityId,
      evaluatedAt,
      matchedTriggers,
      shouldGenerateSAR,
      shouldGenerateCTR,
      recommendedJurisdiction: request.jurisdiction,
      riskFactors,
      recommendations,
      confidence: overallConfidence,
    };
  }

  /**
   * Detect structuring pattern: multiple txs just below reporting threshold
   */
  private detectStructuringPattern(
    transactions: any[],
    threshold: number
  ): { isPresent: boolean; confidence: number; description: string; evidence: string[] } {
    const structuredTxs = transactions.filter(
      (tx) => tx.amount && tx.amount > threshold * 0.8 && tx.amount < threshold
    );

    if (structuredTxs.length >= 3) {
      const timeWindow = 30; // days
      const datesInWindow = structuredTxs.filter((tx) => {
        const txDate = new Date(tx.timestamp);
        const now = new Date();
        const daysAgo = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo < timeWindow;
      });

      if (datesInWindow.length >= 3) {
        return {
          isPresent: true,
          confidence: Math.min(95, 70 + datesInWindow.length * 10),
          description: `${datesInWindow.length} transactions just below ${threshold} within ${timeWindow} days`,
          evidence: datesInWindow.map((tx) => `$${tx.amount.toFixed(2)} on ${tx.timestamp}`),
        };
      }
    }

    return {
      isPresent: false,
      confidence: 0,
      description: 'No structuring pattern detected',
      evidence: [],
    };
  }

  /**
   * Detect velocity anomaly: transaction >> baseline average
   */
  private detectVelocityAnomaly(
    transactions: any[],
    baseline: { avgAmount: number; stdDevAmount: number },
    multiplier: number
  ): {
    isAnomaly: boolean;
    confidence: number;
    currentAmount: number;
    baselineAverage: number;
    multiplier: number;
  } {
    if (transactions.length === 0 || baseline.avgAmount === 0) {
      return {
        isAnomaly: false,
        confidence: 0,
        currentAmount: 0,
        baselineAverage: 0,
        multiplier: 1,
      };
    }

    const latestTx = transactions[transactions.length - 1];
    const currentAmount = latestTx?.amount || 0;
    const anomalyMultiplier = currentAmount / baseline.avgAmount;

    const isAnomaly = anomalyMultiplier >= multiplier;
    const confidence = Math.min(100, (anomalyMultiplier / multiplier) * 80);

    return {
      isAnomaly,
      confidence: isAnomaly ? confidence : 0,
      currentAmount,
      baselineAverage: baseline.avgAmount,
      multiplier: anomalyMultiplier,
    };
  }

  /**
   * Generate actionable recommendations based on triggers
   */
  private generateRecommendations(
    triggers: SARTriggerCondition[],
    jurisdiction: SARJurisdiction
  ): string[] {
    const recommendations: string[] = [];

    triggers.forEach((trigger) => {
      switch (trigger.type) {
        case 'AML_SCORE_HIGH':
          recommendations.push('Escalate to AML specialist for enhanced due diligence');
          recommendations.push('Request additional KYC documents');
          recommendations.push('Consider transaction block pending review');
          break;

        case 'HAWALA_SCORE_HIGH':
          recommendations.push('Investigate source of funds for each transaction');
          recommendations.push('Request invoices or bills of lading');
          recommendations.push('Interview entity on transaction purpose');
          break;

        case 'SANCTIONS_HIT':
          recommendations.push('IMMEDIATE: Block transaction pending legal review');
          recommendations.push('Notify compliance team and legal department');
          recommendations.push('File SAR with regulatory authority');
          break;

        case 'STRUCTURING_PATTERN':
          recommendations.push('Interview entity about transaction splitting');
          recommendations.push('Request consolidated invoice or purchase order');
          recommendations.push('Increase transaction monitoring frequency to daily');
          break;

        case 'VELOCITY_ANOMALY':
          recommendations.push('Verify unusual activity with entity');
          recommendations.push('Request explanation for transaction');
          recommendations.push('Review recent KYC update for changes');
          break;

        case 'COUNTERPARTY_RISK':
          recommendations.push('CRITICAL: Contact entity immediately');
          recommendations.push('Obtain license or authorization from regulator');
          recommendations.push('Consider transaction block and SAR filing');
          break;

        default:
          recommendations.push('Review entity risk profile');
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get configuration for jurisdiction
   */
  getConfig(jurisdiction: SARJurisdiction): SARCTRConfiguration | undefined {
    return this.config.get(jurisdiction);
  }

  /**
   * Update configuration
   */
  updateConfig(jurisdiction: SARJurisdiction, config: Partial<SARCTRConfiguration>): void {
    const existing = this.config.get(jurisdiction);
    if (existing) {
      this.config.set(jurisdiction, { ...existing, ...config });
      logger.info(`Updated SAR/CTR config for ${jurisdiction}`, config);
    }
  }
}

// Singleton instance
let instance: SARThresholdEngine | null = null;

export function getSARThresholdEngine(): SARThresholdEngine {
  if (!instance) {
    instance = new SARThresholdEngine();
  }
  return instance;
}
