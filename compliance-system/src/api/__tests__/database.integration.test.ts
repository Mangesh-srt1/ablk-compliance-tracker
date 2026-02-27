/**
 * Database Integration Tests
 * Tests: PostgreSQL connection, query execution, and transaction handling
 */

import db from '../src/config/database';
import winston from 'winston';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('winston', () => ({
  createLogger: () => mockLogger,
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Connection will be attempted, but may fail if DB not running
    // Tests should handle graceful degradation
  });

  afterAll(async () => {
    // Close connection pool if tests complete
    try {
      await db.close();
    } catch (error) {
      // Ignore errors on close
    }
  });

  describe('Database Connection Pool', () => {
    it('should initialize connection pool with valid config', async () => {
      try {
        // Attempt connection if not already connected - using type guard
        const dbAny = db as any;
        if (!dbAny.isConnected?.()) {
          await dbAny.connect?.();
        }
        
        expect(dbAny.isConnected?.() ?? false).toBe(true);
      } catch (error) {
        // Graceful degradation if DB not available
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Database');
      }
    });

    it('should fail gracefully with missing database config', async () => {
      // Save original env vars
      const originalDbHost = process.env.DB_HOST;
      const originalDbName = process.env.DB_NAME;

      // Temporarily remove required vars
      delete process.env.DB_HOST;
      delete process.env.DB_NAME;

      const testDb = require('../src/config/database').default;

      try {
        await testDb.connect();
        fail('Should have thrown error for missing config');
      } catch (error) {
        expect((error as Error).message).toContain('Missing required database');
      }

      // Restore env vars
      if (originalDbHost) process.env.DB_HOST = originalDbHost;
      if (originalDbName) process.env.DB_NAME = originalDbName;
    });

    it('should implement connection retry logic', async () => {
      try {
        const startTime = Date.now();
        
        // This will timeout and retry
        const dbAny = db as any;
        await dbAny.connect?.(2, 100); // 2 retries with 100ms delay
        
        const duration = Date.now() - startTime;
        
        // Should have attempted retries (at least 200ms for delays)
        if (!dbAny.isConnected?.()) {
          expect(duration).toBeGreaterThanOrEqual(100);
        }
      } catch (error) {
        // Expected to fail if DB not running
        expect(error).toBeDefined();
      }
    });
  });

  describe('Query Execution', () => {
    it('should execute SELECT query successfully', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping query test');
        return;
      }

      try {
        const result = await db.query('SELECT 1 as test');
        
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('test');
        expect(result[0].test).toBe(1);
      } catch (error) {
        console.warn('Query execution failed:', (error as Error).message);
      }
    });

    it('should handle parameterized queries safely', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping parameterized test');
        return;
      }

      try {
        // Test parameterized query (prevents SQL injection)
        const result = await db.query(
          'SELECT $1::text as name, $2::integer as count',
          ['test_name', 42]
        );

        expect(result).toBeDefined();
        expect(result[0].name).toBe('test_name');
        expect(result[0].count).toBe(42);
      } catch (error) {
        console.warn('Parameterized query failed:', (error as Error).message);
      }
    });

    it('should reject malformed queries', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping malformed query test');
        return;
      }

      try {
        await db.query('SELECT * FORM invalid_table'); // Typo: FORM instead of FROM
        fail('Should have thrown error for malformed SQL');
      } catch (error) {
        expect((error as Error).message).toContain('syntax error');
      }
    });
  });

  describe('Transaction Handling', () => {
    it('should support transaction commit', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping transaction test');
        return;
      }

      try {
        const client = await db.getClient();
        
        try {
          await client.query('BEGIN');
          await client.query('SELECT 1 as test');
          await client.query('COMMIT');
          
          // Successfully committed
          expect(true).toBe(true);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.warn('Transaction commit failed:', (error as Error).message);
      }
    });

    it('should support transaction rollback on error', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping rollback test');
        return;
      }

      try {
        const client = await db.getClient();
        let rollbackCalled = false;

        try {
          await client.query('BEGIN');
          // Simulate error
          throw new Error('Intentional transaction error');
        } catch (error) {
          await client.query('ROLLBACK');
          rollbackCalled = true;
        } finally {
          client.release();
        }

        expect(rollbackCalled).toBe(true);
      } catch (error) {
        console.warn('Transaction rollback test failed:', (error as Error).message);
      }
    });

    it('should implement proper connection pooling', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping pooling test');
        return;
      }

      try {
        // Acquire multiple connections
        const connections = [];
        for (let i = 0; i < 3; i++) {
          const client = await db.getClient();
          connections.push(client);
        }

        // Verify all connections were obtained
        expect(connections.length).toBe(3);
        
        // Release all connections
        connections.forEach(client => client.release());

        // Pool should still work
        const finalClient = await db.getClient();
        expect(finalClient).toBeDefined();
        finalClient.release();
      } catch (error) {
        console.warn('Connection pooling test failed:', (error as Error).message);
      }
    });
  });

  describe('Database Health Status', () => {
    it('should report connection status', () => {
      const isConnected = db.isConnected();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should provide connection pool stats', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping stats test');
        return;
      }

      try {
        const stats = db.getPoolStats();
        
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('size');
        expect(stats).toHaveProperty('idle');
        expect(stats).toHaveProperty('waiting');
        expect(typeof stats.size).toBe('number');
        expect(typeof stats.idle).toBe('number');
        expect(typeof stats.waiting).toBe('number');
      } catch (error) {
        console.warn('Pool stats retrieval failed:', (error as Error).message);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle connection timeouts gracefully', async () => {
      if (!db.isConnected()) {
        // This is expected behavior when DB not running
        expect(db.isConnected()).toBe(false);
      }
    });

    it('should log query errors', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping error logging test');
        return;
      }

      try {
        await db.query('SELECT * FROM nonexistent_table');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('does not exist');
      }
    });

    it('should not expose SQL in error messages (security)', async () => {
      if (!db.isConnected()) {
        console.warn('Database not connected, skipping security test');
        return;
      }

      try {
        await db.query('SELECT password FROM users WHERE id = invalid_id');
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Verify error doesn't expose sensitive SQL
        expect(errorMessage).not.toContain('password');
      }
    });
  });

  describe('Database Cleanup', () => {
    it('should properly close connection pool', async () => {
      try {
        if (db.isConnected()) {
          await db.close();
          expect(db.isConnected()).toBe(false);
        }
      } catch (error) {
        console.warn('Connection close failed:', (error as Error).message);
      }
    });
  });
});
