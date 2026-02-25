/**
 * Database Configuration
 * PostgreSQL connection setup
 */

import { Pool } from 'pg';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/database.log' })
  ]
});

let pool: Pool;

/**
 * Create database connection pool
 */
export async function connectDatabase(): Promise<void> {
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'compliance_db',
      user: process.env.DB_USER || 'compliance_user',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.NODE_ENV === 'production',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
    };

    pool = new Pool(config);

    // Test connection
    const client = await pool.connect();
    logger.info('Database connection established', {
      host: config.host,
      database: config.database
    });

    client.release();

    // Set up error handling
    pool.on('error', (err) => {
      logger.error('Unexpected database error', {
        error: err.message,
        code: err.code
      });
    });

    pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    pool.on('remove', () => {
      logger.debug('Database connection removed');
    });

  } catch (error) {
    logger.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
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
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const client = await getPool().connect();

  try {
    const result = await client.query(query, params);
    return result.rows;

  } catch (error) {
    logger.error('Database query failed', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params.length,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;

  } finally {
    client.release();
  }
}

/**
 * Execute a transaction
 */
export async function executeTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Database transaction failed', {
      error: error instanceof Error ? error.message : String(error)
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
      message: 'Database connection healthy'
    };

  } catch (error) {
    return {
      healthy: false,
      message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}