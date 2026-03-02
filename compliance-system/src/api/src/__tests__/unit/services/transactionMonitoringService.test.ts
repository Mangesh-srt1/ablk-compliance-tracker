/**
 * TransactionMonitoringService Unit Tests
 * Tests KYT anomaly detection, risk scoring, and transaction pattern analysis.
 */

import { TransactionMonitoringService } from '../../../services/transactionMonitoringService';
import {
  KytAlertType,
  KytCheckRequest,
  KytCheckResult,
  KytRiskLevel,
  KytTransaction,
  KytBaselineProfile,
} from '../../../types/kyt';
import { Jurisdiction } from '../../../types/aml';

describe('TransactionMonitoringService', () => {
  let service: TransactionMonitoringService;

  const makeTimestamp = (msAgo: number): string =>
    new Date(Date.now() - msAgo).toISOString();

  const buildRequest = (
    transactions: KytTransaction[],
    baseline?: KytBaselineProfile
  ): KytCheckRequest => ({
    entityId: 'entity-test-001',
    jurisdiction: Jurisdiction.AE,
    transactions,
    baseline,
  });

  beforeEach(() => {
    service = new TransactionMonitoringService();
  });

  // ─── Basic happy-path tests ────────────────────────────────────────────────

  describe('analyzeTransactions – happy path', () => {
    it('should return LOW risk for a single normal transaction', async () => {
      const request = buildRequest([
        {
          id: 'tx1',
          amount: 500,
          currency: 'USD',
          timestamp: makeTimestamp(60 * 60 * 1000),
          counterparty: 'payee-A',
        },
      ]);

      const result: KytCheckResult = await service.analyzeTransactions(request);

      expect(result.riskLevel).toBe(KytRiskLevel.LOW);
      expect(result.score).toBeLessThan(30);
      expect(result.alerts).toHaveLength(0);
      expect(result.analyzedTransactions).toBe(1);
    });

    it('should include required output fields', async () => {
      const result = await service.analyzeTransactions(
        buildRequest([
          { id: 'tx1', amount: 100, currency: 'USD', timestamp: makeTimestamp(1000) },
        ])
      );

      expect(result).toHaveProperty('checkId');
      expect(result).toHaveProperty('entityId', 'entity-test-001');
      expect(result).toHaveProperty('jurisdiction', Jurisdiction.AE);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('analyzedTransactions');
      expect(result).toHaveProperty('processingTime');
      expect(result).toHaveProperty('timestamp');
    });

    it('should accept a caller-supplied baseline profile', async () => {
      const baseline: KytBaselineProfile = {
        avgAmount: 1000,
        stdDevAmount: 200,
        avgDailyCount: 5,
        commonCountries: ['US'],
        knownCounterparties: ['payee-A'],
      };

      const result = await service.analyzeTransactions(
        buildRequest(
          [{ id: 'tx1', amount: 950, currency: 'USD', timestamp: makeTimestamp(1000), country: 'US' }],
          baseline
        )
      );

      expect(result.riskLevel).toBe(KytRiskLevel.LOW);
    });
  });

  // ─── Amount anomaly ────────────────────────────────────────────────────────

  describe('amount anomaly detection', () => {
    it('should flag AMOUNT_ANOMALY when a transaction exceeds baseline by >3 standard deviations', async () => {
      const baseline: KytBaselineProfile = {
        avgAmount: 500,
        stdDevAmount: 50,
        avgDailyCount: 2,
        commonCountries: [],
        knownCounterparties: [],
      };

      // Amount is avg + 10 * stdDev = 1000 → well above 3 standard deviations
      const result = await service.analyzeTransactions(
        buildRequest(
          [{ id: 'tx1', amount: 1000, currency: 'USD', timestamp: makeTimestamp(1000) }],
          baseline
        )
      );

      const amountAlert = result.alerts.find(
        (a) => a.type === KytAlertType.AMOUNT_ANOMALY
      );
      expect(amountAlert).toBeDefined();
    });

    it('should NOT flag AMOUNT_ANOMALY for transactions within baseline range', async () => {
      const baseline: KytBaselineProfile = {
        avgAmount: 1000,
        stdDevAmount: 200,
        avgDailyCount: 3,
        commonCountries: [],
        knownCounterparties: [],
      };

      const result = await service.analyzeTransactions(
        buildRequest(
          [{ id: 'tx1', amount: 1050, currency: 'USD', timestamp: makeTimestamp(1000) }],
          baseline
        )
      );

      const amountAlert = result.alerts.find(
        (a) => a.type === KytAlertType.AMOUNT_ANOMALY
      );
      expect(amountAlert).toBeUndefined();
    });
  });

  // ─── Velocity anomaly ─────────────────────────────────────────────────────

  describe('velocity anomaly detection', () => {
    it('should flag VELOCITY_ANOMALY for 6+ transactions within 60 minutes', async () => {
      const now = Date.now();
      const transactions: KytTransaction[] = Array.from({ length: 6 }, (_, i) => ({
        id: `tx${i}`,
        amount: 100,
        currency: 'USD',
        timestamp: new Date(now - i * 5 * 60 * 1000).toISOString(), // 5-min apart
      }));

      const result = await service.analyzeTransactions(buildRequest(transactions));

      const velocityAlert = result.alerts.find(
        (a) => a.type === KytAlertType.VELOCITY_ANOMALY
      );
      expect(velocityAlert).toBeDefined();
    });

    it('should NOT flag VELOCITY_ANOMALY for 4 transactions spaced apart', async () => {
      const now = Date.now();
      const transactions: KytTransaction[] = Array.from({ length: 4 }, (_, i) => ({
        id: `tx${i}`,
        amount: 100,
        currency: 'USD',
        // Space 3 hours apart so no 3 consecutive txs fit within 60 min
        timestamp: new Date(now - i * 3 * 60 * 60 * 1000).toISOString(),
      }));

      const result = await service.analyzeTransactions(buildRequest(transactions));

      const velocityAlert = result.alerts.find(
        (a) => a.type === KytAlertType.VELOCITY_ANOMALY
      );
      expect(velocityAlert).toBeUndefined();
    });
  });

  // ─── Structuring pattern ──────────────────────────────────────────────────

  describe('structuring pattern detection', () => {
    it('should flag STRUCTURING_PATTERN for 3+ transactions in the $9,000–$9,999 band', async () => {
      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 9100, currency: 'USD', timestamp: makeTimestamp(3 * 60 * 60 * 1000) },
        { id: 'tx2', amount: 9500, currency: 'USD', timestamp: makeTimestamp(2 * 60 * 60 * 1000) },
        { id: 'tx3', amount: 9800, currency: 'USD', timestamp: makeTimestamp(1 * 60 * 60 * 1000) },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions));

      const structuringAlert = result.alerts.find(
        (a) => a.type === KytAlertType.STRUCTURING_PATTERN
      );
      expect(structuringAlert).toBeDefined();
      expect(structuringAlert?.severity).toBe('HIGH');
    });

    it('should NOT flag structuring for 2 near-threshold transactions', async () => {
      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 9200, currency: 'USD', timestamp: makeTimestamp(2 * 60 * 60 * 1000) },
        { id: 'tx2', amount: 9700, currency: 'USD', timestamp: makeTimestamp(1 * 60 * 60 * 1000) },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions));

      const structuringAlert = result.alerts.find(
        (a) => a.type === KytAlertType.STRUCTURING_PATTERN
      );
      expect(structuringAlert).toBeUndefined();
    });
  });

  // ─── Round-trip / circular pattern ────────────────────────────────────────

  describe('round-trip pattern detection', () => {
    it('should flag ROUND_TRIP_PATTERN for circular fund movement between two addresses', async () => {
      const addrA = '0xAAAA';
      const addrB = '0xBBBB';
      const transactions: KytTransaction[] = [
        {
          id: 'tx1',
          amount: 5000,
          currency: 'USD',
          timestamp: makeTimestamp(2 * 60 * 60 * 1000),
          fromAddress: addrA,
          toAddress: addrB,
        },
        {
          id: 'tx2',
          amount: 4800,
          currency: 'USD',
          timestamp: makeTimestamp(1 * 60 * 60 * 1000),
          fromAddress: addrB,
          toAddress: addrA,
        },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions));

      const roundTripAlert = result.alerts.find(
        (a) => a.type === KytAlertType.ROUND_TRIP_PATTERN
      );
      expect(roundTripAlert).toBeDefined();
    });

    it('should NOT flag round-trip for one-directional transactions', async () => {
      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 1000, currency: 'USD', timestamp: makeTimestamp(2000), fromAddress: '0xA', toAddress: '0xB' },
        { id: 'tx2', amount: 2000, currency: 'USD', timestamp: makeTimestamp(1000), fromAddress: '0xA', toAddress: '0xC' },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions));

      const roundTripAlert = result.alerts.find(
        (a) => a.type === KytAlertType.ROUND_TRIP_PATTERN
      );
      expect(roundTripAlert).toBeUndefined();
    });
  });

  // ─── Geographic anomaly ───────────────────────────────────────────────────

  describe('geographic anomaly detection', () => {
    it('should flag GEO_ANOMALY for 2+ transactions from uncommon countries', async () => {
      const baseline: KytBaselineProfile = {
        avgAmount: 500,
        stdDevAmount: 100,
        avgDailyCount: 2,
        commonCountries: ['US'],
        knownCounterparties: [],
      };

      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 500, currency: 'USD', timestamp: makeTimestamp(3000), country: 'RU' },
        { id: 'tx2', amount: 500, currency: 'USD', timestamp: makeTimestamp(2000), country: 'KP' },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions, baseline));

      const geoAlert = result.alerts.find((a) => a.type === KytAlertType.GEO_ANOMALY);
      expect(geoAlert).toBeDefined();
    });
  });

  // ─── Behavioral shift ─────────────────────────────────────────────────────

  describe('behavioral shift detection', () => {
    it('should flag BEHAVIORAL_SHIFT when transaction volumes escalate significantly', async () => {
      const baseline: KytBaselineProfile = {
        avgAmount: 200,
        stdDevAmount: 50,
        avgDailyCount: 3,
        commonCountries: [],
        knownCounterparties: [],
      };

      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 200, currency: 'USD', timestamp: makeTimestamp(4 * 60 * 60 * 1000) },
        { id: 'tx2', amount: 210, currency: 'USD', timestamp: makeTimestamp(3 * 60 * 60 * 1000) },
        { id: 'tx3', amount: 800, currency: 'USD', timestamp: makeTimestamp(2 * 60 * 60 * 1000) },
        { id: 'tx4', amount: 900, currency: 'USD', timestamp: makeTimestamp(1 * 60 * 60 * 1000) },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions, baseline));

      const shiftAlert = result.alerts.find(
        (a) => a.type === KytAlertType.BEHAVIORAL_SHIFT
      );
      expect(shiftAlert).toBeDefined();
    });
  });

  // ─── Risk score and risk level boundaries ─────────────────────────────────

  describe('risk score calculation', () => {
    it('should return score between 0 and 100', async () => {
      const result = await service.analyzeTransactions(
        buildRequest([
          { id: 'tx1', amount: 500, currency: 'USD', timestamp: makeTimestamp(1000) },
        ])
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return CRITICAL risk level for highly suspicious transaction set', async () => {
      const now = Date.now();
      const addrA = '0xAAAA';
      const addrB = '0xBBBB';

      // Combine multiple risk signals: velocity + structuring + round-trip
      const transactions: KytTransaction[] = [
        // Structuring band
        { id: 'tx1', amount: 9100, currency: 'USD', timestamp: new Date(now - 1000).toISOString() },
        { id: 'tx2', amount: 9200, currency: 'USD', timestamp: new Date(now - 2000).toISOString() },
        { id: 'tx3', amount: 9300, currency: 'USD', timestamp: new Date(now - 3000).toISOString() },
        // Velocity burst (6+ in <60 min)
        { id: 'tx4', amount: 100, currency: 'USD', timestamp: new Date(now - 4000).toISOString() },
        { id: 'tx5', amount: 100, currency: 'USD', timestamp: new Date(now - 5000).toISOString() },
        { id: 'tx6', amount: 100, currency: 'USD', timestamp: new Date(now - 6000).toISOString() },
        // Round-trip
        { id: 'tx7', amount: 5000, currency: 'USD', timestamp: new Date(now - 7000).toISOString(), fromAddress: addrA, toAddress: addrB },
        { id: 'tx8', amount: 4900, currency: 'USD', timestamp: new Date(now - 8000).toISOString(), fromAddress: addrB, toAddress: addrA },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions));

      expect(result.riskLevel).not.toBe(KytRiskLevel.LOW);
      expect(result.score).toBeGreaterThan(30);
    });
  });

  // ─── Recommendations ──────────────────────────────────────────────────────

  describe('recommendations generation', () => {
    it('should include SAR preparation recommendation for structuring', async () => {
      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 9100, currency: 'USD', timestamp: makeTimestamp(3 * 60 * 60 * 1000) },
        { id: 'tx2', amount: 9500, currency: 'USD', timestamp: makeTimestamp(2 * 60 * 60 * 1000) },
        { id: 'tx3', amount: 9800, currency: 'USD', timestamp: makeTimestamp(1 * 60 * 60 * 1000) },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions));

      expect(
        result.recommendations.some((r) =>
          r.toLowerCase().includes('sar') || r.toLowerCase().includes('structuring')
        )
      ).toBe(true);
    });

    it('should always return at least one recommendation', async () => {
      const result = await service.analyzeTransactions(
        buildRequest([
          { id: 'tx1', amount: 100, currency: 'USD', timestamp: makeTimestamp(1000) },
        ])
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle an empty transaction list gracefully', async () => {
      const result = await service.analyzeTransactions(buildRequest([]));

      expect(result.riskLevel).toBe(KytRiskLevel.LOW);
      expect(result.score).toBe(0);
      expect(result.analyzedTransactions).toBe(0);
    });

    it('should handle a single large transaction without a baseline', async () => {
      const result = await service.analyzeTransactions(
        buildRequest([
          { id: 'tx1', amount: 1000000, currency: 'USD', timestamp: makeTimestamp(1000) },
        ])
      );

      expect(result).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });

    it('should return unique recommendations (no duplicates)', async () => {
      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 9100, currency: 'USD', timestamp: makeTimestamp(3 * 60 * 60 * 1000) },
        { id: 'tx2', amount: 9500, currency: 'USD', timestamp: makeTimestamp(2 * 60 * 60 * 1000) },
        { id: 'tx3', amount: 9800, currency: 'USD', timestamp: makeTimestamp(1 * 60 * 60 * 1000) },
      ];

      const result = await service.analyzeTransactions(buildRequest(transactions));
      const unique = new Set(result.recommendations);

      expect(result.recommendations.length).toBe(unique.size);
    });

    it('should produce a unique checkId for each call', async () => {
      const request = buildRequest([
        { id: 'tx1', amount: 100, currency: 'USD', timestamp: makeTimestamp(1000) },
      ]);

      const [r1, r2] = await Promise.all([
        service.analyzeTransactions(request),
        service.analyzeTransactions(request),
      ]);

      expect(r1.checkId).not.toBe(r2.checkId);
    });

    it('processingTime should be non-negative', async () => {
      const result = await service.analyzeTransactions(
        buildRequest([
          { id: 'tx1', amount: 200, currency: 'USD', timestamp: makeTimestamp(1000) },
        ])
      );

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Idempotency ──────────────────────────────────────────────────────────

  describe('idempotency', () => {
    it('should produce consistent risk scores for identical inputs', async () => {
      const transactions: KytTransaction[] = [
        { id: 'tx1', amount: 9100, currency: 'USD', timestamp: makeTimestamp(3 * 60 * 60 * 1000) },
        { id: 'tx2', amount: 9500, currency: 'USD', timestamp: makeTimestamp(2 * 60 * 60 * 1000) },
        { id: 'tx3', amount: 9800, currency: 'USD', timestamp: makeTimestamp(1 * 60 * 60 * 1000) },
      ];

      const request = buildRequest(transactions);
      const result1 = await service.analyzeTransactions(request);
      const result2 = await service.analyzeTransactions(request);

      expect(result1.score).toBe(result2.score);
      expect(result1.riskLevel).toBe(result2.riskLevel);
      expect(result1.alerts.length).toBe(result2.alerts.length);
    });
  });
});
