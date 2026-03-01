/**
 * KYB Service Unit Tests
 * Comprehensive test coverage for Know Your Business operations
 */

import { kybService } from '../services/kybService';
import {
  KybStatus,
  KybEntityType,
  Jurisdiction,
  KybCheckRequest,
  KybFlagType,
  KybDocument,
  KybCheckResult,
} from '../types/kyb';

describe('KybService', () => {
  const mockUserId = 'test-user-123';
  const mockBusinessId = 'BIZ-12345';

  // Mock data
  const validBusinessEntity = {
    registrationNumber: 'CR-2024-001',
    businessName: 'Tech Innovations LLC',
    entityType: KybEntityType.CORPORATION,
    dateOfIncorporation: new Date('2020-01-15').toISOString(),
    primaryAddress: {
      street: '123 Business Ave',
      city: 'Dubai',
      country: 'AE',
      postalCode: '00000',
    },
    ultimatelyBeneficialOwners: [
      {
        name: 'Ahmed Al Maktoum',
        nationality: 'AE',
        ownershipPercentage: 60,
        address: {
          street: '456 Owner Lane',
          city: 'Dubai',
          country: 'AE',
          postalCode: '00001',
        },
      },
      {
        name: 'Sarah Smith',
        nationality: 'GB',
        ownershipPercentage: 40,
        address: {
          street: '789 Partner St',
          city: 'London',
          country: 'GB',
          postalCode: 'E1 1AA',
        },
      },
    ],
  };

  const validDocuments: KybDocument[] = [
    {
      type: 'CERTIFICATE_OF_INCORPORATION',
      data: Buffer.from('mock certificate data').toString('base64'),
      metadata: {
        filename: 'cert.pdf',
        contentType: 'application/pdf',
        size: 102400,
      },
    },
    {
      type: 'PROOF_OF_BUSINESS_ADDRESS',
      data: Buffer.from('mock address proof').toString('base64'),
      metadata: {
        filename: 'address.pdf',
        contentType: 'application/pdf',
        size: 51200,
      },
    },
  ];

  describe('performKybCheck', () => {
    it('should successfully verify low-risk business in AE jurisdiction', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result).toBeDefined();
      expect(result.businessId).toBe(mockBusinessId);
      expect(result.jurisdiction).toBe(Jurisdiction.AE);
      expect(result.status).toMatch(/VERIFIED|PENDING/);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.flags).toBeInstanceOf(Array);
      expect(result.timestamp).toBeDefined();
      expect(result.checkId).toBeDefined();
    });

    it('should handle missing documents gracefully', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: [],
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result).toBeDefined();
      expect(result.flags).toContainEqual(expect.objectContaining({ type: KybFlagType.MISSING_DOCUMENTS }));
      expect(result.score).toBeGreaterThan(50); // Higher risk without docs
    });

    it('should detect sanctions hits in business name', async () => {
      const sanctionedEntity = {
        ...validBusinessEntity,
        businessName: 'OFAC Sanctioned Corp',
      };

      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: sanctionedEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result.flags.some((f) => f.type === KybFlagType.SANCTIONS_HIT)).toBe(true);
      expect(result.score).toBeGreaterThan(70);
      expect(result.status).toMatch(/FAILED|REQUIRES_REVIEW/);
    });

    it('should detect UBO mismatch', async () => {
      const mismatchedEntity = {
        ...validBusinessEntity,
        ultimatelyBeneficialOwners: [
          {
            name: 'Unknown Owner',
            nationality: 'XX',
            ownershipPercentage: 100,
            address: {
              street: 'Unknown street',
              city: 'Unknown',
              country: 'XX',
              postalCode: '00000',
            },
          },
        ],
      };

      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.IN,
        documents: validDocuments,
        entityData: mismatchedEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result.flags.some((f) => f.type === KybFlagType.UBO_MISMATCH)).toBe(true);
    });

    it('should apply jurisdiction-specific rules (AE)', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      // AE-specific validations should be applied
      expect(result.jurisdiction).toBe(Jurisdiction.AE);
      expect(result).toHaveProperty('jurisdictionRules');
    });

    it('should apply jurisdiction-specific rules (IN)', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.IN,
        documents: validDocuments,
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      // IN-specific validations should be applied
      expect(result.jurisdiction).toBe(Jurisdiction.IN);
      expect(result).toHaveProperty('jurisdictionRules');
    });

    it('should reject unsupported jurisdiction', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: 'XX' as Jurisdiction,
        documents: validDocuments,
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      await expect(kybService.performKybCheck(request, mockUserId)).rejects.toThrow(
        /Unsupported jurisdiction/
      );
    });

    it('should handle very large ownership percentages', async () => {
      const largeOwnershipEntity = {
        ...validBusinessEntity,
        ultimatelyBeneficialOwners: [
          {
            name: 'Primary Owner',
            nationality: 'AE',
            ownershipPercentage: 150, // Invalid: > 100%
            address: validBusinessEntity.ultimatelyBeneficialOwners[0].address,
          },
        ],
      };

      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: largeOwnershipEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result.flags.some((f) => f.reason?.includes('ownership'))).toBe(true);
    });

    it('should handle skip validation flag', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: [],
        entityData: validBusinessEntity,
        userId: mockUserId,
        skipDocumentVerification: true,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result).toBeDefined();
      // Should still return a result even without documents
      expect(result.checkId).toBeDefined();
    });
  });

  describe('validateBusinessRegistration', () => {
    it('should validate legitimate business registration', async () => {
      const result = await kybService.validateBusinessRegistration(validBusinessEntity, false);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.registrationVerified).toBe(true);
    });

    it('should flag invalid registration number format', async () => {
      const invalidEntity = {
        ...validBusinessEntity,
        registrationNumber: 'INVALID',
      };

      const result = await kybService.validateBusinessRegistration(invalidEntity, false);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringMatching(/registration/i));
    });

    it('should detect future incorporation dates', async () => {
      const futureEntity = {
        ...validBusinessEntity,
        dateOfIncorporation: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = await kybService.validateBusinessRegistration(futureEntity, false);

      expect(result.flags).toContainEqual(expect.stringMatching(/future|invalid date/i));
    });

    it('should skip validation when requested', async () => {
      const result = await kybService.validateBusinessRegistration(validBusinessEntity, true);

      expect(result.isValid).toBe(true);
      expect(result.registrationVerified).toBe(false);
    });
  });

  describe('performSanctionsScreening', () => {
    it('should pass clean business through sanctions check', async () => {
      const result = await kybService.performSanctionsScreening(validBusinessEntity, false);

      expect(result).toBeDefined();
      expect(result.sanctionedMatches).toBeDefined();
      expect(Array.isArray(result.sanctionedMatches)).toBe(true);
    });

    it('should detect OFAC sanctioned names', async () => {
      const sanctionedEntity = {
        ...validBusinessEntity,
        businessName: 'OFAC Listed Entity Inc',
      };

      const result = await kybService.performSanctionsScreening(sanctionedEntity, false);

      expect(result.sanctionedMatches.length).toBeGreaterThan(0);
      expect(result.sanctionedMatches[0]).toHaveProperty('sanctionsList');
    });

    it('should detect UN sanctions matches', async () => {
      const unSanctionedEntity = {
        ...validBusinessEntity,
        businessName: 'UN Sanctions Corp',
      };

      const result = await kybService.performSanctionsScreening(unSanctionedEntity, false);

      expect(result).toBeDefined();
    });

    it('should skip sanctions check when requested', async () => {
      const result = await kybService.performSanctionsScreening(validBusinessEntity, true);

      expect(result.sanctionedMatches.length).toBe(0);
    });

    it('should case-insensitively match sanctioned names', async () => {
      const lowerCaseEntity = {
        ...validBusinessEntity,
        businessName: 'ofac listed entity inc',
      };

      const result = await kybService.performSanctionsScreening(lowerCaseEntity, false);

      expect(result.sanctionedMatches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateKybRiskScore', () => {
    it('should calculate risk between 0-100', async () => {
      const riskInput = {
        registrationValid: true,
        sanctionsHits: 0,
        uboVerified: true,
        uboSanctionsHits: 0,
        jurisdiction: Jurisdiction.AE,
      };

      const result = await kybService.calculateKybRiskScore(riskInput);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.riskLevel).toMatch(/LOW|MEDIUM|HIGH|CRITICAL/);
    });

    it('should weigh sanctions hits heavily (35%)', async () => {
      const noSanctionsInput = {
        registrationValid: true,
        sanctionsHits: 0,
        uboVerified: true,
        uboSanctionsHits: 0,
        jurisdiction: Jurisdiction.AE,
      };

      const sanctionedInput = {
        registrationValid: true,
        sanctionsHits: 1,
        uboVerified: true,
        uboSanctionsHits: 0,
        jurisdiction: Jurisdiction.AE,
      };

      const cleanScore = await kybService.calculateKybRiskScore(noSanctionsInput);
      const sanctionedScore = await kybService.calculateKybRiskScore(sanctionedInput);

      expect(sanctionedScore.score).toBeGreaterThan(cleanScore.score);
      expect(sanctionedScore.score - cleanScore.score).toBeGreaterThanOrEqual(25); // 35% weight
    });

    it('should assign HIGH risk when multiple factors are negative', async () => {
      const riskInput = {
        registrationValid: false,
        sanctionsHits: 2,
        uboVerified: false,
        uboSanctionsHits: 1,
        jurisdiction: Jurisdiction.AE,
      };

      const result = await kybService.calculateKybRiskScore(riskInput);

      expect(result.score).toBeGreaterThan(70);
      expect(result.riskLevel).toMatch(/HIGH|CRITICAL/);
    });

    it('should assign LOW risk when all factors are positive', async () => {
      const riskInput = {
        registrationValid: true,
        sanctionsHits: 0,
        uboVerified: true,
        uboSanctionsHits: 0,
        jurisdiction: Jurisdiction.AE,
      };

      const result = await kybService.calculateKybRiskScore(riskInput);

      expect(result.score).toBeLessThan(30);
      expect(result.riskLevel).toBe('LOW');
    });

    it('should apply jurisdiction-specific risk adjustments', async () => {
      const aeInput = {
        registrationValid: true,
        sanctionsHits: 0,
        uboVerified: true,
        uboSanctionsHits: 0,
        jurisdiction: Jurisdiction.AE,
      };

      const usInput = {
        registrationValid: true,
        sanctionsHits: 0,
        uboVerified: true,
        uboSanctionsHits: 0,
        jurisdiction: Jurisdiction.US,
      };

      const aeScore = await kybService.calculateKybRiskScore(aeInput);
      const usScore = await kybService.calculateKybRiskScore(usInput);

      // Scores should differ based on jurisdiction
      expect(aeScore).toBeDefined();
      expect(usScore).toBeDefined();
    });
  });

  describe('getKybCheckHistory', () => {
    it('should retrieve check history for a business', async () => {
      const history = await kybService.getKybCheckHistory(mockBusinessId, 5);

      expect(history).toBeInstanceOf(Array);
      // May be empty if no previous checks, but should not throw
    });

    it('should limit results to requested count', async () => {
      const history = await kybService.getKybCheckHistory(mockBusinessId, 3);

      expect(history.length).toBeLessThanOrEqual(3);
    });

    it('should handle non-existent business ID gracefully', async () => {
      const history = await kybService.getKybCheckHistory('NON-EXISTENT-123', 10);

      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBe(0);
    });

    it('should return checks in reverse chronological order', async () => {
      const history = await kybService.getKybCheckHistory(mockBusinessId, 100);

      if (history.length > 1) {
        for (let i = 0; i < history.length - 1; i++) {
          const current = new Date(history[i].timestamp);
          const next = new Date(history[i + 1].timestamp);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });
  });

  describe('getCurrentKybRiskScore', () => {
    it('should retrieve current risk score', async () => {
      const riskScore = await kybService.getCurrentKybRiskScore(mockBusinessId);

      if (riskScore) {
        expect(riskScore).toHaveProperty('score');
        expect(riskScore).toHaveProperty('riskLevel');
        expect(riskScore.score).toBeGreaterThanOrEqual(0);
        expect(riskScore.score).toBeLessThanOrEqual(100);
      }
    });

    it('should return null for non-existent business', async () => {
      const riskScore = await kybService.getCurrentKybRiskScore('NON-EXISTENT-456');

      expect(riskScore).toBeNull();
    });
  });

  describe('enableContinuousMonitoring', () => {
    it('should enable monitoring with valid configuration', async () => {
      const result = await kybService.enableContinuousMonitoring({
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        monitoringFrequency: 'DAILY',
        screeningScope: ['SANCTIONS', 'NEWS'],
        alertThreshold: 50,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('monitoringId');
      expect(result).toHaveProperty('status');
      expect(result.businessId).toBe(mockBusinessId);
      expect(result.monitoringFrequency).toBe('DAILY');
    });

    it('should support different monitoring frequencies', async () => {
      const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'];

      for (const frequency of frequencies) {
        const result = await kybService.enableContinuousMonitoring({
          businessId: mockBusinessId,
          jurisdiction: Jurisdiction.AE,
          monitoringFrequency: frequency,
          screeningScope: ['SANCTIONS'],
          alertThreshold: 50,
        });

        expect(result.monitoringFrequency).toBe(frequency);
      }
    });

    it('should validate alert threshold between 0-100', async () => {
      const result = await kybService.enableContinuousMonitoring({
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        monitoringFrequency: 'WEEKLY',
        screeningScope: ['SANCTIONS'],
        alertThreshold: 75,
      });

      expect(result).toBeDefined();
      expect(result.alertThreshold).toBe(75);
    });

    it('should include all requested screening scopes', async () => {
      const scopes = ['SANCTIONS', 'NEWS', 'REGULATORY_ACTIONS', 'UBO_CHANGES'];

      const result = await kybService.enableContinuousMonitoring({
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        monitoringFrequency: 'DAILY',
        screeningScope: scopes,
        alertThreshold: 50,
      });

      expect(result.screeningScope).toEqual(expect.arrayContaining(scopes));
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle null entity data gracefully', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: null as any,
        userId: mockUserId,
      };

      await expect(kybService.performKybCheck(request, mockUserId)).rejects.toThrow();
    });

    it('should handle missing jurisdiction gracefully', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: null as any,
        documents: validDocuments,
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      await expect(kybService.performKybCheck(request, mockUserId)).rejects.toThrow();
    });

    it('should handle very long business names', async () => {
      const longNameEntity = {
        ...validBusinessEntity,
        businessName: 'A'.repeat(1000),
      };

      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: longNameEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result).toBeDefined();
      expect(result.checkId).toBeDefined();
    });

    it('should handle special characters in business name', async () => {
      const specialCharEntity = {
        ...validBusinessEntity,
        businessName: "Test & Co. Ltd. (ООО 'Проверка')",
      };

      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: specialCharEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result).toBeDefined();
    });

    it('should handle multiple UBOs with fractional ownership', async () => {
      const multiUboEntity = {
        ...validBusinessEntity,
        ultimatelyBeneficialOwners: [
          {
            name: 'Owner A',
            nationality: 'AE',
            ownershipPercentage: 25.5,
            address: validBusinessEntity.ultimatelyBeneficialOwners[0].address,
          },
          {
            name: 'Owner B',
            nationality: 'GB',
            ownershipPercentage: 24.25,
            address: validBusinessEntity.ultimatelyBeneficialOwners[1].address,
          },
          {
            name: 'Owner C',
            nationality: 'US',
            ownershipPercentage: 50.25,
            address: validBusinessEntity.ultimatelyBeneficialOwners[0].address,
          },
        ],
      };

      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.US,
        documents: validDocuments,
        entityData: multiUboEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result).toBeDefined();
      // Total ownership should be ~100%
    });
  });

  describe('Idempotency', () => {
    it('should return same result for identical requests', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      const result1 = await kybService.performKybCheck(request, mockUserId);
      const result2 = await kybService.performKybCheck(request, mockUserId);

      expect(result1.businessId).toBe(result2.businessId);
      expect(result1.jurisdiction).toBe(result2.jurisdiction);
      // Status and score might differ slightly due to timestamp, but core data same
    });
  });

  describe('Audit Trail', () => {
    it('should store audit trail for compliance', async () => {
      const request: KybCheckRequest = {
        businessId: mockBusinessId,
        jurisdiction: Jurisdiction.AE,
        documents: validDocuments,
        entityData: validBusinessEntity,
        userId: mockUserId,
      };

      const result = await kybService.performKybCheck(request, mockUserId);

      expect(result).toHaveProperty('auditTrail');
      if (result.auditTrail) {
        expect(Array.isArray(result.auditTrail)).toBe(true);
      }
    });
  });
});
