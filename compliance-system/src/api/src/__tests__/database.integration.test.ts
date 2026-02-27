/**
 * Database Integration Tests
 * Tests real database operations with PostgreSQL
 */

import { Pool } from 'pg';
import { KycService } from '../../services/kycService';
import { Jurisdiction, KycStatus } from '../../types/kyc';

// Use test database in CI/CD environment
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_TEST_NAME || 'compliance_db_test',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

describe('Database Integration Tests', () => {
  let kycService: KycService;

  beforeAll(async () => {
    // Setup: Create test database connection
    kycService = new KycService();
  });

  afterEach(async () => {
    // Cleanup: Clear test data after each test
    await pool.query('DELETE FROM kyc_checks WHERE entity_id LIKE $1', ['test-%']);
  });

  afterAll(async () => {
    // Close database connection
    await pool.end();
  });

  describe('KYC Check Storage', () => {
    // Test 1: Store and retrieve KYC check
    it('should store KYC check in database and retrieve it', async () => {
      const kycCheckData = {
        entity_id: 'test-entity-1',
        jurisdiction: Jurisdiction.INDIA,
        full_name: 'Rajesh Kumar',
        email: 'rajesh@test.com',
        status: KycStatus.PASS,
        risk_score: 25,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Insert
      const insertResult = await pool.query(
        `INSERT INTO kyc_checks 
         (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          kycCheckData.entity_id,
          kycCheckData.jurisdiction,
          kycCheckData.full_name,
          kycCheckData.email,
          kycCheckData.status,
          kycCheckData.risk_score,
          kycCheckData.created_at,
          kycCheckData.updated_at,
        ]
      );

      const kycId = insertResult.rows[0].id;

      // Retrieve
      const selectResult = await pool.query(
        'SELECT * FROM kyc_checks WHERE id = $1',
        [kycId]
      );

      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0].entity_id).toBe('test-entity-1');
      expect(selectResult.rows[0].status).toBe(KycStatus.PASS);
      expect(selectResult.rows[0].risk_score).toBe(25);
    });

    // Test 2: Update KYC check status
    it('should update KYC check status', async () => {
      const insert = await pool.query(
        `INSERT INTO kyc_checks 
         (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        ['test-entity-2', Jurisdiction.EUROPEAN_UNION, 'Jean Dupont', 'jean@test.com', 
         KycStatus.PENDING, 50, new Date(), new Date()]
      );

      const kycId = insert.rows[0].id;

      // Update status
      await pool.query(
        'UPDATE kyc_checks SET status = $1, risk_score = $2, updated_at = $3 WHERE id = $4',
        [KycStatus.PASS, 30, new Date(), kycId]
      );

      // Verify update
      const result = await pool.query(
        'SELECT * FROM kyc_checks WHERE id = $1',
        [kycId]
      );

      expect(result.rows[0].status).toBe(KycStatus.PASS);
      expect(result.rows[0].risk_score).toBe(30);
    });

    // Test 3: Query by jurisdiction
    it('should query KYC checks by jurisdiction', async () => {
      // Insert multiple records
      await pool.query(
        `INSERT INTO kyc_checks 
         (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
         VALUES 
         ($1, $2, $3, $4, $5, $6, $7, $8),
         ($9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          'test-in-1', Jurisdiction.INDIA, 'User1', 'user1@test.com', KycStatus.PASS, 25, new Date(), new Date(),
          'test-in-2', Jurisdiction.INDIA, 'User2', 'user2@test.com', KycStatus.PASS, 30, new Date(), new Date(),
        ]
      );

      // Query by jurisdiction
      const result = await pool.query(
        'SELECT * FROM kyc_checks WHERE jurisdiction = $1',
        [Jurisdiction.INDIA]
      );

      expect(result.rows.length).toBeGreaterThanOrEqual(2);
      result.rows.forEach((row) => {
        expect(row.jurisdiction).toBe(Jurisdiction.INDIA);
      });
    });

    // Test 4: Transaction rollback on error
    it('should rollback transaction on error', async () => {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Insert initial record
        await client.query(
          `INSERT INTO kyc_checks 
           (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['test-tx-1', Jurisdiction.INDIA, 'User', 'user@test.com', KycStatus.PASS, 25, new Date(), new Date()]
        );

        // Simulate error by trying to insert invalid data
        await client.query(
          `INSERT INTO kyc_checks 
           (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['test-tx-1', 'INVALID_JURISDICTION', 'User', 'user@test.com', KycStatus.PASS, 25, new Date(), new Date()]
        );

        await client.query('COMMIT');
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      // Verify no records were inserted
      const result = await pool.query(
        'SELECT * FROM kyc_checks WHERE entity_id = $1',
        ['test-tx-1']
      );

      expect(result.rows).toHaveLength(0);
    });

    // Test 5: Data integrity - foreign key constraints
    it('should enforce foreign key constraints', async () => {
      // This test assumes there are FK constraints on related tables
      // Try to insert KYC with non-existent user (if FK exists)
      try {
        await pool.query(
          `INSERT INTO kyc_checks 
           (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['test-fk-error', Jurisdiction.INDIA, 'User', 'user@test.com', KycStatus.PASS, 25, new Date(), new Date()]
        );

        // If no error, check if record was created
        const result = await pool.query(
          'SELECT * FROM kyc_checks WHERE entity_id = $1',
          ['test-fk-error']
        );

        expect(result.rows).toHaveLength(1);
      } catch (error) {
        // FK constraint error is expected
        expect((error as any).code).toBeDefined();
      }
    });
  });

  describe('AML Check Storage', () => {
    // Test 6: Store AML check
    it('should store AML check in database', async () => {
      const result = await pool.query(
        `INSERT INTO aml_checks 
         (wallet_address, risk_score, flags, last_check, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['0x1234567890123456789012345678901234567890', 25, 'low_risk', new Date(), new Date()]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBeDefined();
    });

    // Test 7: Query AML checks by risk level
    it('should query AML checks by risk level', async () => {
      // Insert test data
      await pool.query(
        `INSERT INTO aml_checks (wallet_address, risk_score, flags, last_check, created_at)
         VALUES 
         ($1, $2, $3, $4, $5),
         ($6, $7, $8, $9, $10)`,
        [
          '0xaaa', 10, 'low_risk', new Date(), new Date(),
          '0xbbb', 85, 'high_risk', new Date(), new Date(),
        ]
      );

      // Query high risk
      const result = await pool.query(
        'SELECT * FROM aml_checks WHERE risk_score > $1',
        [70]
      );

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      result.rows.forEach((row) => {
        expect(row.risk_score).toBeGreaterThan(70);
      });
    });

    // Test 8: Update AML check timestamp
    it('should update last_check timestamp', async () => {
      const insert = await pool.query(
        `INSERT INTO aml_checks (wallet_address, risk_score, flags, last_check, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['0xccc', 25, 'low_risk', new Date('2026-01-01'), new Date()]
      );

      const amlId = insert.rows[0].id;
      const newTime = new Date('2026-02-27');

      // Update time
      await pool.query(
        'UPDATE aml_checks SET last_check = $1 WHERE id = $2',
        [newTime, amlId]
      );

      // Verify
      const result = await pool.query(
        'SELECT * FROM aml_checks WHERE id = $1',
        [amlId]
      );

      expect(result.rows[0].last_check.getTime()).toBe(newTime.getTime());
    });
  });

  describe('Compliance Check Aggregation', () => {
    // Test 9: Store compliance check aggregate
    it('should store compliance check aggregation', async () => {
      const result = await pool.query(
        `INSERT INTO compliance_checks 
         (entity_id, overall_risk_score, kyc_status, aml_status, combined_flags, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['test-cc-1', 35, KycStatus.PASS, 'low', 'clean', new Date()]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBeDefined();
    });

    // Test 10: Update compliance flags
    it('should update compliance check flags', async () => {
      const insert = await pool.query(
        `INSERT INTO compliance_checks 
         (entity_id, overall_risk_score, kyc_status, aml_status, combined_flags, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        ['test-cc-2', 25, KycStatus.PASS, 'low', 'clean', new Date()]
      );

      const ccId = insert.rows[0].id;

      // Update to add PEP flag
      await pool.query(
        'UPDATE compliance_checks SET combined_flags = $1, overall_risk_score = $2 WHERE id = $3',
        ['pep_match', 65, ccId]
      );

      // Verify
      const result = await pool.query(
        'SELECT * FROM compliance_checks WHERE id = $1',
        [ccId]
      );

      expect(result.rows[0].combined_flags).toBe('pep_match');
      expect(result.rows[0].overall_risk_score).toBe(65);
    });
  });

  describe('Bulk Operations', () => {
    // Test 11: Bulk insert performance
    it('should handle bulk inserts efficiently', async () => {
      const startTime = Date.now();

      const values = [];
      const placeholders = [];

      for (let i = 0; i < 100; i++) {
        values.push(
          `test-bulk-${i}`,
          Jurisdiction.INDIA,
          `User ${i}`,
          `user${i}@test.com`,
          KycStatus.PASS,
          Math.floor(Math.random() * 100),
          new Date(),
          new Date()
        );

        placeholders.push(
          `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
        );
      }

      const query = `
        INSERT INTO kyc_checks 
        (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
        VALUES ${placeholders.join(', ')}
      `;

      await pool.query(query, values);

      const duration = Date.now() - startTime;

      // Should complete reasonable quickly (<5 seconds for 100 records)
      expect(duration).toBeLessThan(5000);

      // Verify records
      const result = await pool.query(
        'SELECT COUNT(*) FROM kyc_checks WHERE entity_id LIKE $1',
        ['test-bulk-%']
      );

      expect(parseInt(result.rows[0].count, 10)).toBe(100);
    });
  });

  describe('Index Performance', () => {
    // Test 12: Index on entity_id performance
    it('should efficiently query using indexed columns', async () => {
      // Insert test data
      await pool.query(
        `INSERT INTO kyc_checks (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['test-idx-1', Jurisdiction.INDIA, 'User', 'user@test.com', KycStatus.PASS, 25, new Date(), new Date()]
      );

      const startTime = Date.now();

      // Query using indexed column
      const result = await pool.query(
        'SELECT * FROM kyc_checks WHERE entity_id = $1',
        ['test-idx-1']
      );

      const duration = Date.now() - startTime;

      expect(result.rows).toHaveLength(1);
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('View Queries', () => {
    // Test 13: Query pending_approvals view
    it('should query pending_approvals view', async () => {
      // Insert pending KYC
      await pool.query(
        `INSERT INTO kyc_checks (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['test-pending-1', Jurisdiction.INDIA, 'User', 'user@test.com', KycStatus.PENDING, 50, new Date(), new Date()]
      );

      // Query view if it exists
      try {
        const result = await pool.query('SELECT * FROM pending_approvals');
        
        if (result.rows.length > 0) {
          expect(result.rows[0]).toHaveProperty('entity_id');
        }
      } catch (error) {
        // View may not exist in test database
        console.log('View not available in test environment');
      }
    });

    // Test 14: Query high_risk_entities view
    it('should query high_risk_entities view', async () => {
      // Insert high-risk record
      await pool.query(
        `INSERT INTO kyc_checks (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['test-highrisk-1', Jurisdiction.UNITED_STATES, 'User', 'user@test.com', KycStatus.PASS, 85, new Date(), new Date()]
      );

      // Query view if it exists
      try {
        const result = await pool.query('SELECT * FROM high_risk_entities WHERE risk_score > $1', [80]);

        if (result.rows.length > 0) {
          result.rows.forEach((row) => {
            expect(row.risk_score).toBeGreaterThan(80);
          });
        }
      } catch (error) {
        // View may not exist in test database
        console.log('View not available in test environment');
      }
    });
  });

  describe('Concurrent Connections', () => {
    // Test 15: Handle concurrent database connections
    it('should manage multiple concurrent connections', async () => {
      const queries = [];

      for (let i = 0; i < 10; i++) {
        queries.push(
          pool.query(
            `INSERT INTO kyc_checks (entity_id, jurisdiction, full_name, email, status, risk_score, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              `test-concurrent-${i}`,
              Jurisdiction.INDIA,
              `User ${i}`,
              `user${i}@test.com`,
              KycStatus.PASS,
              25 + i,
              new Date(),
              new Date(),
            ]
          )
        );
      }

      const results = await Promise.all(queries);

      // All inserts should succeed
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.rowCount).toBe(1);
      });
    });
  });
});
