/**
 * SEBI Client
 * Integration with SEBI for Indian securities compliance
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
    new winston.transports.File({ filename: 'logs/sebi-client.log' })
  ]
});

export interface SEBIRegistrationStatus {
  registered: boolean;
  registrationNumber?: string;
  registrationType?: string;
  validity?: string;
  disciplinaryActions?: any[];
  capitalAdequacy?: number;
  details?: any;
}

export interface SEBIDematStatus {
  active: boolean;
  accountNumber?: string;
  kycCompliant: boolean;
  kycDetails?: any;
  frozen: boolean;
  freezeDetails?: any;
  details?: any;
}

export interface SEBITradingLimits {
  maxPosition: number;
  dailyTurnoverLimit: number;
  maxConcentration: number;
  marginRequirements?: any;
  details?: any;
}

export class SEBIClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.SEBI_API_KEY || '';
    this.baseUrl = process.env.SEBI_BASE_URL || 'https://api.sebi.gov.in/v1';

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
        logger.error('SEBI API error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  /**
   * Check SEBI registration status
   */
  async checkRegistration(userId: string): Promise<SEBIRegistrationStatus> {
    try {
      logger.info('Checking SEBI registration', { userId });

      const response = await this.client.get(`/registrations/${userId}`);

      const data = response.data;

      logger.info('SEBI registration check completed', {
        userId,
        registered: data.registered
      });

      return {
        registered: data.registered || false,
        registrationNumber: data.registrationNumber,
        registrationType: data.registrationType,
        validity: data.validity,
        disciplinaryActions: data.disciplinaryActions || [],
        capitalAdequacy: data.capitalAdequacy || 0,
        details: data.details
      };

    } catch (error) {
      logger.error('Failed to check SEBI registration', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        registered: false,
        disciplinaryActions: [],
        capitalAdequacy: 0
      };
    }
  }

  /**
   * Check demat account status
   */
  async checkDematAccount(accountId: string): Promise<SEBIDematStatus> {
    try {
      logger.info('Checking SEBI demat account', { accountId });

      const response = await this.client.get(`/demat/${accountId}`);

      const data = response.data;

      logger.info('SEBI demat account check completed', {
        accountId,
        active: data.active
      });

      return {
        active: data.active || false,
        accountNumber: data.accountNumber,
        kycCompliant: data.kycCompliant || false,
        kycDetails: data.kycDetails,
        frozen: data.frozen || false,
        freezeDetails: data.freezeDetails,
        details: data.details
      };

    } catch (error) {
      logger.error('Failed to check SEBI demat account', {
        accountId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        active: false,
        kycCompliant: false,
        frozen: false
      };
    }
  }

  /**
   * Get trading limits for a user
   */
  async getTradingLimits(userId: string): Promise<SEBITradingLimits> {
    try {
      logger.info('Getting SEBI trading limits', { userId });

      const response = await this.client.get(`/limits/${userId}`);

      const data = response.data;

      logger.info('SEBI trading limits retrieved', {
        userId,
        maxPosition: data.maxPosition
      });

      return {
        maxPosition: data.maxPosition || 0,
        dailyTurnoverLimit: data.dailyTurnoverLimit || 0,
        maxConcentration: data.maxConcentration || 0,
        marginRequirements: data.marginRequirements,
        details: data.details
      };

    } catch (error) {
      logger.error('Failed to get SEBI trading limits', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        maxPosition: 0,
        dailyTurnoverLimit: 0,
        maxConcentration: 0
      };
    }
  }

  /**
   * Check insider status
   */
  async checkInsiderStatus(userId: string): Promise<{
    isInsider: boolean;
    details?: any;
  }> {
    try {
      logger.info('Checking SEBI insider status', { userId });

      const response = await this.client.get(`/insider/${userId}`);

      const data = response.data;

      logger.info('SEBI insider status check completed', {
        userId,
        isInsider: data.isInsider
      });

      return {
        isInsider: data.isInsider || false,
        details: data.details
      };

    } catch (error) {
      logger.error('Failed to check SEBI insider status', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return { isInsider: false };
    }
  }

  /**
   * Check required disclosures
   */
  async checkRequiredDisclosures(userId: string): Promise<{
    missing: string[];
    overdue: string[];
  }> {
    try {
      logger.info('Checking SEBI required disclosures', { userId });

      const response = await this.client.get(`/disclosures/${userId}`);

      const data = response.data;

      logger.info('SEBI disclosures check completed', {
        userId,
        missingCount: data.missing?.length || 0,
        overdueCount: data.overdue?.length || 0
      });

      return {
        missing: data.missing || [],
        overdue: data.overdue || []
      };

    } catch (error) {
      logger.error('Failed to check SEBI required disclosures', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return { missing: [], overdue: [] };
    }
  }

  /**
   * Report suspicious transaction
   */
  async reportSuspiciousTransaction(transaction: any): Promise<void> {
    try {
      logger.info('Reporting suspicious transaction to SEBI', {
        transactionId: transaction.id
      });

      await this.client.post('/reports/suspicious-transaction', {
        transactionId: transaction.id,
        details: transaction,
        reportedAt: new Date().toISOString()
      });

      logger.info('Suspicious transaction reported to SEBI', {
        transactionId: transaction.id
      });

    } catch (error) {
      logger.error('Failed to report suspicious transaction to SEBI', {
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get market data for manipulation detection
   */
  async getMarketData(symbol: string, days: number = 30): Promise<any[]> {
    try {
      logger.info('Getting SEBI market data', { symbol, days });

      const response = await this.client.get(`/market/${symbol}`, {
        params: { days }
      });

      const data = response.data.data || [];

      logger.info('SEBI market data retrieved', {
        symbol,
        dataPoints: data.length
      });

      return data;

    } catch (error) {
      logger.error('Failed to get SEBI market data', {
        symbol,
        days,
        error: error instanceof Error ? error.message : String(error)
      });

      return [];
    }
  }

  /**
   * Check for corporate events
   */
  async getCorporateEvents(symbol: string, days: number = 90): Promise<any[]> {
    try {
      logger.info('Getting SEBI corporate events', { symbol, days });

      const response = await this.client.get(`/corporate-events/${symbol}`, {
        params: { days }
      });

      const events = response.data.events || [];

      logger.info('SEBI corporate events retrieved', {
        symbol,
        eventCount: events.length
      });

      return events;

    } catch (error) {
      logger.error('Failed to get SEBI corporate events', {
        symbol,
        days,
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
      logger.error('SEBI health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return { healthy: false };
    }
  }
}