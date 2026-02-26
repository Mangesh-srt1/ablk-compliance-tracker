/**
 * BSE Client
 * Integration with Bombay Stock Exchange
 */

import axios, { AxiosInstance } from 'axios';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/bse-client.log' }),
  ],
});

export class BSEClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.BSE_API_KEY || '';
    this.baseUrl = process.env.BSE_BASE_URL || 'https://api.bseindia.com/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('BSE API error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  /**
   * Get stock quote
   */
  async getQuote(symbol: string): Promise<any> {
    try {
      logger.info('Getting BSE quote', { symbol });

      const response = await this.client.get(`/quotes/${symbol}`);

      const quote = response.data;

      logger.info('BSE quote retrieved', {
        symbol,
        price: quote.lastPrice,
      });

      return quote;
    } catch (error) {
      logger.error('Failed to get BSE quote', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get market depth
   */
  async getMarketDepth(symbol: string): Promise<any> {
    try {
      logger.info('Getting BSE market depth', { symbol });

      const response = await this.client.get(`/depth/${symbol}`);

      const depth = response.data;

      logger.info('BSE market depth retrieved', {
        symbol,
        bids: depth.bids?.length || 0,
        asks: depth.asks?.length || 0,
      });

      return depth;
    } catch (error) {
      logger.error('Failed to get BSE market depth', {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(symbol: string, days: number = 1): Promise<any[]> {
    try {
      logger.info('Getting BSE trade history', { symbol, days });

      const response = await this.client.get(`/trades/${symbol}`, {
        params: { days },
      });

      const trades = response.data.trades || [];

      logger.info('BSE trade history retrieved', {
        symbol,
        tradeCount: trades.length,
      });

      return trades;
    } catch (error) {
      logger.error('Failed to get BSE trade history', {
        symbol,
        days,
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
      logger.error('BSE health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return { healthy: false };
    }
  }
}
