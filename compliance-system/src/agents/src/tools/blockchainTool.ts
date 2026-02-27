/**
 * Blockchain Tool Wrapper for LangChain Agent
 * Monitors blockchain transactions for compliance
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
    new winston.transports.File({ filename: 'logs/blockchain-tool.log' })
  ]
});

const BlockchainInputSchema = z.object({
  wallet: z.string().describe('Wallet address to monitor'),
  blockchainType: z.enum(['permissioned', 'public']).describe('Type of blockchain (permissioned=Besu, public=Ethereum/Solana)'),
  transactionHash: z.string().optional().describe('Specific transaction hash to check'),
  lookbackDays: z.number().optional().describe('Number of days to look back for pattern analysis'),
  metadata: z.record(z.any()).optional().describe('Additional metadata')
});

export type BlockchainInput = z.infer<typeof BlockchainInputSchema>;

export interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  riskFlag: boolean;
  riskReason?: string;
}

export interface BlockchainAnalysisResult {
  wallet: string;
  blockchainType: 'permissioned' | 'public';
  status: 'APPROVED' | 'FLAGGED' | 'ERROR';
  riskFlag: boolean;
  riskScore: number;
  recentTransactions: BlockchainTransaction[];
  anomalies: string[];
  message: string;
  timestamp: Date;
}

/**
 * BlockchainTool: Monitors blockchain for compliance
 * OPTIONAL feature for Week 3 - can be deferred if time-constrained
 */
export class BlockchainTool extends StructuredTool {
  name = 'blockchain_monitoring';
  description = `Monitor blockchain transactions for compliance anomalies.
    Checks transaction patterns, detects unusual activity, identifies high-risk transactions.
    Works with permissioned (Besu) and public (Ethereum/Solana) blockchains.
    Input: wallet, blockchainType, optional: transactionHash, lookbackDays, metadata
    Output: status, riskFlag, riskScore, recentTransactions, anomalies, message`;
  
  schema = BlockchainInputSchema;
  protected apiUrl: string;
  protected timeout: number;
  protected enabled: boolean;

  constructor() {
    super();
    this.apiUrl = process.env.API_URL || 'http://localhost:4000';
    this.timeout = 20000; // 20 second timeout
    
    // Check if blockchain monitoring is enabled
    this.enabled = process.env.BLOCKCHAIN_MONITORING_ENABLED === 'true';
    
    if (!this.enabled) {
      logger.warn('BlockchainTool: Blockchain monitoring disabled - set BLOCKCHAIN_MONITORING_ENABLED=true to enable');
    }
  }

  /**
   * Execute blockchain analysis
   */
  async _call(input: BlockchainInput): Promise<string> {
    const startTime = Date.now();
    
    // Return graceful response if blockchain monitoring disabled
    if (!this.enabled) {
      logger.info('BlockchainTool: Blockchain monitoring disabled for wallet', {
        wallet: input.wallet,
        blockchainType: input.blockchainType
      });

      return JSON.stringify({
        wallet: input.wallet,
        blockchainType: input.blockchainType,
        status: 'APPROVED',
        riskFlag: false,
        riskScore: 0,
        recentTransactions: [],
        anomalies: ['BLOCKCHAIN_MONITORING_DISABLED'],
        message: 'Blockchain monitoring is disabled - proceeding with other checks',
        timestamp: new Date()
      } as BlockchainAnalysisResult);
    }

    try {
      logger.info('BlockchainTool: Starting blockchain analysis', {
        wallet: input.wallet,
        blockchainType: input.blockchainType,
        transactionHash: input.transactionHash,
        lookbackDays: input.lookbackDays || 30
      });

      // Call blockchain monitoring API
      const response = await axios.post(
        `${this.apiUrl}/api/v1/blockchain/analyze`,
        {
          wallet: input.wallet,
          blockchainType: input.blockchainType,
          transactionHash: input.transactionHash,
          lookbackDays: input.lookbackDays || 30,
          metadata: input.metadata || {}
        },
        { timeout: this.timeout }
      );

      const result: BlockchainAnalysisResult = {
        wallet: input.wallet,
        blockchainType: input.blockchainType,
        status: response.data.status,
        riskFlag: response.data.riskFlag || false,
        riskScore: response.data.riskScore || 0,
        recentTransactions: response.data.recentTransactions || [],
        anomalies: response.data.anomalies || [],
        message: response.data.message || 'Blockchain analysis completed',
        timestamp: new Date()
      };

      const duration = Date.now() - startTime;
      logger.info('BlockchainTool: Analysis complete', {
        wallet: input.wallet,
        status: result.status,
        riskFlag: result.riskFlag,
        riskScore: result.riskScore,
        txCount: result.recentTransactions.length,
        anomalyCount: result.anomalies.length,
        duration
      });

      return JSON.stringify(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('BlockchainTool: Analysis failed', {
        wallet: input.wallet,
        blockchainType: input.blockchainType,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      // Graceful degradation: continue with other checks if blockchain unavailable
      return JSON.stringify({
        wallet: input.wallet,
        blockchainType: input.blockchainType,
        status: 'APPROVED',
        riskFlag: false,
        riskScore: 0,
        recentTransactions: [],
        anomalies: ['BLOCKCHAIN_UNAVAILABLE'],
        message: `Blockchain analysis unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      } as BlockchainAnalysisResult);
    }
  }
}

/**
 * Initialize Blockchain Tool instance
 */
export function initializeBlockchainTool(): BlockchainTool {
  return new BlockchainTool();
}
