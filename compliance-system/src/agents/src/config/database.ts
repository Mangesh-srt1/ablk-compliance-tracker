/**
 * Database Configuration
 * PostgreSQL connection setup
 */

import { Pool } from 'pg';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/database.log' }),
  ],
});

let pool: Pool;

/**
 * Create database connection pool with retry logic
 */
export async function connectDatabase(maxRetries = 5, retryDelayMs = 2000): Promise<void> {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'compliance_db',
    user: process.env.DB_USER || 'compliance_user',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production',
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Database connection attempt ${attempt}/${maxRetries}`, {
        host: config.host,
        port: config.port,
        database: config.database,
      });

      pool = new Pool(config);

      // Test connection
      const client = await pool.connect();
      logger.info('Database connection established successfully', {
        host: config.host,
        database: config.database,
        attempt,
      });

      client.release();

      // Set up error handling
      pool.on('error', (err: any) => {
        logger.error('Unexpected database error', {
          error: err instanceof Error ? err.message : String(err),
          code: err?.code || 'UNKNOWN',
        });
      });

      pool.on('connect', () => {
        logger.debug('New database connection established');
      });

      pool.on('remove', () => {
        logger.debug('Database connection removed');
      });

      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn(`Database connection failed (attempt ${attempt}/${maxRetries})`, {
        error: lastError.message,
        nextRetryIn: attempt < maxRetries ? `${retryDelayMs}ms` : 'no retry',
      });

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // All retries exhausted
  logger.error('Failed to connect to database after all retry attempts', {
    maxRetries,
    lastError: lastError?.message,
  });

  throw new Error(
    `Failed to connect to database after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Get database pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query with error handling
 */
export async function executeQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const client = await getPool().connect();

  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Database query failed', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction
 */
export async function executeTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Database transaction failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connections
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database connections closed');
  }
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  message?: string;
}> {
  try {
    const startTime = Date.now();
    await executeQuery('SELECT 1 as health_check');
    const latency = Date.now() - startTime;

    return {
      healthy: true,
      latency,
      message: 'Database connection healthy',
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
