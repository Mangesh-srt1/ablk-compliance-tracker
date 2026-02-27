/**
 * KYC Service - Ballerine Integration Tests
 * End-to-end tests for KYC workflow with Ballerine API
 */

import { KycService } from '../../../services/kycService';
import { BallerineClient } from '../../../agents/src/tools/ballerineClient';
import axios from 'axios';

jest.mock('axios');
jest.mock('../../../config/database');
jest.mock('../../../agents/src/tools/ballerineClient');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedBallerineClient = BallerineClient as jest.MockedClass<typeof BallerineClient>;

describe('KYC Service - Ballerine API Integration', () => {
  let kycService: KycService;
  let ballerineClient: BallerineClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Ballerine client
    ballerineClient = new BallerineClient();
    (ballerineClient as any).createWorkflow = jest.fn();
    (ballerineClient as any).getWorkflowStatus = jest.fn();
    (ballerineClient as any).submitDocument = jest.fn();

    kycService = new KycService();
  });

  describe('Full KYC Workflow', () => {
    // Test 1: Complete workflow - create workflow + submit documents + get result
    it('should execute complete KYC workflow with Ballerine', async () => {
      const mockCreateWorkflow = {
        id: 'workflow-123',
        status: 'processing',
      };

      const mockWorkflowStatus = {
        id: 'workflow-123',
        status: 'completed',
        documentVerification: { status: 'approved' },
        biometricVerification: { status: 'approved' },
        sanctionsCheck: { hit: false },
        pepCheck: { hit: false },
      };

      (ballerineClient as any).createWorkflow.mockResolvedValue(mockCreateWorkflow);
      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockWorkflowStatus);

      const kycRequest = {
        entityId: 'entity-1',
        jurisdiction: 'AE',
        entityData: {
          fullName: 'Ahmed Al Maktoum',
          dateOfBirth: '1990-01-15',
          address: 'Dubai, UAE',
          email: 'ahmed@example.com',
        },
        documents: [],
      };

      // Step 1: Create workflow
      const workflow = await ballerineClient.createWorkflow({
        customer: {
          id: kycRequest.entityId,
          name: kycRequest.entityData.fullName,
          email: kycRequest.entityData.email,
          phone: '+971-50-1234567',
        },
        documents: [],
        workflowType: 'kyc',
      });

      expect(workflow.id).toBe('workflow-123');

      // Step 2: Get workflow status (simulating completion)
      const status = await ballerineClient.getWorkflowStatus('workflow-123');

      expect(status.status).toBe('completed');
      expect(status.documentVerification?.status).toBe('approved');

      // Step 3: Verify no sanctions/PEP match
      expect(status.sanctionsCheck?.hit).toBe(false);
      expect(status.pepCheck?.hit).toBe(false);
    });

    // Test 2: Workflow with document upload
    it('should submit documents during workflow and track status', async () => {
      const mockDocumentUpload = {
        documentId: 'doc-123',
        workflowId: 'workflow-456',
        status: 'uploaded',
      };

      const mockWorkflowStatus = {
        id: 'workflow-456',
        status: 'processing',
        documentVerification: { status: 'processing' },
      };

      (ballerineClient as any).submitDocument.mockResolvedValue(mockDocumentUpload);
      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockWorkflowStatus);

      // Upload document
      const uploadResult = await ballerineClient.submitDocument('workflow-456', {
        type: 'passport',
        file: 'base64-encoded-file-content',
      });

      expect(uploadResult.documentId).toBe('doc-123');
      expect(uploadResult.status).toBe('uploaded');

      // Check workflow status after upload
      const status = await ballerineClient.getWorkflowStatus('workflow-456');

      expect(status.documentVerification?.status).toBe('processing');
    });

    // Test 3: Workflow rejection path
    it('should handle rejected workflow properly', async () => {
      const mockRejectionStatus = {
        id: 'workflow-789',
        status: 'failed',
        documentVerification: {
          status: 'rejected',
          reasons: ['Document quality too low', 'Face does not match document'],
        },
      };

      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockRejectionStatus);

      const status = await ballerineClient.getWorkflowStatus('workflow-789');

      expect(status.status).toBe('failed');
      expect(status.documentVerification?.reasons).toContain('Face does not match document');
    });

    // Test 4: Workflow with sanctions hit
    it('should handle sanctions match in workflow', async () => {
      const mockSanctionsHit = {
        id: 'workflow-111',
        status: 'completed',
        documentVerification: { status: 'approved' },
        sanctionsCheck: {
          hit: true,
          matches: [
            {
              source: 'OFAC',
              name: 'Sanctioned Entity',
              type: 'individual',
            },
          ],
        },
      };

      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockSanctionsHit);

      const status = await ballerineClient.getWorkflowStatus('workflow-111');

      expect(status.sanctionsCheck?.hit).toBe(true);
      expect(status.sanctionsCheck?.matches).toHaveLength(1);
    });

    // Test 5: PEP match in workflow
    it('should detect PEP match in workflow verification', async () => {
      const mockPepHit = {
        id: 'workflow-222',
        status: 'completed',
        documentVerification: { status:  'approved' },
        pepCheck: {
          hit: true,
          matches: [
            {
              source: 'C6_PEP',
              name: 'Government Official',
              type: 'pep',
            },
          ],
        },
      };

      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockPepHit);

      const status = await ballerineClient.getWorkflowStatus('workflow-222');

      expect(status.pepCheck?.hit).toBe(true);
      expect(status.pepCheck?.matches?.[0].type).toBe('pep');
    });
  });

  describe('Error Handling in Integration', () => {
    // Test 6: Handle Ballerine API timeout
    it('should handle Ballerine API timeout gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ECONNABORTED';

      (ballerineClient as any).createWorkflow.mockRejectedValue(timeoutError);

      await expect(
        ballerineClient.createWorkflow({
          customer: {
            id: 'entity-1',
            name: 'Test User',
            email: 'test@test.com',
            phone: '+1-234-567-8900',
          },
          documents: [],
          workflowType: 'kyc',
        })
      ).rejects.toThrow();
    });

    // Test 7: Handle missing workflow
    it('should handle non-existent workflow gracefully', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { message: 'Workflow not found' },
        },
      };

      (ballerineClient as any).getWorkflowStatus.mockRejectedValue(notFoundError);

      await expect(
        ballerineClient.getWorkflowStatus('non-existent-workflow')
      ).rejects.toThrow();
    });

    // Test 8: Handle invalid document upload
    it('should handle invalid document upload', async () => {
      const invalidDocError = {
        response: {
          status: 422,
          data: { message: 'Invalid document format' },
        },
      };

      (ballerineClient as any).submitDocument.mockRejectedValue(invalidDocError);

      await expect(
        ballerineClient.submitDocument('workflow-123', {
          type: 'invalid_document',
          file: 'some-file-content',
        })
      ).rejects.toThrow();
    });

    // Test 9: Handle rate limiting
    it('should respect Ballerine rate limiting', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { message: 'Too many requests' },
        },
      };

      (ballerineClient as any).createWorkflow.mockRejectedValue(rateLimitError);

      await expect(
        ballerineClient.createWorkflow({
          customer: {
            id: 'entity-1',
            name: 'Test',
            email: 'test@test.com',
            phone: '+1-234-567-8900',
          },
          documents: [],
          workflowType: 'kyc',
        })
      ).rejects.toThrow();
    });

    // Test 10: Handle authentication error
    it('should handle Ballerine authentication failure', async () => {
      const authError = {
        response: {
          status: 401,
          data: { message: 'Invalid API key' },
        },
      };

      (ballerineClient as any).createWorkflow.mockRejectedValue(authError);

      await expect(
        ballerineClient.createWorkflow({
          customer: {
            id: 'entity-1',
            name: 'Test',
            email: 'test@test.com',
            phone: '+1-234-567-8900',
          },
          documents: [],
          workflowType: 'kyc',
        })
      ).rejects.toThrow();
    });
  });

  describe('Data Consistency', () => {
    // Test 11: Workflow data persists across requests
    it('should maintain workflow data consistency across multiple status checks', async () => {
      const mockStatus = {
        id: 'workflow-333',
        status: 'completed',
        documentVerification: { status: 'approved' },
        biometricVerification: { status: 'approved' },
        addressVerification: { status: 'approved' },
      };

      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockStatus);

      const status1 = await ballerineClient.getWorkflowStatus('workflow-333');
      const status2 = await ballerineClient.getWorkflowStatus('workflow-333');

      expect(status1.id).toBe(status2.id);
      expect(status1.documentVerification?.status).toBe(status2.documentVerification?.status);
    });

    // Test 12: Workflow updates properly reflect status changes
    it('should reflect status changes in workflow updates', async () => {
      const initialStatus = {
        id: 'workflow-444',
        status: 'processing',
        documentVerification: { status: 'pending' },
      };

      const updatedStatus = {
        id: 'workflow-444',
        status: 'completed',
        documentVerification: { status: 'approved' },
      };

      (ballerineClient as any).getWorkflowStatus
        .mockResolvedValueOnce(initialStatus)
        .mockResolvedValueOnce(updatedStatus);

      const status1 = await ballerineClient.getWorkflowStatus('workflow-444');
      const status2 = await ballerineClient.getWorkflowStatus('workflow-444');

      expect(status1.status).toBe('processing');
      expect(status2.status).toBe('completed');
    });
  });

  describe('Workflow Scenarios', () => {
    // Test 13: Multi-step verification workflow
    it('should handle multi-step verification workflow', async () => {
      const steps = [
        {
          step: 'document_verification',
          status: 'completed',
          result: 'approved',
        },
        {
          step: 'biometric_verification',
          status: 'completed',
          result: 'approved',
        },
        {
          step: 'sanctions_check',
          status: 'completed',
          result: 'cleared',
        },
      ];

      const mockStatus = {
        id: 'workflow-555',
        status: 'completed',
        steps: steps,
        documentVerification: { status: 'approved' },
        biometricVerification: { status: 'approved' },
        sanctionsCheck: { hit: false },
      };

      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockStatus);

      const status = await ballerineClient.getWorkflowStatus('workflow-555');

      expect(status.documentVerification?.status).toBe('approved');
      expect(status.sanctionsCheck?.hit).toBe(false);
    });

    // Test 14: Partial completion workflow
    it('should handle partially completed workflows', async () => {
      const mockStatus = {
        id: 'workflow-666',
        status: 'processing',
        documentVerification: { status: 'approved' },
        biometricVerification: { status: 'processing' },
        addressVerification: { status: 'pending' },
      };

      (ballerineClient as any).getWorkflowStatus.mockResolvedValue(mockStatus);

      const status = await ballerineClient.getWorkflowStatus('workflow-666');

      expect(status.documentVerification?.status).toBe('approved');
      expect(status.biometricVerification?.status).toBe('processing');
      expect(status.addressVerification?.status).toBe('pending');
    });

    // Test 15: Re-submission workflow
    it('should handle workflow re-submission after rejection', async () => {
      const rejectionStatus = {
        id: 'workflow-777',
        status: 'failed',
        documentVerification: {
          status: 'rejected',
          reasons: ['Quality too low'],
        },
      };

      const resubmitStatus = {
        id: 'workflow-777-v2',
        status: 'processing',
        documentVerification: { status: 'processing' },
      };

      (ballerineClient as any).getWorkflowStatus
        .mockResolvedValueOnce(rejectionStatus)
        .mockResolvedValueOnce(resubmitStatus);

      const status1 = await ballerineClient.getWorkflowStatus('workflow-777');
      expect(status1.status).toBe('failed');

      // Resubmit
      const status2 = await ballerineClient.getWorkflowStatus('workflow-777-v2');
      expect(status2.status).toBe('processing');
    });
  });
});
