/**
 * AML Tool Wrapper for LangChain Agent
 * Wraps AML Service as a LangChain tool
 * Integrates with AMLPatternDetector for velocity analysis and anomaly detection
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';
import winston from 'winston';
import { AMLPatternDetector, Transaction as PatternTransaction } from './amlPatternDetector';

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
    riskAdjustment?: number;
    profileMetrics?: {
      transactionsPerHour: number;
      transactionsPerDay: number;
      averageAmount: number;
      totalVolume: number;
    };
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
    Analyzes transaction patterns for anomalies and velocity-based risk adjustments.
    Returns risk assessment, flags, and screening results.
    Input: wallet, jurisdiction, optional: transactionHistory, entityType, metadata
    Output: status, riskScore, riskLevel, flags, sanctions, velocity, message`;
  
  schema = AMLInputSchema;
  protected apiUrl: string;
  protected timeout: number;
  protected patternDetector: AMLPatternDetector;

  constructor() {
    super();
    this.apiUrl = process.env.API_URL || 'http://localhost:4000';
    this.timeout = 45000; // 45 second timeout (external API calls)
    this.patternDetector = new AMLPatternDetector();
  }

  /**
   * Execute AML screening with pattern analysis
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

      // Analyze transaction patterns if history provided
      let patternAnalysis = null;
      let velocityRiskAdjustment = 0;
      let patternAnomalies: string[] = [];

      if (input.transactionHistory && input.transactionHistory.length > 0) {
        try {
          // Convert transaction history to pattern detector format
          const transactions: PatternTransaction[] = input.transactionHistory.map((tx: any) => ({
            id: tx.id || tx.hash || String(Math.random()),
            from: tx.from || tx.sender || 'unknown',
            to: tx.to || tx.recipient || 'unknown',
            amount: tx.amount || tx.value || 0,
            timestamp: tx.timestamp || tx.time || Date.now(),
            type: tx.type || 'transfer'
          }));

          patternAnalysis = this.patternDetector.analyzePatterns(transactions);
          velocityRiskAdjustment = patternAnalysis.velocityRiskAdjustment;
          patternAnomalies = patternAnalysis.anomalyFlags.map(flag => `${flag.type} (${flag.severity})`);

          logger.info('AMLTool: Pattern analysis complete', {
            wallet: input.wallet,
            hasAnomalies: patternAnalysis.hasAnomalies,
            riskAdjustment: velocityRiskAdjustment,
            anomalyCount: patternAnomalies.length
          });
        } catch (patternError) {
          logger.warn('AMLTool: Pattern analysis failed, continuing with basic screening', {
            error: patternError instanceof Error ? patternError.message : String(patternError)
          });
        }
      }

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

      // Apply pattern-based risk adjustment
      let adjustedRiskScore = response.data.riskScore || 0;
      if (patternAnalysis) {
        adjustedRiskScore = Math.max(0, Math.min(100, adjustedRiskScore + velocityRiskAdjustment));
      }

      // Determine status based on adjusted risk score and patterns
      let status = response.data.status || 'APPROVED';
      if (patternAnalysis?.hasAnomalies && adjustedRiskScore >= 70) {
        status = 'ESCALATED';
      }

      const result: AMLResult = {
        status: status,
        riskScore: adjustedRiskScore,
        riskLevel: this.determineRiskLevel(adjustedRiskScore),
        flags: [
          ...(response.data.flags || []),
          ...patternAnomalies
        ],
        sanctions: response.data.sanctions || {
          matched: false,
          sources: []
        },
        velocity: {
          normal: !patternAnalysis?.hasAnomalies,
          anomalies: patternAnomalies,
          riskAdjustment: velocityRiskAdjustment,
          profileMetrics: patternAnalysis ? {
            transactionsPerHour: patternAnalysis.velocityProfile.transactionsPerHour,
            transactionsPerDay: patternAnalysis.velocityProfile.transactionsPerDay,
            averageAmount: patternAnalysis.velocityProfile.averageAmount,
            totalVolume: patternAnalysis.velocityProfile.totalVolume
          } : undefined
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
        flagCount: result.flags.length,
        patternAdjustment: velocityRiskAdjustment
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
          normal: false,
          anomalies: ['AML_SERVICE_UNAVAILABLE']
        },
        message: `AML screening unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      } as AMLResult);
    }
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }
}

/**
 * Initialize AML Tool instance
 */
export function initializeAMLTool(): AMLTool {
  return new AMLTool();
}
