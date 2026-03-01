/**
 * AML Anomaly Detector Agent
 * Analyzes P2P transfers for suspicious patterns indicative of hawala or other money laundering
 *
 * File: src/api/src/agents/amlAnomalyDetectorAgent.ts
 */

import { Pool } from 'pg';
import { TransactionMonitoringService } from '../services/transactionMonitoringService';
import { KytTransaction } from '../types/kyt';
import { Jurisdiction } from '../types/aml';

/**
 * P2P Transfer interface
 */
export interface P2PTransfer {
  fromAddress: string;
  toAddress: string;
  amount: number;
  tokenSymbol: string;
  assetId: string; // Token/asset contract address
  timestamp: Date;
  transactionHash: string;
  chainId: number;
  jurisdiction?: Jurisdiction;
}

/**
 * AML Pattern Detail
 */
export interface AMLPattern {
  pattern: string;
  confidence: number;
  indicators: string[];
}

/**
 * AML Assessment Result
 */
export interface AMLAssessmentResult {
  riskScore: number;
  overallRiskScore: number; // Duplicate for compatibility
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  escalationLevel?: 'none' | 'review' | 'escalate' | 'manual_review' | 'block';
  shouldBlock?: boolean;
  flags: string[];
  patterns?: AMLPattern[] | string[]; // Support both array types
  reasoning: string;
  recommendations?: string | string[];
  timestamp: Date;
}

/** Supported time-window options (minutes) for velocity analysis */
const ALLOWED_TIME_WINDOWS_MINUTES: ReadonlySet<number> = new Set([15, 30, 60, 120, 360, 720, 1440]);

/**
 * AML Anomaly Detector Agent
 * Uses the TransactionMonitoringService to detect anomalous patterns in P2P transfers.
 */
export class AMLAnomalyDetectorAgent {
  private logger: any;
  private txMonitorService: TransactionMonitoringService;

  constructor(
    private dbClient: Pool,
    private besuProvider: any // ethers.js provider for blockchain queries
  ) {
    this.logger = console;
    this.txMonitorService = new TransactionMonitoringService();
  }

  /**
   * Map a P2PTransfer into the KytTransaction shape expected by TransactionMonitoringService.
   */
  private toKytTransaction(transfer: P2PTransfer): KytTransaction {
    return {
      id: transfer.transactionHash,
      amount: transfer.amount,
      currency: transfer.tokenSymbol,
      timestamp: transfer.timestamp.toISOString(),
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
    };
  }

  /**
   * Derive an AMLAssessmentResult from a KYT analysis result.
   */
  private buildAssessment(kytResult: any): AMLAssessmentResult {
    const riskScore = kytResult.score ?? 0;
    const flags: string[] = (kytResult.alerts ?? []).map((a: any) => a.type as string);
    const patterns: AMLPattern[] = (kytResult.alerts ?? []).map((a: any) => ({
      pattern: a.type,
      confidence: a.confidence,
      indicators: a.evidence ? Object.values(a.evidence).map(String) : [],
    }));

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let escalationLevel: 'none' | 'review' | 'escalate' | 'manual_review' | 'block';
    let shouldBlock = false;

    if (riskScore >= 80) {
      riskLevel = 'critical';
      escalationLevel = 'block';
      shouldBlock = true;
    } else if (riskScore >= 60) {
      riskLevel = 'high';
      escalationLevel = 'manual_review';
    } else if (riskScore >= 30) {
      riskLevel = 'medium';
      escalationLevel = 'review';
    } else {
      riskLevel = 'low';
      escalationLevel = 'none';
    }

    const reasoning =
      flags.length > 0
        ? `Detected patterns: ${flags.join(', ')}. Risk score: ${riskScore}/100.`
        : `No anomalous patterns detected. Risk score: ${riskScore}/100.`;

    const recommendations: string[] =
      kytResult.recommendations ?? (shouldBlock ? ['Block transfer for manual review'] : ['Proceed with standard monitoring']);

    return {
      riskScore,
      overallRiskScore: riskScore,
      riskLevel,
      escalationLevel,
      shouldBlock,
      flags,
      patterns,
      reasoning,
      recommendations,
      timestamp: new Date(),
    };
  }

  /**
   * Assess risk of hawala (informal money transfer) patterns
   *
   * @param transfer P2P transfer details
   * @returns AML assessment with risk score and flags
   */
  async assessHawalaRisk(transfer: P2PTransfer): Promise<AMLAssessmentResult> {
    try {
      const kytTx = this.toKytTransaction(transfer);
      const jurisdiction = (transfer.jurisdiction ?? 'AE') as Jurisdiction;

      const kytResult = await this.txMonitorService.analyzeTransactions({
        entityId: transfer.fromAddress,
        transactions: [kytTx],
        jurisdiction,
      });

      return this.buildAssessment(kytResult);
    } catch (error: any) {
      this.logger.error('Error assessing hawala risk:', error);
      throw error;
    }
  }

  /**
   * Analyze transaction velocity for anomalies
   * @param address Wallet address
   * @param timeWindowMinutes Time window to analyze (must be one of the allowed values)
   * @param jurisdiction Jurisdiction for risk rules
   */
  async analyzeVelocity(
    address: string,
    timeWindowMinutes: number = 60,
    jurisdiction: Jurisdiction = 'AE' as Jurisdiction
  ): Promise<AMLAssessmentResult> {
    try {
      // Validate and sanitize the time window against an allowlist to prevent SQL injection
      const safeWindowMinutes = ALLOWED_TIME_WINDOWS_MINUTES.has(timeWindowMinutes)
        ? timeWindowMinutes
        : 60;

      // Fetch recent transactions for the address from DB if available
      let transactions: KytTransaction[] = [];

      try {
        const result = await this.dbClient.query<{
          tx_hash: string;
          amount: number;
          currency: string;
          created_at: Date;
          from_address: string;
          to_address: string;
        }>(
          `SELECT tx_hash, amount, currency, created_at, from_address, to_address
           FROM blockchain_monitoring
           WHERE (from_address = $1 OR to_address = $1)
             AND created_at >= NOW() - ($2 || ' minutes')::INTERVAL
           ORDER BY created_at DESC
           LIMIT 100`,
          [address, String(safeWindowMinutes)]
        );

        transactions = result.rows.map((row) => ({
          id: row.tx_hash,
          amount: row.amount,
          currency: row.currency,
          timestamp: row.created_at.toISOString(),
          fromAddress: row.from_address,
          toAddress: row.to_address,
        }));
      } catch {
        // DB unavailable – proceed with empty transaction list
      }

      if (transactions.length === 0) {
        return {
          riskScore: 0,
          overallRiskScore: 0,
          riskLevel: 'low',
          escalationLevel: 'none',
          shouldBlock: false,
          flags: [],
          patterns: [],
          reasoning: 'No recent transactions found for velocity analysis.',
          recommendations: ['Monitor for continued activity'],
          timestamp: new Date(),
        };
      }

      const kytResult = await this.txMonitorService.analyzeTransactions({
        entityId: address,
        transactions,
        jurisdiction,
      });

      return this.buildAssessment(kytResult);
    } catch (error: any) {
      this.logger.error('Error analyzing velocity:', error);
      throw error;
    }
  }

  /**
   * Detect structured transactions (smurfing)
   * @param address Wallet address
   * @param jurisdiction Jurisdiction for risk rules
   */
  async detectStructuring(
    address: string,
    jurisdiction: Jurisdiction = 'AE' as Jurisdiction
  ): Promise<AMLAssessmentResult> {
    try {
      let transactions: KytTransaction[] = [];

      try {
        const result = await this.dbClient.query<{
          tx_hash: string;
          amount: number;
          currency: string;
          created_at: Date;
          from_address: string;
          to_address: string;
        }>(
          `SELECT tx_hash, amount, currency, created_at, from_address, to_address
           FROM blockchain_monitoring
           WHERE from_address = $1
             AND created_at >= NOW() - INTERVAL '30 days'
           ORDER BY created_at DESC
           LIMIT 200`,
          [address]
        );

        transactions = result.rows.map((row) => ({
          id: row.tx_hash,
          amount: row.amount,
          currency: row.currency,
          timestamp: row.created_at.toISOString(),
          fromAddress: row.from_address,
          toAddress: row.to_address,
        }));
      } catch {
        // DB unavailable – proceed with empty transaction list
      }

      if (transactions.length === 0) {
        return {
          riskScore: 0,
          overallRiskScore: 0,
          riskLevel: 'low',
          escalationLevel: 'none',
          shouldBlock: false,
          flags: [],
          patterns: [],
          reasoning: 'No transactions found for structuring analysis.',
          recommendations: ['Proceed with transfer'],
          timestamp: new Date(),
        };
      }

      const kytResult = await this.txMonitorService.analyzeTransactions({
        entityId: address,
        transactions,
        jurisdiction,
      });

      return this.buildAssessment(kytResult);
    } catch (error: any) {
      this.logger.error('Error detecting structuring:', error);
      throw error;
    }
  }
}


