/**
 * KYC Tool Wrapper for LangChain Agent
 * Wraps KYC Service as a LangChain tool
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
    new winston.transports.File({ filename: 'logs/kyc-tool.log' })
  ]
});

const KYCInputSchema = z.object({
  name: z.string().describe('Full name of the entity'),
  jurisdiction: z.string().describe('Jurisdiction code (AE, IN, US)'),
  documentType: z.string().describe('Document type (PASSPORT, PROOF_OF_ADDRESS, UAE_ID_COPY)'),
  liveness: z.boolean().optional().describe('Whether liveness verification is required'),
  metadata: z.record(z.any()).optional().describe('Additional metadata')
});

export type KYCInput = z.infer<typeof KYCInputSchema>;

export interface KYCResult {
  status: 'VERIFIED' | 'REJECTED' | 'PENDING' | 'ERROR';
  confidence: number;
  riskScore: number;
  flags: string[];
  message: string;
  timestamp: Date;
}

/**
 * KYCTool: Verifies entity identity via Ballerine integration
 */
export class KYCTool extends StructuredTool {
  name = 'kyc_verification';
  description = `Verify entity identity using KYC service. 
    Checks identity documents, applies liveness verification if needed.
    Returns verification status, confidence score, and risk assessment.
    Input: name, jurisdiction, documentType, optional: liveness, metadata
    Output: status, confidence, riskScore, flags, message`;
  
  schema = KYCInputSchema;
  protected apiUrl: string;
  protected timeout: number;

  constructor() {
    super();
    this.apiUrl = process.env.API_URL || 'http://localhost:4000';
    this.timeout = 30000; // 30 second timeout
  }

  /**
   * Execute KYC verification
   */
  async _call(input: KYCInput): Promise<string> {
    const startTime = Date.now();
    
    try {
      logger.info('KYCTool: Starting verification', {
        name: input.name,
        jurisdiction: input.jurisdiction,
        documentType: input.documentType
      });

      // Call KYC service API
      const response = await axios.post(
        `${this.apiUrl}/api/v1/kyc/check`,
        {
          name: input.name,
          jurisdiction: input.jurisdiction,
          documentType: input.documentType,
          liveness: input.liveness ?? true,
          metadata: input.metadata || {}
        },
        { timeout: this.timeout }
      );

      const result: KYCResult = {
        status: response.data.status,
        confidence: response.data.confidence || 0.85,
        riskScore: response.data.riskScore || 15,
        flags: response.data.flags || [],
        message: response.data.message || 'Verification completed',
        timestamp: new Date()
      };

      const duration = Date.now() - startTime;
      logger.info('KYCTool: Verification complete', {
        name: input.name,
        status: result.status,
        confidence: result.confidence,
        riskScore: result.riskScore,
        duration,
        flags: result.flags
      });

      return JSON.stringify(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('KYCTool: Verification failed', {
        name: input.name,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      // Graceful degradation: return escalated result if KYC unavailable
      return JSON.stringify({
        status: 'ERROR',
        confidence: 0,
        riskScore: 50,
        flags: ['KYC_UNAVAILABLE', 'REQUIRES_MANUAL_REVIEW'],
        message: `KYC verification unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      } as KYCResult);
    }
  }
}

/**
 * Initialize KYC Tool instance
 */
export function initializeKYCTool(): KYCTool {
  return new KYCTool();
}
