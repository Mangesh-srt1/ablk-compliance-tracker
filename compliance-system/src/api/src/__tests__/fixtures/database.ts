/**
 * Database Test Fixture
 * Mock database client for isolation testing
 */

import { Pool, PoolClient } from 'pg';

export class MockDatabaseClient {
  private queryResults: Map<string, any[]> = new Map();
  private callLog: Array<{ method: string; args: any[] }> = [];

  setQueryResult(sql: string, result: any[]) {
    this.queryResults.set(this.normalizeSql(sql), result);
  }

  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim().toUpperCase();
  }

  getCallLog() {
    return this.callLog;
  }

  clearCallLog() {
    this.callLog = [];
  }

  /**
   * Mock query method
   */
  async query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    this.callLog.push({ method: 'query', args: [sql, values] });

    const normalizedSql = this.normalizeSql(sql);
    const result = this.queryResults.get(normalizedSql) || [];

    return {
      rows: result,
      rowCount: result.length
    };
  }

  /**
   * Mock transaction begin
   */
  async begin(): Promise<PoolClient> {
    this.callLog.push({ method: 'begin', args: [] });
    return {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
      end: jest.fn()
    } as unknown as PoolClient;
  }

  /**
   * Mock connect
   */
  async connect(): Promise<PoolClient> {
    this.callLog.push({ method: 'connect', args: [] });
    return {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
      end: jest.fn()
    } as unknown as PoolClient;
  }

  /**
   * Mock end connection pool
   */
  async end(): Promise<void> {
    this.callLog.push({ method: 'end', args: [] });
  }

  /**
   * Create test pool instance
   */
  static createTestPool(): Partial<Pool> {
    const client = new MockDatabaseClient();

    return {
      query: (sql: string, values?: any[]) => client.query(sql, values),
      connect: () => client.connect(),
      end: () => client.end(),
      on: jest.fn()
    };
  }
}

/**
 * Test database transaction
 */
export class MockTransaction {
  private committed = false;
  private rolledBack = false;
  private queries: Array<{ sql: string; values?: any[] }> = [];

  async addQuery(sql: string, values?: any[]) {
    this.queries.push({ sql, values });
  }

  async commit() {
    this.committed = true;
  }

  async rollback() {
    this.rolledBack = true;
  }

  isCommitted() {
    return this.committed;
  }

  isRolledBack() {
    return this.rolledBack;
  }

  getQueries() {
    return this.queries;
  }
}

/**
 * Test result builder for db operations
 */
export class TestResultBuilder {
  private rows: any[] = [];
  private rowCount = 0;

  withRows(rows: any[]) {
    this.rows = rows;
    this.rowCount = rows.length;
    return this;
  }

  withRowCount(count: number) {
    this.rowCount = count;
    return this;
  }

  build() {
    return {
      rows: this.rows,
      rowCount: this.rowCount,
      command: 'SELECT',
      fields: [],
      oid: undefined
    };
  }
}
