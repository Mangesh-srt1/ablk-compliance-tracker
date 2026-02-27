/**
 * AML Tool Wrapper for LangChain Agent
 * Wraps AML Service as a LangChain tool
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
    new winston.transports.File({ filename: 'logs/aml-tool.log' })
  ]
});

const AMLInputSchema = z.object({
  wallet: z.string().describe('Wallet address or entity identifier'),
  jurisdiction: z.string().describe('Jurisdiction code (AE, IN, US)'),
  transactionHistory: z.array(z.record(z.any())).optional().describe('Historical transactions'),
  entityType: z.string().optional().describe('Type of entity (individual, business, exchange)'),
  metadata: z.record(z.any()).optional().describe('Additional metadata')
});

export type AMLInput = z.infer<typeof AMLInputSchema>;

export interface AMLResult {
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'ERROR';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: string[];
  sanctions: {
    matched: boolean;
    sources: string[];
  };
  velocity: {
    normal: boolean;
    anomalies: string[];
  };
  message: string;
  timestamp: Date;
}

/**
 * AMLTool: Screens entity against AML/sanctions lists
 */
export class AMLTool extends StructuredTool {
  name = 'aml_screening';
  description = `Screen entity against AML/sanctions databases using Chainalysis and OFAC.
    Checks for sanctions matches, PEP designations, risk scoring, velocity analysis.
    Returns risk assessment, flags, and screening results.
    Input: wallet, jurisdiction, optional: transactionHistory, entityType, metadata
    Output: status, riskScore, riskLevel, flags, sanctions, velocity, message`;
  
  schema = AMLInputSchema;
  protected apiUrl: string;
  protected timeout: number;

  constructor() {
    super();
    this.apiUrl = process.env.API_URL || 'http://localhost:4000';
    this.timeout = 45000; // 45 second timeout (external API calls)
  }

  /**
   * Execute AML screening
   */
  async _call(input: AMLInput): Promise<string> {
    const startTime = Date.now();
    
    try {
      logger.info('AMLTool: Starting screening', {
        wallet: input.wallet,
        jurisdiction: input.jurisdiction,
        entityType: input.entityType || 'unknown',
        hasTransactionHistory: !!input.transactionHistory && input.transactionHistory.length > 0
      });

      // Call AML service API
      const response = await axios.post(
        `${this.apiUrl}/api/v1/aml/check`,
        {
          wallet: input.wallet,
          jurisdiction: input.jurisdiction,
          transactionHistory: input.transactionHistory || [],
          entityType: input.entityType || 'individual',
          metadata: input.metadata || {}
        },
        { timeout: this.timeout }
      );

      const result: AMLResult = {
        status: response.data.status,
        riskScore: response.data.riskScore || 0,
        riskLevel: response.data.riskLevel || 'LOW',
        flags: response.data.flags || [],
        sanctions: response.data.sanctions || {
          matched: false,
          sources: []
        },
        velocity: response.data.velocity || {
          normal: true,
          anomalies: []
        },
        message: response.data.message || 'Screening completed',
        timestamp: new Date()
      };

      const duration = Date.now() - startTime;
      logger.info('AMLTool: Screening complete', {
        wallet: input.wallet,
        status: result.status,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        duration,
        sanctionsMatched: result.sanctions.matched,
        flagCount: result.flags.length
      });

      return JSON.stringify(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('AMLTool: Screening failed', {
        wallet: input.wallet,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      // Graceful degradation: return escalated result if AML unavailable
      return JSON.stringify({
        status: 'ERROR',
        riskScore: 50,
        riskLevel: 'HIGH',
        flags: ['AML_UNAVAILABLE', 'REQUIRES_MANUAL_REVIEW'],
        sanctions: {
          matched: false,
          sources: []
        },
        velocity: {
          normal: true,
          anomalies: []
        },
        message: `AML screening unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      } as AMLResult);
    }
  }
}

/**
 * Initialize AML Tool instance
 */
export function initializeAMLTool(): AMLTool {
  return new AMLTool();
}
