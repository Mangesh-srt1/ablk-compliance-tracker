/**
 * Jurisdiction Rules Engine Service
 * 
 * Decouples compliance rules from code by loading jurisdiction-specific rules from YAML configs.
 * Enables multi-jurisdiction deployments with a single codebase.
 * Production-ready, fully tested TypeScript implementation.
 * 
 * Usage:
 *   const engine = new JurisdictionRulesEngine('/config', dbClient);
 *   const rules = await engine.loadJurisdiction('AE'); // Load Dubai
 *   const isValidFund = await engine.validateFundStructure(fundData);
 *   await engine.logComplianceDecision(fundId, 'AE', 'GOVERNANCE_CHANGE', 'APPROVED', 'AE.governance.majorChangesRequireVote', details);
 */

import * as YAML from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import postgres from 'pg';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface JurisdictionConfig {
  jurisdiction: {
    code: string;
    name: string;
    region: string;
    launchDate?: string;
    timeZone?: string;
    currencyCode?: string;
  };
  regulatoryBodies?: Array<{
    id: string;
    name: string;
    jurisdiction?: string;
    website?: string;
    reportingEmail?: string;
  }>;
  fundStructure?: {
    requiredLegalEntity?: string;
    minFundSize?: number;
    maxInvestors?: number;
    allowedFundTypes?: string[];
  };
  kyc?: {
    providerIntegration?: string;
    docRequirements?: {
      individual?: string[];
      corporate?: string[];
    };
    sanctionsList?: string[];
    livenessCheck?: boolean;
    faceMatch?: boolean;
    kycRefreshInterval?: number;
  };
  governance?: {
    majorChangesRequireVote?: boolean;
    votingThreshold?: number;
    votingDeadlineDays?: number;
    majorChangeDefinitions?: string[];
    gpHasVeto?: boolean;
    distributionChangesRequireVote?: boolean;
  };
  distributions?: {
    frequencyMonths?: number;
    allowedFrequencies?: number[];
    minManagementFeePercentage?: number;
    maxManagementFeePercentage?: number;
    minCarryPercentage?: number;
    maxCarryPercentage?: number;
    allowedWaterfallStructures?: string[];
  };
  insiderTrading?: {
    detectionEnabled?: boolean;
    signals?: {
      [key: string]: {
        enabled?: boolean;
        threshold?: number;
        weight?: number;
      };
    };
    escalationThresholds?: {
      block?: number;
      regulatoryReport?: number;
      manualReview?: number;
      monitor?: number;
    };
  };
  amlCft?: {
    ctfThreshold?: number;
    strFilingRequired?: boolean;
    strFilingDeadline?: number;
    pep_check?: boolean;
  };
  reporting?: {
    quarterlyReportRequired?: boolean;
    annualAuditRequired?: boolean;
    recordRetention?: number;
  };
  dataProtection?: {
    standard?: string;
    piiEncryption?: string;
    jurisdictionalDataStorage?: string;
  };
  oracles?: {
    proofOfReserve?: {
      enabled?: boolean;
      provider?: string;
      checkInterval?: number;
    };
    assetRegistry?: {
      enabled?: boolean;
      registry?: string;
      apiEndpoint?: string;
    };
  };
  smartContract?: {
    erc1400Standard?: boolean;
    automaticPausing?: boolean;
    automaticBurning?: boolean;
  };
  [key: string]: any; // Allow extensibility
}

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  warnings?: string[];
}

export interface ComplianceDecisionLog {
  id: string;
  fundId: string;
  jurisdictionCode: string;
  decisionType: string;
  decision: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING_REVIEW';
  ruleReference: string;
  ruleVersion?: string;
  details: any;
  timestamp: Date;
}

// ============================================================================
// JURISDICTION RULES ENGINE
// ============================================================================

export class JurisdictionRulesEngine extends EventEmitter {
  private logger: winston.Logger;
  private dbClient: postgres.Client;
  private configPath: string;
  private rulesCache: Map<string, JurisdictionConfig> = new Map();
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();
  private cacheTimeout: NodeJS.Timeout | null = null;

  constructor(
    configPath: string,
    dbClient: postgres.Client,
    loggerInstance?: winston.Logger
  ) {
    super();
    this.configPath = configPath;
    this.dbClient = dbClient;
    
    // Use provided logger or create default
    this.logger = loggerInstance || winston.createLogger({
      level: 'info',
      format: winston.format.json({ space: 2 }),
      defaultMeta: { service: 'jurisdiction-rules-engine' },
      transports: [
        new winston.transports.File({ filename: 'logs/rules-engine-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/rules-engine-combined.log' })
      ]
    });

    this.validateConfigDirectory();
  }

  /**
   * Validate config directory exists and is accessible
   */
  private validateConfigDirectory(): void {
    const jurisdictionsDir = path.join(this.configPath, 'jurisdictions');
    
    if (!fs.existsSync(jurisdictionsDir)) {
      throw new Error(
        `Jurisdictions config directory not found: ${jurisdictionsDir}. ` +
        `Create directory and add YAML config files (e.g., ae.yaml, in.yaml, sg.yaml)`
      );
    }

    this.logger.info('Jurisdiction rules engine initialized', {
      configPath: this.configPath,
      jurisdictionsDir
    });
  }

  /**
   * Load jurisdiction rules from YAML config file
   * Implements caching + file watching for auto-reload on config updates
   */
  async loadJurisdiction(jurisdictionCode: string): Promise<JurisdictionConfig> {
    const code = jurisdictionCode.toUpperCase();

    // Check cache first
    if (this.rulesCache.has(code)) {
      return this.rulesCache.get(code)!;
    }

    const filePath = path.join(
      this.configPath,
      'jurisdictions',
      `${code.toLowerCase()}.yaml`
    );

    try {
      // Read and parse YAML
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const config = YAML.parse(fileContent) as JurisdictionConfig;

      // Validate structure
      this.validateConfigStructure(config, code);

      // Cache the rules
      this.rulesCache.set(code, config);

      // Watch file for changes (auto-reload)
      if (!this.fileWatchers.has(code)) {
        this.setupFileWatcher(code, filePath);
      }

      this.logger.info('Jurisdiction rules loaded successfully', {
        jurisdictionCode: code,
        name: config.jurisdiction.name,
        region: config.jurisdiction.region,
        filePath
      });

      // Emit load event
      this.emit('jurisdictionLoaded', {
        code,
        name: config.jurisdiction.name,
        timestamp: new Date()
      });

      return config;

    } catch (error) {
      this.logger.error('Failed to load jurisdiction rules', {
        jurisdictionCode: code,
        filePath,
        errorMessage: (error as Error).message,
        stack: (error as Error).stack
      });

      throw new Error(
        `Failed to load jurisdiction config for '${code}': ${(error as Error).message}`
      );
    }
  }

  /**
   * Setup file watcher for auto-reload on config changes
   */
  private setupFileWatcher(jurisdictionCode: string, filePath: string): void {
    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.logger.info('Jurisdiction config file changed, reloading', {
            jurisdictionCode
          });
          
          // Remove from cache and reload
          this.rulesCache.delete(jurisdictionCode);
          
          // Debounce reload (prevent multiple triggers)
          if (this.cacheTimeout) clearTimeout(this.cacheTimeout);
          this.cacheTimeout = setTimeout(async () => {
            try {
              await this.loadJurisdiction(jurisdictionCode);
              this.emit('configReloaded', {
                jurisdictionCode,
                timestamp: new Date()
              });
            } catch (error) {
              this.logger.error('Failed to reload jurisdiction config', {
                jurisdictionCode,
                error: (error as Error).message
              });
            }
          }, 1000);
        }
      });

      this.fileWatchers.set(jurisdictionCode, watcher);

    } catch (error) {
      this.logger.warn('Could not setup file watcher', {
        jurisdictionCode,
        reason: (error as Error).message
      });
    }
  }

  /**
   * Validate jurisdiction config structure
   */
  private validateConfigStructure(config: JurisdictionConfig, code: string): void {
    const requiredFields = [
      'jurisdiction.code',
      'jurisdiction.name',
      'jurisdiction.region'
    ];

    for (const field of requiredFields) {
      const [section, key] = field.split('.');
      const sectionData = config[section as keyof JurisdictionConfig] as any;
      
      if (!sectionData || !sectionData[key]) {
        throw new Error(
          `Required field missing: ${field} in ${code}.yaml`
        );
      }
    }

    // Validate jurisdiction code matches filename
    if (config.jurisdiction.code !== code) {
      this.logger.warn('Jurisdiction code mismatch', {
        filename: code,
        configCode: config.jurisdiction.code
      });
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
  ): Promise<ValidationResult> {
    const rules = await this.loadJurisdiction(fundData.jurisdictionCode);
    const violations: string[] = [];
    const warnings: string[] = [];

    if (!rules.fundStructure) {
      return { isValid: true, violations, warnings };
    }

    const fs = rules.fundStructure;

    // Check fund size
    if (fs.minFundSize && fundData.fundSize < fs.minFundSize) {
      violations.push(
        `Fund size ${fundData.fundSize} below minimum ${fs.minFundSize} for ${fundData.jurisdictionCode}`
      );
    }

    // Check investor count
    if (fs.maxInvestors && fundData.investorCount > fs.maxInvestors) {
      violations.push(
        `Investor count ${fundData.investorCount} exceeds maximum ${fs.maxInvestors}`
      );
    }

    // Check allowed fund types
    if (fs.allowedFundTypes && fs.allowedFundTypes.length > 0) {
      const hasValidType = fundData.fundTypes.some(type =>
        fs.allowedFundTypes!.includes(type)
      );
      if (!hasValidType) {
        violations.push(
          `Fund types [${fundData.fundTypes.join(', ')}] not allowed. ` +
          `Allowed: [${fs.allowedFundTypes.join(', ')}]`
        );
      }
    }

    this.logger.info('Fund structure validation completed', {
      jurisdictionCode: fundData.jurisdictionCode,
      isValid: violations.length === 0,
      violationCount: violations.length,
      warningCount: warnings.length
    });

    return {
      isValid: violations.length === 0,
      violations,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Get KYC requirements for jurisdiction
   */
  async getKYCRequirements(jurisdictionCode: string): Promise<{
    provider: string;
    requiredDocumentsIndividual: string[];
    requiredDocumentsCorporate: string[];
    sanctionsLists: string[];
    livenessCheck: boolean;
    faceMatch: boolean;
    refreshIntervalDays: number;
  }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const kyc = rules.kyc || {};

    return {
      provider: kyc.providerIntegration || 'ballerine',
      requiredDocumentsIndividual: kyc.docRequirements?.individual || [],
      requiredDocumentsCorporate: kyc.docRequirements?.corporate || [],
      sanctionsLists: kyc.sanctionsList || [],
      livenessCheck: kyc.livenessCheck !== false,
      faceMatch: kyc.faceMatch !== false,
      refreshIntervalDays: kyc.kycRefreshInterval || 365
    };
  }

  /**
   * Check if governance change requires LP vote
   */
  async requiresLPVote(
    jurisdictionCode: string,
    changeType: string
  ): Promise<{
    required: boolean;
    threshold: number;
    deadlineDays: number;
    gpHasVeto: boolean;
  }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const gov = rules.governance || {};

    const changeRequiresVote =
      (gov.majorChangeDefinitions || []).includes(changeType) ||
      (changeType === 'DISTRIBUTION_CHANGE' && gov.distributionChangesRequireVote);

    return {
      required: (gov.majorChangesRequireVote === true) && changeRequiresVote,
      threshold: gov.votingThreshold || 50,
      deadlineDays: gov.votingDeadlineDays || 14,
      gpHasVeto: gov.gpHasVeto === true
    };
  }

  /**
   * Validate distribution waterfall
   */
  async validateDistributionWaterfall(
    jurisdictionCode: string,
    waterfall: {
      lpPercentage: number;
      gpCarryPercentage: number;
      mgmtFeePercentage: number;
      hurdleRate?: number;
    }
  ): Promise<ValidationResult> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const violations: string[] = [];
    const warnings: string[] = [];

    if (!rules.distributions) {
      return { isValid: true, violations, warnings };
    }

    const dist = rules.distributions;

    // Management fee checks
    if (dist.maxManagementFeePercentage && waterfall.mgmtFeePercentage > dist.maxManagementFeePercentage) {
      violations.push(
        `Management fee ${waterfall.mgmtFeePercentage}% exceeds max ${dist.maxManagementFeePercentage}%`
      );
    }

    if (dist.minManagementFeePercentage && waterfall.mgmtFeePercentage < dist.minManagementFeePercentage) {
      violations.push(
        `Management fee ${waterfall.mgmtFeePercentage}% below min ${dist.minManagementFeePercentage}%`
      );
    }

    // Carry checks
    if (dist.maxCarryPercentage && waterfall.gpCarryPercentage > dist.maxCarryPercentage) {
      violations.push(
        `GP carry ${waterfall.gpCarryPercentage}% exceeds max ${dist.maxCarryPercentage}%`
      );
    }

    if (dist.minCarryPercentage && waterfall.gpCarryPercentage < dist.minCarryPercentage) {
      warnings.push(
        `GP carry ${waterfall.gpCarryPercentage}% below recommended min ${dist.minCarryPercentage}%`
      );
    }

    this.logger.info('Distribution waterfall validation completed', {
      jurisdictionCode,
      isValid: violations.length === 0,
      violationCount: violations.length,
      warningCount: warnings.length
    });

    return {
      isValid: violations.length === 0,
      violations,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Get insider trading escalation thresholds
   */
  async getInsiderTradingThresholds(jurisdictionCode: string): Promise<{
    blockThreshold: number;
    regulatoryReportThreshold: number;
    manualReviewThreshold: number;
    monitorThreshold: number;
    signalWeights: { [key: string]: number };
  }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const it = rules.insiderTrading || {};

    return {
      blockThreshold: it.escalationThresholds?.block || 0.90,
      regulatoryReportThreshold: it.escalationThresholds?.regulatoryReport || 0.75,
      manualReviewThreshold: it.escalationThresholds?.manualReview || 0.60,
      monitorThreshold: it.escalationThresholds?.monitor || 0.30,
      signalWeights: Object.entries(it.signals || {}).reduce(
        (acc, [key, val]: [string, any]) => {
          acc[key] = val.weight || val.threshold || 0;
          return acc;
        },
        {} as { [key: string]: number }
      )
    };
  }

  /**
   * Check if AML/CTF reporting required
   */
  async getAMLReportingRequirements(jurisdictionCode: string): Promise<{
    strRequired: boolean;
    strFilingDeadlineDays: number;
    ctfThreshold: number;
  }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const aml = rules.amlCft || {};

    return {
      strRequired: aml.strFilingRequired === true,
      strFilingDeadlineDays: aml.strFilingDeadline || 10,
      ctfThreshold: aml.ctfThreshold || 100000
    };
  }

  /**
   * Get data protection requirements
   */
  async getDataProtectionRequirements(jurisdictionCode: string): Promise<{
    standard: string;
    encryption: string;
    minRetentionYears: number;
    maxRetentionYears: number;
    jurisdictionalStorageRequired: boolean;
  }> {
    const rules = await this.loadJurisdiction(jurisdictionCode);
    const dp = rules.dataProtection || {};

    return {
      standard: dp.standard || 'GDPR',
      encryption: dp.piiEncryption || 'AES_256',
      minRetentionYears: 7,
      maxRetentionYears: 10,
      jurisdictionalStorageRequired: dp.jurisdictionalDataStorage === 'REQUIRED'
    };
  }

  /**
   * Log a compliance decision with audit trail
   */
  async logComplianceDecision(
    fundId: string,
    jurisdictionCode: string,
    decisionType: string,
    decision: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING_REVIEW',
    ruleReference: string,
    details: any,
    decidedBy?: string
  ): Promise<ComplianceDecisionLog> {
    const id = uuidv4();
    const timestamp = new Date();

    try {
      await this.dbClient.query(
        `INSERT INTO compliance_decision_audit (
          id, fund_id, jurisdiction_code, decision_type, decision, 
          rule_reference, details, decided_by, decision_timestamp, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
        [
          id,
          fundId,
          jurisdictionCode,
          decisionType,
          decision,
          ruleReference,
          JSON.stringify(details),
          decidedBy || 'SYSTEM',
          timestamp,
          timestamp
        ]
      );

      this.logger.info('Compliance decision logged', {
        id,
        fundId,
        jurisdictionCode,
        decisionType,
        decision,
        ruleReference
      });

      return {
        id,
        fundId,
        jurisdictionCode,
        decisionType,
        decision,
        ruleReference,
        details,
        timestamp
      };

    } catch (error) {
      this.logger.error('Failed to log compliance decision', {
        fundId,
        jurisdictionCode,
        errorMessage: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get audit log for fund
   */
  async getFundAuditLog(
    fundId: string,
    limit: number = 50
  ): Promise<ComplianceDecisionLog[]> {
    try {
      const result = await this.dbClient.query(
        `SELECT id, fund_id, jurisdiction_code, decision_type, decision, 
                 rule_reference, details, created_at
         FROM compliance_decision_audit
         WHERE fund_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [fundId, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        fundId: row.fund_id,
        jurisdictionCode: row.jurisdiction_code,
        decisionType: row.decision_type,
        decision: row.decision,
        ruleReference: row.rule_reference,
        details: row.details,
        timestamp: row.created_at
      }));

    } catch (error) {
      this.logger.error('Failed to fetch audit log', {
        fundId,
        errorMessage: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get all supported jurisdictions
   */
  async getSupportedJurisdictions(): Promise<
    Array<{ code: string; name: string; region: string }>
  > {
    const jurisdictionsDir = path.join(this.configPath, 'jurisdictions');
    const files = fs.readdirSync(jurisdictionsDir);
    const jurisdictions: Array<{ code: string; name: string; region: string }> = [];

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const jurisdictionCode = file.replace(/\.(yaml|yml)$/, '').toUpperCase();
        
        try {
          const rules = await this.loadJurisdiction(jurisdictionCode);
          jurisdictions.push({
            code: rules.jurisdiction.code,
            name: rules.jurisdiction.name,
            region: rules.jurisdiction.region
          });
        } catch (error) {
          this.logger.warn('Failed to load jurisdiction', {
            code: jurisdictionCode,
            error: (error as Error).message
          });
        }
      }
    }

    return jurisdictions.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Clear cache and reload all rules
   */
  async reloadAllRules(): Promise<void> {
    this.rulesCache.clear();
    this.logger.info('All jurisdiction rules cleared from cache and available for reload');
    this.emit('cacheCleared', { timestamp: new Date() });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedJurisdictions: number;
    jurisdictionCodes: string[];
    totalCacheSize: number;
  } {
    return {
      cachedJurisdictions: this.rulesCache.size,
      jurisdictionCodes: Array.from(this.rulesCache.keys()),
      totalCacheSize: JSON.stringify(Array.from(this.rulesCache.values())).length
    };
  }

  /**
   * Cleanup: stop file watchers
   */
  destroy(): void {
    for (const [code, watcher] of this.fileWatchers.entries()) {
      watcher.close();
      this.logger.info('File watcher closed', { jurisdictionCode: code });
    }
    
    this.fileWatchers.clear();
    this.rulesCache.clear();

    if (this.cacheTimeout) {
      clearTimeout(this.cacheTimeout);
    }

    this.logger.info('Jurisdiction rules engine destroyed');
  }
}

export default JurisdictionRulesEngine;
