/**
 * Database Transaction Manager
 * Implements ACID transactions for critical compliance operations
 * Wraps multi-step operations (KYC insert, AML insert, compliance aggregation) in transactions
 * Provides automatic rollback on constraint violations or errors
 */

import { Pool, PoolClient } from 'pg';
import { Logger } from 'winston';
import logger from '../config/logger';

export interface TransactionOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  timeout?: number;
}

export class TransactionManager {
  constructor(private pool: Pool) {}

  /**
   * Execute a function within a database transaction
   * Automatically commits on success, rolls back on error
   * 
   * @example
   * const result = await transactionManager.run(async (client) => {
   *   await client.query('INSERT INTO kyc_records ...');
   *   await client.query('INSERT INTO aml_records ...');
   *   return { success: true };
   * });
   */
  async run<T>(
    callback: (client: PoolClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const client = await this.pool.connect();
    const isolationLevel = options.isolationLevel || 'READ COMMITTED';
    const transactionId = Math.random().toString(36).substring(7);

    try {
      logger.info(`[TX-${transactionId}] Starting transaction with isolation level ${isolationLevel}`);
      
      // Set isolation level and begin transaction
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      
      // Execute the callback within transaction
      const result = await callback(client);
      
      // Commit transaction
      await client.query('COMMIT');
      logger.info(`[TX-${transactionId}] Transaction committed successfully`);
      
      return result;
    } catch (error) {
      // Rollback on error
      try {
        await client.query('ROLLBACK');
        logger.warn(`[TX-${transactionId}] Transaction rolled back due to error:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (rollbackError) {
        logger.error(`[TX-${transactionId}] Rollback failed:`, {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a function with savepoints for nested transactions
   * Useful for complex multi-step operations with optional sub-operations
   */
  async runWithSavepoint<T>(
    callback: (client: PoolClient) => Promise<T>,
    savepointName: string = 'sp_compliance',
    options: TransactionOptions = {}
  ): Promise<T> {
    const client = await this.pool.connect();
    const isolationLevel = options.isolationLevel || 'READ COMMITTED';
    const transactionId = Math.random().toString(36).substring(7);

    try {
      logger.info(`[TX-${transactionId}] Starting transaction with savepoint ${savepointName}`);
      
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      await client.query(`SAVEPOINT ${savepointName}`);
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.info(`[TX-${transactionId}] Transaction with savepoint committed`);
      
      return result;
    } catch (error) {
      try {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        logger.warn(`[TX-${transactionId}] Savepoint rolled back:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (rollbackError) {
        logger.error(`[TX-${transactionId}] Savepoint rollback failed`);
      }
      
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * KYC+AML+Compliance aggregation transaction
 * Ensures atomicity: all three operations succeed or all rollback
 */
export async function aggregateComplianceTransaction(
  transactionManager: TransactionManager,
  kycQuery: string,
  amlQuery: string,
  complianceQuery: string,
  params: {
    kycParams: unknown[];
    amlParams: unknown[];
    complianceParams: unknown[];
  }
): Promise<{ kycId: string; amlId: string; complianceId: string }> {
  return transactionManager.run(async (client) => {
    // Step 1: Insert KYC record
    const kycResult = await client.query(kycQuery, params.kycParams);
    const kycId = kycResult.rows[0].id;
    logger.info(`[TX] KYC record created: ${kycId}`);

    // Step 2: Insert AML record (depends on KYC)
    const amlResult = await client.query(amlQuery, [kycId, ...params.amlParams]);
    const amlId = amlResult.rows[0].id;
    logger.info(`[TX] AML record created: ${amlId}`);

    // Step 3: Create compliance aggregation (depends on both KYC+AML)
    const complianceResult = await client.query(complianceQuery, [kycId, amlId, ...params.complianceParams]);
    const complianceId = complianceResult.rows[0].id;
    logger.info(`[TX] Compliance record created: ${complianceId}`);

    return { kycId, amlId, complianceId };
  });
}

/**
 * Constraint violation handler
 * Converts PostgreSQL constraint errors to readable compliance errors
 */
export function handleConstraintError(error: any): { code: string; message: string; field?: string } {
  if (error.code === '23505') {
    // Unique violation
    return {
      code: 'DUPLICATE_ENTITY',
      message: 'Entity KYC/AML check already exists',
      field: error.constraint,
    };
  }
  
  if (error.code === '23503') {
    // Foreign key violation
    return {
      code: 'INVALID_REFERENCE',
      message: 'Referenced entity does not exist',
      field: error.constraint,
    };
  }
  
  if (error.code === '23502') {
    // NOT NULL violation
    return {
      code: 'MISSING_FIELD',
      message: `Required field missing: ${error.column}`,
      field: error.column,
    };
  }

  return {
    code: 'DATABASE_ERROR',
    message: error.message || 'Unknown database error',
  };
}
