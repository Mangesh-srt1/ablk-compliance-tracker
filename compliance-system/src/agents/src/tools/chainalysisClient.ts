/**
 * Chainalysis Client
 * Integration with Chainalysis for blockchain risk assessment
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
    new winston.transports.File({ filename: 'logs/chainalysis-client.log' })
  ]
});

export interface ChainalysisRiskScore {
  address: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'severe';
  categories: string[];
  exposureDetails?: any;
  lastUpdated: string;
}

export class ChainalysisClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CHAINALYSIS_API_KEY || '';
    this.baseUrl = process.env.CHAINALYSIS_BASE_URL || 'https://api.chainalysis.com/v1';

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
        logger.error('Chainalysis API error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  /**
   * Get risk score for an address
   */
  async getAddressRiskScore(address: string): Promise<number> {
    try {
      logger.info('Getting Chainalysis risk score', { address });

      const response = await this.client.get(`/addresses/${address}/risk`);

      const riskData = response.data;
      const riskScore = this.mapRiskLevelToScore(riskData.riskLevel);

      logger.info('Chainalysis risk score retrieved', {
        address,
        riskScore,
        riskLevel: riskData.riskLevel
      });

      return riskScore;

    } catch (error) {
      logger.error('Failed to get Chainalysis risk score', {
        address,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return medium risk on error to be conservative
      return 0.5;
    }
  }

  /**
   * Get detailed risk assessment for an address
   */
  async getAddressRiskAssessment(address: string): Promise<ChainalysisRiskScore> {
    try {
      logger.info('Getting detailed Chainalysis risk assessment', { address });

      const response = await this.client.get(`/addresses/${address}/risk`);

      const riskData = response.data;

      const assessment: ChainalysisRiskScore = {
        address,
        riskScore: this.mapRiskLevelToScore(riskData.riskLevel),
        riskLevel: riskData.riskLevel,
        categories: riskData.categories || [],
        exposureDetails: riskData.exposureDetails,
        lastUpdated: riskData.lastUpdated || new Date().toISOString()
      };

      logger.info('Chainalysis risk assessment retrieved', {
        address,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        categories: assessment.categories
      });

      return assessment;

    } catch (error) {
      logger.error('Failed to get Chainalysis risk assessment', {
        address,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return conservative assessment on error
      return {
        address,
        riskScore: 0.5,
        riskLevel: 'medium',
        categories: ['unknown'],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Check if address is associated with sanctioned entities
   */
  async checkSanctions(address: string): Promise<{
    sanctioned: boolean;
    sanctionsDetails?: any[];
  }> {
    try {
      logger.info('Checking Chainalysis sanctions', { address });

      const response = await this.client.get(`/addresses/${address}/sanctions`);

      const sanctionsData = response.data;

      logger.info('Chainalysis sanctions check completed', {
        address,
        sanctioned: sanctionsData.sanctioned
      });

      return {
        sanctioned: sanctionsData.sanctioned || false,
        sanctionsDetails: sanctionsData.details
      };

    } catch (error) {
      logger.error('Failed to check Chainalysis sanctions', {
        address,
        error: error instanceof Error ? error.message : String(error)
      });

      return { sanctioned: false };
    }
  }

  /**
   * Get transaction risk assessment
   */
  async assessTransactionRisk(transaction: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    asset: string;
  }): Promise<{
    riskScore: number;
    riskFactors: string[];
    recommendations: string[];
  }> {
    try {
      logger.info('Assessing transaction risk with Chainalysis', {
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        amount: transaction.amount,
        asset: transaction.asset
      });

      // Get risk scores for both addresses
      const [fromRisk, toRisk] = await Promise.all([
        this.getAddressRiskAssessment(transaction.fromAddress),
        this.getAddressRiskAssessment(transaction.toAddress)
      ]);

      // Calculate combined risk score
      const combinedRisk = Math.max(fromRisk.riskScore, toRisk.riskScore);

      // Identify risk factors
      const riskFactors = [];
      const recommendations = [];

      if (fromRisk.riskScore > 0.7) {
        riskFactors.push('high_risk_sender');
        recommendations.push('Verify sender identity and source of funds');
      }

      if (toRisk.riskScore > 0.7) {
        riskFactors.push('high_risk_recipient');
        recommendations.push('Monitor recipient activity closely');
      }

      if (fromRisk.categories.includes('mixer') || toRisk.categories.includes('mixer')) {
        riskFactors.push('tumor_tumbler_usage');
        recommendations.push('Enhanced due diligence required for mixer usage');
      }

      if (fromRisk.categories.includes('exchange') && transaction.amount > 100) {
        riskFactors.push('large_exchange_transaction');
        recommendations.push('Verify transaction purpose and beneficiary');
      }

      logger.info('Transaction risk assessment completed', {
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        combinedRisk,
        riskFactors
      });

      return {
        riskScore: combinedRisk,
        riskFactors,
        recommendations
      };

    } catch (error) {
      logger.error('Failed to assess transaction risk', {
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        riskScore: 0.5,
        riskFactors: ['assessment_failed'],
        recommendations: ['Manual risk assessment required']
      };
    }
  }

  /**
   * Get exposure details for an address
   */
  async getAddressExposure(address: string): Promise<{
    directExposure: number;
    indirectExposure: number;
    exposureBreakdown: any;
  }> {
    try {
      logger.info('Getting Chainalysis address exposure', { address });

      const response = await this.client.get(`/addresses/${address}/exposure`);

      const exposureData = response.data;

      logger.info('Chainalysis address exposure retrieved', {
        address,
        directExposure: exposureData.directExposure,
        indirectExposure: exposureData.indirectExposure
      });

      return {
        directExposure: exposureData.directExposure || 0,
        indirectExposure: exposureData.indirectExposure || 0,
        exposureBreakdown: exposureData.breakdown || {}
      };

    } catch (error) {
      logger.error('Failed to get Chainalysis address exposure', {
        address,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        directExposure: 0,
        indirectExposure: 0,
        exposureBreakdown: {}
      };
    }
  }

  /**
   * Map risk level string to numeric score
   */
  private mapRiskLevelToScore(riskLevel: string): number {
    switch (riskLevel?.toLowerCase()) {
      case 'severe':
        return 1.0;
      case 'high':
        return 0.8;
      case 'medium':
        return 0.5;
      case 'low':
        return 0.2;
      default:
        return 0.5; // Default to medium risk
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
      logger.error('Chainalysis health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return { healthy: false };
    }
  }
}