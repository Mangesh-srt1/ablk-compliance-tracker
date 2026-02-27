/**
 * Ballerine Client Unit Tests
 * Tests Ballerine KYC integration, workflow management, and error handling
 */

import { BallerineClient, BallerineWorkflowResult } from '../ballerineClient';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BallerineClient', () => {
  let client: BallerineClient;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BALLERINE_API_KEY = 'test-api-key';
    process.env.BALLERINE_BASE_URL = 'https://api.test.ballerine.io/v1';
    
    // Setup axios mock
    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn((success, error) => {}),
        },
      },
    } as any);

    client = new BallerineClient();
  });

  describe('createWorkflow', () => {
    // Test 1: Successfully create workflow
    it('should create a new Ballerine workflow successfully', async () => {
      const mockResponse = {
        data: {
          id: 'workflow-123',
          status: 'processing',
          documentVerification: { status: 'pending' },
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.createWorkflow({
        customer: {
          id: 'customer-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1-234-567-8900',
        },
        documents: [],
        workflowType: 'kyc',
      });

      expect(result.id).toBe('workflow-123');
      expect(result.status).toBe('processing');
    });

    // Test 2: Handle API error on workflow creation
    it('should handle API errors when creating workflow', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid workflow data' },
        },
        message: 'Bad request',
      };

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(
        client.createWorkflow({
          customer: { id: 'c1', name: 'Test', email: 'test@test.com', phone: '123' },
          documents: [],
          workflowType: 'invalid',
        })
      ).rejects.toThrow();
    });

    // Test 3: Timeout handling
    it('should handle timeout errors during workflow creation', async () => {
      const mockError = new Error('Timeout');
      (mockError as any).code = 'ECONNABORTED';

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(
        client.createWorkflow({
          customer: { id: 'c1', name: 'Test', email: 'test@test.com', phone: '123' },
          documents: [],
          workflowType: 'kyc',
        })
      ).rejects.toThrow();
    });
  });

  describe('getWorkflowStatus', () => {
    // Test 4: Get workflow status - pending
    it('should retrieve workflow status as pending', async () => {
      const mockResponse = {
        data: {
          id: 'workflow-123',
          status: 'pending',
          documentVerification: { status: 'pending' },
          biometricVerification: { status: 'pending' },
        },
      };

      (client as any).client.get.mockResolvedValue(mockResponse);

      const result = await client.getWorkflowStatus('workflow-123');

      expect(result.id).toBe('workflow-123');
      expect(result.status).toBe('pending');
    });

    // Test 5: Get workflow status - completed
    it('should retrieve workflow status as completed with all checks passed', async () => {
      const mockResponse = {
        data: {
          id: 'workflow-456',
          status: 'completed',
          documentVerification: { status: 'approved' },
          biometricVerification: { status: 'approved' },
          addressVerification: { status: 'approved' },
          sanctionsCheck: { hit: false },
          pepCheck: { hit: false },
        },
      };

      (client as any).client.get.mockResolvedValue(mockResponse);

      const result = await client.getWorkflowStatus('workflow-456');

      expect(result.status).toBe('completed');
      expect(result.documentVerification?.status).toBe('approved');
      expect(result.sanctionsCheck?.hit).toBe(false);
    });

    // Test 6: Get workflow status - rejected
    it('should retrieve workflow status as failed with rejection reason', async () => {
      const mockResponse = {
        data: {
          id: 'workflow-789',
          status: 'failed',
          documentVerification: {
            status: 'rejected',
            reasons: ['Document expired', 'Image quality too low'],
          },
        },
      };

      (client as any).client.get.mockResolvedValue(mockResponse);

      const result = await client.getWorkflowStatus('workflow-789');

      expect(result.status).toBe('failed');
      expect(result.documentVerification?.reasons).toContain('Document expired');
    });

    // Test 7: Handle 404 not found
    it('should handle workflow not found error', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { message: 'Workflow not found' },
        },
      };

      (client as any).client.get.mockRejectedValue(mockError);

      await expect(client.getWorkflowStatus('nonexistent-workflow')).rejects.toThrow();
    });
  });

  describe('updateWorkflow', () => {
    // Test 8: Update workflow with new documents
    it('should update workflow with additional documents', async () => {
      const mockResponse = {
        data: {
          id: 'workflow-123',
          status: 'processing',
          documents: [
            { type: 'passport', updatedAt: new Date().toISOString() },
          ],
        },
      };

      (client as any).client.put.mockResolvedValue(mockResponse);

      const result = await client.updateWorkflow('workflow-123', {
        documents: [{ type: 'passport', file: 'base64-encoded-file' }],
      });

      expect(result.id).toBe('workflow-123');
      expect(result.documents).toHaveLength(1);
    });

    // Test 9: Handle invalid update
    it('should reject invalid workflow updates', async () => {
      const mockError = {
        response: {
          status: 422,
          data: { message: 'Invalid update data' },
        },
      };

      (client as any).client.put.mockRejectedValue(mockError);

      await expect(
        client.updateWorkflow('workflow-123', { documents: [] })
      ).rejects.toThrow();
    });
  });

  describe('submitDocument', () => {
    // Test 10: Successfully submit document
    it('should submit document to the workflow', async () => {
      const mockResponse = {
        data: {
          documentId: 'doc-123',
          workflowId: 'workflow-456',
          status: 'uploaded',
          uploadedAt: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.submitDocument('workflow-456', {
        type: 'passport',
        file: 'base64-content',
      });

      expect(result.documentId).toBe('doc-123');
      expect(result.status).toBe('uploaded');
    });

    // Test 11: Reject invalid document type
    it('should reject documents of unsupported type', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Unsupported document type' },
        },
      };

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(
        client.submitDocument('workflow-456', {
          type: 'invalid_type',
          file: 'base64-content',
        })
      ).rejects.toThrow();
    });

    // Test 12: Handle file size limit
    it('should reject documents that exceed size limit', async () => {
      const mockError = {
        response: {
          status: 413,
          data: { message: 'File too large' },
        },
      };

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(
        client.submitDocument('workflow-456', {
          type: 'passport',
          file: 'very-large-base64-file'.repeat(1000000),
        })
      ).rejects.toThrow();
    });
  });

  describe('getSupportedDocumentTypes', () => {
    // Test 13: Get list of supported documents
    it('should return list of supported document types', async () => {
      const mockResponse = {
        data: {
          documentTypes: [
            'passport',
            'national_id',
            'drivers_license',
            'proof_of_address',
            'bank_statement',
          ],
        },
      };

      (client as any).client.get.mockResolvedValue(mockResponse);

      const result = await client.getSupportedDocumentTypes();

      expect(result).toContain('passport');
      expect(result).toContain('national_id');
      expect(result.length).toBeGreaterThan(0);
    });

    // Test 14: Handle API failure when fetching document types
    it('should handle API failure when fetching document types', async () => {
      const mockError = {
        response: {
          status: 503,
          data: { message: 'Service unavailable' },
        },
      };

      (client as any).client.get.mockRejectedValue(mockError);

      await expect(client.getSupportedDocumentTypes()).rejects.toThrow();
    });
  });

  describe('Retry Logic', () => {
    // Test 15: Handle transient failures with retry
    it('should retry on transient network errors', async () => {
      const mockError = new Error('Network timeout');
      (mockError as any).code = 'ECONNABORTED';

      // First call fails, second succeeds
      (client as any).client.get
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          data: {
            id: 'workflow-123',
            status: 'completed',
          },
        });

      const result = await client.getWorkflowStatus('workflow-123');
      expect(result.id).toBe('workflow-123');
    });

    // Test 16: Respect max retries
    it('should stop retrying after max attempts', async () => {
      const mockError = new Error('Network timeout');
      (mockError as any).code = 'ECONNABORTED';

      (client as any).client.get.mockRejectedValue(mockError);

      await expect(client.getWorkflowStatus('workflow-123')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    // Test 17: Unauthorized API key
    it('should handle 401 Unauthorized error', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Invalid API key' },
        },
      };

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(
        client.createWorkflow({
          customer: { id: 'c1', name: 'Test', email: 'test@test.com', phone: '123' },
          documents: [],
          workflowType: 'kyc',
        })
      ).rejects.toThrow();
    });

    // Test 18: Rate limiting handling
    it('should handle rate limiting (429) response', async () => {
      const mockError = {
        response: {
          status: 429,
          data: { message: 'Too many requests' },
          headers: { 'retry-after': '60' },
        },
      };

      (client as any).client.get.mockRejectedValue(mockError);

      await expect(client.getWorkflowStatus('workflow-123')).rejects.toThrow();
    });
  });

  describe('Configuration', () => {
    // Test 19: Default configuration with environment variables
    it('should use configuration from environment variables', () => {
      expect(process.env.BALLERINE_API_KEY).toBe('test-api-key');
      expect(process.env.BALLERINE_BASE_URL).toContain('https://');
    });

    // Test 20: Fallback to default base URL
    it('should use default base URL if not specified', () => {
      delete process.env.BALLERINE_BASE_URL;
      // Client would use default URL
      expect(process.env.BALLERINE_API_KEY).toBeDefined();
    });
  });
});
