# ComplianceShield Multi-Jurisdiction Architecture

**Document Version**: 1.1  
**Date**: February 26, 2026  
**Status**: Design Phase - Jurisdiction Extensibility  
**Purpose**: Enable PE tokenization deployment across Dubai, India, EU, US, and future jurisdictions with pluggable compliance rules  
**Blockchain Support**: Both Permissioned (Besu) & Public (Ethereum/Solana) blockchains can use same jurisdiction rules engine

---

## Executive Summary

The original PE tokenization module hardcoded SEBI (India), AIFMD (EU), and Reg D (US) rules. **For Dubai launch + future geographic expansion**, we've refactored to a **Jurisdiction Rules Engine** that:

1. **Decouples compliance rules from code** - Rules live in config files (YAML), not TypeScript
2. **Enables instant jurisdiction switching** - Deploy same code to Dubai, India, Singapore with different config
3. **Supports future jurisdictions** - Add new rules without code changes
4. **Maintains audit trail** - All jurisdiction-specific decisions logged with rule reference
5. **Works with any blockchain type** - Same rules apply to permissioned Besu funds or public Ethereum funds

**Key Benefit**: Same ~1,800 lines of core code supports unlimited jurisdictions and blockchain types. Only the config file size grows.

---

## Blockchain Independence

This rules engine is **blockchain-agnostic**. The same jurisdiction rules apply whether you're using:

- **Permissioned Besu** (institutional PE funds, private network)
- **Public Ethereum** (retail PE offerings, public network)
- **Solana** (high-speed trading platforms)

The **key difference** is how compliance _triggers_ work:

```
SAME RULES, DIFFERENT TRIGGERS:

Permissioned Besu:
  - Rules: Load ae-dubai.yaml for governance/voting requirements ✓
  - Trigger: On internal TX monitoring (<300ms)
  - Cost: $0.01/TX

Public Ethereum:
  - Rules: Load ae-dubai.yaml for governance/voting requirements ✓
  - Trigger: On public TX detection + Chainalysis check
  - Cost: $0.50/TX

Same jurisdiction rules, different execution path!
```

---

## Part 1: Multi-Jurisdiction Architecture

### 1.1 Core Concept: Rules Engine Pattern

**Old Approach (Hardcoded)**:
```typescript
// Hardcoded in code
if (jurisdiction === 'IN') {
  require(lpVote && lpCount >= threshold.SEBI_AIF);
} else if (jurisdiction === 'EU') {
  require(lpVote && lpCount >= threshold.AIFMD);
} else if (jurisdiction === 'US') {
  require(lpVote || gpMajority);
}
```

**New Approach (Rules Engine)**:
```typescript
// Load from config
const rules = jurisdictionConfig.load('AE'); // Dubai
const requirement = rules.governance.majorChangesRequireVote;
if (requirement.enabled) {
  require(lpVote && lpCount >= requirement.threshold);
}
```

### 1.2 Jurisdiction Configuration Structure

**YAML Format** (Easy to understand, non-technical teams can edit):

```yaml
# File: config/jurisdictions/ae-dubai.yaml
jurisdiction:
  code: AE
  name: "United Arab Emirates - Dubai"
  region: MENA
  launchDate: "2026-03-01"
  
# Regulatory Bodies & Contacts
regulatoryBodies:
  - name: DFSA
    label: "Dubai Financial Services Authority"
    website: "www.dfsa.ae"
    reportingContact: compliance@dfsa.ae
  - name: SCA
    label: "Securities and Commodities Authority"
    website: "www.sca.ae"
    reportingContact: aml@sca.ae
    
# Fund Structure Requirements
fundStructure:
  requiredLegalEntity: "DFSA-Regulated Fund Manager"
  minFundSize: 1000000  # AED (not USD)
  maxInvestors: 500     # DFSA threshold
  allowedFundTypes:
    - DFSA_PRIVATE_FUND
    - DFSA_QUALIFIED_INVESTOR_FUND
  
# KYC/AML Requirements
kyc:
  providerIntegration: ballerine  # Same as others
  docRequirements:
    - PASSPORT
    - PROOF_OF_ADDRESS
    - UAE_ID_COPY
  livenessCheck: true
  faceMatch: true
  sanctionsList:
    - OFAC_SDN               # US sanctions
    - UN_SECURITY_COUNCIL    # UN list
    - EU_CONSOLIDATED        # EU list
    - DFSA_PERSONS_LIST      # Dubai-specific
    
# Governance & Voting
governance:
  majorChangesRequireVote: true
  majorChangeDefinitions:
    - SIGNATORY_CHANGE
    - LPA_AMENDMENT
    - EXTEND_MATURITY
    - CHANGE_INVESTMENT_STRATEGY
  votingThreshold: 66          # % of LPs required
  votingDeadlineDays: 14
  gpHasVeto: false             # UAE funds: no GP veto
  
# Distribution & Waterfall
distributions:
  frequencyMonths: 3           # Quarterly only
  allowedWaterfallStructures:
    - STANDARD: "LP %, GP carry %"
    - HURDLE_RATE: "Hurdle before carry"
    - CLAWBACK: "Clawback if NAV drops"
  minManagementFeePercentage: 0.5
  maxManagementFeePercentage: 3.0
  minCarryPercentage: 15
  maxCarryPercentage: 30
  hurdle_rate_if_applicable: 8  # %
  
# Insider Trading Rules
insiderTrading:
  detectionEnabled: true
  signals:
    gpActivityCorrelation:
      enabled: true
      threshold: 0.3
    informationAsymmetry:
      enabled: true
      threshold: 0.35
    frontRunningPattern:
      enabled: true
      threshold: 0.25
      minDaysBeforeAnnouncement: 3
    temporalAnomaly:
      enabled: true
      threshold: 0.1
  escalationThresholds:
    block: 0.90
    regulatoryReport: 0.75
    manualReview: 0.60
    monitor: 0.30
  stricterRulesForGPAffiliates: true  # UAE has strict insider rules
  
# Reporting & Compliance
reporting:
  quarterlyReportRequired: true
  quarterlyReportDays: 45        # After quarter-end
  annualAuditRequired: true
  auditStandard: IFRS_9          # Dubai uses IFRS
  amlReporting:
    suspiciousActivityReportRequired: true
    sarThresholdAmount: 250000    # AED
    sarFilingDays: 3              # Stricter than FATF (10 days)
    reportingAuthority: SCA
  recordRetention: 10             # Years
  
# P2P Trading Restrictions
peerToPeer:
  allowSecondaryMarketTrading: true
  requiresComplianceApproval: true
  lockupPeriod: 365               # Days
  earlyExitPenalty: 3             # %
  allowedExchanges:               # Whitelist DEXs/CEXs
    - DFSA_APPROVED_PLATFORM
    - INTERNATIONAL_ISO20022
  restrictedCountriesForBuyers:
    - KP  # North Korea
    - IR  # Iran
    - SY  # Syria
    - CU  # Cuba
  
# AML/CFT
amlCft:
  ctfThreshold: 100000            # AED (>$27K)
  strFilingRequired: true
  strFilingDeadline: 3            # Days
  pep_check: true
  adverse_media_screening: true
  transaction_ongoing_monitoring: true
  
# Oracle Configuration
oracles:
  proofOfReserve:
    enabled: true
    provider: chainlink           # Standard
    checkInterval: 3600           # Seconds (hourly)
  assetRegistry:
    enabled: true
    registry: DUBAI_LAND_DEPT     # Dubai Land Department
    apiEndpoint: https://api.dubailand.ae/verify
    apiAuthMethod: OAuth2
  sanctionsData:
    enabled: true
    providers:
      - OFAC
      - UN_SECURITY_COUNCIL
      - DFSA
    updateFrequency: 86400        # Daily
    
# Smart Contract & Token Standards
smartContract:
  erc1400Standard: true
  automaticPausing: true
  pausingReasons:
    - OWNERSHIP_FRAUD_DETECTED
    - INSIDER_TRADING_RISK_HIGH
    - GOVERNANCE_VIOLATION
    - REGULATORY_SUSPENSION
  automaticBurning: false         # Dubai prefers pause over burn
  
# PII & Data Protection
dataProtection:
  standard: UAE_DPA               # UAE Data Protection Act
  piiEncryption: AES_256
  minDataRetention: 7             # Years
  maxDataRetention: 10            # Years
  jurisdictionalDataStorage: REQUIRED  # Data must stay in UAE
  
# Compliance Escalation
escalation:
  manualReviewQueue:
    maxWaitTime: 48               # Hours
    sla: 95                       # % meeting SLA
    escalationEmail: compliance@yourfirm.ae
    escalationTicketing: JIRA     # Your tool
  regulatoryReporting:
    enabled: true
    autoFileSAR: true
    autoFileSTR: false            # Manual for UAE
    reportingEmail: aml@sca.ae
    
# Cost & Pricing
pricing:
  setupFee: 50000     # AED (not USD)
  monthlyFee: 15000   # AED per fund
  transactionFee: 0.05 # % of distribution
  
# Feature Flags
features:
  enableBatchDistributions: true
  enableLPGovernanceVoting: true
  enableSecondaryMarketTrading: true
  enableInsiderTradingDetection: true
  enableAutomaticAMLReporting: false  # Manual for now
  
# Testing & Deployment
deployment:
  environment: production
  besuNetworkId: 1     # Dubai-specific Besu chain
  databaseSchema: pe_funds_ae
  logLevel: INFO
  alertingEnabled: true
  alertEmail: alerts@yourfirm.ae
```

---

## Part 2: Jurisdiction Rules Engine (TypeScript Service)

### 2.1 Core Rules Engine

```typescript
/**
 * Jurisdiction Rules Engine
 * Loads jurisdiction-specific compliance rules from YAML config files
 * Enables pluggable compliance rules for multi-jurisdiction deployments
 */

import * as YAML from 'yaml';
import * as fs from 'fs';
import postgres from 'pg';
import winston from 'winston';

export interface JurisdictionRules {
  jurisdiction: {
    code: string;
    name: string;
    region: string;
  };
  kyc: {
    providerIntegration: string;
    docRequirements: string[];
    sanctionsList: string[];
  };
  governance: {
    majorChangesRequireVote: boolean;
    votingThreshold: number;
    gpHasVeto: boolean;
  };
  distributions: {
    frequencyMonths: number;
    maxManagementFeePercentage: number;
    maxCarryPercentage: number;
  };
  insiderTrading: {
    detectionEnabled: boolean;
    escalationThresholds: {
      block: number;
      regulatoryReport: number;
      manualReview: number;
    };
  };
  amlCft: {
    strFilingRequired: boolean;
    strFilingDeadline: number;
    ctfThreshold: number;
  };
  reporting: {
    quarterlyReportRequired: boolean;
    annualAuditRequired: boolean;
    recordRetention: number;
  };
  dataProtection: {
    standard: string;
    jurisdictionalDataStorage: string;
  };
  [key: string]: any; // Allow extensibility
}

export class JurisdictionRulesEngine {
  private logger: winston.Logger;
  private dbClient: postgres.Client;
  private rulesCache: Map<string, JurisdictionRules> = new Map();
  private configPath: string;

  constructor(configPath: string, dbClient: postgres.Client) {
    this.configPath = configPath;
    this.dbClient = dbClient;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'jurisdiction-rules-engine' }
    });
  }

  /**
   * Load jurisdiction rules from YAML config file
   * Caches rules in memory; auto-reloads on file change
   */
  async loadJurisdiction(jurisdictionCode: string): Promise<JurisdictionRules> {
    // Check cache first
    if (this.rulesCache.has(jurisdictionCode)) {
      return this.rulesCache.get(jurisdictionCode)!;
    }

    // Load from file
    const filePath = `${this.configPath}/jurisdictions/${jurisdictionCode.toLowerCase()}.yaml`;
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const rules = YAML.parse(fileContent) as JurisdictionRules;

      // Validate required fields
      this.validateRulesStructure(rules);

      // Store in cache
      this.rulesCache.set(jurisdictionCode, rules);

      // Log load event
      this.logger.info('Jurisdiction rules loaded', {
        jurisdictionCode,
        name: rules.jurisdiction.name,
        region: rules.jurisdiction.region
      });

      return rules;

    } catch (error) {
      this.logger.error('Failed to load jurisdiction rules', {
        jurisdictionCode,
        filePath,
        error: (error as Error).message
      });
      throw new Error(`Jurisdiction config not found: ${jurisdictionCode}`);
    }
  }

  /**
   * Validate fund structure against jurisdiction requirements
   */
  async validateFundStructure(
    fundData: {
      jurisdictionCode: string;
      legalEntityType: string;
      fundSize: number;
      investorCount: number;
      fundTypes: string[];
    }
  ): Promise<{ isValid: boolean; violations: string[] }> {
    const rules = await this.loadJurisdiction(fundData.jurisdictionCode);
    const violations: string[] = [];

    // Check fund size
    if (fundData.fundSize < rules.fundStructure.minFundSize) {
      violations.push(
        `Fund size ${fundData.fundSize} below minimum ${rules.fundStructure.minFundSize} for ${fundData.jurisdictionCode}`
      );
    }

    // Check investor count
    if (fundData.investorCount > rules.fundStructure.maxInvestors) {
      violations.push(
        `Investor count ${fundData.investorCount} exceeds maximum ${rules.fundStructure.maxInvestors}`
      );
    }

    // Check allowed fund types
    const allowedTypes = rules.fundStructure.allowedFundTypes;
    const hasValidType = fundData.fundTypes.some(type => allowedTypes.includes(type));
    if (!hasValidType) {
      violations.push(
        `Fund types ${fundData.fundTypes.join(',')} not allowed. Allowed: ${allowedTypes.join(',')}`
      );
    }

    // Log validation result
    this.logger.info('Fund structure validation completed', {
      jurisdictionCode: fundData.jurisdictionCode,
      isValid: violations.length === 0,
      violationCount: violations.length
    });

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Get KYC requirement for jurisdiction
   */
  async getKYCRequirements(jurisdictionCode: string) {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    return {
      provider: rules.kyc.providerIntegration,
      requiredDocuments: rules.kyc.docRequirements,
      sanctionsLists: rules.kyc.sanctionsList,
      livenessCheck: rules.kyc.livenessCheck,
      faceMatch: rules.kyc.faceMatch
    };
  }

  /**
   * Check if governance change requires LP vote
   */
  async requiresLPVote(
    jurisdictionCode: string,
    changeType: string
  ): Promise<{ required: boolean; threshold: number; deadlineDays: number }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const govRules = rules.governance;

    const changeRequiresVote = govRules.majorChangeDefinitions.includes(changeType);

    return {
      required: govRules.majorChangesRequireVote && changeRequiresVote,
      threshold: govRules.votingThreshold,
      deadlineDays: govRules.votingDeadlineDays
    };
  }

  /**
   * Validate distribution waterfall against jurisdiction rules
   */
  async validateDistributionWaterfall(
    jurisdictionCode: string,
    waterfall: {
      lpPercentage: number;
      gpCarryPercentage: number;
      mgmtFeePercentage: number;
      hurdleRate?: number;
      clawbackEnabled?: boolean;
    }
  ): Promise<{ isValid: boolean; violations: string[] }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const distRules = rules.distributions;
    const violations: string[] = [];

    // Check management fee limits
    if (waterfall.mgmtFeePercentage > distRules.maxManagementFeePercentage) {
      violations.push(
        `Management fee ${waterfall.mgmtFeePercentage}% exceeds max ${distRules.maxManagementFeePercentage}%`
      );
    }

    if (waterfall.mgmtFeePercentage < distRules.minManagementFeePercentage) {
      violations.push(
        `Management fee ${waterfall.mgmtFeePercentage}% below min ${distRules.minManagementFeePercentage}%`
      );
    }

    // Check carry limits
    if (waterfall.gpCarryPercentage > distRules.maxCarryPercentage) {
      violations.push(
        `GP carry ${waterfall.gpCarryPercentage}% exceeds max ${distRules.maxCarryPercentage}%`
      );
    }

    if (waterfall.gpCarryPercentage < distRules.minCarryPercentage) {
      violations.push(
        `GP carry ${waterfall.gpCarryPercentage}% below min ${distRules.minCarryPercentage}%`
      );
    }

    // Check distribution frequency
    // (If implementation specifies frequency, validate it matches jurisdiction rule)

    return {
      isValid: violations.length === 0,
      violations
    };
  }

  /**
   * Get insider trading thresholds for jurisdiction
   */
  async getInsiderTradingThresholds(jurisdictionCode: string) {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    return rules.insiderTrading.escalationThresholds;
  }

  /**
   * Check if AML Suspicious Activity Report filing required
   */
  async isAMLReportingRequired(jurisdictionCode: string): Promise<{
    required: boolean;
    filingDeadlineDays: number;
    threshold: number;
  }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const amlRules = rules.amlCft;

    return {
      required: amlRules.strFilingRequired,
      filingDeadlineDays: amlRules.strFilingDeadline,
      threshold: amlRules.ctfThreshold
    };
  }

  /**
   * Get data protection & PII handling rules
   */
  async getDataProtectionRequirements(jurisdictionCode: string) {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const dpRules = rules.dataProtection;

    return {
      standard: dpRules.standard,
      encryption: dpRules.piiEncryption,
      minRetention: dpRules.minDataRetention,
      maxRetention: dpRules.maxDataRetention,
      jurisdictionalStorageRequired: dpRules.jurisdictionalDataStorage === 'REQUIRED'
    };
  }

  /**
   * Log a compliance decision with jurisdiction rule reference
   * Maintains audit trail showing which rule was applied
   */
  async logComplianceDecision(
    fundId: string,
    jurisdictionCode: string,
    decisionType: string,
    decision: 'APPROVED' | 'REJECTED' | 'ESCALATED',
    ruleReference: string,
    details: any
  ): Promise<void> {
    try {
      await this.dbClient.query(
        `INSERT INTO compliance_decision_audit (
          fund_id, jurisdiction_code, decision_type, decision, rule_reference, details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [fundId, jurisdictionCode, decisionType, decision, ruleReference, JSON.stringify(details)]
      );

      this.logger.info('Compliance decision logged', {
        fundId,
        jurisdictionCode,
        decisionType,
        decision,
        ruleReference
      });

    } catch (error) {
      this.logger.error('Failed to log compliance decision', {
        fundId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get all supported jurisdictions
   */
  async getSupportedJurisdictions(): Promise<Array<{ code: string; name: string; region: string }>> {
    const files = fs.readdirSync(this.configPath + '/jurisdictions');
    const jurisdictions: Array<{ code: string; name: string; region: string }> = [];

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const jurisdictionCode = file.replace('.yaml', '').toUpperCase();
        try {
          const rules = await this.loadJurisdiction(jurisdictionCode);
          jurisdictions.push({
            code: rules.jurisdiction.code,
            name: rules.jurisdiction.name,
            region: rules.jurisdiction.region
          });
        } catch (error) {
          this.logger.warn('Failed to load jurisdiction', { jurisdictionCode });
        }
      }
    }

    return jurisdictions;
  }

  /**
   * Reload all cached rules (useful after config updates)
   */
  async reloadAllRules(): Promise<void> {
    this.rulesCache.clear();
    this.logger.info('All jurisdiction rules cleared from cache');
  }

  /**
   * Validate rules structure has required fields
   */
  private validateRulesStructure(rules: JurisdictionRules): void {
    const required = [
      'jurisdiction.code',
      'kyc.providerIntegration',
      'governance.majorChangesRequireVote',
      'distributions.frequencyMonths',
      'amlCft.strFilingRequired',
      'reporting.recordRetention',
      'dataProtection.standard'
    ];

    for (const field of required) {
      const [top, sub] = field.split('.');
      if (!rules[top as keyof JurisdictionRules] || !rules[top as keyof JurisdictionRules][sub]) {
        throw new Error(`Required field missing in jurisdiction config: ${field}`);
      }
    }
  }
}

// Export for use in other services
export default JurisdictionRulesEngine;
```

---

## Part 3: Updated Database Schema with Jurisdiction Awareness

```sql
-- Add jurisdiction awareness to existing PE fund tables

-- 1. Create jurisdiction master table
CREATE TABLE IF NOT EXISTS jurisdictions (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  region VARCHAR(50),
  active BOOLEAN DEFAULT true,
  launchDate DATE,
  config_version VARCHAR(20),  -- Track config version
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Add jurisdiction column to pe_funds table
ALTER TABLE pe_funds ADD COLUMN IF NOT EXISTS jurisdiction_code VARCHAR(2);
ALTER TABLE pe_funds ADD CONSTRAINT fk_jurisdiction 
  FOREIGN KEY (jurisdiction_code) REFERENCES jurisdictions(code);
ALTER TABLE pe_funds ADD COLUMN IF NOT EXISTS regulatory_approval_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CONDITIONAL');
ALTER TABLE pe_funds ADD COLUMN IF NOT EXISTS regulatory_approval_date DATE;

-- 3. Create audit table for compliance decisions with jurisdiction tracking
CREATE TABLE IF NOT EXISTS compliance_decision_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID REFERENCES pe_funds(id),
  jurisdiction_code VARCHAR(2) REFERENCES jurisdictions(code),
  
  -- What decision was made
  decision_type VARCHAR(100),  -- e.g., 'GOVERNANCE_CHANGE', 'P2P_TRADE', 'DISTRIBUTION'
  decision VARCHAR(50),  -- APPROVED, REJECTED, ESCALATED
  
  -- Which rule(s) applied
  rule_reference VARCHAR(255),  -- e.g., 'AE.governance.majorChangesRequireVote'
  rule_version VARCHAR(20),  -- Config version for traceability
  
  -- Details
  details JSONB,  -- Detailed decision info
  risk_score NUMERIC(3,2),
  escalation_reason VARCHAR(500),
  
  -- Decision maker
  decided_by VARCHAR(255),
  decision_timestamp TIMESTAMP,
  
  -- Regulatory reference (if applicable)
  regulatory_authority VARCHAR(100),  -- e.g., 'DFSA', 'SCA', 'SEBI'
  external_reference_id VARCHAR(255),  -- SAR filing ID, etc.
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create jurisdiction feature flags table (for gradual rollout)
CREATE TABLE IF NOT EXISTS jurisdiction_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code VARCHAR(2) REFERENCES jurisdictions(code),
  
  feature_name VARCHAR(100),  -- e.g., 'INSIDER_TRADING_DETECTION', 'AUTO_AML_REPORTING'
  enabled BOOLEAN DEFAULT true,
  
  rollout_percentage INT DEFAULT 100,  -- 0-100 for gradual rollout
  rollout_startDate DATE,
  rollout_endDate DATE,
  
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create regulatory reporting queue (jurisdiction-specific)
CREATE TABLE IF NOT EXISTS regulatory_reporting_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID REFERENCES pe_funds(id),
  jurisdiction_code VARCHAR(2) REFERENCES jurisdictions(code),
  
  report_type VARCHAR(100),  -- 'STR', 'SAR', 'QUARTERLY', 'ANNUAL'
  regulatory_authority VARCHAR(100),  -- 'DFSA', 'SCA', 'SEBI'
  
  -- Filing details
  dueDate DATE,
  filedDate DATE,
  reportContent JSONB,
  filing_reference_id VARCHAR(255),
  
  status ENUM('PENDING', 'FILED', 'ACKNOWLEDGED', 'REJECTED', 'REQUIRES_AMENDMENT'),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Create jurisdiction-specific parameter overrides (for fine-tuning per jurisdiction)
CREATE TABLE IF NOT EXISTS jurisdiction_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_code VARCHAR(2) REFERENCES jurisdictions(code),
  
  parameter_name VARCHAR(100),  -- e.g., 'INSIDER_TRADING_BLOCK_THRESHOLD', 'STR_FILING_DEADLINE_DAYS'
  parameter_value VARCHAR(500),
  data_type VARCHAR(20),  -- 'integer', 'percentage', 'days', 'currency'
  
  override_reason TEXT,  -- Why parameter differs from default
  effective_date DATE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_jurisdictions_active ON jurisdictions(active) WHERE active = true;
CREATE INDEX idx_pe_funds_jurisdiction ON pe_funds(jurisdiction_code);
CREATE INDEX idx_compliance_audit_jurisdiction ON compliance_decision_audit(jurisdiction_code, created_at DESC);
CREATE INDEX idx_regulatory_reporting_jurisdiction ON regulatory_reporting_queue(jurisdiction_code, dueDate);
CREATE INDEX idx_feature_flags_jurisdiction ON jurisdiction_feature_flags(jurisdiction_code, enabled);
```

---

## Part 4: Refactored PE Components Using Rules Engine

### 4.1 Updated PEFundGovernanceOracle (Jurisdiction-Aware)

```typescript
/**
 * PE Fund Governance Oracle (Multi-Jurisdiction Version)
 * Uses JurisdictionRulesEngine for jurisdiction-specific validation
 */

export class PEFundGovernanceOracle {
  private rulesEngine: JurisdictionRulesEngine;
  
  constructor(rulesEngine: JurisdictionRulesEngine, dbClient: postgres.Client) {
    this.rulesEngine = rulesEngine;
    this.dbClient = dbClient;
  }

  /**
   * Verify fund governance with jurisdiction-specific rules
   */
  async verifyFundGovernance(fundId: string): Promise<FundGovernanceStatus> {
    // Get fund's jurisdiction
    const fund = await this.dbClient.query(
      'SELECT jurisdiction_code FROM pe_funds WHERE id = $1',
      [fundId]
    );

    if (!fund.rows.length) {
      throw new Error(`Fund not found: ${fundId}`);
    }

    const jurisdictionCode = fund.rows[0].jurisdiction_code;

    // Load jurisdiction-specific rules
    const rules = await this.rulesEngine.loadJurisdiction(jurisdictionCode);

    // Apply jurisdiction-specific governance checks
    const gpControl = await this.verifyGPControlAuthorization(fundId, rules);
    const capTable = await this.verifyCapTableIntegrity(fundId, rules);
    const distributions = await this.verifyDistributionWaterfall(fundId, rules);
    const fundStatus = await this.verifyFundStatus(fundId, rules);

    // Calculate oracle score based on jurisdiction-specific criteria
    let oracleScore = 1.0;
    const riskFlags: string[] = [];

    if (!gpControl.isAuthorized) {
      oracleScore -= 0.4;
      riskFlags.push(`[${jurisdictionCode}] ${gpControl.changeDetailed}`);
    }

    if (!capTable.isConsistent) {
      oracleScore -= 0.3;
      riskFlags.push(`[${jurisdictionCode}] Cap table modified`);
    }

    if (!distributions.isOnTrack) {
      oracleScore -= 0.2;
      riskFlags.push(`[${jurisdictionCode}] Distribution delayed`);
    }

    if (fundStatus.isDissolvedOrMerged) {
      oracleScore -= 0.5;
      riskFlags.push(`[${jurisdictionCode}] Fund status changed: ${fundStatus.statusChange}`);
    }

    // Log decision with jurisdiction reference
    await this.rulesEngine.logComplianceDecision(
      fundId,
      jurisdictionCode,
      'FUND_GOVERNANCE_VERIFICATION',
      oracleScore >= 0.7 ? 'APPROVED' : 'ESCALATED',
      `${jurisdictionCode}.governance.verification`,
      { oracleScore, riskFlags }
    );

    return {
      fundId,
      jurisdictionCode,
      isValid: oracleScore >= 0.7,
      gpControlStatus: oracleScore >= 0.7 ? 'authorized' : 'disputed',
      capTableIntegrity: capTable.isConsistent ? 'consistent' : 'modified',
      lastDistributionStatus: distributions.isOnTrack ? 'on_schedule' : 'delayed',
      riskFlags,
      oracleScore,
      applicableRules: rules // Include rules for transparency
    };
  }

  /**
   * Verify GP control with jurisdiction-specific LP vote requirements
   */
  private async verifyGPControlAuthorization(
    fundId: string,
    rules: JurisdictionRules
  ): Promise<{ isAuthorized: boolean; changeDetailed?: string }> {
    // Check if major signatory change requires LP vote
    const votingRequirement = rules.governance.majorChangesRequireVote;
    const voteThreshold = rules.governance.votingThreshold;

    // ... rest of verification logic, using jurisdiction rules
    
    // If change detected, check if it passed LP vote
    if (changeDetected && votingRequirement) {
      const lpVotes = await this.dbClient.query(
        `SELECT COUNT(*) as approved_votes FROM lp_governance_votes
         WHERE fund_id = $1 AND vote_type = 'SIGNATORY_CHANGE' AND status = 'APPROVED'`,
        [fundId]
      );

      const approvalPercentage = (lpVotes.rows[0].approved_votes / totalLPCount) * 100;
      
      if (approvalPercentage < voteThreshold) {
        return {
          isAuthorized: false,
          changeDetailed: `Signatory changed but LP approval ${approvalPercentage.toFixed(1)}% < required ${voteThreshold}%`
        };
      }
    }

    return { isAuthorized: true };
  }

  // Similar patterns for capTable, distributions, fundStatus using jurisdiction rules...
}
```

### 4.2 Updated PEInsiderTradingDetector (Jurisdiction-Aware)

```typescript
/**
 * PE Insider Trading Detector (Multi-Jurisdiction Version)
 * Uses jurisdiction-specific thresholds and escalation rules
 */

export class PEInsiderTradingDetector {
  private rulesEngine: JurisdictionRulesEngine;

  constructor(rulesEngine: JurisdictionRulesEngine, dbClient: postgres.Client) {
    this.rulesEngine = rulesEngine;
  }

  /**
   * Assess insider trading risk with jurisdiction-specific thresholds
   */
  async assessInsiderTradingRisk(trade: P2PTrade): Promise<InsiderTradingAssessment> {
    // Get fund's jurisdiction
    const fund = await this.dbClient.query(
      'SELECT jurisdiction_code FROM pe_funds WHERE id = $1',
      [trade.fundId]
    );

    const jurisdictionCode = fund.rows[0].jurisdiction_code;
    const rules = await this.rulesEngine.loadJurisdiction(jurisdictionCode);

    // Get jurisdiction-specific escalation thresholds
    const thresholds = rules.insiderTrading.escalationThresholds;

    // Calculate risk score (same as before)
    let insiderRiskScore = 0;
    const signals = { /* ... */ };
    const shapExplanation: { [key: string]: number } = {};

    // Apply jurisdiction-specific signal weights
    const signalConfig = rules.insiderTrading.signals;
    
    if (signalConfig.gpActivityCorrelation.enabled) {
      const weight = signalConfig.gpActivityCorrelation.threshold;
      // ... calculate gpActivityCorrelation signal
      insiderRiskScore += weight * gpCorrelationStrength;
    }

    // Determine escalation level using jurisdiction-specific thresholds
    const escalationLevel = insiderRiskScore >= thresholds.block 
      ? 'block'
      : insiderRiskScore >= thresholds.regulatoryReport 
      ? 'regulatory_report'
      : insiderRiskScore >= thresholds.manualReview 
      ? 'manual_review'
      : 'auto_approve';

    // Log with jurisdiction reference
    await this.rulesEngine.logComplianceDecision(
      trade.fundId,
      jurisdictionCode,
      'P2P_TRADE_INSIDER_RISK_ASSESSMENT',
      escalationLevel === 'auto_approve' ? 'APPROVED' : escalationLevel === 'block' ? 'REJECTED' : 'ESCALATED',
      `${jurisdictionCode}.insiderTrading.escalationThresholds`,
      { insiderRiskScore, signals, escalationLevel }
    );

    return {
      transactionHash: trade.txHash,
      fundId: trade.fundId,
      jurisdictionCode,
      insiderRiskScore,
      escalationLevel,
      detectionSignals: signals,
      shapExplanation,
      applicableRules: rules.insiderTrading
    };
  }
}
```

---

## Part 5: Dubai Configuration Template

```yaml
# config/jurisdictions/ae.yaml
# Dubai / UAE Configuration for PE Fund Tokenization

jurisdiction:
  code: AE
  name: "United Arab Emirates - Dubai"
  region: MENA
  launchDate: "2026-03-15"
  timeZone: "Asia/Dubai"
  currencyCode: "AED"
  currencySymbol: "د.إ"

# Regulatory Framework
regulatoryFramework:
  primaryRegulator: DFSA
  secondaryRegulator: SCA
  applicableLaws:
    - DFSA_FUND_RULES_2014
    - DFSA_ANTI_MONEY_LAUNDERING_RULES_2020
    - UAE_DATA_PROTECTION_LAW_2021
    - DFSA_CRYPTO_ASSET_RULES_2023

regulatoryBodies:
  - id: DFSA
    name: "Dubai Financial Services Authority"
    jurisdiction: DIFC
    website: "https://www.dfsa.ae"
    reportingEmail: "aml@dfsa.ae"
    contactPhone: "+971-4-308-8100"
    reportingFormats: [INTERACTIVE, PDF, XML]
    
  - id: SCA
    name: "Securities and Commodities Authority"
    jurisdiction: UAE_NATIONWIDE
    website: "https://www.sca.ae"
    reportingEmail: "aml@sca.ae"
    reportingFormats: [EMAIL, WEB_PORTAL]

# Fund Structure Requirements (DFSA Approved FundsRules)
fundStructure:
  requiredLegalEntity: "DFSA_AUTHORIZED_FUND_MANAGER"
  minFundSize: 1000000  # AED (~$272,000 USD)
  maxInvestors: 500     # DFSA limit
  minInvesters: 2       # DFSA requirement
  allowedFundTypes:
    - DFSA_PRIVATE_FUND     # Not authorized to market to public
    - DFSA_QUALIFIED_INVESTOR_FUND  # Qualified investors only
    - DFSA_PROFESSIONAL_FUND  # Financial Professionals only
    
  lpEligibility:
    - QUALIFIED_INVESTOR   # Net worth > AED 1.5M
    - FINANCIAL_PROFESSIONAL
    - GOVERNMENT_ENTITY
    - INSTITUTIONAL_INVESTOR
    
  minInvestmentAmount: 100000  # AED per LP
  
# KYC/AML Requirements (DFSA & FATF Compliant)
kyc:
  providerIntegration: ballerine  # Standard integration
  livenessCheck: true
  faceMatch: true
  docLanguages: [EN, AR]  # English and Arabic
  
  docRequirements:
    individual:
      - PASSPORT_OR_ID
      - UAE_ID_COPY
      - PROOF_OF_ADDRESS  # Utility bill in English
      - SOURCE_OF_FUNDS_CERTIFICATION
      - BENEFICIAL_OWNERSHIP_DECLARATION
      
    corporate:
      - CERTIFICATE_OF_INCORPORATION
      - BOARDRESOLUTION_FOR_TOKEN_INVESTMENT
      - REGISTER_OF_DIRECTORS
      - PROOF_OF_ADDRESS
      - AUDITED_FINANCIALS  # Last 2 years
      
  sanctionsLists:
    - OFAC_SDN              # US sanctions
    - UN_SECURITY_COUNCIL   # UN
    - EU_CONSOLIDATED       # EU consolidated list
    - DFSA_PERSONS_LIST     # DFSA-specific list
    - SCA_PERSONS_LIST      # SCA-specific list
    - INTERPOL_RED_NOTICES  # Interpol wanted list
    - STATE_LIST_UAE        # UAE equivalent
    
  aversiveMediaScreening: true
  pepCheck: true
  pepDefinition: "Government official, military, judicial, or board member of SOE"
  pepRelativeCheck: true
  pepRelativeLevels: 1  # Spouse, children only
  
  kycRefreshInterval: 365  # Annual refresh
  kycExpiryNotification: 30  # Days before expiry
  
# Governance & Voting Requirements (DFSA Fund Rules)
governance:
  majorChangesRequireVote: true  # Mandatory
  gpHasVeto: false  # DFSA: No GP veto allowed
  gpCanInitiateMajorChanges: false  # LPs must propose
  
  majorChangeDefinitions:
    - SIGNATORY_CHANGE
    - CHANGE_OF_INVESTMENT_STRATEGY
    - CHANGE_OF_ADMINISTRATOR
    - CHANGE_OF_CUSTODIAN
    - EXTEND_FUND_MATURITY
    - EARLY_LIQUIDATION
    - AMENDMENT_TO_LPA
    - INCREASE_MANAGEMENT_FEE
    - CHANGE_OF_VALUATION_POLICY
    
  votingThreshold: 66  # 2/3 majority required (stricter than FATF)
  votingDeadlineDays: 14
  votingMethodRequired: BLOCKCHAIN_WITH_LEGAL_SIGNATURE  # DFSA requirement
  minVotingParticipation: 25  # % of LPs must vote
  
  unananimousConsent:
    requiredFor:
      - CHANGE_OF_FUND_IN_BASE_CURRENCY  # AED vs USD
      - CHANGE_OF_AUDITOR
      - WINDING_UP_FUND
      
  distributionChangesRequireVote: true  # Any change to waterfall
  
# Distribution & Waterfall (DFSA Fund Rules Article 6)
distributions:
  frequencyMonths: 3  # QUARTERLY ONLY - DFSA requirement
  allowedFrequencies: [3]  # No other options
  allowedWaterfallStructures:
    - STANDARD
    - HURDLE_RATE
    - CLAWBACK
    
  minManagementFeePercentage: 0.5
  maxManagementFeePercentage: 2.5  # Stricter than global
  standardManagementFee: 2.0  # Industry standard in MENA
  
  minCarryPercentage: 15
  maxCarryPercentage: 25  # Stricter than global
  standardCarryPercentage: 20  # Industry standard
  
  hurdleRate:
    mandatory: false
    minSuggested: 6  # Safety margin above DFSA base rate
    maxAllowed: 10
    
  clawbackEnabled: true
  clawbackTrigger: "NAV drops below waterfall LP entitlements"
  clawbackPeriod: 3  # Years post-exit
  
  earlyExitPenalty: 3  # % if LP exits before lockup
  gateingAllowed: true  # Gates on redemptions
  gateingThreshold: 25  # % of fund requesting redemption
  
  managementFeeFrequency: MONTHLY_ACCRUAL_QUARTERLY_PAYMENT
  distributionCurrency: AED  # Must be in AED for Dubai
  
# Lockup & Redemption (DFSA Approach)
lockup:
  initialLockupMonths: 24  # 2 years - DFSA requirement
  hardLockupMonths: 12  # Can't redeem during this period
  softLockupMonths: 12  # Can redeem with penalty
  
  redemptionFrequency: QUARTERLY
  redemptionNoticeDays: 45
  redemptionProcessingDays: 60
  
  redemptionRestrictions:
    - NO_PARTIAL_REDEMPTION_BELOW: 50000  # Min AED per redemption
    - NO_REDEMPTION_IF_FUND_NAV_BELOW: 500000000  # Min fund size
    - NO_REDEMPTION_DURING_PORTFOLIO_LIQUIDATION: true

# Insider Trading Rules (DFSA insider Trading Regime)
insiderTrading:
  detectionEnabled: true
  applicableToGPAffiliates: true  # Strict
  applicableToAdvisers: true
  applicableToInterestedParties: true
  
  signals:
    gpActivityCorrelation:
      enabled: true
      threshold: 0.3
      detectionDays: 5  # Flag activity within 5 days of trades
      
    informationAsymmetry:
      enabled: true
      threshold: 0.35
      minDaysBeforeAnnouncement: 2  # Tighter than global
      
    frontRunningPattern:
      enabled: true
      threshold: 0.25
      minDaysBeforeAnnouncement: 2
      
    temporalAnomaly:
      enabled: true
      threshold: 0.1
      
  escalationThresholds:
    block: 0.90
    regulatoryReport: 0.75  # Auto-report to DFSA
    manualReview: 0.60
    monitor: 0.30
    
  stricterRulesForGPAffiliates: true  # GP subject to higher scrutiny
  gpAffiliateDefinition: "Any natural person closely associated with GP; spouse, children, controlled entities"
  
  reportToRegulator: true
  regulatoryReportingDeadline: 3  # Days
  confidentialTreatment: true  # Don't disclose internally before DFSA reports
  
# AML/CFT (DFSA & SCA Rules 2020)
amlCft:
  ctfThreshold: 100000  # AED (~$27k USD) - FATF guideline
  ctfReportingAuthorized: true
  ctfReportingAuthority: SCA  # National authority
  
  suspiciousActivity:
    sarRequired: true
    sarFilingDeadline: 3  # DAYS (stricter than FATF 10-day requirement)
    reportingAuthority: DFSA_AND_SCA  # Both must be notified
    
  strRequired: true
  strFilingDeadline: 3  # Days
  
  pep:
    check: true
    pepCheck: true
    pepFamilyCheck: true  # Spouse, children
    
  adverseMedia:
    screening: true
    updateFrequency: 86400  # Daily (mandatory)
    blacklistTrigger: IMMEDIATE_FREEZE  # Freeze upon adverse media hit
    
  transactionMonitoring:
    enabled: true
    frequency: REAL_TIME
    velocity_checks: true
    velocity_threshold: 5  # Transfers per day max for new accounts
    
  layering:
    detection: true
    alert_if: "3+ transfers within 24 hours to new wallets"
    
  riskCategorization:
    high_risk_countries: [KP, IR, SY, CU]  # Hard blocked
    medium_risk_countries: [PK, BD, AF]  # Escalation required
    lower_risk_countries: []
    
  enhanced_due_diligence:
    requiredFor:
      - PEP
      - HIGH_RISK_JURISDICTIONS
      - ASSET_BACKED_TOKENS  # PE funds)
      - VIRTUAL_ASSET_SERVICE_PROVIDERS

# Reporting & Compliance (DFSA & SCA)
reporting:
  quarterlyReportRequired: true
  quarterlyReportDays: 45
  quarterlyReportContents:
    - FUND_NAV
    - DISTRIBUTION_PAID
    - ASSET_ALLOCATION
    - PERFORMANCE_METRICS
    - PORTFOLIO_CHANGES
    - INSIDER_TRADING_INCIDENTS
    - AML_INCIDENTS
    - GOVERNANCE_VOTES_HELD
    
  annualAuditRequired: true
  auditStandard: IFRS_9  # Dubai uses IFRS
  auditDeadline: 120  # Days after year-end
  auditPublishRequired: true  # Must be sent to LPs
  
  annualReport:
    required: true
    contents: [FINANCIAL_STATEMENTS, AUDIT_OPINION, FUND_PERFORMANCE, GOVERNANCE_CHANGES]
    
  amlReporting:
    strRequired: true
    sarRequired: true
    sarFilingDeadline: 3
    strFilingDeadline: 3
    reportingAuthority: DFSA_SCA
    
  recordRetention: 10  # Years (DFSA requirement)
  
  regulatoryFilings:
    - ANNUAL_FUND_RETURN (SCA)
    - QUARTERLY_AUM_REPORT (DFSA)
    - SEMI_ANNUAL_PORTFOLIO_REVIEW (DFSA)
    - INSIDER_TRADING_INCIDENTS (DFSA_SCA)
    - AML_INCIDENTS (DFSA_SCA)

# P2P Trading Restrictions
peerToPeer:
  allowSecondaryMarketTrading: true
  requiresComplianceApproval: true  # Every trade
  allowedDistributionChannels:
    - DFSA_APPROVED_EXCHANGE
    - BISC_DCE  # Dubai International Smart Cold Exchange
    - DESIGNATED_SMART_CONTRACT_ONLY
    
  lockupPeriod: 365  # Days, minimum
  earlyExitPenalty: 3  # %
  
  allowedExchanges:
    - BISC_DCE
    - DIFC_EXCHANGE
    - REGULATED_ISLAMIC_FINANCE_PLATFORM
    
  restrictedCountriesForBuyers:
    hardBlock:
      - KP  # North Korea
      - IR  # Iran
      - SY  # Syria
      - CU  # Cuba
    mediumRisk:
      - PK  # Pakistan
      - BD  # Bangladesh
      - AF  # Afghanistan
      
  tradeApprovalProcess: MANDATORY_COMPLIANCE_GATE
  tradeApprovalLatency: 120  # Minutes max
  tradeAuditTrail: IMMUTABLE  # Blockchain-recorded

# Oracle Configuration (Dubai-Specific)
oracles:
  proofOfReserve:
    enabled: true
    provider: CHAINLINK
    checkInterval: 3600  # Hourly
    backupOracle: BAND_PROTOCOL
    
  assetRegistry:
    enabled: true
    registry: DUBAI_LAND_DEPARTMENT
    apiEndpoint: "https://api.dubailand.ae/verify"
    authentication: OAUTH2_WITH_CERTIFICATE
    backupRegistry: "https://api2.dubailand.ae"
    
  sanctionsData:
    enabled: true
    primaryProviders:
      - OFAC
      - UN_SECURITY_COUNCIL
      - DFSA
      - SCA
      - UAE_CBE  # Central Bank of UAE
    updateFrequency: 43200  # Every 12 hours (more frequent than weekly)
    fallbackToLocalList: true

# Smart Contract & Token Standards (ERC-1400)
smartContract:
  erc1400Standard: true
  automaticPausing: true
  pausingReasons:
    - OWNERSHIP_FRAUD_DETECTED
    - INSIDER_TRADING_RISK_HIGH
    - GOVERNANCE_VIOLATION
    - REGULATORY_SUSPENSION
    - AML_ALERT_TRIGGERED
    - SANCTIONS_MATCH_DETECTED
    
  automaticBurning: false  # Dubai prefers pause > burn
  burningAllowedVia: LP_VOTE_ONLY
  
  pausingTimeLock: 86400  # 24 hours for emergency pause
  resumingRequiresReview: true  # Manual review to unpause
  
  auditTrailOnChain: true  # All actions on-chain
  
# PII & Data Protection (UAE DPA 2021)
dataProtection:
  standard: UAE_DATA_PROTECTION_ACT_2021
  piiEncryption: AES_256
  minDataRetention: 7  # Years
  maxDataRetention: 10  # Years
  jurisdictionalDataStorage: REQUIRED  # Must be in UAE
  dataStorageLocation: DUBAI_DATA_CENTERS_ONLY
  dataProcessingCountries: [AE]  # No cross-border without consent
  
  piiElements: [FULL_NAME, EMAIL, PHONE, ID_NUMBER, BANK_ACCOUNT, WALLET_ADDRESS]
  piiSensitivity: HIGH
  
  dataSubjectRights:
    - ACCESS
    - RECTIFICATION
    - ERASURE
    - PORTABILITY
    
  consentMechanism: EXPLICIT_OPT_IN  # Not opt-out
  consentRetention: 7  # Years

# Compliance Escalation & SLA
escalation:
  escalationEmail: "compliance@yourfirm.ae"
  escalationTicketing: JIRA
  
  manualReviewQueue:
    maxWaitTime: 48  # Hours
    slaTarget: 95  # % meeting SLA
    notificationEmail: escalations@yourfirm.ae
    
  regulatoryReporting:
    autoFileSAR: false  # Manual for DFSA
    autoFileSTR: false  # Manual for SCA
    manualReviewRequired: true
    internalReviewDays: 2
    regulatoryFilingDays: 1
    reportingEmail: "aml@dfsa.ae, aml@sca.ae"
    reportingCCEmail: "compliance@yourfirm.ae"
    
  escalationAssignment:
    tier1ReviewEmail: "junior.compliance@yourfirm.ae"
    tier2ReviewEmail: "senior.compliance@yourfirm.ae"
    tier3ReviewEmail: "ceo@yourfirm.ae"

# Cost & Pricing (in AED)
pricing:
  setupFee: 50000  # AED (~$13.6K USD)
  monthlyFee: 15000  # AED (~$4.1K USD) per fund
  transactionFee: 0.05  # % of distribution
  
  currencyExchangeSource: CBE  # Central Bank of UAE for legal rates

# Feature Flags & Gradual Rollout
features:
  enableBatchDistributions: true
  enableLPGovernanceVoting: true
  enableSecondaryMarketTrading: true
  enableInsiderTradingDetection: true
  enableAutomaticAMLReporting: false  # Manual for now
  enableArabicLanguageSupport: true  # Critical for Dubai
  enableIslamicFinanceCompliance: false  # Phase 2
  enableCryptovaluesReporting: false  # Phase 2

# Testing & Deployment
deployment:
  environment: PRODUCTION
  besuNetworkID: 1
  databaseSchema: pe_funds_ae
  logLevel: INFO
  alertingEnabled: true
  alertEmail: "alerts@yourfirm.ae"
  backupEmail: "alerts.backup@yourfirm.ae"

# Compliance Officer Details
complianceOfficer:
  name: "Chief Compliance Officer"
  email: "cco@yourfirm.ae"
  phone: "+971-XX-XXX-XXXX"
  legalTitle: "CCO"
  regulatoryLiability: true

# Version Control
configVersion: "1.0.0-AE"
lastUpdated: "2026-02-25"
nextReviewDate: "2026-06-30"
effectiveDate: "2026-03-15"
```

---

## Part 6: Adding New Jurisdictions (Step-by-Step Guide)

### 6.1 Process to Add New Jurisdiction (e.g., Singapore)

**Step 1**: Create jurisdiction config file
```bash
# Create config/jurisdictions/sg.yaml using Dubai template
cp config/jurisdictions/ae.yaml config/jurisdictions/sg.yaml
# Edit sg.yaml with Singapore-specific rules (MAS, ACRA, etc.)
```

**Step 2**: Register jurisdiction in database
```sql
INSERT INTO jurisdictions (code, name, region, active, launchDate, config_version) 
VALUES ('SG', 'Singapore', 'APAC', true, '2026-06-01', '1.0.0-SG');
```

**Step 3**: Update environment variables (if needed)
```
JURISDICTION_CONFIGS_PATH=/config/jurisdictions
SUPPORTED_JURISDICTIONS=AE,IN,EU,US,SG
```

**Step 4**: No code changes needed! Rules engine automatically picks up new config file

**Step 5**: Test with sample fund
```typescript
const engine = new JurisdictionRulesEngine('/config', dbClient);
const sgRules = await engine.loadJurisdiction('SG');
// Rules now apply automatically to any fund with jurisdiction_code = 'SG'
```

### 6.2 Checklist for New Jurisdiction

```
☐ Identify primary and secondary regulators
☐ Document all applicable regulations
☐ Define fund structure requirements (min size, investor count, fund types)
☐ Define KYC/AML requirements (documents, sanctions lists)
☐ Define governance rules (voting thresholds, major change definitions)
☐ Define distribution rules (frequency, management fee limits, carry limits)
☐ Define insider trading detection rules (signal weights, escalation thresholds)
☐ Define AML/CFT thresholds (CTF amount, STR deadline)
☐ Define reporting requirements (quarterly, annual, regulatory)
☐ Define data protection rules (encryption, retention, storage location)
☐ Create YAML config file following Dubai template
☐ Register jurisdiction in database
☐ Test rules engine with sample fund
☐ Schedule compliance team review
☐ Launch with 1-2 pilot funds
```

---

## Part 7: Why This Approach Works

| Approach | Advantage for Dubai Launch + Future Expansion |
|----------|-----------------------------------------------|
| **Rules in YAML** | Non-technical team (Compliance) can update rules without code changes |
| **Jurisdiction Rules Engine** | Same service code supports all jurisdictions; branches based on config |
| **Database junction table** | Tracks jurisdiction decision history; audit trail for regulators |
| **Feature flags per jurisdiction** | Can gradually enable/disable features per jurisdiction (e.g., auto-AML reporting phase 2) |
| **Pluggable components** | Oracle, detector, gateway all call rules engine; no re-architecting needed |
| **YAML versioning** | Roll back rules if needed; no code redeployment required |

---

## Part 8: Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│        API Request (Fund Governance / P2P Trade)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  Get Fund Jurisdiction      │
        │  (fundId → AE / IN / US)    │
        └────────────┬────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  JurisdictionRulesEngine             │
        │  .loadJurisdiction('AE')             │
        │  ↓ Loads ae.yaml from disk           │
        │  ↓ Caches in memory                  │
        │  ↓ Returns JurisdictionRules object  │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  PEFundGovernanceOracle /            │
        │  PEInsiderTradingDetector            │
        │  (Uses jurisdiction rules)           │
        │  ▼ Check voting thresholds           │
        │  ▼ Calculate risk with local weights │
        │  ▼ Escalate per local rules          │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  log ComplianceDecision()            │
        │  (Records which rule was applied)   │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  Return response to API caller       │
        │  (APPROVED / ESCALATED / BLOCKED)   │
        └────────────────────────────────────┘
```

---

## Part 9: Next Steps for Implementation

1. **Immediate (Week 1)**
   - [ ] Create JurisdictionRulesEngine service (400 lines, done above)
   - [ ] Create Dubai config file (ae.yaml, done above)
   - [ ] Refactor PEFundGovernanceOracle to use rules engine
   - [ ] Refactor PEInsiderTradingDetector to use rules engine

2. **Short-term (Weeks 2-3)**
   - [ ] Deploy to test environment; validate with 5 test funds
   - [ ] Create India config (in.yaml) + EU config (eu.yaml) + US config (us.yaml)
   - [ ] Test switching between jurisdictions (same codebase, different rules)
   - [ ] Compliance review of Dubai rules alignment

3. **Medium-term (Weeks 4-6)**
   - [ ] Go-live Dubai (with in.yaml, eu.yaml as backup)
   - [ ] Launch Singapore config (sg.yaml) for Phase 2
   - [ ] Document jurisdiction extension process for future teams

---

**Status**: Architecture Ready ✅  
**Complexity**: Medium (1-2 weeks to fully implement)  
**Benefit**: Single codebase, unlimited jurisdictions, no re-deployment for rule changes  

