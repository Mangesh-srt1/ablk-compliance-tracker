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

  // ─── FR-7.8: PE-Specific Hawala Pattern Detection Tests ──────────────────

  describe('detectHawalaPatterns (FR-7.8)', () => {
    it('should return unflagged result for empty transactions', () => {
      const result = detector.detectHawalaPatterns([]);

      expect(result.flagged).toBe(false);
      expect(result.hawalaScore).toBe(0);
      expect(result.patterns).toHaveLength(0);
      expect(result.recommendation).toContain('No transactions');
    });

    describe('Structuring detection', () => {
      it('should detect structuring: multiple sub-threshold splits within 24h', () => {
        const now = Date.now();
        // Five $2,000 transfers from same sender within a few hours — combined $10k
        const transactions: Transaction[] = [
          { id: 'tx1', from: '0xSender', to: '0xA', amount: 2000, timestamp: now - 3 * 60 * 60 * 1000, type: 'transfer' },
          { id: 'tx2', from: '0xSender', to: '0xB', amount: 2000, timestamp: now - 2 * 60 * 60 * 1000, type: 'transfer' },
          { id: 'tx3', from: '0xSender', to: '0xC', amount: 2000, timestamp: now - 1 * 60 * 60 * 1000, type: 'transfer' },
          { id: 'tx4', from: '0xSender', to: '0xD', amount: 2000, timestamp: now - 30 * 60 * 1000, type: 'transfer' },
          { id: 'tx5', from: '0xSender', to: '0xE', amount: 2000, timestamp: now, type: 'transfer' },
        ];

        const result = detector.detectHawalaPatterns(transactions);

        const structuring = result.patterns.find(p => p.type === 'STRUCTURING');
        expect(structuring).toBeDefined();
        expect(structuring!.confidence).toBeGreaterThan(0.5);
        expect(result.hawalaScore).toBeGreaterThan(0);
        expect(result.flagged).toBe(true);
      });

      it('should NOT flag structuring for a single large transfer above threshold', () => {
        const now = Date.now();
        const transactions: Transaction[] = [
          { id: 'tx1', from: '0xSender', to: '0xA', amount: 50_000, timestamp: now, type: 'transfer' },
        ];

        const result = detector.detectHawalaPatterns(transactions);

        const structuring = result.patterns.find(p => p.type === 'STRUCTURING');
        expect(structuring).toBeUndefined();
      });
    });

    describe('Round-trip detection', () => {
      it('should detect round-trip: funds sent and returned within 48h', () => {
        const now = Date.now();
        const transactions: Transaction[] = [
          { id: 'out1', from: '0xAlice', to: '0xBob', amount: 10_000, timestamp: now - 24 * 60 * 60 * 1000, type: 'transfer' },
          { id: 'ret1', from: '0xBob', to: '0xAlice', amount: 9_800, timestamp: now - 12 * 60 * 60 * 1000, type: 'return' },
        ];

        const result = detector.detectHawalaPatterns(transactions);

        const roundTrip = result.patterns.find(p => p.type === 'ROUND_TRIP');
        expect(roundTrip).toBeDefined();
        expect(roundTrip!.transactions).toContain('out1');
        expect(roundTrip!.transactions).toContain('ret1');
      });

      it('should NOT flag round-trip for transfers more than 48h apart', () => {
        const now = Date.now();
        const transactions: Transaction[] = [
          { id: 'out1', from: '0xAlice', to: '0xBob', amount: 10_000, timestamp: now - 72 * 60 * 60 * 1000, type: 'transfer' },
          { id: 'ret1', from: '0xBob', to: '0xAlice', amount: 9_800, timestamp: now, type: 'return' },
        ];

        const result = detector.detectHawalaPatterns(transactions);

        const roundTrip = result.patterns.find(p => p.type === 'ROUND_TRIP');
        expect(roundTrip).toBeUndefined();
      });
    });

    describe('Fan-out detection', () => {
      it('should detect fan-out: one sender to many recipients in burst', () => {
        const now = Date.now();
        const transactions: Transaction[] = Array.from({ length: 6 }, (_, i) => ({
          id: `fanout-${i}`,
          from: '0xHub',
          to: `0xRecipient${i}`,
          amount: 1_000,
          timestamp: now - (5 - i) * 10 * 60 * 1000, // 10-min intervals within 1 hour
          type: 'transfer',
        }));

        const result = detector.detectHawalaPatterns(transactions);

        const fanOut = result.patterns.find(p => p.type === 'FAN_OUT');
        expect(fanOut).toBeDefined();
        expect(fanOut!.confidence).toBeGreaterThan(0);
        expect(result.flagged).toBe(true);
      });
    });

    describe('Fan-in detection', () => {
      it('should detect fan-in: many senders consolidating to one recipient', () => {
        const now = Date.now();
        const transactions: Transaction[] = Array.from({ length: 6 }, (_, i) => ({
          id: `fanin-${i}`,
          from: `0xSender${i}`,
          to: '0xCollector',
          amount: 1_000,
          timestamp: now - (5 - i) * 10 * 60 * 1000,
          type: 'transfer',
        }));

        const result = detector.detectHawalaPatterns(transactions);

        const fanIn = result.patterns.find(p => p.type === 'FAN_IN');
        expect(fanIn).toBeDefined();
        expect(fanIn!.confidence).toBeGreaterThan(0);
        expect(result.flagged).toBe(true);
      });
    });

    describe('Mirror trading detection', () => {
      it('should detect mirror trading: near-equal amounts across jurisdictions within 24h', () => {
        const now = Date.now();
        const transactions: Transaction[] = [
          { id: 'buy-ae', from: '0xTraderA', to: '0xFundAE', amount: 500_000, timestamp: now - 6 * 60 * 60 * 1000, type: 'transfer', jurisdiction: 'AE' },
          { id: 'sell-in', from: '0xFundIN', to: '0xTraderA', amount: 495_000, timestamp: now - 4 * 60 * 60 * 1000, type: 'transfer', jurisdiction: 'IN' },
        ];

        const result = detector.detectHawalaPatterns(transactions);

        const mirror = result.patterns.find(p => p.type === 'MIRROR_TRADING');
        expect(mirror).toBeDefined();
        expect(mirror!.transactions).toContain('buy-ae');
        expect(mirror!.transactions).toContain('sell-in');
      });

      it('should NOT detect mirror trading for same jurisdiction', () => {
        const now = Date.now();
        const transactions: Transaction[] = [
          { id: 'tx1', from: '0xA', to: '0xB', amount: 500_000, timestamp: now - 60 * 60 * 1000, type: 'transfer', jurisdiction: 'AE' },
          { id: 'tx2', from: '0xC', to: '0xD', amount: 498_000, timestamp: now, type: 'transfer', jurisdiction: 'AE' },
        ];

        const result = detector.detectHawalaPatterns(transactions);

        const mirror = result.patterns.find(p => p.type === 'MIRROR_TRADING');
        expect(mirror).toBeUndefined();
      });
    });

    describe('hawalaScore and recommendation', () => {
      it('should return hawalaScore >= 80 and STR recommendation for high-confidence multi-pattern match', () => {
        const now = Date.now();
        // Structuring pattern (5 sub-threshold within 24h)
        const structuring: Transaction[] = Array.from({ length: 5 }, (_, i) => ({
          id: `s-${i}`,
          from: '0xSender',
          to: `0xRecip${i}`,
          amount: 2_000,
          timestamp: now - (4 - i) * 60 * 60 * 1000,
          type: 'transfer',
        }));
        // Fan-out (6 recipients from hub)
        const fanOut: Transaction[] = Array.from({ length: 6 }, (_, i) => ({
          id: `fo-${i}`,
          from: '0xHub',
          to: `0xDst${i}`,
          amount: 1_000,
          timestamp: now - (5 - i) * 8 * 60 * 1000,
          type: 'transfer',
        }));
        // Round-trip
        const roundTrip: Transaction[] = [
          { id: 'rt1', from: '0xAlice', to: '0xBob', amount: 10_000, timestamp: now - 20 * 60 * 60 * 1000, type: 'transfer' },
          { id: 'rt2', from: '0xBob', to: '0xAlice', amount: 9_900, timestamp: now - 10 * 60 * 60 * 1000, type: 'return' },
        ];

        const allTx = [...structuring, ...fanOut, ...roundTrip];
        const result = detector.detectHawalaPatterns(allTx);

        expect(result.hawalaScore).toBeGreaterThanOrEqual(80);
        expect(result.recommendation).toContain('STR/SAR');
      });

      it('should have recommendation with trigger suggestion when flagged', () => {
        const now = Date.now();
        const transactions: Transaction[] = Array.from({ length: 5 }, (_, i) => ({
          id: `t-${i}`,
          from: '0xSender',
          to: `0xR${i}`,
          amount: 2_000,
          timestamp: now - (4 - i) * 60 * 60 * 1000,
          type: 'transfer',
        }));

        const result = detector.detectHawalaPatterns(transactions);

        if (result.flagged) {
          expect(result.recommendation.length).toBeGreaterThan(10);
        }
      });
    });
  });
});
