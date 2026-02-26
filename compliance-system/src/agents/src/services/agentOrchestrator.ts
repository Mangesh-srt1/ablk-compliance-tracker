/**
 * Agent Orchestrator
 * Coordinates execution of compliance agents
 */

import winston from 'winston';
import { ComplianceGraph } from '../graphs/complianceGraph';
import { Transaction, ComplianceResult, AgentResponse } from '../types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/orchestrator.log' }),
  ],
});

export class AgentOrchestrator {
  private complianceGraph: ComplianceGraph;

  constructor(complianceGraph: ComplianceGraph) {
    this.complianceGraph = complianceGraph;
  }

  /**
   * Execute compliance check for a transaction
   */
  async executeComplianceCheck(transaction: Transaction): Promise<ComplianceResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting compliance check orchestration', {
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
      });

      // Validate transaction
      this.validateTransaction(transaction);

      // Execute compliance workflow
      const result = await this.complianceGraph.executeWorkflow(transaction);
      const processingTime = Date.now() - startTime;

      // Update processing time
      result.processingTime = processingTime;

      logger.info('Compliance check orchestration completed', {
        transactionId: transaction.id,
        status: result.status,
        riskScore: result.riskScore,
        processingTime,
      });

      return result;
    } catch (error) {
      logger.error('Compliance check orchestration failed', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return error result
      return {
        transactionId: transaction.id,
        status: 'escalated',
        riskScore: 1.0,
        findings: [
          {
            type: 'system_error',
            severity: 'critical',
            message: 'Compliance check orchestration failed',
            details: { error: error instanceof Error ? error.message : String(error) },
          },
        ],
        recommendations: ['Manual compliance review required'],
        metadata: {},
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        agentsUsed: [],
        errors: [error instanceof Error ? error.message : 'Orchestration failed'],
      };
    }
  }

  /**
   * Execute batch compliance checks
   */
  async executeBatchComplianceChecks(transactions: Transaction[]): Promise<ComplianceResult[]> {
    logger.info('Starting batch compliance checks', {
      batchSize: transactions.length,
    });

    const results: ComplianceResult[] = [];

    // Process transactions in parallel with concurrency limit
    const concurrencyLimit = parseInt(process.env.BATCH_CONCURRENCY || '5');
    const batches = this.chunkArray(transactions, concurrencyLimit);

    for (const batch of batches) {
      const batchPromises = batch.map((transaction) => this.executeComplianceCheck(transaction));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const transaction = batch[index];
          logger.error('Batch compliance check failed', {
            transactionId: transaction.id,
            error: result.reason,
          });

          // Add error result
          results.push({
            transactionId: transaction.id,
            status: 'escalated',
            riskScore: 1.0,
            findings: [
              {
                type: 'batch_error',
                severity: 'critical',
                message: 'Batch compliance check failed',
                details: { error: result.reason },
              },
            ],
            recommendations: ['Manual compliance review required'],
            metadata: {},
            processingTime: 0,
            timestamp: new Date().toISOString(),
            agentsUsed: [],
            errors: [
              result.reason instanceof Error ? result.reason.message : 'Batch processing failed',
            ],
          });
        }
      });
    }

    logger.info('Batch compliance checks completed', {
      totalTransactions: transactions.length,
      resultsCount: results.length,
    });

    return results;
  }

  /**
   * Get compliance status for a transaction
   */
  async getComplianceStatus(transactionId: string): Promise<ComplianceResult | null> {
    try {
      logger.info('Getting compliance status', { transactionId });

      // This would typically query the database
      // For now, return null (not implemented)
      return null;
    } catch (error) {
      logger.error('Failed to get compliance status', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Validate transaction data
   */
  private validateTransaction(transaction: Transaction): void {
    if (!transaction.id) {
      throw new Error('Transaction ID is required');
    }

    if (!transaction.type) {
      throw new Error('Transaction type is required');
    }

    if (typeof transaction.amount !== 'number' || transaction.amount < 0) {
      throw new Error('Valid transaction amount is required');
    }

    if (!transaction.timestamp) {
      throw new Error('Transaction timestamp is required');
    }
  }

  /**
   * Chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get orchestrator health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    message?: string;
    lastCheck: string;
  }> {
    try {
      // Perform basic health checks
      const isGraphHealthy = await this.checkGraphHealth();

      return {
        healthy: isGraphHealthy,
        message: isGraphHealthy ? 'Orchestrator is healthy' : 'Graph health check failed',
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if compliance graph is healthy
   */
  private async checkGraphHealth(): Promise<boolean> {
    try {
      // Test with a minimal transaction
      const testTransaction: Transaction = {
        id: 'health-check-' + Date.now(),
        type: 'transfer',
        amount: 100,
        timestamp: new Date().toISOString(),
      };

      // This should not actually process, just validate the graph structure
      // For now, just return true
      return true;
    } catch (error) {
      logger.error('Graph health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
