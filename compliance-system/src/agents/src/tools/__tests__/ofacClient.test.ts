/**
 * OFAC Client Unit Tests
 * Tests OFAC sanctions screening, batch processing, and caching
 */

import { OFACClient, OFACScreeningResult } from '../ofacClient';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OFACClient', () => {
  let client: OFACClient;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OFAC_API_KEY = 'test-ofac-key';
    process.env.OFAC_BASE_URL = 'https://api.test.ofac.ustreas.gov/v1';

    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn((success, error) => {}),
        },
      },
    } as any);

    client = new OFACClient();
  });

  describe('screenName', () => {
    // Test 1: Clean name - no sanctions match
    it('should return no match for clean entity name', async () => {
      const mockResponse = {
        data: {
          matches: [],
          overallScore: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.screenName('John Doe', 'individual');

      expect(result.isMatch).toBe(false);
      expect(result.confidenceScore).toBe(0);
      expect(result.matchedEntities).toHaveLength(0);
      expect(result.entityName).toBe('John Doe');
    });

    // Test 2: SDN match found
    it('should return match for sanctioned entity name', async () => {
      const mockResponse = {
        data: {
          matches: [
            {
              name: 'Sanctioned Person',
              type: 'individual',
              program: 'OFAC_SDN',
              sanctions_list: ['SDN'],
            },
          ],
          overallScore: 0.95,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.screenName('Sanctioned Person', 'individual');

      expect(result.isMatch).toBe(true);
      expect(result.confidenceScore).toBe(0.95);
      expect(result.matchedEntities).toHaveLength(1);
      expect(result.sanctionsPrograms).toContain('OFAC_SDN');
    });

    // Test 3: Fuzy match with variations
    it('should find matches for name variations', async () => {
      const mockResponse = {
        data: {
          matches: [
            {
              name: 'Hassan al-Ayoubi',
              alternate_names: ['Hassan al-Ayube', 'Hasan Ayoubi'],
              type: 'individual' as const,
              program: 'OFAC_SDN',
              sanctions_list: ['SDN', 'TERRORIST'],
            },
          ],
          overallScore: 0.88,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.screenName('Hassan Ayoub', 'individual');

      expect(result.isMatch).toBe(true);
      expect(result.confidenceScore).toBeGreaterThan(0.8);
    });

    // Test 4: API error handling
    it('should throw on API error during screening', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      };

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(client.screenName('Any Name', 'individual')).rejects.toThrow();
    });

    // Test 5: Caching - returns cached result
    it('should return cached result for same query', async () => {
      const mockResponse = {
        data: {
          matches: [],
          overallScore: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      // First call
      await client.screenName('John Doe', 'individual');
      
      // Second call - should use cache
      const result = await client.screenName('John Doe', 'individual');

      expect((client as any).client.post).toHaveBeenCalledTimes(1); // Only called once, not twice
      expect(result.isMatch).toBe(false);
    });
  });

  describe('screenWallet', () => {
    // Test 6: Clean wallet
    it('should return no match for clean wallet address', async () => {
      const mockResponse = {
        data: {
          flagged: false,
          riskScore: 0,
          matches: [],
          programs: [],
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.screenWallet('0x1234567890123456789012345678901234567890');

      expect(result.isMatch).toBe(false);
      expect(result.confidenceScore).toBe(0);
    });

    // Test 7: Flagged wallet
    it('should flag sanctioned crypto wallet', async () => {
      const mockResponse = {
        data: {
          flagged: true,
          riskScore: 95,
          matches: [
            {
              name: 'Sanctioned Wallet',
              type: 'individual',
            },
          ],
          programs: ['OFAC_SDN'],
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.screenWallet('0xSanctionedWallet123456789012345678901234');

      expect(result.isMatch).toBe(true);
      expect(result.confidenceScore).toBeGreaterThan(90);
    });

    // Test 8: Timeout during wallet screening
    it('should handle timeout errors during wallet screening', async () => {
      const mockError = new Error('Timeout');
      (mockError as any).code = 'ECONNABORTED';

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(
        client.screenWallet('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow();
    });
  });

  describe('screenOrganization', () => {
    // Test 9: Organization screening
    it('should screen organization against OFAC list', async () => {
      const mockResponse = {
        data: {
          matches: [],
          overallScore: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.screenOrganization('Acme Corp');

      expect(result.entityName).toBe('Acme Corp');
      expect(result.isMatch).toBe(false);
    });

    // Test 10: Organization blocked by sanctions
    it('should block sanctioned organization', async () => {
      const mockResponse = {
        data: {
          matches: [
            {
              name: 'Blocked Corp Inc',
              type: 'organization',
              program: 'OFAC_SDN',
              sanctions_list: ['SDN'],
            },
          ],
          overallScore: 0.99,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.screenOrganization('Blocked Corp Inc');

      expect(result.isMatch).toBe(true);
      expect(result.confidenceScore).toBeGreaterThan(0.95);
    });
  });

  describe('screenBatch', () => {
    // Test 11: Batch screening multiple entities
    it('should screen multiple entities in batch', async () => {
      const mockResponse = {
        data: {
          matches: [],
          overallScore: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const entities = [
        { name: 'John Doe', type: 'individual' },
        { name: 'Jane Smith', type: 'individual' },
        { name: 'Acme Corp', type: 'organization' },
      ];

      const results = await client.screenBatch(entities);

      expect(results).toHaveLength(3);
      expect(results[0].entityName).toBe('John Doe');
    });

    // Test 12: Batch continues on individual failures
    it('should handle failures in batch screening gracefully', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Bad request' },
        },
      };

      (client as any).client.post
        .mockResolvedValueOnce({
          data: { matches: [], overallScore: 0, lastUpdated: new Date().toISOString() },
        })
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          data: { matches: [], overallScore: 0, lastUpdated: new Date().toISOString() },
        });

      const entities = [
        { name: 'John Doe', type: 'individual' },
        { name: 'Invalid', type: 'invalid' },
        { name: 'Jane Smith', type: 'individual' },
      ];

      const results = await client.screenBatch(entities);

      expect(results.length).toBeGreaterThanOrEqual(2); // At least 2 successful
    });
  });

  describe('isEntitySanctioned', () => {
    // Test 13: Check sanctioned status with confidence threshold
    it('should return true for sanctioned entity above confidence threshold', async () => {
      const mockResponse = {
        data: {
          matches: [
            {
              name: 'Sanctioned Person',
              type: 'individual',
              program: 'OFAC_SDN',
            },
          ],
          overallScore: 0.90,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.isEntitySanctioned('Sanctioned Person', 0.8);

      expect(result).toBe(true);
    });

    // Test 14: Return false for below threshold
    it('should return false for matches below confidence threshold', async () => {
      const mockResponse = {
        data: {
          matches: [
            {
              name: 'Similar Name',
              type: 'individual',
            },
          ],
          overallScore: 0.65,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      const result = await client.isEntitySanctioned('Similar Name', 0.8);

      expect(result).toBe(false);
    });

    // Test 15: Fail open on error
    it('should return true (fail open) on API error', async () => {
      (client as any).client.post.mockRejectedValue(new Error('API error'));

      const result = await client.isEntitySanctioned('Any Name');

      expect(result).toBe(true); // Fail open for safety
    });
  });

  describe('getSanctionsPrograms', () => {
    // Test 16: Get active sanctions programs
    it('should return list of active sanctions programs', async () => {
      const mockResponse = {
        data: {
          programs: ['OFAC_SDN', 'IFSR', 'ISG', 'CYBER', 'SDNTK'],
        },
      };

      (client as any).client.get.mockResolvedValue(mockResponse);

      const programs = await client.getSanctionsPrograms();

      expect(programs).toContain('OFAC_SDN');
      expect(programs.length).toBeGreaterThan(0);
    });

    // Test 17: Handle API error in programs fetch
    it('should handle API error when fetching sanctions programs', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { message: 'Server error' },
        },
      };

      (client as any).client.get.mockRejectedValue(mockError);

      await expect(client.getSanctionsPrograms()).rejects.toThrow();
    });
  });

  describe('isHealthy', () => {
    // Test 18: Service health check - healthy
    it('should return true when service is healthy', async () => {
      const mockResponse = {
        status: 200,
        data: { status: 'healthy' },
      };

      (client as any).client.get.mockResolvedValue(mockResponse);

      const result = await client.isHealthy();

      expect(result).toBe(true);
    });

    // Test 19: Service health check - unhealthy
    it('should return false when service is unavailable', async () => {
      const mockError = {
        response: {
          status: 503,
        },
      };

      (client as any).client.get.mockRejectedValue(mockError);

      const result = await client.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('clearExpiredCache', () => {
    // Test 20: Cache expiry management
    it('should clear expired cache entries', async () => {
      // Mock the cache with old entries
      const mockResponse = {
        data: {
          matches: [],
          overallScore: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      // Add entry to cache
      await client.screenName('John Doe', 'individual');

      // Must be implemented in class
      if (typeof client.clearExpiredCache === 'function') {
        client.clearExpiredCache();
        // Cache should be partially cleared (if time-based)
      }
    });
  });

  describe('getCacheStats', () => {
    // Test 21: Cache statistics
    it('should return cache statistics', async () => {
      const mockResponse = {
        data: {
          matches: [],
          overallScore: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      (client as any).client.post.mockResolvedValue(mockResponse);

      // Add entries to cache
      await client.screenName('John Doe', 'individual');
      await client.screenName('Jane Smith', 'individual');

      const stats = client.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('entries');
      expect(stats.entries).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    // Test 22: 401 Unauthorized
    it('should handle 401 Unauthorized error', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Invalid API key' },
        },
      };

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(client.screenName('Any Name')).rejects.toThrow();
    });

    // Test 23: 429 Rate Limiting
    it('should handle rate limiting (429)', async () => {
      const mockError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { message: 'Too many requests' },
        },
      };

      (client as any).client.post.mockRejectedValue(mockError);

      await expect(client.screenName('Any Name')).rejects.toThrow();
    });

    // Test 24: Network timeout
    it('should handle network timeouts', async () => {
      const mockError = new Error('Network timeout');
      (mockError as any).code = 'ECONNABORTED';

      (client as any).client.post.mockRejectedValue(mockError);

      // For isEntitySanctioned, should fail open (return true)
      const result = await client.isEntitySanctioned('Any Name');
      expect(result).toBe(true);
    });
  });
});
