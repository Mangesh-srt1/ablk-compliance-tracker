/**
 * Transaction Manager Tests
 * Validates ACID transaction handling for compliance operations
 */

import { Pool, PoolClient } from 'pg';
import { TransactionManager, aggregateComplianceTransaction, handleConstraintError } from '../transaction';
import logger from '../../config/logger';

// Mock the pool and client
const mockQuery = jest.fn();
const mockConnect = jest.fn();
const mockRelease = jest.fn();

const mockClient: Partial<PoolClient> = {
  query: mockQuery,
  release: mockRelease,
};

const mockPool: Partial<Pool> = {
  connect: mockConnect.mockResolvedValue(mockClient),
};

jest.mock('../../config/logger');

describe('TransactionManager', () => {
  let transactionManager: TransactionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockClear();
    mockConnect.mockClear();
    mockRelease.mockClear();
    transactionManager = new TransactionManager(mockPool as Pool);
  });

  describe('run', () => {
    it('should execute callback within transaction and commit on success', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const callback = jest.fn().mockResolvedValue({ success: true });
      const result = await transactionManager.run(callback);

      expect(mockQuery).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL READ COMMITTED');
      expect(callback).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should rollback transaction on error', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const testError = new Error('Test error');
      const callback = jest.fn().mockRejectedValue(testError);

      try {
        await transactionManager.run(callback);
      } catch (error) {
        expect(error).toBe(testError);
      }

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should handle custom isolation level', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const callback = jest.fn().mockResolvedValue({});

      await transactionManager.run(callback, {
        isolationLevel: 'SERIALIZABLE',
      });

      expect(mockQuery).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL SERIALIZABLE');
    });

    it('should release connection even if rollback fails', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Rollback failed')); // ROLLBACK fails

      const callback = jest.fn().mockRejectedValue(new Error('Callback error'));

      try {
        await transactionManager.run(callback);
      } catch (error) {
        // Expected
      }

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('runWithSavepoint', () => {
    it('should create and use savepoint', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SAVEPOINT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT
      const callback = jest.fn().mockResolvedValue({ data: 'test' });

      const result = await transactionManager.runWithSavepoint(callback, 'test_sp');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL READ COMMITTED');
      expect(mockQuery).toHaveBeenCalledWith('SAVEPOINT test_sp');
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual({ data: 'test' });
    });

    it('should rollback to savepoint on error', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const callback = jest.fn().mockRejectedValue(new Error('Savepoint test error'));

      try {
        await transactionManager.runWithSavepoint(callback, 'error_sp');
      } catch (error) {
        // Expected
      }

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT error_sp');
    });
  });

  describe('aggregateComplianceTransaction', () => {
    it('should aggregate compliance data in single transaction', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'kyc-123' }] }) // KYC insert
        .mockResolvedValueOnce({ rows: [{ id: 'aml-456' }] }) // AML insert
        .mockResolvedValueOnce({ rows: [{ id: 'comp-789' }] }) // Compliance insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await aggregateComplianceTransaction(
        transactionManager,
        'INSERT INTO kyc_records ...',
        'INSERT INTO aml_records ...',
        'INSERT INTO compliance_records ...',
        {
          kycParams: ['entity-1'],
          amlParams: ['wallet-1'],
          complianceParams: ['user-1'],
        }
      );

      expect(result).toEqual({
        kycId: 'kyc-123',
        amlId: 'aml-456',
        complianceId: 'comp-789',
      });
      expect(mockQuery).toHaveBeenCalledTimes(5); // BEGIN + 3 inserts + COMMIT
    });
  });

  describe('handleConstraintError', () => {
    it('should handle unique constraint violation', () => {
      const error = {
        code: '23505',
        constraint: 'kyc_records_wallet_unique',
      };

      const result = handleConstraintError(error);

      expect(result.code).toBe('DUPLICATE_ENTITY');
      expect(result.message).toContain('already exists');
      expect(result.field).toBe('kyc_records_wallet_unique');
    });

    it('should handle foreign key violation', () => {
      const error = {
        code: '23503',
        constraint: 'aml_records_kyc_fk',
      };

      const result = handleConstraintError(error);

      expect(result.code).toBe('INVALID_REFERENCE');
      expect(result.message).toContain('Referenced entity');
    });

    it('should handle NOT NULL violation', () => {
      const error = {
        code: '23502',
        column: 'risk_score',
      };

      const result = handleConstraintError(error);

      expect(result.code).toBe('MISSING_FIELD');
      expect(result.field).toBe('risk_score');
    });

    it('should handle unknown error', () => {
      const error = new Error('Unknown error');

      const result = handleConstraintError(error);

      expect(result.code).toBe('DATABASE_ERROR');
    });
  });
});
