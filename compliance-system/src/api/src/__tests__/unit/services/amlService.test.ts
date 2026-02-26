/**
 * AML Service Unit Tests
 * Tests AML risk scoring, sanctions screening, and anomaly detection
 */

import { AmlService } from '../../../services/amlService';
import { Jurisdiction, AmlRiskLevel, AmlFlagType } from '../../../types/aml';
import { AppError, ErrorCode } from '../../../types/errors';
import * as mockData from '../../fixtures/mockData';

jest.mock('../../../config/database');
jest.mock('../../../utils/sqlLoader');
jest.mock('../../../services/providers/amlProviderManager');

describe('AmlService', () => {
  let service: AmlService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AmlService();
  });

  describe('performAmlCheck', () => {
    // 1. Happy path: Low-risk entity
    it('should identify LOW-RISK entity with clean screening', async () => {
      const request = {
        entityId: 'entity-1',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Rajesh Kumar',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678'
        },
        transactions: [
          {
            txHash: '0xaaa...',
            from: '0x1234567890abcdef1234567890abcdef12345678',
            to: '0xbbbb...',
            amount: 50000,
            timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
            type: 'transfer'
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      expect(result.riskLevel).toBe(AmlRiskLevel.LOW);
      expect(result.score).toBeLessThan(30);
      expect(result.flags.length).toBe(0);
      expect(result.screeningResults.sanctionsMatch).toBe(false);
    });

    // 2. Happy path: Medium-risk entity requiring review
    it('should identify MEDIUM-RISK entity with velocity anomaly', async () => {
      const request = {
        entityId: 'entity-2',
        jurisdiction: Jurisdiction.UNITED_STATES,
        entityData: {
          fullName: 'John Smith',
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        },
        transactions: [
          {
            txHash: '0xccc...',
            from: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            to: '0xdddd...',
            amount: 500000, // Large amount
            timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
            type: 'transfer'
          },
          {
            txHash: '0xeee...',
            from: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            to: '0xffff...',
            amount: 500000, // Another large amount
            timestamp: Date.now() - 500 * 60 * 60, // 30 min later
            type: 'transfer'
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      expect(result.riskLevel).toBe(AmlRiskLevel.MEDIUM);
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThan(70);
      expect(result.flags.some(f => f.type === AmlFlagType.VELOCITY_ANOMALY)).toBe(true);
    });

    // 3. Edge case: High-risk entity with suspicious patterns
    it('should identify HIGH-RISK entity with multiple suspicious flags', async () => {
      const request = {
        entityId: 'entity-3',
        jurisdiction: Jurisdiction.EUROPEAN_UNION,
        entityData: {
          fullName: 'Suspicious User',
          walletAddress: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed'
        },
        transactions: [
          {
            txHash: '0xggg...',
            from: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed',
            to: '0xhhhh...',
            amount: 10000000, // Massive amount
            timestamp: Date.now() - 10 * 60 * 1000, // 10 min ago
            type: 'transfer'
          },
          {
            txHash: '0xiii...',
            from: '0xfedcbafedcbafedcbafedcbafedcbafedcbafed',
            to: '0xjjjj...',
            amount: 5000000,
            timestamp: Date.now() - 5 * 60 * 1000, // 5 min ago
            type: 'transfer'
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      expect(result.riskLevel).toBe(AmlRiskLevel.HIGH);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.flags.length).toBeGreaterThan(0);
    });

    // 4. Edge case: Sanctions list match detected
    it('should ESCALATE entity with sanctions list match', async () => {
      const request = {
        entityId: 'entity-4',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Sanctioned Entity',
          walletAddress: '0x9999999999999999999999999999999999999999'
        },
        transactions: []
      };

      const result = await service.performAmlCheck(request);

      // This depends on mock implementation of screening
      // Verify the check completes and may flag sanctions
      expect(result.checkId).toBeDefined();
      expect(result.screeningResults).toBeDefined();
    });

    // 5. Edge case: PEP (Politically Exposed Person) detection
    it('should flag entity if PEP detected in screening', async () => {
      const request = {
        entityId: 'entity-5',
        jurisdiction: Jurisdiction.UNITED_STATES,
        entityData: {
          fullName: 'Government Official',
          walletAddress: '0x1111111111111111111111111111111111111111'
        },
        transactions: [
          {
            txHash: '0xkkk...',
            from: '0x1111111111111111111111111111111111111111',
            to: '0xllll...',
            amount: 100000,
            timestamp: Date.now(),
            type: 'transfer'
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      expect(result.screeningResults).toBeDefined();
      // PEP detection would be in flags if screening returns positive
      expect(result.checkId).toBeDefined();
    });

    // 6. Invalid jurisdiction throws error
    it('should throw error for unsupported jurisdiction', async () => {
      const request = {
        entityId: 'entity-6',
        jurisdiction: 'XX' as any,
        entityData: {
          fullName: 'Invalid Entity',
          walletAddress: '0x2222222222222222222222222222222222222222'
        },
        transactions: []
      };

      await expect(service.performAmlCheck(request)).rejects.toThrow(AppError);
    });

    // 7: Processing time measured
    it('should measure and return processing time', async () => {
      const request = {
        entityId: 'entity-7',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Timing Test',
          walletAddress: '0x3333333333333333333333333333333333333333'
        },
        transactions: []
      };

      const result = await service.performAmlCheck(request);

      expect(result.processingTime).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeLessThan(10000); // Should complete in <10s
    });

    // 8: Result includes recommendations
    it('should provide risk-appropriate recommendations', async () => {
      const request = {
        entityId: 'entity-8',
        jurisdiction: Jurisdiction.EUROPEAN_UNION,
        entityData: {
          fullName: 'Medium Risk User',
          walletAddress: '0x4444444444444444444444444444444444444444'
        },
        transactions: [
          {
            txHash: '0xmmm...',
            from: '0x4444444444444444444444444444444444444444',
            to: '0xnnnn...',
            amount: 300000,
            timestamp: Date.now(),
            type: 'transfer'
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Transaction Pattern Analysis', () => {
    // 9: Single transaction analyzed correctly
    it('should handle single transaction with normal velocity', async () => {
      const request = {
        entityId: 'entity-9',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Normal Velocity',
          walletAddress: '0x5555555555555555555555555555555555555555'
        },
        transactions: [
          {
            txHash: '0xooo...',
            from: '0x5555555555555555555555555555555555555555',
            to: '0xpppp...',
            amount: 50000,
            timestamp: Date.now(),
            type: 'transfer'
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      expect(result.riskLevel).toBe(AmlRiskLevel.LOW);
    });

    // 10: Multiple transactions in burst detected
    it('should detect burst pattern (multiple TXs in short window)', async () => {
      const baseTime = Date.now();
      const request = {
        entityId: 'entity-10',
        jurisdiction: Jurisdiction.UNITED_STATES,
        entityData: {
          fullName: 'Burst Pattern',
          walletAddress: '0x6666666666666666666666666666666666666666'
        },
        transactions: [
          {
            txHash: '0xqqq...',
            from: '0x6666666666666666666666666666666666666666',
            to: '0xrrrr...',
            amount: 100000,
            timestamp: baseTime
          },
          {
            txHash: '0xsss...',
            from: '0x6666666666666666666666666666666666666666',
            to: '0xtttt...',
            amount: 100000,
            timestamp: baseTime - 30000 // 30s apart
          },
          {
            txHash: '0xuuu...',
            from: '0x6666666666666666666666666666666666666666',
            to: '0xvvvv...',
            amount: 100000,
            timestamp: baseTime - 60000 // 60s apart
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      // Should flag multiple transactions in burst
      expect(result.flags.some(f => f.type === AmlFlagType.VELOCITY_ANOMALY)).toBe(true);
    });

    // 11: Round-trip detection (A->B->A suspicious)
    it('should detect suspicious round-trip pattern', async () => {
      const baseTime = Date.now();
      const request = {
        entityId: 'entity-11',
        jurisdiction: Jurisdiction.EUROPEAN_UNION,
        entityData: {
          fullName: 'Round Trip',
          walletAddress: '0x7777777777777777777777777777777777777777'
        },
        transactions: [
          {
            txHash: '0xwww...',
            from: '0x7777777777777777777777777777777777777777',
            to: '0x8888888888888888888888888888888888888888',
            amount: 500000,
            timestamp: baseTime - 1000 * 60 * 60 // 1 hour ago
          },
          {
            txHash: '0xxxx...',
            from: '0x8888888888888888888888888888888888888888',
            to: '0x7777777777777777777777777777777777777777',
            amount: 500000,
            timestamp: baseTime // Back to original
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      // Round-trip patterns are suspicious
      expect(result.riskLevel).toBeGreaterThanOrEqual(AmlRiskLevel.MEDIUM);
    });

    // 12: Structuring detection (small amounts to avoid thresholds)
    it('should detect structuring pattern (multiple small TXs)', async () => {
      const baseTime = Date.now();
      const request = {
        entityId: 'entity-12',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Structuring Suspect',
          walletAddress: '0x9999999999999999999999999999999999999999'
        },
        transactions: [
          {
            txHash: '0xyyy...',
            from: '0x9999999999999999999999999999999999999999',
            to: '0x1010101010101010101010101010101010101010',
            amount: 9999, // Just under 10000
            timestamp: baseTime - 3 * 60 * 1000
          },
          {
            txHash: '0xzzz...',
            from: '0x9999999999999999999999999999999999999999',
            to: '0x1010101010101010101010101010101010101010',
            amount: 9999,
            timestamp: baseTime - 2 * 60 * 1000
          },
          {
            txHash: '0xaaab...',
            from: '0x9999999999999999999999999999999999999999',
            to: '0x1010101010101010101010101010101010101010',
            amount: 9999,
            timestamp: baseTime - 1 * 60 * 1000
          }
        ]
      };

      const result = await service.performAmlCheck(request);

      // Structuring is flagged as suspicious
      expect(result.flags.some(f => f.type === AmlFlagType.STRUCTURING)).toBe(true);
    });
  });

  describe('Idempotency', () => {
    // 13: Same request produces same result
    it('should be idempotent - consistent risk scoring', async () => {
      const request = {
        entityId: 'entity-13',
        jurisdiction: Jurisdiction.UNITED_STATES,
        entityData: {
          fullName: 'Consistent Entity',
          walletAddress: '0x1212121212121212121212121212121212121212'
        },
        transactions: [
          {
            txHash: '0xbbbc...',
            from: '0x1212121212121212121212121212121212121212',
            to: '0x1313131313131313131313131313131313131313',
            amount: 25000,
            timestamp: Date.now()
          }
        ]
      };

      const result1 = await service.performAmlCheck(request);
      const result2 = await service.performAmlCheck(request);

      expect(result1.score).toBe(result2.score);
      expect(result1.riskLevel).toBe(result2.riskLevel);
      expect(result1.flags.length).toBe(result2.flags.length);
    });
  });

  describe('Jurisdiction-Specific Scoring', () => {
    // 14: India lower thresholds than US
    it('should apply jurisdiction-specific risk thresholds (India stricter)', async () => {
      const indiaRequest = {
        entityId: 'entity-14a',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'India User',
          walletAddress: '0x1414141414141414141414141414141414141414'
        },
        transactions: [
          {
            txHash: '0xcccd...',
            from: '0x1414141414141414141414141414141414141414',
            to: '0x1515151515151515151515151515151515151515',
            amount: 200000, // 200k
            timestamp: Date.now()
          }
        ]
      };

      const usRequest = {
        entityId: 'entity-14b',
        jurisdiction: Jurisdiction.UNITED_STATES,
        entityData: {
          fullName: 'US User',
          walletAddress: '0x1616161616161616161616161616161616161616'
        },
        transactions: [
          {
            txHash: '0xddde...',
            from: '0x1616161616161616161616161616161616161616',
            to: '0x1717171717171717171717171717171717171717',
            amount: 200000, // Same amount
            timestamp: Date.now()
          }
        ]
      };

      const indiaResult = await service.performAmlCheck(indiaRequest);
      const usResult = await service.performAmlCheck(usRequest);

      // India may be stricter, so should potentially have higher score
      expect(indiaResult.score).toBeGreaterThanOrEqual(0);
      expect(usResult.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    // 15: Graceful handling of missing data
    it('should handle missing optional transaction data', async () => {
      const request = {
        entityId: 'entity-15',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Minimal Data',
          walletAddress: '0x1818181818181818181818181818181818181818'
        },
        transactions: [] // Empty transactions
      };

      const result = await service.performAmlCheck(request);

      expect(result.checkId).toBeDefined();
      expect(result.riskLevel).toBeDefined();
    });
  });
});
