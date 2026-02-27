/**
 * OFAC Client
 * US Treasury OFAC sanctions list screening
 */

import axios, { AxiosInstance } from 'axios';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ofac-client.log' }),
  ],
});

export interface OFACEntity {
  name: string;
  type: 'individual' | 'organization' | 'vessel' | 'aircraft';
  address?: string;
  country?: string;
  sanctions_list?: string[];
  program?: string;
  alternate_names?: string[];
}

export interface OFACScreeningResult {
  walletAddress?: string;
  entityName: string;
  isMatch: boolean;
  confidenceScore: number;
  matchedEntities: OFACEntity[];
  sanctionsPrograms: string[];
  lastUpdated: string;
  checkTimestamp: string;
}

export interface OFACResult {
  hit: boolean;
  matchType: 'exact' | 'fuzzy' | 'none';
  confidence: number;
  details?: {
    name: string;
    aliases: string[];
    type: string;
    programs: string[];
    remarks?: string;
  };
}

export class OFACClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private sanctionsCache: Map<string, OFACScreeningResult>;
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.apiKey = process.env.OFAC_API_KEY || '';
    this.baseUrl = process.env.OFAC_BASE_URL || 'https://api.ofac.ustreas.gov/v1';
    this.sanctionsCache = new Map();

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('OFAC API error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  /**
   * Screen entity name against OFAC SDN list
   */
  async screenName(name: string, entityType: string = 'individual'): Promise<OFACScreeningResult> {
    try {
      // Check cache first
      const cacheKey = `${name}-${entityType}`;
      const cached = this.sanctionsCache.get(cacheKey);
      if (cached && Date.now() - new Date(cached.checkTimestamp).getTime() < this.cacheExpiry) {
        logger.debug('Returning cached OFAC result', { name });
        return cached;
      }

      logger.info('Screening entity against OFAC SDN list', { name, entityType });

      const response = await this.client.post('/sdn-search', {
        query: name,
        type: entityType,
        matchType: 'fuzzy', // Support fuzzy matching for name variations
      });

      const result: OFACScreeningResult = {
        entityName: name,
        isMatch: response.data.matches && response.data.matches.length > 0,
        confidenceScore: response.data.overallScore || 0,
        matchedEntities: response.data.matches || [],
        sanctionsPrograms: this.extractSanctionsPrograms(response.data.matches || []),
        lastUpdated: response.data.lastUpdated || new Date().toISOString(),
        checkTimestamp: new Date().toISOString(),
      };

      // Cache result
      this.sanctionsCache.set(cacheKey, result);

      return result;
    } catch (error) {
      logger.error('OFAC screening failed', {
        name,
        entityType,
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Screen wallet address against OFAC cryptocurrency watch list
   */
  async screenWallet(walletAddress: string): Promise<OFACScreeningResult> {
    try {
      logger.info('Screening wallet against OFAC crypto list', { walletAddress });

      const response = await this.client.post('/crypto-screening', {
        address: walletAddress,
        assetClass: 'cryptocurrency',
      });

      const result: OFACScreeningResult = {
        walletAddress,
        entityName: walletAddress,
        isMatch: response.data.flagged || false,
        confidenceScore: response.data.riskScore || 0,
        matchedEntities: response.data.matches || [],
        sanctionsPrograms: response.data.programs || [],
        lastUpdated: response.data.lastUpdated || new Date().toISOString(),
        checkTimestamp: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      logger.error('Wallet screening failed', {
        walletAddress,
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Screen organization against SDN list
   */
  async screenOrganization(organizationName: string): Promise<OFACScreeningResult> {
    return this.screenName(organizationName, 'organization');
  }

  /**
   * Batch screen multiple entities
   */
  async screenBatch(entities: Array<{ name: string; type: string }>): Promise<OFACScreeningResult[]> {
    try {
      logger.info('Batch screening entities', { count: entities.length });

      const results: OFACScreeningResult[] = [];
      
      for (const entity of entities) {
        try {
          const result = await this.screenName(entity.name, entity.type);
          results.push(result);
        } catch (error) {
          logger.warn('Failed to screen entity in batch', {
            entity: entity.name,
            error: (error as any).message,
          });
          // Continue with next entity
        }
      }

      return results;
    } catch (error) {
      logger.error('Batch screening failed', {
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Check if name matches OFAC SDN with high confidence
   */
  async isEntitySanctioned(name: string, minConfidence: number = 0.8): Promise<boolean> {
    try {
      const result = await this.screenName(name);
      return result.isMatch && result.confidenceScore >= minConfidence;
    } catch (error) {
      logger.error('Sanction check failed', { name, error: (error as any).message });
      return true; // Fail open - treat failures as potential sanctions
    }
  }

  /**
   * Get list of active OFAC sanctions programs
   */
  async getSanctionsPrograms(): Promise<string[]> {
    try {
      const response = await this.client.get('/sanctions-programs');
      return response.data.programs || [];
    } catch (error) {
      logger.error('Failed to fetch sanctions programs', {
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Check service health
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('OFAC health check failed', {
        error: (error as any).message,
      });
      return false;
    }
  }

  /**
   * Clear cache entries older than expiry time
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let clearedCount = 0;

    this.sanctionsCache.forEach((result, key) => {
      const cacheTime = new Date(result.checkTimestamp).getTime();
      if (now - cacheTime > this.cacheExpiry) {
        this.sanctionsCache.delete(key);
        clearedCount++;
      }
    });

    if (clearedCount > 0) {
      logger.debug('Cleared expired OFAC cache entries', { count: clearedCount });
    }
  }

  /**
   * Private helper to extract sanctions programs from matched entities
   */
  private extractSanctionsPrograms(entities: OFACEntity[]): string[] {
    const programs = new Set<string>();
    entities.forEach((entity) => {
      if (entity.program) {
        programs.add(entity.program);
      }
      if (entity.sanctions_list) {
        entity.sanctions_list.forEach((list) => programs.add(list));
      }
    });
    return Array.from(programs);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.sanctionsCache.size,
      entries: this.sanctionsCache.size,
    };
  }

  /**
   * Check if an address is sanctioned (legacy method)
   */
  async checkAddress(address: string): Promise<OFACResult> {
    try {
      logger.info('Checking OFAC sanctions for address', { address });

      const response = await this.client.get(`/sanctions/addresses/${address}`);

      const result = response.data;

      logger.info('OFAC address check completed', {
        address,
        hit: result.hit,
        matchType: result.matchType,
      });

      return {
        hit: result.hit || false,
        matchType: result.matchType || 'none',
        confidence: result.confidence || 0,
        details: result.details,
      };
    } catch (error) {
      logger.error('Failed to check OFAC sanctions for address', {
        address,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return no hit on error to avoid false positives
      return {
        hit: false,
        matchType: 'none',
        confidence: 0,
      };
    }
  }

  /**
   * Check if an entity is sanctioned (legacy method)
   */
  async checkEntity(name: string, country?: string): Promise<OFACResult> {
    try {
      logger.info('Checking OFAC sanctions for entity', { name, country });

      const params: any = { name };
      if (country) {
        params.country = country;
      }

      const response = await this.client.get('/sanctions/entities', { params });

      const result = response.data;

      logger.info('OFAC entity check completed', {
        name,
        country,
        hit: result.hit,
        matchType: result.matchType,
      });

      return {
        hit: result.hit || false,
        matchType: result.matchType || 'none',
        confidence: result.confidence || 0,
        details: result.details,
      };
    } catch (error) {
      logger.error('Failed to check OFAC sanctions for entity', {
        name,
        country,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return no hit on error to avoid false positives
      return {
        hit: false,
        matchType: 'none',
        confidence: 0,
      };
    }
  }

  /**
   * Check multiple addresses in batch
   */
  async checkAddressesBatch(addresses: string[]): Promise<OFACResult[]> {
    try {
      logger.info('Checking OFAC sanctions for address batch', {
        count: addresses.length,
      });

      const response = await this.client.post('/sanctions/addresses/batch', {
        addresses,
      });

      const results = response.data.results || [];

      logger.info('OFAC address batch check completed', {
        requested: addresses.length,
        results: results.length,
      });

      return results.map((result: any, index: number) => ({
        hit: result.hit || false,
        matchType: result.matchType || 'none',
        confidence: result.confidence || 0,
        details: result.details,
      }));
    } catch (error) {
      logger.error('Failed to check OFAC sanctions for address batch', {
        count: addresses.length,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return no hits on error
      return addresses.map(() => ({
        hit: false,
        matchType: 'none',
        confidence: 0,
      }));
    }
  }

  /**
   * Get sanctions list updates
   */
  async getSanctionsUpdates(since?: string): Promise<{
    updates: any[];
    lastUpdated: string;
  }> {
    try {
      const params: any = {};
      if (since) {
        params.since = since;
      }

      const response = await this.client.get('/sanctions/updates', { params });

      const data = response.data;

      logger.info('OFAC sanctions updates retrieved', {
        updateCount: data.updates?.length || 0,
        lastUpdated: data.lastUpdated,
      });

      return {
        updates: data.updates || [],
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get OFAC sanctions updates', {
        since,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        updates: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Fuzzy search for potential matches
   */
  async fuzzySearch(query: string, threshold: number = 0.8): Promise<OFACResult[]> {
    try {
      logger.info('Performing OFAC fuzzy search', { query, threshold });

      const response = await this.client.get('/sanctions/search', {
        params: { query, threshold },
      });

      const results = response.data.results || [];

      logger.info('OFAC fuzzy search completed', {
        query,
        resultsCount: results.length,
      });

      return results.map((result: any) => ({
        hit: result.hit || false,
        matchType: result.matchType || 'fuzzy',
        confidence: result.confidence || 0,
        details: result.details,
      }));
    } catch (error) {
      logger.error('Failed to perform OFAC fuzzy search', {
        query,
        threshold,
        error: error instanceof Error ? error.message : String(error),
      });

      return [];
    }
  }

  /**
   * Check if client is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  /**
   * Get client health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; latency?: number }> {
    try {
      const startTime = Date.now();
      await this.client.get('/health');
      const latency = Date.now() - startTime;

      return { healthy: true, latency };
    } catch (error) {
      logger.error('OFAC health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return { healthy: false };
    }
  }
}
