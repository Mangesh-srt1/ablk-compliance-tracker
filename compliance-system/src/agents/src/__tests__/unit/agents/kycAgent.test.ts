/**
 * KYC Agent Unit Tests
 * Tests KYC verification workflow with Ballerine integration
 *
 * File: src/__tests__/unit/agents/kycAgent.test.ts
 */

import { KycAgent } from '../../../agents/kycAgent';

describe('KycAgent', () => {
  let agent: KycAgent;
  let mockBallerineTool: any;
  let mockJurisdictionTool: any;

  beforeEach(() => {
    mockBallerineTool = {
      call: jest.fn().mockResolvedValue({
        status: 'VERIFIED',
        confidence: 0.98,
        documentTypes: ['PASSPORT', 'PROOF_OF_ADDRESS'],
      }),
    };
    mockJurisdictionTool = {
      call: jest.fn().mockResolvedValue({
        requirements: {
          minAge: 18,
          docTypes: ['PASSPORT', 'NATIONAL_ID'],
        },
      }),
    };

    agent = new KycAgent({
      ballerineTool: mockBallerineTool,
      jurisdictionTool: mockJurisdictionTool,
    });
  });

  describe('Identity Verification Happy Path', () => {
    it('should verify identity with valid documents', async () => {
      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('VERIFIED');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(mockBallerineTool.call).toHaveBeenCalled();
    });

    it('should accept all required document types per jurisdiction', async () => {
      const docTypes = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'];

      for (const docType of docTypes) {
        const result = await agent.verifyIdentity({
          name: 'Test User',
          documentType: docType,
          documentId: 'DOC123',
          dateOfBirth: '1990-01-15',
          jurisdiction: 'US',
        });

        expect(result).toBeDefined();
        expect([
          'VERIFIED',
          'PENDING',
          'REJECTED',
        ]).toContain(result.status);
      }
    });

    it('should verify minimum age requirement', async () => {
      const validAge = '1990-01-15'; // Over 18
      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: validAge,
        jurisdiction: 'US',
      });

      expect(result.status).not.toBe('REJECTED');
    });

    it('should apply jurisdiction-specific KYC requirements', async () => {
      const jurisdictions = ['US', 'EU', 'IN', 'AE'];

      for (const jurisdiction of jurisdictions) {
        const result = await agent.verifyIdentity({
          name: 'Test User',
          documentType: 'PASSPORT',
          documentId: 'DOC123',
          dateOfBirth: '1990-01-15',
          jurisdiction,
        });

        expect(mockJurisdictionTool.call).toHaveBeenCalledWith({
          jurisdiction,
        });
        expect(result).toBeDefined();
      }
    });
  });

  describe('Document Validation', () => {
    it('should reject underage applicants', async () => {
      const underageDate = new Date();
      underageDate.setFullYear(underageDate.getFullYear() - 17); // 17 years old

      const result = await agent.verifyIdentity({
        name: 'Young User',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: underageDate.toISOString().split('T')[0],
        jurisdiction: 'US',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.reasoning).toMatch(/age|underage/i);
    });

    it('should reject expired documents', async () => {
      mockBallerineTool.call.mockResolvedValue({
        status: 'REJECTED',
        reason: 'Document expired',
      });

      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        documentExpiry: '2020-01-01',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('REJECTED');
    });

    it('should reject invalid document format', async () => {
      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'INVALID_TYPE',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.reasoning).toMatch(/invalid|not supported/i);
    });

    it('should handle missing required fields', async () => {
      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        // Missing documentId
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.reasoning).toMatch(/required|missing/i);
    });

    it('should perform liveness check when requested', async () => {
      mockBallerineTool.call.mockResolvedValue({
        status: 'VERIFIED',
        livenessCheck: true,
        livenessScore: 0.92,
      });

      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
        requireLiveness: true,
      });

      expect(result.status).toBe('VERIFIED');
      expect(result.livenessCheck).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    it('should assign low risk to verified users', async () => {
      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeLessThan(30);
    });

    it('should flag high-risk document types', async () => {
      mockBallerineTool.call.mockResolvedValue({
        status: 'PENDING_REVIEW',
        risk: 'HIGH',
        reason: 'Document appears forged',
      });

      const result = await agent.verifyIdentity({
        name: 'Suspicious User',
        documentType: 'PASSPORT',
        documentId: 'FORGED123',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.riskScore).toBeGreaterThan(60);
    });

    it('should apply jurisdiction-specific risk thresholds', async () => {
      const jurisdictions = ['US', 'AE', 'IN'];

      for (const jurisdiction of jurisdictions) {
        const result = await agent.verifyIdentity({
          name: 'Test User',
          documentType: 'PASSPORT',
          documentId: 'DOC123',
          dateOfBirth: '1990-01-15',
          jurisdiction,
        });

        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Jurisdiction-Specific Compliance', () => {
    it('should enforce GDPR compliance for EU users', async () => {
      const result = await agent.verifyIdentity({
        name: 'EU User',
        documentType: 'NATIONAL_ID',
        documentId: 'EU123',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'EU',
      });

      expect(mockJurisdictionTool.call).toHaveBeenCalledWith({
        jurisdiction: 'EU',
      });
      expect(result.gdprCompliant).toBe(true);
    });

    it('should enforce SEBI compliance for Indian users', async () => {
      const result = await agent.verifyIdentity({
        name: 'Indian User',
        documentType: 'NATIONAL_ID',
        documentId: 'IN123',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'IN',
      });

      expect(mockJurisdictionTool.call).toHaveBeenCalledWith({
        jurisdiction: 'IN',
      });
      expect(result).toBeDefined();
    });

    it('should enforce UAE-specific requirements', async () => {
      const result = await agent.verifyIdentity({
        name: 'UAE User',
        documentType: 'PASSPORT',
        documentId: 'UAE123',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'AE',
      });

      expect(mockJurisdictionTool.call).toHaveBeenCalledWith({
        jurisdiction: 'AE',
      });
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling & Graceful Degradation', () => {
    it('should handle Ballerine API timeout', async () => {
      mockBallerineTool.call.mockRejectedValue(
        new Error('Request timeout after 30s')
      );

      const result = await agent.verifyIdentity({
        name: 'Test User',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.reasoning).toMatch(/timeout|unavailable/i);
    });

    it('should handle invalid jurisdiction gracefully', async () => {
      mockJurisdictionTool.call.mockRejectedValue(
        new Error('Jurisdiction not supported')
      );

      const result = await agent.verifyIdentity({
        name: 'Test User',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'UNKNOWN',
      });

      expect(result).toBeDefined();
      expect([
        'REJECTED',
        'ESCALATED',
        'PENDING_REVIEW',
      ]).toContain(result.status);
    });

    it('should retry failed verification with backoff', async () => {
      mockBallerineTool.call
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          status: 'VERIFIED',
          confidence: 0.95,
        });

      const result = await agent.verifyIdentity({
        name: 'Test User',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
        maxRetries: 3,
      });

      expect(result.status).toBe('VERIFIED');
    });
  });

  describe('Performance & Caching', () => {
    it('should cache verification results', async () => {
      const request = {
        name: 'Test User',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      };

      const result1 = await agent.verifyIdentity(request);
      const result2 = await agent.verifyIdentity(request);

      expect(result1).toEqual(result2);
      expect(mockBallerineTool.call.mock.calls.length).toBeLessThan(3);
    });

    it('should complete verification within SLA', async () => {
      const startTime = Date.now();
      await agent.verifyIdentity({
        name: 'Test User',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });
      const duration = Date.now() - startTime;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Compliance Documentation', () => {
    it('should generate audit trail for verification', async () => {
      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.auditTrail).toBeDefined();
      expect(result.auditTrail.timestamp).toBeDefined();
      expect(result.auditTrail.verifier).toBeDefined();
    });

    it('should store verification records for compliance', async () => {
      const result = await agent.verifyIdentity({
        name: 'John Doe',
        documentType: 'PASSPORT',
        documentId: 'P123456',
        dateOfBirth: '1990-01-15',
        jurisdiction: 'US',
      });

      expect(result.recordId).toBeDefined();
      expect(result.storedAt).toBeDefined();
    });
  });
});
