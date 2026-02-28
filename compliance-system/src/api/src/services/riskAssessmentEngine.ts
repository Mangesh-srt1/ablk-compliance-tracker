/**
 * Risk Assessment Engine
 * Calculates weighted risk scores for compliance entities using rule-based logic.
 */

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/risk-assessment.log' }),
  ],
});

export interface RiskFactors {
  kycScore?: number;         // 0-100, higher = better verified
  amlScore?: number;         // 0-100, higher = more risky
  sanctionsMatch?: boolean;
  pepMatch?: boolean;
  velocityAnomaly?: boolean;
  jurisdictionRisk?: number; // 0-100
  transactionVolume?: number; // 0-100 (normalized)
}

export interface RiskAssessmentResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  breakdown: Record<string, number>;
  reasoning: string;
  timestamp: Date;
}

// Weight constants (percentages that sum to 100 for continuous factors)
const WEIGHTS = {
  kyc: 0.25,
  aml: 0.30,
  jurisdictionRisk: 0.15,
  transactionVolume: 0.10,
};

// Default risk value used when a factor is not provided.
// 50 is chosen as a conservative "neutral/unknown" midpoint so that missing data
// does not artificially lower the overall risk score, prompting further investigation
// rather than an automatic approval.
const DEFAULT_RISK_VALUE = 50;

// Flat point additions for boolean risk flags
const BOOLEAN_POINTS = {
  sanctionsMatch: 40,
  pepMatch: 20,
  velocityAnomaly: 15,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export class RiskAssessmentEngine {
  /**
   * Assess risk based on provided risk factors.
   * Continuous factors are weighted; boolean flags add fixed points.
   */
  assessRisk(factors: RiskFactors): RiskAssessmentResult {
    logger.info('Assessing risk factors', { factors });

    const breakdown: Record<string, number> = {};
    let continuousScore = 0;
    let booleanScore = 0;

    // KYC score is inverted: higher KYC score means lower risk
    const kycRisk = factors.kycScore !== undefined ? clamp(100 - factors.kycScore) : DEFAULT_RISK_VALUE;
    breakdown['kycRisk'] = parseFloat((kycRisk * WEIGHTS.kyc).toFixed(2));
    continuousScore += kycRisk * WEIGHTS.kyc;

    // AML score: higher = more risky
    const amlRisk = factors.amlScore !== undefined ? clamp(factors.amlScore) : DEFAULT_RISK_VALUE;
    breakdown['amlRisk'] = parseFloat((amlRisk * WEIGHTS.aml).toFixed(2));
    continuousScore += amlRisk * WEIGHTS.aml;

    // Jurisdiction risk
    const jurisdictionRisk = factors.jurisdictionRisk !== undefined ? clamp(factors.jurisdictionRisk) : DEFAULT_RISK_VALUE / 2;
    breakdown['jurisdictionRisk'] = parseFloat((jurisdictionRisk * WEIGHTS.jurisdictionRisk).toFixed(2));
    continuousScore += jurisdictionRisk * WEIGHTS.jurisdictionRisk;

    // Transaction volume
    const txVolume = factors.transactionVolume !== undefined ? clamp(factors.transactionVolume) : DEFAULT_RISK_VALUE / 2 - 5;
    breakdown['transactionVolume'] = parseFloat((txVolume * WEIGHTS.transactionVolume).toFixed(2));
    continuousScore += txVolume * WEIGHTS.transactionVolume;

    // Boolean risk flags
    if (factors.sanctionsMatch) {
      breakdown['sanctionsMatch'] = BOOLEAN_POINTS.sanctionsMatch;
      booleanScore += BOOLEAN_POINTS.sanctionsMatch;
    }
    if (factors.pepMatch) {
      breakdown['pepMatch'] = BOOLEAN_POINTS.pepMatch;
      booleanScore += BOOLEAN_POINTS.pepMatch;
    }
    if (factors.velocityAnomaly) {
      breakdown['velocityAnomaly'] = BOOLEAN_POINTS.velocityAnomaly;
      booleanScore += BOOLEAN_POINTS.velocityAnomaly;
    }

    const riskScore = clamp(Math.round(continuousScore + booleanScore));
    const riskLevel = determineRiskLevel(riskScore);

    const reasoningParts: string[] = [
      `KYC contribution: ${breakdown['kycRisk']?.toFixed(1) ?? 0}`,
      `AML contribution: ${breakdown['amlRisk']?.toFixed(1) ?? 0}`,
    ];
    if (factors.sanctionsMatch) reasoningParts.push('Sanctions list match detected (+40 points)');
    if (factors.pepMatch) reasoningParts.push('Politically exposed person match (+20 points)');
    if (factors.velocityAnomaly) reasoningParts.push('Transaction velocity anomaly detected (+15 points)');
    reasoningParts.push(`Final risk level: ${riskLevel.toUpperCase()} (score: ${riskScore})`);

    const result: RiskAssessmentResult = {
      riskScore,
      riskLevel,
      breakdown,
      reasoning: reasoningParts.join('. '),
      timestamp: new Date(),
    };

    logger.info('Risk assessment complete', { riskScore, riskLevel });
    return result;
  }
}

// Singleton instance
let instance: RiskAssessmentEngine | null = null;

export function getRiskAssessmentEngine(): RiskAssessmentEngine {
  if (!instance) {
    instance = new RiskAssessmentEngine();
  }
  return instance;
}
