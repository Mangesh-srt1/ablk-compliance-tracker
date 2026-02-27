/**
 * Jurisdiction Rules Tool for LangChain Agent
 * Loads and applies jurisdiction-specific compliance rules
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/jurisdiction-rules-tool.log' })
  ]
});

const JurisdictionRulesInputSchema = z.object({
  jurisdiction: z.string().describe('Jurisdiction code (AE, IN, US, etc)'),
  includeGovernance: z.boolean().optional().describe('Whether to include governance rules'),
  includeRiskScoring: z.boolean().optional().describe('Whether to include risk scoring weights')
});

export type JurisdictionRulesInput = z.infer<typeof JurisdictionRulesInputSchema>;

export interface JurisdictionRules {
  jurisdiction: {
    code: string;
    name: string;
    region: string;
  };
  kyc: {
    providers: string[];
    docRequirements: string[];
    liveness: boolean;
    maxVerificationTime: number;
  };
  aml: {
    sanctionsList: string[];
    pepScreening: boolean;
    velocityWindow: number;
    velocityThreshold: number;
  };
  governance?: {
    majorChangesRequireVote: boolean;
    votingThreshold: number;
  };
  riskScoring?: {
    kycWeight: number;
    amlWeight: number;
    velocityWeight: number;
  };
}

/**
 * JurisdictionRulesTool: Loads and returns jurisdiction-specific rules
 */
export class JurisdictionRulesTool extends StructuredTool {
  name = 'jurisdiction_rules';
  description = `Load jurisdiction-specific compliance rules from configuration.
    Retrieves KYC requirements, AML thresholds, governance rules, risk scoring weights.
    Input: jurisdiction code (AE, IN, US, etc), optional: includeGovernance, includeRiskScoring
    Output: Complete jurisdiction rules including KYC, AML, governance, risk scoring`;
  
  schema = JurisdictionRulesInputSchema;
  private rulesCache: Map<string, JurisdictionRules> = new Map();
  private rulesPath: string;

  constructor() {
    super();
    this.rulesPath = process.env.JURISDICTION_RULES_PATH || './src/config/jurisdictions';
  }

  /**
   * Execute rule loading
   */
  async _call(input: JurisdictionRulesInput): Promise<string> {
    const startTime = Date.now();
    
    try {
      const jurisdiction = input.jurisdiction.toUpperCase();

      logger.info('JurisdictionRulesTool: Loading rules', {
        jurisdiction,
        includeGovernance: input.includeGovernance ?? true,
        includeRiskScoring: input.includeRiskScoring ?? true
      });

      // Check cache first
      if (this.rulesCache.has(jurisdiction)) {
        const cached = this.rulesCache.get(jurisdiction)!;
        logger.info('JurisdictionRulesTool: Rules loaded from cache', {
          jurisdiction,
          duration: Date.now() - startTime
        });
        return JSON.stringify(cached);
      }

      // Load from YAML file
      const rules = this.loadJurisdictionRules(jurisdiction);

      // Transform based on options
      let result = { ...rules };
      if (!input.includeGovernance) {
        delete result.governance;
      }
      if (!input.includeRiskScoring) {
        delete result.riskScoring;
      }

      // Cache for future use
      this.rulesCache.set(jurisdiction, rules);

      const duration = Date.now() - startTime;
      logger.info('JurisdictionRulesTool: Rules loaded', {
        jurisdiction,
        hasGovernance: !!result.governance,
        hasRiskScoring: !!result.riskScoring,
        duration
      });

      return JSON.stringify(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('JurisdictionRulesTool: Rule loading failed', {
        jurisdiction: input.jurisdiction,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      // Return default rules if jurisdiction not found
      return JSON.stringify(this.getDefaultRules(input.jurisdiction));
    }
  }

  /**
   * Load rules from YAML file
   */
  private loadJurisdictionRules(jurisdiction: string): JurisdictionRules {
    const filePath = path.join(
      this.rulesPath,
      `${jurisdiction.toLowerCase()}.yaml`
    );

    if (!fs.existsSync(filePath)) {
      logger.warn('JurisdictionRulesTool: Rules file not found, using defaults', {
        jurisdiction,
        expectedPath: filePath
      });
      return this.getDefaultRules(jurisdiction);
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const rules = yaml.load(fileContent) as JurisdictionRules;

      logger.debug('JurisdictionRulesTool: Rules loaded from file', {
        jurisdiction,
        filePath
      });

      return rules;
    } catch (error) {
      logger.error('JurisdictionRulesTool: Error parsing YAML file', {
        jurisdiction,
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });

      return this.getDefaultRules(jurisdiction);
    }
  }

  /**
   * Get default rules if jurisdiction not found
   */
  private getDefaultRules(jurisdiction: string): JurisdictionRules {
    return {
      jurisdiction: {
        code: jurisdiction.toUpperCase(),
        name: `${jurisdiction.toUpperCase()} Jurisdiction`,
        region: 'UNKNOWN'
      },
      kyc: {
        providers: ['ballerine'],
        docRequirements: ['PASSPORT', 'PROOF_OF_ADDRESS'],
        liveness: true,
        maxVerificationTime: 300
      },
      aml: {
        sanctionsList: ['OFAC_SDN', 'UN_SECURITY_COUNCIL'],
        pepScreening: true,
        velocityWindow: 3600,
        velocityThreshold: 1000000
      },
      governance: {
        majorChangesRequireVote: false,
        votingThreshold: 50
      },
      riskScoring: {
        kycWeight: 30,
        amlWeight: 50,
        velocityWeight: 20
      }
    };
  }

  /**
   * Clear rule cache
   */
  clearCache(): void {
    this.rulesCache.clear();
    logger.info('JurisdictionRulesTool: Cache cleared');
  }
}

/**
 * Initialize Jurisdiction Rules Tool instance
 */
export function initializeJurisdictionRulesTool(): JurisdictionRulesTool {
  return new JurisdictionRulesTool();
}
