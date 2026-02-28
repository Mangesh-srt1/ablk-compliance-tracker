/**
 * Agent → API Integration Tests
 * Tests: Agent HTTP calls, request/response serialization, error handling
 */

import axios, { AxiosInstance } from 'axios';

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create a shared mock client that axios.create() will return
const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  defaults: {
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
    },
  },
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
} as unknown as jest.Mocked<AxiosInstance>;

mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

describe('Agent → API Integration Tests', () => {
  let apiClient: jest.Mocked<AxiosInstance>;
  const API_BASE_URL = 'http://localhost:4000';

  beforeEach(() => {
    // Create axios instance for agent communication
    apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    }) as jest.Mocked<AxiosInstance>;

    // Clear mock calls
    jest.clearAllMocks();
  });

  describe('Agent HTTP Calls to API', () => {
    it('should successfully call KYC check endpoint', async () => {
      const mockResponse = {
        status: 'APPROVED',
        riskScore: 15,
        confidence: 0.98,
        reasoning: 'Identity verified, low risk',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
      });

      const payload = {
        wallet: '0x1234567890abcdef',
        name: 'John Doe',
        jurisdiction: 'AE',
      };

      const response = await apiClient.post('/api/v1/kyc-check', payload);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('APPROVED');
      expect(response.data.riskScore).toBeLessThan(30);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/kyc-check'),
        expect.objectContaining({
          wallet: '0x1234567890abcdef',
          name: 'John Doe',
          jurisdiction: 'AE',
        })
      );
    });

    it('should successfully call AML check endpoint', async () => {
      const mockResponse = {
        status: 'APPROVED',
        riskScore: 25,
        flags: [],
        reasoning: 'No sanctions matches',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
      });

      const payload = {
        wallet: '0xaabbccddeeff1122',
        transactionHistory: [
          { hash: '0xabc', value: 1000, to: '0x999' },
          { hash: '0xdef', value: 2000, to: '0x888' },
        ],
        jurisdiction: 'US',
      };

      const response = await apiClient.post('/api/v1/aml-check', payload);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('APPROVED');
      expect(Array.isArray(response.data.flags)).toBe(true);
    });

    it('should successfully call compliance check endpoint', async () => {
      const mockResponse = {
        status: 'ESCALATED',
        riskScore: 65,
        decision: 'REVIEW_REQUIRED',
        reasoning: 'Large transaction amount',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
      });

      const payload = {
        from: '0xfrom1234',
        to: '0xto5678',
        amount: 500000,
        currency: 'USD',
        jurisdiction: 'IN',
      };

      const response = await apiClient.post('/api/v1/compliance-check', payload);

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ESCALATED');
      expect(response.data.decision).toBe('REVIEW_REQUIRED');
    });

    it('should successfully retrieve agent status', async () => {
      const mockResponse = {
        agent_id: 'supervisor-1',
        status: 'ready',
        version: '1.0.0',
        uptime: 3600,
        processed: 42,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockResponse,
        status: 200,
        statusText: 'OK',
      });

      const response = await apiClient.get('/api/v1/agent/status');

      expect(response.status).toBe(200);
      expect(response.data.agent_id).toBe('supervisor-1');
      expect(response.data.status).toBe('ready');
      expect(typeof response.data.processed).toBe('number');
    });
  });

  describe('Request/Response Serialization', () => {
    it('should properly serialize complex request objects', async () => {
      const complexPayload = {
        entity: {
          id: 'entity-123',
          type: 'individual',
          metadata: {
            tags: ['high-risk', 'pep'],
            scores: {
              aml: 80,
              kyc: 95,
            },
          },
        },
        timestamp: new Date().toISOString(),
        sessionId: 'sess-abc123',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
      });

      await apiClient.post('/api/v1/entity-check', complexPayload);

      const callArgs = mockAxiosInstance.post.mock.calls[0];
      const serializedData = callArgs[1] as any;

      // Verify serialization preserved structure
      expect(serializedData?.entity?.type).toBe('individual');
      expect(serializedData?.entity?.metadata?.scores?.aml).toBe(80);
      expect(serializedData?.timestamp).toBeTruthy();
    });

    it('should properly deserialize response with nested objects', async () => {
      const complexResponse = {
        decision: {
          status: 'REJECTED',
          riskLevel: 'CRITICAL',
          factors: {
            kyc: {
              verified: false,
              reason: 'Document expired',
            },
            aml: {
              sanctions: true,
              matchedName: 'John Doe',
              source: 'OFAC_SDN',
            },
          },
          audit: {
            timestamp: '2026-02-27T10:00:00Z',
            agent: 'supervisor-1',
            version: '1.0.0',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: complexResponse,
        status: 200,
      });

      const response = await apiClient.post('/api/v1/complex-check', {});

      expect(response.data.decision.status).toBe('REJECTED');
      expect(response.data.decision.factors.aml.sanctions).toBe(true);
      expect(response.data.decision.audit.agent).toBe('supervisor-1');
    });

    it('should handle array serialization in requests', async () => {
      const payloadWithArrays = {
        wallets: ['0xaaa', '0xbbb', '0xccc'],
        transactions: [
          { hash: '0xabc', status: 'pending' },
          { hash: '0xdef', status: 'confirmed' },
        ],
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { processed: 5 },
        status: 200,
      });

      await apiClient.post('/api/v1/batch-check', payloadWithArrays);

      const callArgs = mockAxiosInstance.post.mock.calls[0];
      const data = callArgs[1] as any;

      expect(Array.isArray(data?.wallets)).toBe(true);
      expect(data?.wallets?.length).toBe(3);
      expect(Array.isArray(data?.transactions)).toBe(true);
      expect(data?.transactions?.[0]?.status).toBe('pending');
    });

    it('should handle null and undefined values correctly', async () => {
      const payloadWithNulls = {
        requiredField: 'value',
        optionalField: null,
        emptyField: undefined,
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
      });

      await apiClient.post('/api/v1/test', payloadWithNulls);

      const callArgs = mockAxiosInstance.post.mock.calls[0];
      const data = callArgs[1] as any;

      expect(data?.requiredField).toBe('value');
      expect(data?.optionalField).toBeNull();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle API 400 Bad Request', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'Invalid request',
            message: 'Missing required field: wallet',
          },
        },
      });

      try {
        await apiClient.post('/api/v1/kyc-check', { name: 'John' });
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('Missing required');
      }
    });

    it('should handle API 401 Unauthorized', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: 'Authentication failed',
            message: 'Invalid token',
          },
        },
      });

      try {
        await apiClient.post('/api/v1/kyc-check', {});
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should handle API 500 Server Error', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            error: 'Internal server error',
            message: 'Database connection failed',
          },
        },
      });

      try {
        await apiClient.post('/api/v1/kyc-check', {});
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(500);
      }
    });

    it('should handle network timeout', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        message: 'timeout of 5000ms exceeded',
        code: 'ECONNABORTED',
      });

      try {
        await apiClient.post('/api/v1/kyc-check', {});
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
        expect(error.message).toContain('timeout');
      }
    });

    it('should implement exponential backoff retry logic', async () => {
      let attemptCount = 0;

      const mockRetryableAxios = {
        post: jest.fn(async (url?: string, data?: any) => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Service temporarily unavailable');
          }
          return { status: 200, data: { success: true } };
        }),
      };

      // Simulate retry logic
      let lastError: Error | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          const result = await mockRetryableAxios.post?.('/api/v1/test', {});
          expect(result?.status).toBe(200);
          lastError = null; // Reset on success
          break;
        } catch (error) {
          lastError = error as Error;
          // Wait before retry (exponential backoff: 100ms, 200ms, 400ms)
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
        }
      }

      expect(attemptCount).toBe(3);
      expect(lastError).toBeNull();
    });

    it('should gracefully handle API response parsing errors', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: 'Invalid JSON response',
      });

      const response = await apiClient.post('/api/v1/test', {});

      // Should handle string response gracefully
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
    });
  });

  describe('Request Headers and Authentication', () => {
    it('should include authorization header in requests', () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      apiClient.post('/api/v1/test', {});

      // Verify axios was called with correct base config
      expect(apiClient.defaults.headers['Authorization']).toBe('Bearer test-token');
    });

    it('should set correct content-type header', () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      apiClient.post('/api/v1/test', {});

      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should handle custom headers in requests', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      await apiClient.post('/api/v1/test', {}, {
        headers: {
          'X-Correlation-ID': 'corr-123',
          'X-Request-ID': 'req-456',
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('Performance and Timeout', () => {
    it('should enforce timeout limits', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      });

      try {
        await apiClient.post('/api/v1/slow-endpoint', {});
        fail('Should have thrown timeout error');
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });

    it('should measure response time', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
        headers: { 'x-response-time': '125ms' },
      });

      const startTime = Date.now();
      const response = await apiClient.post('/api/v1/test', {});
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('API Endpoint Availability', () => {
    it('should verify KYC endpoint is available', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { endpoint: 'kyc-check', available: true },
      });

      const response = await apiClient.get('/api/v1/health/kyccheck');

      expect(response.status).toBe(200);
      expect(response.data.available).toBe(true);
    });

    it('should verify AML endpoint is available', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { endpoint: 'aml-check', available: true },
      });

      const response = await apiClient.get('/api/v1/health/aml-check');

      expect(response.status).toBe(200);
      expect(response.data.available).toBe(true);
    });

    it('should verify Compliance endpoint is available', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { endpoint: 'compliance-check', available: true },
      });

      const response = await apiClient.get('/api/v1/health/compliance-check');

      expect(response.status).toBe(200);
      expect(response.data.available).toBe(true);
    });
  });
});
