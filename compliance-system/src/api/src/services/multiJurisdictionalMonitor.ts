/**
 * Multi-Jurisdictional Monitor
 * Evaluates entities against jurisdiction-specific compliance rules.
 * Supports IN, EU, US, AE, and GLOBAL jurisdictions.
 */

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/multi-jurisdictional-monitor.log' }),
  ],
});

export interface JurisdictionCheckInput {
  entityId: string;
  jurisdiction: string[];
  entityData: {
    name: string;
    country?: string;
    age?: number;
    pepStatus?: boolean;
    sanctionsMatch?: boolean;
  };
  transactionData?: {
    amount?: number;
    currency?: string;
    counterpartyJurisdiction?: string;
  };
}

export interface JurisdictionFinding {
  jurisdiction: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  passed: boolean;
}

export interface JurisdictionCheckResult {
  entityId: string;
  jurisdictions: string[];
  findings: JurisdictionFinding[];
  overallCompliant: boolean;
  timestamp: Date;
}

// Rule evaluator type: returns a finding or null if rule doesn't apply
type RuleEvaluator = (
  input: JurisdictionCheckInput
) => JurisdictionFinding | null;

// INR/USD conversion rate used for threshold comparisons.
// NOTE: This is a static approximation. For production, use a currency service.
const USD_TO_INR_RATE = 83;

const JURISDICTION_RULES: Record<string, RuleEvaluator[]> = {
  IN: [
    (input) => {
      const age = input.entityData.age;
      if (age === undefined) return null;
      return {
        jurisdiction: 'IN',
        ruleName: 'IN_AGE_REQUIREMENT',
        severity: 'high',
        description: age >= 18 ? 'Entity meets minimum age requirement (18+)' : 'Entity does not meet minimum age of 18 years (SEBI regulation)',
        passed: age >= 18,
      };
    },
    (input) => {
      const amount = input.transactionData?.amount;
      const currency = input.transactionData?.currency;
      if (amount === undefined) return null;
      const amountInINR = currency === 'USD' ? amount * USD_TO_INR_RATE : amount;
      const threshold = 1_000_000;
      const exceeds = amountInINR > threshold;
      return {
        jurisdiction: 'IN',
        ruleName: 'IN_SEBI_REPORTING_THRESHOLD',
        severity: 'medium',
        description: exceeds
          ? `Transaction amount (${amountInINR.toLocaleString()} INR) exceeds SEBI reporting threshold of 1,000,000 INR`
          : 'Transaction amount is within SEBI reporting threshold',
        passed: !exceeds,
      };
    },
    (input) => ({
      jurisdiction: 'IN',
      ruleName: 'IN_AADHAAR_REQUIREMENT',
      severity: 'high',
      description: input.entityData.country === 'IN'
        ? 'Indian resident — Aadhaar-based KYC verification required per SEBI regulations'
        : 'Non-Indian resident — Aadhaar requirement not applicable',
      // Non-Indian residents are exempt; for Indian residents, flag as informational
      passed: input.entityData.country !== 'IN',
    }),
  ],

  EU: [
    (input) => {
      const age = input.entityData.age;
      if (age === undefined) return null;
      return {
        jurisdiction: 'EU',
        ruleName: 'EU_GDPR_AGE_CONSENT',
        severity: 'medium',
        description: age >= 16
          ? 'Entity meets GDPR minimum age for data processing (16+)'
          : 'Entity below GDPR minimum age (16) — parental consent required',
        passed: age >= 16,
      };
    },
    (_input) => ({
      jurisdiction: 'EU',
      ruleName: 'EU_GDPR_DATA_PROTECTION',
      severity: 'low',
      description: 'GDPR data protection requirements apply — personal data must be processed lawfully',
      passed: true,
    }),
    (_input) => ({
      jurisdiction: 'EU',
      ruleName: 'EU_MIFID_II',
      severity: 'medium',
      description: 'MiFID II compliance required for investment services — suitability assessment mandatory',
      passed: true,
    }),
  ],

  US: [
    (input) => {
      const amount = input.transactionData?.amount;
      const currency = input.transactionData?.currency;
      if (amount === undefined) return null;
      const amountInUSD = currency === 'INR' ? amount / USD_TO_INR_RATE : amount;
      const threshold = 10_000;
      const exceeds = amountInUSD > threshold;
      return {
        jurisdiction: 'US',
        ruleName: 'US_FINCEN_REPORTING',
        severity: 'high',
        description: exceeds
          ? `Transaction amount ($${amountInUSD.toFixed(2)} USD) exceeds FinCEN mandatory reporting threshold of $10,000`
          : 'Transaction amount is within FinCEN reporting threshold',
        passed: !exceeds,
      };
    },
    (input) => ({
      jurisdiction: 'US',
      ruleName: 'US_PATRIOT_ACT_KYC',
      severity: 'critical',
      description: input.entityData.sanctionsMatch
        ? 'Entity flagged under USA PATRIOT Act — sanctions screening failed'
        : 'Entity cleared under USA PATRIOT Act sanctions screening',
      passed: !input.entityData.sanctionsMatch,
    }),
  ],

  AE: [
    (input) => ({
      jurisdiction: 'AE',
      ruleName: 'AE_DFSA_KYC',
      severity: 'high',
      description: input.entityData.pepStatus
        ? 'PEP status detected — enhanced due diligence required under DFSA regulations'
        : 'Entity cleared — standard DFSA KYC requirements apply',
      passed: !input.entityData.pepStatus,
    }),
    (_input) => ({
      jurisdiction: 'AE',
      ruleName: 'AE_DUBAI_FINANCIAL_REGULATIONS',
      severity: 'medium',
      description: 'Dubai Financial Services Authority (DFSA) regulations apply — compliance review required',
      passed: true,
    }),
  ],

  GLOBAL: [
    (input) => ({
      jurisdiction: 'GLOBAL',
      ruleName: 'GLOBAL_SANCTIONS_SCREENING',
      severity: 'critical',
      description: input.entityData.sanctionsMatch
        ? 'Entity matched on international sanctions lists (OFAC/UN)'
        : 'Entity cleared on international sanctions lists',
      passed: !input.entityData.sanctionsMatch,
    }),
    (input) => ({
      jurisdiction: 'GLOBAL',
      ruleName: 'GLOBAL_PEP_SCREENING',
      severity: 'high',
      description: input.entityData.pepStatus
        ? 'Politically exposed person (PEP) — enhanced due diligence required globally'
        : 'No PEP status detected',
      passed: !input.entityData.pepStatus,
    }),
  ],
};

export class MultiJurisdictionalMonitor {
  /**
   * Evaluate an entity against rules for the specified jurisdictions.
   */
  checkJurisdictions(input: JurisdictionCheckInput): JurisdictionCheckResult {
    logger.info('Starting multi-jurisdictional compliance check', {
      entityId: input.entityId,
      jurisdictions: input.jurisdiction,
    });

    const findings: JurisdictionFinding[] = [];

    for (const jCode of input.jurisdiction) {
      const rules = JURISDICTION_RULES[jCode.toUpperCase()];
      if (!rules) {
        logger.warn('No rules found for jurisdiction', { jurisdiction: jCode });
        continue;
      }

      for (const evaluator of rules) {
        try {
          const finding = evaluator(input);
          if (finding) findings.push(finding);
        } catch (err) {
          logger.error('Rule evaluation error', { jurisdiction: jCode, error: err });
        }
      }
    }

    const overallCompliant = findings.every((f) => f.passed);

    const result: JurisdictionCheckResult = {
      entityId: input.entityId,
      jurisdictions: input.jurisdiction,
      findings,
      overallCompliant,
      timestamp: new Date(),
    };

    logger.info('Multi-jurisdictional check complete', {
      entityId: input.entityId,
      totalFindings: findings.length,
      overallCompliant,
    });

    return result;
  }
}

// Singleton instance
let instance: MultiJurisdictionalMonitor | null = null;

export function getMultiJurisdictionalMonitor(): MultiJurisdictionalMonitor {
  if (!instance) {
    instance = new MultiJurisdictionalMonitor();
  }
  return instance;
}
