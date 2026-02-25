/**
 * PostgreSQL Database Configuration
 * Connection pool and query utilities
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
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

class DatabaseConnection {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize database connection pool
   */
  async connect(): Promise<void> {
    try {
      if (this.pool) {
        logger.warn('Database pool already exists');
        return;
      }

      // Validate required environment variables
      const dbHost = process.env.DB_HOST;
      const dbPort = Number.parseInt(process.env.DB_PORT || '5432', 10);
      const dbName = process.env.DB_NAME;
      const dbUser = process.env.DB_USER;
      const dbPassword = process.env.DB_PASSWORD;

      if (!dbHost || !dbName || !dbUser || !dbPassword) {
        throw new Error('Missing required database environment variables');
      }

      // Create connection pool
      this.pool = new Pool({
        host: dbHost,
        port: dbPort,
        database: dbName,
        user: dbUser,
        password: dbPassword,
        max: Number.parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      // Handle pool events
      this.pool.on('connect', (client: PoolClient) => {
        logger.debug('New client connected to database');
      });

      this.pool.on('error', (err: Error, client: PoolClient) => {
        logger.error('Unexpected error on idle client', err);
      });

      // Test connection
      const client = await this.pool.connect();
      logger.info('Database connection established successfully');
      client.release();

      this.isConnected = true;

    } catch (error) {
      logger.error('Failed to connect to database:', error);
      // Don't throw error in development, just log it
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      this.isConnected = false;
    }
  }

  /**
   * Execute a query with optional parameters
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 100)}...`);

      return result;
    } catch (error) {
      logger.error('Database query error:', {
        query: text,
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute a transaction with multiple queries
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client for manual transaction management
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return await this.pool.connect();
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Get pool statistics
   */
  getStats(): any {
    if (!this.pool) {
      return { connected: false };
    }

    return {
      connected: this.isConnected,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

// Singleton instance
const db = new DatabaseConnection();

export default db;
export { DatabaseConnection };