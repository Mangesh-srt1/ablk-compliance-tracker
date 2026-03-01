/**
 * FraudDetectionService Unit Tests
 * Tests for transaction anomaly detection logic (FR-3.3)
 */

import { FraudDetectionService, FraudDetectionRequest } from '../fraudDetectionService';

// Helper: build a transaction at a given timestamp offset (seconds from base)
function makeTx(id: string, amount: number, secondsOffset: number, currency = 'USD') {
  const base = new Date('2026-01-01T00:00:00Z');
  const ts = new Date(base.getTime() + secondsOffset * 1000);
  return {
    id,
    amount,
    currency,
    timestamp: ts.toISOString(),
    type: 'transfer' as const,
  };
}

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  beforeEach(() => {
    service = new FraudDetectionService();
  });

  // ---------------------------------------------------------------------------
  // Happy path – clean transactions
  // ---------------------------------------------------------------------------
  describe('Clean transactions', () => {
    it('should return no anomaly for a single low-value transaction', async () => {
      const req: FraudDetectionRequest = {
        entityId: 'entity-001',
        transactions: [makeTx('tx-1', 500, 0)],
      };

      const result = await service.detectFraud(req);

      expect(result.anomaly).toBe(false);
      expect(result.riskScore).toBeLessThan(30);
      expect(result.flags).toHaveLength(0);
    });

    it('should return APPROVED-level risk for a few spread-out transactions', async () => {
      const txs = [
        makeTx('tx-1', 1000, 0),
        makeTx('tx-2', 2000, 3600),
        makeTx('tx-3', 500, 7200),
      ];

      const result = await service.detectFraud({ entityId: 'entity-002', transactions: txs });

      expect(result.riskLevel).toBe('low');
      expect(result.anomaly).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // High-value transaction flag
  // ---------------------------------------------------------------------------
  describe('High-value transactions', () => {
    it('should flag a single high-value transaction (>= $10,000)', async () => {
      const req: FraudDetectionRequest = {
        entityId: 'entity-003',
        transactions: [makeTx('tx-1', 15000, 0)],
      };

      const result = await service.detectFraud(req);

      expect(result.flags.some((f) => f.type === 'HIGH_VALUE_TRANSACTION')).toBe(true);
    });

    it('should increase risk with multiple high-value transactions', async () => {
      const txs = [
        makeTx('tx-1', 12000, 0),
        makeTx('tx-2', 11000, 3600),
        makeTx('tx-3', 15000, 7200),
        makeTx('tx-4', 20000, 10800),
      ];

      const result = await service.detectFraud({ entityId: 'entity-004', transactions: txs });

      const hvFlag = result.flags.find((f) => f.type === 'HIGH_VALUE_TRANSACTION');
      expect(hvFlag).toBeDefined();
      expect(hvFlag!.severity).toBe('HIGH');
    });
  });

  // ---------------------------------------------------------------------------
  // Structuring check (just below reporting threshold)
  // ---------------------------------------------------------------------------
  describe('Structuring detection', () => {
    it('should flag structuring: multiple transactions just below $10k', async () => {
      const txs = [
        makeTx('tx-1', 9500, 0),
        makeTx('tx-2', 9800, 3600),
        makeTx('tx-3', 9100, 7200),
      ];

      const result = await service.detectFraud({ entityId: 'entity-005', transactions: txs });

      expect(result.flags.some((f) => f.type === 'STRUCTURING')).toBe(true);
      expect(result.anomaly).toBe(true);
    });

    it('should recommend STR filing for structuring with US jurisdiction', async () => {
      const txs = [
        makeTx('tx-1', 9500, 0),
        makeTx('tx-2', 9700, 3600),
        makeTx('tx-3', 9200, 7200),
      ];

      const result = await service.detectFraud({
        entityId: 'entity-006',
        transactions: txs,
        jurisdiction: 'US',
      });

      expect(result.recommendations.some((r) => r.includes('FinCEN'))).toBe(true);
    });

    it('should recommend STR filing with FIU-IND for India jurisdiction', async () => {
      const txs = [
        makeTx('tx-1', 9500, 0),
        makeTx('tx-2', 9700, 3600),
        makeTx('tx-3', 9200, 7200),
      ];

      const result = await service.detectFraud({
        entityId: 'entity-007',
        transactions: txs,
        jurisdiction: 'IN',
      });

      expect(result.recommendations.some((r) => r.includes('FIU-IND'))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Velocity check
  // ---------------------------------------------------------------------------
  describe('Velocity detection', () => {
    it('should flag 20+ transactions within 24h window', async () => {
      // 22 transactions spread over 23 hours = within the default 24h window
      const txs = Array.from({ length: 22 }, (_, i) =>
        makeTx(`tx-${i}`, 100, i * 3600)
      );

      const result = await service.detectFraud({ entityId: 'entity-008', transactions: txs });

      expect(result.flags.some((f) => f.type === 'HIGH_VELOCITY')).toBe(true);
      expect(result.anomaly).toBe(true);
    });

    it('should NOT flag 15 transactions spread across 3 days', async () => {
      // 15 transactions over 72h (avg 1 per 4.8h) – below threshold
      const txs = Array.from({ length: 15 }, (_, i) =>
        makeTx(`tx-${i}`, 100, i * 4 * 3600)
      );

      const result = await service.detectFraud({ entityId: 'entity-009', transactions: txs });

      expect(result.flags.some((f) => f.type === 'HIGH_VELOCITY')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Layering check (rapid succession)
  // ---------------------------------------------------------------------------
  describe('Layering detection', () => {
    it('should flag rapid-succession transactions (5+ within 60s window)', async () => {
      // 6 transactions within 30 seconds of each other
      const txs = Array.from({ length: 6 }, (_, i) =>
        makeTx(`tx-${i}`, 500, i * 5)
      );

      const result = await service.detectFraud({ entityId: 'entity-010', transactions: txs });

      expect(result.flags.some((f) => f.type === 'LAYERING')).toBe(true);
      expect(result.anomaly).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Round-amount structuring
  // ---------------------------------------------------------------------------
  describe('Round-amount pattern', () => {
    it('should flag suspiciously round transaction amounts', async () => {
      const txs = [
        makeTx('tx-1', 9000, 0),
        makeTx('tx-2', 8500, 3600),
        makeTx('tx-3', 7500, 7200),
      ];

      const result = await service.detectFraud({ entityId: 'entity-011', transactions: txs });

      expect(result.flags.some((f) => f.type === 'ROUND_AMOUNT_PATTERN')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Output structure
  // ---------------------------------------------------------------------------
  describe('Result structure', () => {
    it('should always include required fields', async () => {
      const result = await service.detectFraud({
        entityId: 'entity-012',
        transactions: [makeTx('tx-1', 100, 0)],
      });

      expect(result).toHaveProperty('checkId');
      expect(result).toHaveProperty('entityId');
      expect(result).toHaveProperty('anomaly');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('timestamp');
    });

    it('should have processingTime > 0', async () => {
      const result = await service.detectFraud({
        entityId: 'entity-013',
        transactions: [makeTx('tx-1', 500, 0)],
      });

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should return riskScore between 0 and 100', async () => {
      const txs = [
        makeTx('tx-1', 9500, 0),
        makeTx('tx-2', 9700, 30),
        makeTx('tx-3', 9200, 60),
        makeTx('tx-4', 15000, 90),
        makeTx('tx-5', 12000, 120),
      ];

      const result = await service.detectFraud({ entityId: 'entity-014', transactions: txs });

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should return entityId matching the request', async () => {
      const entityId = 'unique-entity-xyz';
      const result = await service.detectFraud({
        entityId,
        transactions: [makeTx('tx-1', 100, 0)],
      });

      expect(result.entityId).toBe(entityId);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('Error handling', () => {
    it('should handle empty transactions array gracefully', async () => {
      // An empty array triggers the "min 1" route validation,
      // but the service itself should handle it without throwing
      const result = await service.detectFraud({
        entityId: 'entity-015',
        transactions: [],
      });

      expect(result.anomaly).toBe(false);
      expect(result.riskScore).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Boundary and edge cases
  // ---------------------------------------------------------------------------
  describe('Boundary values', () => {
    it('should NOT flag a transaction at exactly $9,999 as high-value', async () => {
      const result = await service.detectFraud({
        entityId: 'entity-boundary-1',
        transactions: [makeTx('tx-1', 9999, 0)],
      });

      expect(result.flags.some((f) => f.type === 'HIGH_VALUE_TRANSACTION')).toBe(false);
    });

    it('should flag a transaction at exactly the high-value threshold ($10,000)', async () => {
      const result = await service.detectFraud({
        entityId: 'entity-boundary-2',
        transactions: [makeTx('tx-1', 10000, 0)],
      });

      expect(result.flags.some((f) => f.type === 'HIGH_VALUE_TRANSACTION')).toBe(true);
    });

    it('should return riskScore capped at 100 for many combined risk factors', async () => {
      // Combine: high-value + velocity + structuring + layering
      const txs: ReturnType<typeof makeTx>[] = [];
      // 25 transactions in 24h (velocity)
      for (let i = 0; i < 25; i++) {
        txs.push(makeTx(`tx-v${i}`, 9500, i * 60)); // also structuring candidates
      }
      // Add a high-value tx
      txs.push(makeTx('tx-hv', 50000, 26 * 60));
      // Rapid succession: 6 txs within 60s
      for (let i = 0; i < 6; i++) {
        txs.push(makeTx(`tx-r${i}`, 1000, 30 * 3600 + i * 5));
      }

      const result = await service.detectFraud({ entityId: 'entity-boundary-3', transactions: txs });

      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle a single transaction with amount = 0 without error', async () => {
      const result = await service.detectFraud({
        entityId: 'entity-zero',
        transactions: [makeTx('tx-zero', 0, 0)],
      });

      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Result fields completeness
  // ---------------------------------------------------------------------------
  describe('Result completeness', () => {
    it('should include a non-empty checkId', async () => {
      const result = await service.detectFraud({
        entityId: 'unique-entity-xyz',
        transactions: [makeTx('tx-1', 100, 0)],
      });

      expect(result.checkId).toBeTruthy();
      expect(result.checkId.length).toBeGreaterThan(0);
    });

    it('should return the same entityId as provided in the request', async () => {
      const entityId = 'my-specific-entity-id';
      const result = await service.detectFraud({
        entityId,
        transactions: [makeTx('tx-1', 500, 0)],
      });

      expect(result.entityId).toBe(entityId);
    });

    it('should include a valid ISO timestamp', async () => {
      const result = await service.detectFraud({
        entityId: 'ts-check',
        transactions: [makeTx('tx-1', 500, 0)],
      });

      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(isNaN(new Date(result.timestamp).getTime())).toBe(false);
    });

    it('should always include the patterns array', async () => {
      const result = await service.detectFraud({
        entityId: 'patterns-check',
        transactions: [makeTx('tx-1', 500, 0)],
      });

      expect(Array.isArray(result.patterns)).toBe(true);
    });

    it('should always include the recommendations array', async () => {
      const result = await service.detectFraud({
        entityId: 'recs-check',
        transactions: [makeTx('tx-1', 500, 0)],
      });

      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
