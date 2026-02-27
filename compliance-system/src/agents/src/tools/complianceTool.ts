/**
 * Compliance Tool Wrapper for LangChain Agent
 * Wraps Compliance Service as a LangChain tool
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/compliance-tool.log' })
  ]
});

const ComplianceInputSchema = z.object({
  entityId: z.string().describe('Entity identifier'),
  jurisdiction: z.string().describe('Jurisdiction code (AE, IN, US)'),
  kycStatus: z.string().describe('KYC verification status'),
  amlRiskScore: z.number().describe('AML risk score (0-100)'),
  transactionAmount: z.number().optional().describe('Transaction amount'),
  entityType: z.string().optional().describe('Type of entity'),
  metadata: z.record(z.any()).optional().describe('Additional metadata')
});

export type ComplianceInput = z.infer<typeof ComplianceInputSchema>;

export interface ComplianceRuleViolation {
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
}

export interface ComplianceResult {
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'ERROR';
  overallRiskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: ComplianceRuleViolation[];
  recommendations: string[];
  jurisdictionRules: string[];
  message: string;
  timestamp: Date;
}

/**
 * ComplianceTool: Aggregates compliance decisions based on rules
 */
export class ComplianceTool extends StructuredTool {
  name = 'compliance_decision';
  description = `Make final compliance decision by aggregating all checks.
    Applies jurisdiction-specific rules and risk thresholds.
    Returns final decision, risk level, rule violations, and recommendations.
    Input: entityId, jurisdiction, kycStatus, amlRiskScore, optional: transactionAmount, entityType, metadata
    Output: status, overallRiskScore, riskLevel, violations, recommendations, jurisdictionRules, message`;
  
  schema = ComplianceInputSchema;
  protected apiUrl: string;
  protected timeout: number;

  constructor() {
    super();
    this.apiUrl = process.env.API_URL || 'http://localhost:4000';
    this.timeout = 30000; // 30 second timeout
  }

  /**
   * Execute compliance decision aggregation
   */
  async _call(input: ComplianceInput): Promise<string> {
    const startTime = Date.now();
    
    try {
      logger.info('ComplianceTool: Starting decision aggregation', {
        entityId: input.entityId,
        jurisdiction: input.jurisdiction,
        kycStatus: input.kycStatus,
        amlRiskScore: input.amlRiskScore,
        transactionAmount: input.transactionAmount
      });

      // Call Compliance service API
      const response = await axios.post(
        `${this.apiUrl}/api/v1/compliance/aggregate`,
        {
          entityId: input.entityId,
          jurisdiction: input.jurisdiction,
          kycStatus: input.kycStatus,
          amlRiskScore: input.amlRiskScore,
          transactionAmount: input.transactionAmount || 0,
          entityType: input.entityType || 'individual',
          metadata: input.metadata || {}
        },
        { timeout: this.timeout }
      );

      const result: ComplianceResult = {
        status: response.data.status,
        overallRiskScore: response.data.overallRiskScore || input.amlRiskScore,
        riskLevel: response.data.riskLevel || 'MEDIUM',
        violations: response.data.violations || [],
        recommendations: response.data.recommendations || [],
        jurisdictionRules: response.data.jurisdictionRules || [],
        message: response.data.message || 'Compliance decision completed',
        timestamp: new Date()
      };

      const duration = Date.now() - startTime;
      logger.info('ComplianceTool: Decision complete', {
        entityId: input.entityId,
        status: result.status,
        overallRiskScore: result.overallRiskScore,
        riskLevel: result.riskLevel,
        violationCount: result.violations.length,
        duration
      });

      return JSON.stringify(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('ComplianceTool: Decision failed', {
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      // Graceful degradation: escalate if compliance decision unavailable
      return JSON.stringify({
        status: 'ERROR',
        overallRiskScore: 75,
        riskLevel: 'HIGH',
        violations: [{
          rule: 'COMPLIANCE_SERVICE_UNAVAILABLE',
          severity: 'HIGH',
          message: 'Unable to complete compliance decision'
        }],
        recommendations: ['Manual compliance review required'],
        jurisdictionRules: [],
        message: `Compliance decision unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      } as ComplianceResult);
    }
  }
}

/**
 * Initialize Compliance Tool instance
 */
export function initializeComplianceTool(): ComplianceTool {
  return new ComplianceTool();
}
