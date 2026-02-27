/**
 * Chainalysis AML Provider Unit Tests
 * Tests AML screening, transaction analysis, and risk scoring
 */

import { ChainalysisAmlProvider } from '../../../services/providers/chainalysisAmlProvider';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChainalysisAmlProvider', () => {
  let provider: ChainalysisAmlProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHAINALYSIS_API_KEY = 'test-api-key';
    process.env.CHAINALYSIS_BASE_URL = 'https://api.test.chainalysis.com/v1';

    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn((success, error) => {}),
        },
      },
    } as any);

    provider = new ChainalysisAmlProvider();
  });

  describe('screenEntity', () => {
    // Test 1: Clean wallet screening - no hits
    it('should return low risk score for non-flagged wallet', async () => {
      const mockResponse = {
        data: {
          address: '0x1234567890123456789012345678901234567890',
          riskScore: 15,
          riskLevel: 'low',
          flags: [],
          identifications: [],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.screenEntity({
        walletAddress: '0x1234567890123456789012345678901234567890',
        entityType: 'individual',
        transactionHistory: [],
      });

      expect(result.riskScore).toBeLessThan(30);
      expect(result.flags).toHaveLength(0);
    });

    // Test 2: OFAC sanctioned address
    it('should flag OFAC sanctioned wallet with high risk', async () => {
      const mockResponse = {
        data: {
          address: '0xSanctionedAddress1234567890123456789012',
          riskScore: 95,
          riskLevel: 'critical',
          flags: ['OFAC_SDN', 'SANCTIONS_MATCH'],
          identifications: [
            {
              source: 'OFAC',
              name: 'Sanctioned Person',
              type: 'individual',
            },
          ],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.screenEntity({
        walletAddress: '0xSanctionedAddress1234567890123456789012',
        entityType: 'individual',
        transactionHistory: [],
      });

      expect(result.riskScore).toBeGreaterThan(70);
      expect(result.flags).toContain('OFAC_SDN');
    });

    // Test 3: PEP (Politically Exposed Person) detection
    it('should flag PEP entities with medium-high risk', async () => {
      const mockResponse = {
        data: {
          address: '0xPEPWallet123456789012345678901234567890',
          riskScore: 65,
          riskLevel: 'medium-high',
          flags: ['PEP_MATCH'],
          identifications: [
            {
              source: 'C6_PEP_DATABASE',
              name: 'Government Official',
              type: 'pep',
            },
          ],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.screenEntity({
        walletAddress: '0xPEPWallet123456789012345678901234567890',
        entityType: 'individual',
        transactionHistory: [],
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(50);
      expect(result.flags).toContain('PEP_MATCH');
    });

    // Test 4: Cryptocurrency exchange wallet detection
    it('should identify exchange wallets with appropriate flags', async () => {
      const mockResponse = {
        data: {
          address: '0xExchangeWallet12345678901234567890123456',
          riskScore: 25,
          riskLevel: 'low',
          flags: ['EXCHANGE_WALLET'],
          identifications: [
            {
              source: 'EXCHANGE_IDENTIFICATION',
              name: 'Binance Deposit Address',
              type: 'exchange',
            },
          ],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.screenEntity({
        walletAddress: '0xExchangeWallet12345678901234567890123456',
        entityType: 'exchange',
        transactionHistory: [],
      });

      expect(result.flags).toContain('EXCHANGE_WALLET');
    });

    // Test 5: Handle API errors gracefully
    it('should handle Chainalysis API errors', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid wallet address' },
        },
      };

      (provider as any).client.post.mockRejectedValue(mockError);

      await expect(
        provider.screenEntity({
          walletAddress: 'invalid-address',
          entityType: 'individual',
          transactionHistory: [],
        })
      ).rejects.toThrow();
    });

    // Test 6: Timeout handling
    it('should handle timeout errors during screening', async () => {
      const mockError = new Error('Request timeout');
      (mockError as any).code = 'ECONNABORTED';

      (provider as any).client.post.mockRejectedValue(mockError);

      await expect(
        provider.screenEntity({
          walletAddress: '0x1234567890123456789012345678901234567890',
          entityType: 'individual',
          transactionHistory: [],
        })
      ).rejects.toThrow();
    });
  });

  describe('analyzeTransactions', () => {
    // Test 7: Normal transaction pattern
    it('should identify normal transaction pattern with low risk', async () => {
      const mockResponse = {
        data: {
          wallet: '0x1234567890123456789012345678901234567890',
          analysisScore: 20,
          patterns: {
            frequency: 'moderate',
            velocity: 'normal',
            amounts: 'consistent',
          },
          anomalies: [],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.analyzeTransactions({
        walletAddress: '0x1234567890123456789012345678901234567890',
        transactions: [
          {
            hash: 'tx1',
            fromAddress: '0x1234567890123456789012345678901234567890',
            toAddress: '0x0987654321098765432109876543210987654321',
            amount: 1.5,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      expect(result.riskScore).toBeLessThan(30);
      expect(result.anomalies).toHaveLength(0);
    });

    // Test 8: Anomalous transaction pattern
    it('should identify suspicious transaction patterns', async () => {
      const mockResponse = {
        data: {
          wallet: '0x1234567890123456789012345678901234567890',
          analysisScore: 75,
          patterns: {
            frequency: 'high',
            velocity: 'abnormal',
            amounts: 'irregular',
          },
          anomalies: [
            'Sudden increase in transaction volume',
            'Large transfers to unknown addresses',
            'Mixing activity detected',
          ],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.analyzeTransactions({
        walletAddress: '0x1234567890123456789012345678901234567890',
        transactions: [],
      });

      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });

    // Test 9: High velocity transactions
    it('should flag unusually high transaction velocity', async () => {
      const mockResponse = {
        data: {
          wallet: '0x1234567890123456789012345678901234567890',
          analysisScore: 85,
          patterns: {
            frequency: 'very_high',
            velocity: 'critical',
            amounts: 'very_large',
          },
          anomalies: ['Extreme transaction velocity', 'Possible layering activity'],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.analyzeTransactions({
        walletAddress: '0x1234567890123456789012345678901234567890',
        transactions: [],
      });

      expect(result.riskScore).toBeGreaterThan(70);
    });

    // Test 10: Mixing service transactions
    it('should detect and flag mixing service usage', async () => {
      const mockResponse = {
        data: {
          wallet: '0x1234567890123456789012345678901234567890',
          analysisScore: 90,
          patterns: {
            frequency: 'high',
            velocity: 'abnormal',
            amounts: 'inconsistent',
          },
          anomalies: ['Mixing activity detected', 'Transfer to privacy-enhancing service'],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.analyzeTransactions({
        walletAddress: '0x1234567890123456789012345678901234567890',
        transactions: [],
      });

      expect(result.anomalies).toContain('Mixing activity detected');
    });

    // Test 11: Empty transaction history
    it('should handle wallets with no transaction history', async () => {
      const mockResponse = {
        data: {
          wallet: '0x1234567890123456789012345678901234567890',
          analysisScore: 50, // Neutral score for new wallets
          patterns: {
            frequency: 'none',
            velocity: 'none',
            amounts: 'none',
          },
          anomalies: ['New wallet - no established history'],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.analyzeTransactions({
        walletAddress: '0x1234567890123456789012345678901234567890',
        transactions: [],
      });

      expect(result.riskScore).toBeDefined();
    });

    // Test 12: Handle analysis API errors
    it('should handle API errors in transaction analysis', async () => {
      const mockError = {
        response: {
          status: 503,
          data: { message: 'Service temporarily unavailable' },
        },
      };

      (provider as any).client.post.mockRejectedValue(mockError);

      await expect(
        provider.analyzeTransactions({
          walletAddress: '0x1234567890123456789012345678901234567890',
          transactions: [],
        })
      ).rejects.toThrow();
    });
  });

  describe('isHealthy', () => {
    // Test 13: Provider health check - healthy
    it('should return healthy status when API is accessible', async () => {
      const mockResponse = {
        data: { status: 'healthy', responseTime: 150 },
      };

      (provider as any).client.get.mockResolvedValue(mockResponse);

      const result = await provider.isHealthy();

      expect(result).toBe(true);
    });

    // Test 14: Provider health check - unhealthy
    it('should return unhealthy status when API is down', async () => {
      const mockError = {
        response: {
          status: 503,
        },
      };

      (provider as any).client.get.mockRejectedValue(mockError);

      const result = await provider.isHealthy();

      expect(result).toBe(false);
    });

    // Test 15: Handle timeout in health check
    it('should handle timeout in health check', async () => {
      const mockError = new Error('Timeout');
      (mockError as any).code = 'ECONNABORTED';

      (provider as any).client.get.mockRejectedValue(mockError);

      const result = await provider.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    // Test 16: Return supported features
    it('should return provider capabilities', async () => {
      const result = await provider.getCapabilities();

      expect(result).toHaveProperty('sanctions');
      expect(result).toHaveProperty('pep');
      expect(result).toHaveProperty('transactionAnalysis');
      expect(result.sanctions).toBe(true);
      expect(result.pep).toBe(true);
    });
  });

  describe('Risk Scoring Accuracy', () => {
    // Test 17: Risk score calibration for low risk entities
    it('should calibrate risk score correctly for low-risk wallets', async () => {
      const mockResponse = {
        data: {
          address: '0xCleanWallet12345678901234567890123456789',
          riskScore: 12,
          riskLevel: 'low',
          flags: [],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.screenEntity({
        walletAddress: '0xCleanWallet12345678901234567890123456789',
        entityType: 'individual',
        transactionHistory: [],
      });

      expect(result.riskScore).toBeLessThan(30);
    });

    // Test 18: Risk score calibration for critical risk
    it('should assign critical risk score for sanctioned entities', async () => {
      const mockResponse = {
        data: {
          address: '0xSanctioned1234567890123456789012345678',
          riskScore: 98,
          riskLevel: 'critical',
          flags: ['OFAC_SDN', 'SANCTIONS_MATCH'],
        },
      };

      (provider as any).client.post.mockResolvedValue(mockResponse);

      const result = await provider.screenEntity({
        walletAddress: '0xSanctioned1234567890123456789012345678',
        entityType: 'individual',
        transactionHistory: [],
      });

      expect(result.riskScore).toBeGreaterThan(90);
    });
  });

  describe('Error Resilience', () => {
    // Test 19: Rate limit handling
    it('should handle rate limiting responses', async () => {
      const mockError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { message: 'Rate limit exceeded' },
        },
      };

      (provider as any).client.post.mockRejectedValue(mockError);

      await expect(
        provider.screenEntity({
          walletAddress: '0x1234567890123456789012345678901234567890',
          entityType: 'individual',
          transactionHistory: [],
        })
      ).rejects.toThrow();
    });

    // Test 20: Authentication error handling
    it('should handle authentication failures', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Invalid API key' },
        },
      };

      (provider as any).client.post.mockRejectedValue(mockError);

      await expect(
        provider.screenEntity({
          walletAddress: '0x1234567890123456789012345678901234567890',
          entityType: 'individual',
          transactionHistory: [],
        })
      ).rejects.toThrow();
    });
  });
});
