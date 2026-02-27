/**
 * Compliance Service Unit Tests
 * Tests for ComplianceService methods including decision aggregation, rules engine, and audit trails
 */

import { ComplianceService, ComplianceDecision, AuditEntry } from '../../../services/complianceService';

// Mock database module
jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

// Mock SQL loader
jest.mock('../../../utils/sqlLoader', () => ({
  getInstance: jest.fn(() => ({
    getQuery: jest.fn((path: string) => `SELECT * FROM compliance_checks`),
  })),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-12345'),
}));

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  })),
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

describe('ComplianceService', () => {
  let complianceService: ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    complianceService = new ComplianceService();
  });

  /**
   * Test Suite 1: Decision Aggregation
   */
  describe('aggregateComplianceDecision', () => {
    it('should aggregate compliance decision from KYC and AML results', async () => {
      const kycResult = {
        score: 15,
        flags: [{ type: 'IDENTITY_VERIFIED' }],
        recommendations: ['Monitor for 12 months'],
      };

      const amlResult = {
        score: 25,
        flags: [{ type: 'NORMAL_VELOCITY' }],
        recommendations: ['Standard monitoring'],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-123',
        kycResult,
        amlResult,
        'AE', // UAE jurisdiction
        'user-456'
      );

      expect(decision).toBeDefined();
      expect(decision.decisionId).toBe('test-uuid-12345');
      expect(decision.entityId).toBe('entity-123');
      expect(decision.jurisdiction).toBe('AE');
      expect(decision.kycRiskScore).toBe(15);
      expect(decision.amlRiskScore).toBe(25);
      expect(decision.auditTrail.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle missing KYC result gracefully', async () => {
      const amlResult = {
        score: 45,
        flags: [],
        recommendations: [],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-789',
        undefined,
        amlResult,
        'US'
      );

      expect(decision).toBeDefined();
      expect(decision.kycRiskScore).toBe(0);
      expect(decision.amlRiskScore).toBe(45);
    });

    it('should handle missing AML result gracefully', async () => {
      const kycResult = {
        score: 35,
        flags: [],
        recommendations: [],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-999',
        kycResult,
        undefined,
        'IN'
      );

      expect(decision).toBeDefined();
      expect(decision.kycRiskScore).toBe(35);
      expect(decision.amlRiskScore).toBe(0);
    });

    it('should combine flags from both KYC and AML', async () => {
      const kycResult = {
        score: 10,
        flags: [{ type: 'IDENTITY_VERIFIED' }, { type: 'ADDRESS_CONFIRMED' }],
        recommendations: [],
      };

      const amlResult = {
        score: 20,
        flags: [{ type: 'NORMAL_VELOCITY' }],
        recommendations: [],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-flags',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.combinedFlags.length).toBeGreaterThanOrEqual(2);
      expect(decision.combinedFlags).toContain('IDENTITY_VERIFIED');
      expect(decision.combinedFlags).toContain('NORMAL_VELOCITY');
    });

    it('should create audit trail entry for aggregation', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-audit',
        kycResult,
        amlResult,
        'AE',
        'officer-123'
      );

      expect(decision.auditTrail).toBeDefined();
      expect(decision.auditTrail.length).toBeGreaterThanOrEqual(1);

      const auditEntry = decision.auditTrail[0];
      expect(auditEntry.action).toBe('DECISION_AGGREGATED');
      expect(auditEntry.userId).toBe('officer-123');
      expect(auditEntry.status).toBe('success');
      expect(auditEntry.timestamp).toBeDefined();
    });
  });

  /**
   * Test Suite 2: Status Determination
   */
  describe('determineStatus', () => {
    it('should return APPROVED for low risk score (< 20)', () => {
      // Using private method through aggregateComplianceDecision
      const kycResult = { score: 15, flags: [], recommendations: [] };
      const amlResult = { score: 10, flags: [], recommendations: [] };

      return complianceService
        .aggregateComplianceDecision('entity-test', kycResult, amlResult, 'AE')
        .then((decision) => {
          expect(decision.kycStatus).toBe('APPROVED');
          expect(decision.amlStatus).toBe('APPROVED');
        });
    });

    it('should return PENDING for medium-low risk score (20-40)', async () => {
      const kycResult = { score: 25, flags: [], recommendations: [] };
      const amlResult = { score: 35, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-pending',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.kycStatus).toBe('PENDING');
      expect(decision.amlStatus).toBe('PENDING');
    });

    it('should return ESCALATED for medium-high risk score (40-70)', async () => {
      const kycResult = { score: 45, flags: [], recommendations: [] };
      const amlResult = { score: 55, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-escalated',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.kycStatus).toBe('ESCALATED');
      expect(decision.amlStatus).toBe('ESCALATED');
    });

    it('should return REJECTED for high risk score (>= 70)', async () => {
      const kycResult = { score: 75, flags: [], recommendations: [] };
      const amlResult = { score: 85, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-rejected',
        kycResult,
        amlResult,
        'IN'
      );

      expect(decision.kycStatus).toBe('REJECTED');
      expect(decision.amlStatus).toBe('REJECTED');
    });
  });

  /**
   * Test Suite 3: Overall Status Determination
   */
  describe('determineOverallStatus', () => {
    it('should use most restrictive status (REJECTED > ESCALATED > PENDING > APPROVED)', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] }; // APPROVED
      const amlResult = { score: 75, flags: [], recommendations: [] }; // REJECTED

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-override',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.overallStatus).toBe('REJECTED'); // Most restrictive wins
    });

    it('should select ESCALATED when KYC=ESCALATED and AML=PENDING', async () => {
      const kycResult = { score: 50, flags: [], recommendations: [] }; // ESCALATED
      const amlResult = { score: 25, flags: [], recommendations: [] }; // PENDING

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-priority',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.overallStatus).toBe('ESCALATED'); // More restrictive than PENDING
    });

    it('should maintain APPROVED when both are APPROVED', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 15, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-approved',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.overallStatus).toBe('APPROVED');
    });
  });

  /**
   * Test Suite 4: Risk Score Aggregation
   */
  describe('Risk Score Calculation', () => {
    it('should calculate average risk score from KYC and AML', async () => {
      const kycResult = { score: 40, flags: [], recommendations: [] };
      const amlResult = { score: 60, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-score',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.riskScore).toBe(50); // (40 + 60) / 2
    });

    it('should handle zero scores correctly', async () => {
      const kycResult = { score: 0, flags: [], recommendations: [] };
      const amlResult = { score: 0, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-zero',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.riskScore).toBe(0);
    });

    it('should handle maximum scores correctly', async () => {
      const kycResult = { score: 100, flags: [], recommendations: [] };
      const amlResult = { score: 100, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-max',
        kycResult,
        amlResult,
        'IN'
      );

      expect(decision.riskScore).toBe(100);
    });
  });

  /**
   * Test Suite 5: Recommendation Aggregation
   */
  describe('Recommendation Aggregation', () => {
    it('should combine recommendations from both KYC and AML', async () => {
      const kycResult = {
        score: 15,
        flags: [],
        recommendations: ['Monitor for suspicious activity', 'Verify source of funds'],
      };

      const amlResult = {
        score: 25,
        flags: [],
        recommendations: ['Check transaction velocity', 'Review geographic risk'],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-recommendations',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.recommendations.length).toBeGreaterThanOrEqual(4);
      expect(decision.recommendations).toContain('Monitor for suspicious activity');
      expect(decision.recommendations).toContain('Check transaction velocity');
    });

    it('should remove duplicate recommendations', async () => {
      const kycResult = {
        score: 15,
        flags: [],
        recommendations: ['Enhanced due diligence', 'Monitor activity'],
      };

      const amlResult = {
        score: 25,
        flags: [],
        recommendations: ['Enhanced due diligence', 'Review sanctions'],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-dedup',
        kycResult,
        amlResult,
        'AE'
      );

      const uniqueRecommendations = [...new Set(decision.recommendations)];
      expect(decision.recommendations.length).toBe(uniqueRecommendations.length); // No duplicates
    });

    it('should handle empty recommendations', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-no-recs',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.recommendations).toBeDefined();
      expect(Array.isArray(decision.recommendations)).toBe(true);
    });
  });

  /**
   * Test Suite 6: Jurisdiction Handling
   */
  describe('Jurisdiction Handling', () => {
    it('should preserve jurisdiction in decision', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-uae',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.jurisdiction).toBe('AE');
    });

    it('should handle different jurisdictions', async () => {
      const jurisdictions = ['AE', 'US', 'IN', 'EU'];
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const promises = jurisdictions.map((jurisdiction) =>
        complianceService.aggregateComplianceDecision(
          `entity-${jurisdiction}`,
          kycResult,
          amlResult,
          jurisdiction
        )
      );

      const decisions = await Promise.all(promises);

      decisions.forEach((decision, index) => {
        expect(decision.jurisdiction).toBe(jurisdictions[index]);
      });
    });
  });

  /**
   * Test Suite 7: User Attribution
   */
  describe('User Attribution in Audit Trail', () => {
    it('should record user in audit trail when provided', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-user',
        kycResult,
        amlResult,
        'AE',
        'officer-john-doe'
      );

      expect(decision.auditTrail[0].userId).toBe('officer-john-doe');
    });

    it('should use SYSTEM as default user when not provided', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-system',
        kycResult,
        amlResult,
        'US'
        // No userId provided
      );

      expect(decision.auditTrail[0].userId).toBe('SYSTEM');
    });
  });

  /**
   * Test Suite 8: Edge Cases
   */
  describe('Edge Cases', () => {
    it('should handle null flags array gracefully', async () => {
      const kycResult = {
        score: 15,
        flags: null,
        recommendations: ['Recommendation 1'],
      };

      const amlResult = {
        score: 25,
        flags: undefined,
        recommendations: ['Recommendation 2'],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-null-flags',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.combinedFlags).toBeDefined();
      expect(Array.isArray(decision.combinedFlags)).toBe(true);
    });

    it('should handle null recommendations array gracefully', async () => {
      const kycResult = {
        score: 15,
        flags: [{ type: 'FLAG1' }],
        recommendations: null,
      };

      const amlResult = {
        score: 25,
        flags: [{ type: 'FLAG2' }],
        recommendations: undefined,
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-null-recs',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.recommendations).toBeDefined();
      expect(Array.isArray(decision.recommendations)).toBe(true);
    });

    it('should handle extremely large flag counts', async () => {
      const largeFlags = Array.from({ length: 100 }, (_, i) => ({
        type: `FLAG_${i}`,
      }));

      const kycResult = {
        score: 75,
        flags: largeFlags.slice(0, 50),
        recommendations: [],
      };

      const amlResult = {
        score: 80,
        flags: largeFlags.slice(50),
        recommendations: [],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-large-flags',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.combinedFlags.length).toBeLessThanOrEqual(100);
    });

    it('should handle special characters in flags and recommendations', async () => {
      const kycResult = {
        score: 20,
        flags: [{ type: 'FLAG_WITH_<SPECIAL>_CHARS' }],
        recommendations: ['Recommendation with "quotes" and <html>'],
      };

      const amlResult = {
        score: 30,
        flags: [{ type: 'FLAG_WITH_émojis_🚀' }],
        recommendations: ["Recommendation with 'single quotes'"],
      };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-special-chars',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision).toBeDefined();
      expect(decision.combinedFlags.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test Suite 9: Decision Structure Validation
   */
  describe('Decision Structure Validation', () => {
    it('should return valid ComplianceDecision structure', async () => {
      const kycResult = { score: 15, flags: [], recommendations: [] };
      const amlResult = { score: 25, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-structure',
        kycResult,
        amlResult,
        'AE'
      );

      // Verify required properties exist
      expect(decision).toHaveProperty('decisionId');
      expect(decision).toHaveProperty('entityId');
      expect(decision).toHaveProperty('kycStatus');
      expect(decision).toHaveProperty('amlStatus');
      expect(decision).toHaveProperty('overallStatus');
      expect(decision).toHaveProperty('riskScore');
      expect(decision).toHaveProperty('kycRiskScore');
      expect(decision).toHaveProperty('amlRiskScore');
      expect(decision).toHaveProperty('combinedFlags');
      expect(decision).toHaveProperty('recommendations');
      expect(decision).toHaveProperty('jurisdiction');
      expect(decision).toHaveProperty('auditTrail');
    });

    it('should have valid status values', async () => {
      const validStatuses = ['APPROVED', 'REJECTED', 'ESCALATED', 'PENDING'];

      const kycResult = { score: 50, flags: [], recommendations: [] };
      const amlResult = { score: 60, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-status-validation',
        kycResult,
        amlResult,
        'US'
      );

      expect(validStatuses).toContain(decision.kycStatus);
      expect(validStatuses).toContain(decision.amlStatus);
      expect(validStatuses).toContain(decision.overallStatus);
    });

    it('should have valid risk scores (0-100)', async () => {
      const kycResult = { score: 45, flags: [], recommendations: [] };
      const amlResult = { score: 55, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-risk-score-range',
        kycResult,
        amlResult,
        'AE'
      );

      expect(decision.kycRiskScore).toBeGreaterThanOrEqual(0);
      expect(decision.kycRiskScore).toBeLessThanOrEqual(100);
      expect(decision.amlRiskScore).toBeGreaterThanOrEqual(0);
      expect(decision.amlRiskScore).toBeLessThanOrEqual(100);
      expect(decision.riskScore).toBeGreaterThanOrEqual(0);
      expect(decision.riskScore).toBeLessThanOrEqual(100);
    });
  });

  /**
   * Test Suite 10: Audit Trail Integrity
   */
  describe('Audit Trail Integrity', () => {
    it('should have at least one audit entry after aggregation', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-audit-integrity',
        kycResult,
        amlResult,
        'US'
      );

      expect(decision.auditTrail.length).toBeGreaterThanOrEqual(1);
    });

    it('should have valid audit entry structure', async () => {
      const kycResult = { score: 10, flags: [], recommendations: [] };
      const amlResult = { score: 20, flags: [], recommendations: [] };

      const decision = await complianceService.aggregateComplianceDecision(
        'entity-audit-structure',
        kycResult,
        amlResult,
        'AE',
        'officer-123'
      );

      const auditEntry = decision.auditTrail[0];
      expect(auditEntry).toHaveProperty('timestamp');
      expect(auditEntry).toHaveProperty('action');
      expect(auditEntry).toHaveProperty('userId');
      expect(auditEntry).toHaveProperty('details');
      expect(auditEntry).toHaveProperty('status');

      expect(['success', 'failure']).toContain(auditEntry.status);
    });
  });
});
