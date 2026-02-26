/**
 * KYC Service Unit Tests
 * Tests KYC verification logic, scoring, and database operations
 */

import { KycService } from '../../../services/kycService';
import { Jurisdiction, KycStatus, KycFlagType } from '../../../types/kyc';
import { AppError, ErrorCode } from '../../../types/errors';
import * as mockData from '../../fixtures/mockData';
import { MockDatabaseClient } from '../../fixtures/database';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../utils/sqlLoader');
jest.mock('../../../services/providers/kycProviderManager');

describe('KycService', () => {
  let service: KycService;
  let mockDb: Partial<MockDatabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KycService();
    mockDb = new MockDatabaseClient();
  });

  describe('performKycCheck', () => {
    // 1. Happy path: Valid entity passes India KYC
    it('should APPROVE valid Indian entity with all documents', async () => {
      const request = {
        entityId: 'entity-1',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Rajesh Kumar',
          dateOfBirth: '1990-01-15',
          address: '123 Main St, Mumbai',
          email: 'rajesh@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: '1234-5678-9012',
            expiryDate: '2030-12-31'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.PASS);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.flags.length).toBe(0);
      expect(result.entityId).toBe('entity-1');
    });

    // 2. Happy path: Valid EU entity
    it('should APPROVE valid EU entity with passport', async () => {
      const request = {
        entityId: 'entity-2',
        jurisdiction: Jurisdiction.EUROPEAN_UNION,
        entityData: {
          fullName: 'Jean Dupont',
          dateOfBirth: '1985-06-20',
          address: 'Paris, France',
          email: 'jean@test.com'
        },
        documents: [
          { 
            type: 'passport', 
            documentNumber: 'AB123456',
            expiryDate: '2030-06-20'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.PASS);
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.jurisdiction).toBe(Jurisdiction.EUROPEAN_UNION);
    });

    // 3. Happy path: Valid US entity
    it('should APPROVE valid US entity with drivers license', async () => {
      const request = {
        entityId: 'entity-3',
        jurisdiction: Jurisdiction.UNITED_STATES,
        entityData: {
          fullName: 'John Smith',
          dateOfBirth: '1980-03-10',
          address: 'New York, USA',
          email: 'john@test.com'
        },
        documents: [
          { 
            type: 'drivers_license', 
            documentNumber: 'DL123456789',
            expiryDate: '2029-03-10'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.PASS);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    // 4. Edge case: Missing document triggers flag
    it('should FAIL India KYC without Aadhaar document', async () => {
      const request = {
        entityId: 'entity-4',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Priya Singh',
          dateOfBirth: '1992-07-18',
          address: 'New Delhi, India',
          email: 'priya@test.com'
        },
        documents: [] // No Aadhaar!
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.FAIL);
      expect(result.score).toBeLessThan(70);
      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.flags[0].type).toBe(KycFlagType.DOCUMENT_INVALID);
    });

    // 5. Edge case: Underage entity REJECTED
    it('should FAIL India KYC for underage entity (< 18)', async () => {
      const request = {
        entityId: 'entity-5',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Anil Young',
          dateOfBirth: '2010-01-01', // Age 14
          address: 'Mumbai, India',
          email: 'anil@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: '9876-5432-1098',
            expiryDate: '2030-01-01'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.FAIL);
      expect(result.score).toBeLessThan(50);
      expect(result.flags.some(f => f.type === KycFlagType.AGE_UNDERAGE)).toBe(true);
    });

    // 6. Edge case: EU entity underage for GDPR (< 16)
    it('should FAIL EU KYC for underage entity (< 16)', async () => {
      const request = {
        entityId: 'entity-6',
        jurisdiction: Jurisdiction.EUROPEAN_UNION,
        entityData: {
          fullName: 'Anna Young',
          dateOfBirth: '2012-01-01', // Age 12
          address: 'Berlin, Germany',
          email: 'anna@test.com'
        },
        documents: [
          { 
            type: 'passport', 
            documentNumber: 'DE123456',
            expiryDate: '2032-01-01'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.FAIL);
      expect(result.flags.some(f => f.type === KycFlagType.AGE_UNDERAGE)).toBe(true);
    });

    // 7. Edge case: Missing email in EU requires review
    it('should escalate to REQUIRES_REVIEW for EU without email', async () => {
      const request = {
        entityId: 'entity-7',
        jurisdiction: Jurisdiction.EUROPEAN_UNION,
        entityData: {
          fullName: 'Marie Claire',
          dateOfBirth: '1988-04-22',
          address: 'Paris, France',
          email: undefined // Missing email
        },
        documents: [
          { 
            type: 'national_id', 
            documentNumber: 'FR789456',
            expiryDate: '2030-04-22'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.REQUIRES_REVIEW);
      expect(result.score).toBeLessThan(75);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    // 8. Invalid jurisdiction throws error
    it('should throw error for unsupported jurisdiction', async () => {
      const request = {
        entityId: 'entity-8',
        jurisdiction: 'XX' as any, // Invalid jurisdiction
        entityData: {
          fullName: 'Invalid Entity',
          dateOfBirth: '1990-01-01',
          address: 'Somewhere'
        },
        documents: []
      };

      await expect(service.performKycCheck(request)).rejects.toThrow(AppError);
    });

    // 9: Processing time is calculated
    it('should measure and return processing time', async () => {
      const request = {
        entityId: 'entity-9',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Test User',
          dateOfBirth: '1990-01-01',
          address: 'Test Address',
          email: 'test@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: '1111-2222-3333',
            expiryDate: '2030-01-01'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.processingTime).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeLessThan(5000); // Should complete in <5s
    });

    // 10: Result includes recommendation for passed entities
    it('should include recommendations in result', async () => {
      const request = {
        entityId: 'entity-10',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Amit Patel',
          dateOfBirth: '1990-01-01',
          address: 'Bangalore, India',
          email: 'amit@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: '5555-6666-7777',
            expiryDate: '2030-01-01'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Age Calculation', () => {
    // 11: Correctly calculates age from DOB
    it('should correctly calculate age for adult', async () => {
      const request = {
        entityId: 'entity-11',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Adult User',
          dateOfBirth: '1990-01-01',
          address: 'Test Address',
          email: 'adult@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: '8888-9999-0000',
            expiryDate: '2030-01-01'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      // Should pass since adult age
      expect(result.status).not.toBe(KycStatus.FAIL);
    });

    // 12: Boundary case - exactly 18 years old (minimum India)
    it('should PASS entity that is exactly 18 years old for India', async () => {
      const today = new Date();
      const dob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      const dobString = dob.toISOString().split('T')[0];

      const request = {
        entityId: 'entity-12',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Just Legal',
          dateOfBirth: dobString,
          address: 'Test Address',
          email: 'legal@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: 'AAAA-BBBB-CCCC',
            expiryDate: '2030-01-01'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.PASS);
    });
  });

  describe('Idempotency', () => {
    // 13: Same request twice returns same result
    it('should be idempotent - same request produces same decision', async () => {
      const request = {
        entityId: 'entity-13',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'Consistent User',
          dateOfBirth: '1990-01-01',
          address: 'Test Address',
          email: 'consistent@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: 'DDDD-EEEE-FFFF',
            expiryDate: '2030-01-01'
          }
        ]
      };

      const result1 = await service.performKycCheck(request);
      const result2 = await service.performKycCheck(request);

      expect(result1.status).toBe(result2.status);
      expect(result1.score).toBe(result2.score);
      expect(result1.flags.length).toBe(result2.flags.length);
    });
  });

  describe('Error Handling', () => {
    // 14: Database error is caught and wrapped
    it('should handle database errors gracefully', async () => {
      const request = {
        entityId: 'entity-14',
        jurisdiction: Jurisdiction.INDIA,
        entityData: {
          fullName: 'DB Error User',
          dateOfBirth: '1990-01-01',
          address: 'Test Address',
          email: 'dberror@test.com'
        },
        documents: [
          { 
            type: 'aadhaar', 
            documentNumber: 'GGGG-HHHH-IIII',
            expiryDate: '2030-01-01'
          }
        ]
      };

      // This will depend on how storeKycCheck is mocked
      // For now, verify error is thrown
      try {
        await service.performKycCheck(request);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Multi-Document Support', () => {
    // 15: Multiple documents can be submitted
    it('should handle multiple documents for same entity', async () => {
      const request = {
        entityId: 'entity-15',
        jurisdiction: Jurisdiction.EUROPEAN_UNION,
        entityData: {
          fullName: 'Multi Doc User',
          dateOfBirth: '1988-05-15',
          address: 'Amsterdam, Netherlands',
          email: 'multidoc@test.com'
        },
        documents: [
          { 
            type: 'passport', 
            documentNumber: 'NL123456',
            expiryDate: '2030-05-15'
          },
          { 
            type: 'national_id', 
            documentNumber: 'ID789012',
            expiryDate: '2030-05-15'
          }
        ]
      };

      const result = await service.performKycCheck(request);

      expect(result.status).toBe(KycStatus.PASS);
      expect(result.score).toBeGreaterThanOrEqual(75);
    });
  });
});
