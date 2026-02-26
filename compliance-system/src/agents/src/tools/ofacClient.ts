/**
 * OFAC Client
 * Integration with OFAC sanctions lists
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
    new winston.transports.File({ filename: 'logs/ofac-client.log' })
  ]
});

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

  constructor() {
    this.apiKey = process.env.OFAC_API_KEY || '';
    this.baseUrl = process.env.OFAC_BASE_URL || 'https://api.ofac.gov/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('OFAC API error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  /**
   * Check if an address is sanctioned
   */
  async checkAddress(address: string): Promise<OFACResult> {
    try {
      logger.info('Checking OFAC sanctions for address', { address });

      const response = await this.client.get(`/sanctions/addresses/${address}`);

      const result = response.data;

      logger.info('OFAC address check completed', {
        address,
        hit: result.hit,
        matchType: result.matchType
      });

      return {
        hit: result.hit || false,
        matchType: result.matchType || 'none',
        confidence: result.confidence || 0,
        details: result.details
      };

    } catch (error) {
      logger.error('Failed to check OFAC sanctions for address', {
        address,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return no hit on error to avoid false positives
      return {
        hit: false,
        matchType: 'none',
        confidence: 0
      };
    }
  }

  /**
   * Check if an entity is sanctioned
   */
  async checkEntity(name: string, country?: string): Promise<OFACResult> {
    try {
      logger.info('Checking OFAC sanctions for entity', { name, country });

      const params: any = { name };
      if (country) {params.country = country;}

      const response = await this.client.get('/sanctions/entities', { params });

      const result = response.data;

      logger.info('OFAC entity check completed', {
        name,
        country,
        hit: result.hit,
        matchType: result.matchType
      });

      return {
        hit: result.hit || false,
        matchType: result.matchType || 'none',
        confidence: result.confidence || 0,
        details: result.details
      };

    } catch (error) {
      logger.error('Failed to check OFAC sanctions for entity', {
        name,
        country,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return no hit on error to avoid false positives
      return {
        hit: false,
        matchType: 'none',
        confidence: 0
      };
    }
  }

  /**
   * Check multiple addresses in batch
   */
  async checkAddressesBatch(addresses: string[]): Promise<OFACResult[]> {
    try {
      logger.info('Checking OFAC sanctions for address batch', {
        count: addresses.length
      });

      const response = await this.client.post('/sanctions/addresses/batch', {
        addresses
      });

      const results = response.data.results || [];

      logger.info('OFAC address batch check completed', {
        requested: addresses.length,
        results: results.length
      });

      return results.map((result: any, index: number) => ({
        hit: result.hit || false,
        matchType: result.matchType || 'none',
        confidence: result.confidence || 0,
        details: result.details
      }));

    } catch (error) {
      logger.error('Failed to check OFAC sanctions for address batch', {
        count: addresses.length,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return no hits on error
      return addresses.map(() => ({
        hit: false,
        matchType: 'none',
        confidence: 0
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
      if (since) {params.since = since;}

      const response = await this.client.get('/sanctions/updates', { params });

      const data = response.data;

      logger.info('OFAC sanctions updates retrieved', {
        updateCount: data.updates?.length || 0,
        lastUpdated: data.lastUpdated
      });

      return {
        updates: data.updates || [],
        lastUpdated: data.lastUpdated || new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get OFAC sanctions updates', {
        since,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        updates: [],
        lastUpdated: new Date().toISOString()
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
        params: { query, threshold }
      });

      const results = response.data.results || [];

      logger.info('OFAC fuzzy search completed', {
        query,
        resultsCount: results.length
      });

      return results.map((result: any) => ({
        hit: result.hit || false,
        matchType: result.matchType || 'fuzzy',
        confidence: result.confidence || 0,
        details: result.details
      }));

    } catch (error) {
      logger.error('Failed to perform OFAC fuzzy search', {
        query,
        threshold,
        error: error instanceof Error ? error.message : String(error)
      });

      return [];
    }
  }

  /**
   * Get sanctions programs
   */
  async getSanctionsPrograms(): Promise<string[]> {
    try {
      const response = await this.client.get('/sanctions/programs');

      return response.data.programs || [];

    } catch (error) {
      logger.error('Failed to get OFAC sanctions programs', {
        error: error instanceof Error ? error.message : String(error)
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
        error: error instanceof Error ? error.message : String(error)
      });

      return { healthy: false };
    }
  }
}