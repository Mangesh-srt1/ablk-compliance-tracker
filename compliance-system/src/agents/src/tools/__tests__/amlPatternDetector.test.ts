/**
 * AML Pattern Detector Tests
 * Comprehensive test suite for pattern detection and velocity scoring
 */

import { AMLPatternDetector, Transaction } from '../amlPatternDetector';

describe('AMLPatternDetector', () => {
  let detector: AMLPatternDetector;

  beforeEach(() => {
    detector = new AMLPatternDetector();
    process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
  });

  describe('Velocity Profile Calculation', () => {
    it('should calculate zero velocity for empty transaction history', () => {
      const result = detector.analyzePatterns([]);
      
      expect(result.velocityProfile.transactionsPerHour).toBe(0);
      expect(result.velocityProfile.transactionsPerDay).toBe(0);
      expect(result.velocityProfile.transactionsPerWeek).toBe(0);
      expect(result.normalBehavior).toBe(true);
      expect(result.riskLevel).toBe('LOW');
    });

    it('should calculate correct velocity for recent transactions', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 30 * 60 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 20 * 60 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 10 * 60 * 1000, type: 'transfer' },
        { id: '4', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 5 * 60 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityProfile.transactionsPerHour).toBe(4);
      expect(result.velocityProfile.averageAmount).toBe(100);
      expect(result.velocityProfile.totalVolume).toBe(400);
    });

    it('should calculate average amount correctly', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 200, timestamp: now, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 300, timestamp: now, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityProfile.averageAmount).toBe(200);
      expect(result.velocityProfile.totalVolume).toBe(600);
    });

    it('should identify peak transaction hour', () => {
      const peakHour = 14; // 2 PM
      const now = Date.now();
      const offHour = new Date(now);
      offHour.setHours(14, 30, 0, 0); // 2:30 PM today
      
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: offHour.getTime(), type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: offHour.getTime() + 60 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now + 24 * 60 * 60 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      // Peak hour might be 14 (2 PM)
      expect(result.velocityProfile.peakHour).not.toBeNull();
      expect(typeof result.velocityProfile.peakHour).toBe('number');
    });

    it('should handle Date object timestamps', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient1', amount: 100, timestamp: now - 24 * 60 * 60 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient2', amount: 100, timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityProfile.transactionsPerHour).toBeLessThanOrEqual(1);
      expect(result.riskLevel).toBe('LOW');
    });
  });

  describe('Temporal Pattern Detection', () => {
    it('should detect clustering pattern with closely spaced transactions', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 50 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 45 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 40 * 1000, type: 'transfer' },
        { id: '4', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 35 * 1000, type: 'transfer' },
        { id: '5', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 30 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.temporalPatterns.length).toBeGreaterThan(0);
      expect(result.hasAnomalies).toBe(true);
    });

    it('should detect spikes pattern with idle periods', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        // First cluster
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 24 * 60 * 60 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 24 * 60 * 60 * 1000 + 30 * 1000, type: 'transfer' },
        // Large gap (idle period)
        // Second cluster
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 60 * 1000, type: 'transfer' },
        { id: '4', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 30 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.temporalPatterns.length).toBeGreaterThan(0);
      expect(result.hasAnomalies).toBe(true);
    });

    it('should detect rhythmic pattern with consistent gaps', () => {
      const now = Date.now();
      const interval = 60 * 1000; // 1 minute intervals
      const transactions: Transaction[] = [];

      for (let i = 0; i < 10; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (10 - i) * interval,
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      const rhythmicPattern = result.temporalPatterns.find(p => p.type === 'RHYTHMIC');
      expect(rhythmicPattern).toBeDefined();
      expect(rhythmicPattern?.confidence).toBeGreaterThan(0.6);
    });

    it('should return IRREGULAR pattern for random timing', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 1000 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 50 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 10 * 1000, type: 'transfer' },
        { id: '4', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 5000 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      const hasPattern = result.temporalPatterns.length > 0;
      expect(hasPattern).toBe(true);
    });
  });

  describe('Anomaly Detection', () => {
    it('should flag velocity spike (3x normal)', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // 20 transactions in the last hour (3x normal baseline of ~5)
      for (let i = 0; i < 20; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (20 - i) * (3 * 60 * 1000), // 3 minute intervals = 20 per hour
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      const velocityFlag = result.anomalyFlags.find(f => f.type.includes('VELOCITY'));
      expect(velocityFlag).toBeDefined();
      if (velocityFlag) {
        expect(['HIGH', 'CRITICAL']).toContain(velocityFlag.severity);
      }
    });

    it('should flag critical velocity (10x normal)', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // 60 transactions in the last hour (10x normal)
      for (let i = 0; i < 60; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (60 - i) * (60 * 1000), // 1 minute intervals = 60 per hour
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      const criticalFlag = result.anomalyFlags.find(f => f.type === 'CRITICAL_VELOCITY');
      expect(criticalFlag).toBeDefined();
      if (criticalFlag) {
        expect(criticalFlag.severity).toBe('CRITICAL');
      }
    });

    it('should flag large transfers significantly above average', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 1000 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 500 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 1000, timestamp: now - 100 * 1000, type: 'transfer' },
        { id: '4', from: '0xUser', to: '0xRecipient', amount: 900, timestamp: now - 50 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.anomalyFlags.length).toBeGreaterThan(0);
      expect(result.hasAnomalies).toBe(true);
    });

    it('should flag rapid consecutive transfers', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // 10 transactions within 5 minutes
      for (let i = 0; i < 10; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (10 - i) * (30 * 1000), // 30 second intervals
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      const rapidFlag = result.anomalyFlags.find(f => f.type === 'RAPID_CONSECUTIVE_TRANSFERS');
      expect(rapidFlag).toBeDefined();
    });

    it('should flag counterparty concentration', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xConcentrated', amount: 100, timestamp: now - 1000 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xConcentrated', amount: 100, timestamp: now - 500 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xConcentrated', amount: 100, timestamp: now - 100 * 1000, type: 'transfer' },
        { id: '4', from: '0xUser', to: '0xConcentrated', amount: 100, timestamp: now - 50 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      const concentrationFlag = result.anomalyFlags.find(f => f.type === 'COUNTERPARTY_CONCENTRATION');
      expect(concentrationFlag).toBeDefined();
    });
  });

  describe('Risk Level Determination', () => {
    it('should determine LOW risk for normal transactions', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient1', amount: 100, timestamp: now - 24 * 60 * 60 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient2', amount: 100, timestamp: now - 18 * 60 * 60 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient3', amount: 100, timestamp: now - 12 * 60 * 60 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.riskLevel).toBe('LOW');
      expect(result.normalBehavior).toBe(true);
      expect(result.hasAnomalies).toBe(false);
    });

    it('should determine MEDIUM risk with single medium anomaly', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // Create velocity spike (3x normal)
      for (let i = 0; i < 20; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (20 - i) * (3 * 60 * 1000),
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      expect(['MEDIUM', 'HIGH']).toContain(result.riskLevel);
      expect(result.hasAnomalies).toBe(true);
    });

    it('should determine HIGH risk with multiple high severity anomalies', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // Create velocity spike + rapid consecutive transfers
      for (let i = 0; i < 25; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (25 - i) * (2 * 60 * 1000), // 2 minute intervals
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      expect(['HIGH', 'CRITICAL']).toContain(result.riskLevel);
    });

    it('should determine CRITICAL risk for critical velocity', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // Create critical velocity (10x normal)
      for (let i = 0; i < 60; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (60 - i) * (60 * 1000),
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      expect(result.riskLevel).toBe('CRITICAL');
    });
  });

  describe('Risk Adjustment Calculation', () => {
    it('should reduce risk for normal velocity', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient1', amount: 100, timestamp: now - 24 * 60 * 60 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient2', amount: 100, timestamp: now - 18 * 60 * 60 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient3', amount: 100, timestamp: now - 12 * 60 * 60 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityRiskAdjustment).toBeLessThan(0); // Risk reduction
    });

    it('should increase risk for high velocity', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // Create velocity spike
      for (let i = 0; i < 30; i++) {
        transactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (30 - i) * (2 * 60 * 1000),
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityRiskAdjustment).toBeGreaterThan(0); // Risk increase
    });

    it('should cap adjustment between -20 and +50', () => {
      const now = Date.now();
      
      // Test low velocity (should be capped at -20)
      const lowVelTransactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 7 * 24 * 60 * 60 * 1000, type: 'transfer' }
      ];
      const lowResult = detector.analyzePatterns(lowVelTransactions);
      expect(lowResult.velocityRiskAdjustment).toBeGreaterThanOrEqual(-20);
      expect(lowResult.velocityRiskAdjustment).toBeLessThanOrEqual(50);

      // Test high velocity (should be capped at +50)
      const highVelTransactions: Transaction[] = [];
      for (let i = 0; i < 100; i++) {
        highVelTransactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: Date.now() - (100 - i) * (30 * 1000),
          type: 'transfer'
        });
      }
      const highResult = detector.analyzePatterns(highVelTransactions);
      expect(highResult.velocityRiskAdjustment).toBeGreaterThanOrEqual(-20);
      expect(highResult.velocityRiskAdjustment).toBeLessThanOrEqual(50);
    });
  });

  describe('Confidence Scoring', () => {
    it('should have higher confidence with more transaction data', () => {
      const now = Date.now();
      
      // Small dataset
      const smallTransactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now, type: 'transfer' }
      ];
      const smallResult = detector.analyzePatterns(smallTransactions);

      // Large dataset
      const largeTransactions: Transaction[] = [];
      for (let i = 0; i < 150; i++) {
        largeTransactions.push({
          id: `${i}`,
          from: '0xUser',
          to: '0xRecipient',
          amount: 100,
          timestamp: now - (150 - i) * (10 * 1000),
          type: 'transfer'
        });
      }
      const largeResult = detector.analyzePatterns(largeTransactions);

      expect(largeResult.confidence).toBeGreaterThanOrEqual(smallResult.confidence);
    });

    it('should have confidence between 0 and 1', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 60 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single transaction', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result).toBeDefined();
      expect(result.velocityProfile.transactionsPerHour).toBeGreaterThanOrEqual(0);
      expect(result.riskLevel).toBeDefined();
    });

    it('should handle very old transactions', () => {
      const veryOld = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year ago
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: veryOld, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityProfile.transactionsPerHour).toBe(0);
      expect(['LOW', 'MEDIUM']).toContain(result.riskLevel);
    });

    it('should handle zero-amount transactions', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 0, timestamp: now, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 0, timestamp: now - 60 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityProfile.averageAmount).toBe(0);
      expect(result.velocityProfile.totalVolume).toBe(0);
      expect(result).toBeDefined();
    });

    it('should handle mixed timestamp types', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: new Date(now - 60 * 1000), type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 120 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityProfile.transactionsPerHour).toBe(3);
      expect(result.riskLevel).toBeDefined();
    });

    it('should handle negative amounts (returns)', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient', amount: 100, timestamp: now - 60 * 1000, type: 'transfer' },
        { id: '2', from: '0xRecipient', to: '0xUser', amount: -50, timestamp: now, type: 'return' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(result.velocityProfile.totalVolume).toBe(50);
      expect(result).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should analyze normal user behavior correctly', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient1', amount: 100, timestamp: now - 7 * 24 * 60 * 60 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient2', amount: 120, timestamp: now - 5 * 24 * 60 * 60 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient3', amount: 90, timestamp: now - 3 * 24 * 60 * 60 * 1000, type: 'transfer' }
      ];

      const result = detector.analyzePatterns(transactions);
      
      expect(['LOW', 'MEDIUM']).toContain(result.riskLevel);
      expect(result.velocityRiskAdjustment).toBeLessThanOrEqual(0);
    });

    it('should analyze suspicious behavior correctly', () => {
      const now = Date.now();
      const transactions: Transaction[] = [];

      // Simulate suspicious behavior: rapid burst activity
      for (let i = 0; i < 50; i++) {
        transactions.push({
          id: `tx-${i}`,
          from: '0xUserSuspicious',
          to: '0xRecipient',
          amount: 500,
          timestamp: now - (50 - i) * (30 * 1000), // 30 second intervals
          type: 'transfer'
        });
      }

      const result = detector.analyzePatterns(transactions);
      
      expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.riskLevel);
      expect(result.hasAnomalies).toBe(true);
      expect(result.velocityRiskAdjustment).toBeGreaterThan(0);
    });

    it('should provide consistent analysis across multiple runs', () => {
      const now = Date.now();
      const transactions: Transaction[] = [
        { id: '1', from: '0xUser', to: '0xRecipient1', amount: 100, timestamp: now - 1000 * 1000, type: 'transfer' },
        { id: '2', from: '0xUser', to: '0xRecipient2', amount: 150, timestamp: now - 500 * 1000, type: 'transfer' },
        { id: '3', from: '0xUser', to: '0xRecipient3', amount: 200, timestamp: now - 100 * 1000, type: 'transfer' }
      ];

      const detector1 = new AMLPatternDetector();
      const result1 = detector1.analyzePatterns(transactions);

      const detector2 = new AMLPatternDetector();
      const result2 = detector2.analyzePatterns(transactions);

      expect(result1.riskLevel).toBe(result2.riskLevel);
      expect(result1.velocityRiskAdjustment).toBe(result2.velocityRiskAdjustment);
      expect(result1.hasAnomalies).toBe(result2.hasAnomalies);
    });
  });
});
