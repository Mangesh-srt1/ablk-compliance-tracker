/**
 * Marble AML Provider Implementation
 * AML scoring and sanctions screening for fintech
 */

import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import {
  IAmlProvider,
  AmlProviderConfig,
  AmlScreeningRequest,
  AmlScreeningResult,
  AmlTransactionAnalysisRequest,
  AmlTransactionAnalysisResult,
  AmlMatch,
  AmlRiskIndicator,
  AmlPattern,
} from './amlProviderInterface';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/marble-aml.log' }),
  ],
});

export class MarbleAmlProvider implements IAmlProvider {
  public readonly name = 'Marble';
  public readonly supportedJurisdictions = ['IN', 'EU', 'US', 'GLOBAL'];

  private client: AxiosInstance;
  private config: AmlProviderConfig;

  constructor(config: AmlProviderConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Marble API Request', {
          url: config.url,
          method: config.method,
          entityId: config.data?.entityId,
        });
        return config;
      },
      (error) => {
        logger.error('Marble API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Marble API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Marble API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  async screenEntity(request: AmlScreeningRequest): Promise<AmlScreeningResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting Marble entity screening', {
        entityId: request.entityId,
        entityName: request.entityName,
        entityType: request.entityType,
      });

      const payload = {
        entityId: request.entityId,
        name: request.entityName,
        type: request.entityType,
        jurisdiction: request.jurisdiction,
        additionalInfo: request.additionalInfo,
      };

      let response: any;
      let attempt = 0;
      while (attempt < this.config.retries) {
        try {
          response = await this.client.post('/api/v1/screening/screen', payload);
          break;
        } catch (error: any) {
          attempt++;
          if (attempt >= this.config.retries) {
            throw error;
          }
          logger.warn(`Marble API call failed, retrying (${attempt}/${this.config.retries})`, {
            error: error.message,
            entityId: request.entityId,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!response) {
        throw new Error('Failed to get response from Marble API');
      }

      const processingTime = Date.now() - startTime;
      const data = response.data;

      const matches = this.parseMarbleMatches(data.matches || []);
      const riskLevel = this.calculateRiskLevel(data.riskScore || 0, matches);
      const riskScore = data.riskScore || 0;

      const result: AmlScreeningResult = {
        provider: this.name,
        entityId: request.entityId,
        riskLevel,
        riskScore,
        matches,
        sanctionsLists: data.sanctionsLists || [],
        processingTime,
        rawResponse: data,
      };

      logger.info('Marble entity screening completed', {
        entityId: request.entityId,
        riskLevel,
        riskScore,
        matchCount: matches.length,
        processingTime,
      });

      return result;
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error('Marble entity screening failed', {
        entityId: request.entityId,
        error: error.message,
        processingTime,
      });

      // Return high-risk result on failure
      return {
        provider: this.name,
        entityId: request.entityId,
        riskLevel: 'CRITICAL',
        riskScore: 100,
        matches: [],
        sanctionsLists: [],
        processingTime,
        rawResponse: { error: error.message },
      };
    }
  }

  async analyzeTransactions(
    request: AmlTransactionAnalysisRequest
  ): Promise<AmlTransactionAnalysisResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting Marble transaction analysis', {
        entityId: request.entityId,
        transactionCount: request.transactions.length,
      });

      const payload = {
        entityId: request.entityId,
        transactions: request.transactions,
        analysisPeriod: request.analysisPeriod,
      };

      let response: any;
      let attempt = 0;
      while (attempt < this.config.retries) {
        try {
          response = await this.client.post('/api/v1/analysis/transactions', payload);
          break;
        } catch (error: any) {
          attempt++;
          if (attempt >= this.config.retries) {
            throw error;
          }
          logger.warn(
            `Marble transaction analysis failed, retrying (${attempt}/${this.config.retries})`,
            {
              error: error.message,
              entityId: request.entityId,
            }
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!response) {
        throw new Error('Failed to get response from Marble API');
      }

      const processingTime = Date.now() - startTime;
      const data = response.data;

      const riskIndicators = this.parseRiskIndicators(data.riskIndicators || []);
      const patterns = this.parsePatterns(data.patterns || []);
      const overallRisk = this.calculateOverallRisk(riskIndicators, patterns);

      const result: AmlTransactionAnalysisResult = {
        provider: this.name,
        entityId: request.entityId,
        riskIndicators,
        patterns,
        overallRisk,
        recommendations: data.recommendations || [],
        processingTime,
        rawResponse: data,
      };

      logger.info('Marble transaction analysis completed', {
        entityId: request.entityId,
        overallRisk,
        indicatorCount: riskIndicators.length,
        patternCount: patterns.length,
        processingTime,
      });

      return result;
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error('Marble transaction analysis failed', {
        entityId: request.entityId,
        error: error.message,
        processingTime,
      });

      return {
        provider: this.name,
        entityId: request.entityId,
        riskIndicators: [],
        patterns: [],
        overallRisk: 'CRITICAL',
        recommendations: ['Manual review required due to analysis failure'],
        processingTime,
        rawResponse: { error: error.message },
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/health');
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      logger.error('Marble health check failed', { error: (error as Error).message });
      return false;
    }
  }

  async getCapabilities(): Promise<{
    supportedLists: string[];
    supportedJurisdictions: string[];
    features: string[];
  }> {
    try {
      const response = await this.client.get('/api/v1/capabilities');
      return {
        supportedLists: response.data.supportedLists || [
          'OFAC',
          'EU_SANCTIONS',
          'UN_SANCTIONS',
          'INTERPOL',
        ],
        supportedJurisdictions: response.data.supportedJurisdictions || this.supportedJurisdictions,
        features: response.data.features || [
          'entity_screening',
          'transaction_analysis',
          'risk_scoring',
        ],
      };
    } catch (error) {
      logger.warn('Failed to get Marble capabilities, using defaults', {
        error: (error as Error).message,
      });
      return {
        supportedLists: ['OFAC', 'EU_SANCTIONS', 'UN_SANCTIONS', 'INTERPOL'],
        supportedJurisdictions: this.supportedJurisdictions,
        features: ['entity_screening', 'transaction_analysis', 'risk_scoring'],
      };
    }
  }

  private parseMarbleMatches(matchesData: any[]): AmlMatch[] {
    return matchesData.map((match) => ({
      listName: match.listName || 'Unknown',
      matchType: match.matchType || 'EXACT',
      confidence: match.confidence || 0.95,
      matchedEntity: {
        name: match.entityName || '',
        aliases: match.aliases || [],
        country: match.country,
        sanctionsType: match.sanctionsType,
      },
      details: match.details,
    }));
  }

  private parseRiskIndicators(indicatorsData: any[]): AmlRiskIndicator[] {
    return indicatorsData.map((indicator) => ({
      type: indicator.type || 'UNUSUAL_AMOUNT',
      severity: indicator.severity || 'MEDIUM',
      description: indicator.description || 'Risk indicator detected',
      evidence: indicator.evidence,
    }));
  }

  private parsePatterns(patternsData: any[]): AmlPattern[] {
    return patternsData.map((pattern) => ({
      type: pattern.type || 'STRUCTURING',
      confidence: pattern.confidence || 0.8,
      description: pattern.description || 'Pattern detected',
      transactions: pattern.transactionIds || [],
    }));
  }

  private calculateRiskLevel(
    score: number,
    matches: AmlMatch[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (matches.length > 0) {
      return 'CRITICAL';
    }
    if (score >= 80) {
      return 'HIGH';
    }
    if (score >= 60) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private calculateOverallRisk(
    indicators: AmlRiskIndicator[],
    patterns: AmlPattern[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalIndicators = indicators.filter((i) => i.severity === 'CRITICAL').length;
    const highIndicators = indicators.filter((i) => i.severity === 'HIGH').length;
    const criticalPatterns = patterns.filter((p) => p.confidence > 0.9).length;

    if (criticalIndicators > 0 || criticalPatterns > 0) {
      return 'CRITICAL';
    }
    if (highIndicators > 2 || patterns.length > 3) {
      return 'HIGH';
    }
    if (indicators.length > 0 || patterns.length > 0) {
      return 'MEDIUM';
    }
    return 'LOW';
  }
}
