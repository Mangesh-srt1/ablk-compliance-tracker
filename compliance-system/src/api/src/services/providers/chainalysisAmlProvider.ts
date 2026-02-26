/**
 * Chainalysis AML Provider Implementation
 * Cryptocurrency-focused AML and sanctions screening
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
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
    new winston.transports.File({ filename: 'logs/chainalysis-aml.log' }),
  ],
});

export class ChainalysisAmlProvider implements IAmlProvider {
  public readonly name = 'Chainalysis';
  public readonly supportedJurisdictions = ['US', 'EU', 'GLOBAL'];

  private client: AxiosInstance;
  private config: AmlProviderConfig;
  private apiSecret: string;

  constructor(config: AmlProviderConfig, apiSecret: string) {
    this.config = config;
    this.apiSecret = apiSecret;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
    });

    // Add request/response interceptors for logging and auth
    this.client.interceptors.request.use(
      (config) => {
        // Generate Chainalysis signature if needed
        if (this.apiSecret) {
          const timestamp = Math.floor(Date.now() / 1000);
          const payload = config.data ? JSON.stringify(config.data) : '';
          const signature = this.generateSignature(payload, timestamp);

          config.headers = {
            ...config.headers,
            'X-Auth-Signature': signature,
            'X-Auth-Timestamp': timestamp.toString(),
          } as any;
        }

        logger.debug('Chainalysis API Request', {
          url: config.url,
          method: config.method,
          entityId: config.data?.entityId,
        });
        return config;
      },
      (error) => {
        logger.error('Chainalysis API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Chainalysis API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Chainalysis API Response Error', {
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
      logger.info('Starting Chainalysis entity screening', {
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
          response = await this.client.post('/api/v1/screening/entities', payload);
          break;
        } catch (error: any) {
          attempt++;
          if (attempt >= this.config.retries) {
            throw error;
          }
          logger.warn(`Chainalysis API call failed, retrying (${attempt}/${this.config.retries})`, {
            error: error.message,
            entityId: request.entityId,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!response) {
        throw new Error('Failed to get response from Chainalysis API');
      }

      const processingTime = Date.now() - startTime;
      const data = response.data;

      const matches = this.parseChainalysisMatches(data.matches || []);
      const riskLevel = this.calculateRiskLevel(data.riskScore || 0, matches);
      const riskScore = data.riskScore || 0;

      const result: AmlScreeningResult = {
        provider: this.name,
        entityId: request.entityId,
        riskLevel,
        riskScore,
        matches,
        sanctionsLists: data.sanctionsLists || ['OFAC', 'CHAINALYSIS_SANCTIONS'],
        processingTime,
        rawResponse: data,
      };

      logger.info('Chainalysis entity screening completed', {
        entityId: request.entityId,
        riskLevel,
        riskScore,
        matchCount: matches.length,
        processingTime,
      });

      return result;
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error('Chainalysis entity screening failed', {
        entityId: request.entityId,
        error: error.message,
        processingTime,
      });

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
      logger.info('Starting Chainalysis transaction analysis', {
        entityId: request.entityId,
        transactionCount: request.transactions.length,
      });

      // Filter for crypto transactions only
      const cryptoTransactions = request.transactions.filter((tx) => this.isCryptoTransaction(tx));

      if (cryptoTransactions.length === 0) {
        logger.info('No crypto transactions found for Chainalysis analysis', {
          entityId: request.entityId,
          totalTransactions: request.transactions.length,
        });

        return {
          provider: this.name,
          entityId: request.entityId,
          riskIndicators: [],
          patterns: [],
          overallRisk: 'LOW',
          recommendations: ['No cryptocurrency transactions to analyze'],
          processingTime: Date.now() - startTime,
          rawResponse: { message: 'No crypto transactions' },
        };
      }

      const payload = {
        entityId: request.entityId,
        transactions: cryptoTransactions.map((tx) => ({
          ...tx,
          blockchain: this.detectBlockchain(tx),
        })),
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
            `Chainalysis transaction analysis failed, retrying (${attempt}/${this.config.retries})`,
            {
              error: error.message,
              entityId: request.entityId,
            }
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!response) {
        throw new Error('Failed to get response from Chainalysis API');
      }

      const processingTime = Date.now() - startTime;
      const data = response.data;

      const riskIndicators = this.parseCryptoRiskIndicators(data.riskIndicators || []);
      const patterns = this.parseCryptoPatterns(data.patterns || []);
      const overallRisk = this.calculateCryptoRisk(riskIndicators, patterns);

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

      logger.info('Chainalysis transaction analysis completed', {
        entityId: request.entityId,
        overallRisk,
        indicatorCount: riskIndicators.length,
        patternCount: patterns.length,
        processingTime,
      });

      return result;
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error('Chainalysis transaction analysis failed', {
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
      return response.status === 200 && response.data.status === 'OK';
    } catch (error) {
      logger.error('Chainalysis health check failed', { error: (error as Error).message });
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
          'CHAINALYSIS_SANCTIONS',
          'CRYPTO_SANCTIONS',
        ],
        supportedJurisdictions: response.data.supportedJurisdictions || this.supportedJurisdictions,
        features: response.data.features || [
          'entity_screening',
          'crypto_transaction_analysis',
          'blockchain_risk_scoring',
        ],
      };
    } catch (error) {
      logger.warn('Failed to get Chainalysis capabilities, using defaults', {
        error: (error as Error).message,
      });
      return {
        supportedLists: ['OFAC', 'CHAINALYSIS_SANCTIONS', 'CRYPTO_SANCTIONS'],
        supportedJurisdictions: this.supportedJurisdictions,
        features: ['entity_screening', 'crypto_transaction_analysis', 'blockchain_risk_scoring'],
      };
    }
  }

  private generateSignature(payload: string, timestamp: number): string {
    const message = `${timestamp}${payload}`;
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
  }

  private parseChainalysisMatches(matchesData: any[]): AmlMatch[] {
    return matchesData.map((match) => ({
      listName: match.listName || 'Chainalysis Sanctions',
      matchType: match.matchType || 'EXACT',
      confidence: match.confidence || 0.95,
      matchedEntity: {
        name: match.entityName || '',
        aliases: match.aliases || [],
        country: match.country,
        sanctionsType: match.sanctionsType || 'Crypto Sanctions',
      },
      details: match.details,
    }));
  }

  private parseCryptoRiskIndicators(indicatorsData: any[]): AmlRiskIndicator[] {
    return indicatorsData.map((indicator) => ({
      type: indicator.type || 'HIGH_RISK_COUNTERPARTY',
      severity: indicator.severity || 'MEDIUM',
      description: indicator.description || 'Cryptocurrency risk indicator detected',
      evidence: indicator.evidence,
    }));
  }

  private parseCryptoPatterns(patternsData: any[]): AmlPattern[] {
    return patternsData.map((pattern) => ({
      type: pattern.type || 'RAPID_MOVEMENT',
      confidence: pattern.confidence || 0.8,
      description: pattern.description || 'Cryptocurrency pattern detected',
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

  private calculateCryptoRisk(
    indicators: AmlRiskIndicator[],
    patterns: AmlPattern[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalIndicators = indicators.filter((i) => i.severity === 'CRITICAL').length;
    const highIndicators = indicators.filter((i) => i.severity === 'HIGH').length;
    const highConfidencePatterns = patterns.filter((p) => p.confidence > 0.9).length;

    if (criticalIndicators > 0 || highConfidencePatterns > 0) {
      return 'CRITICAL';
    }
    if (highIndicators > 1 || patterns.length > 2) {
      return 'HIGH';
    }
    if (indicators.length > 0 || patterns.length > 0) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private isCryptoTransaction(transaction: any): boolean {
    // Check if transaction involves cryptocurrency
    const description = transaction.description?.toLowerCase() || '';
    const counterparty = transaction.counterparty?.toLowerCase() || '';

    return (
      description.includes('crypto') ||
      description.includes('bitcoin') ||
      description.includes('ethereum') ||
      description.includes('wallet') ||
      counterparty.includes('exchange') ||
      counterparty.includes('blockchain')
    );
  }

  private detectBlockchain(transaction: any): string {
    // Simple blockchain detection based on transaction details
    const description = transaction.description?.toLowerCase() || '';

    if (description.includes('bitcoin') || description.includes('btc')) {
      return 'bitcoin';
    }
    if (description.includes('ethereum') || description.includes('eth')) {
      return 'ethereum';
    }
    if (description.includes('polygon') || description.includes('matic')) {
      return 'polygon';
    }
    if (description.includes('bnb') || description.includes('binance')) {
      return 'bsc';
    }

    return 'unknown';
  }
}
