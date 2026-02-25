/**
 * KYC Provider Manager
 * Manages multiple KYC providers and handles provider selection
 */

import winston from 'winston';
import { IKycProvider, KycVerificationRequest, KycVerificationResult } from './kycProviderInterface';
import { BallerineKycProvider } from './ballerineKycProvider';
import { JumioKycProvider } from './jumioKycProvider';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kyc-provider-manager.log' })
  ]
});

export class KycProviderManager {
  private providers: Map<string, IKycProvider> = new Map();
  private primaryProvider: string;

  constructor() {
    this.primaryProvider = process.env.KYC_PRIMARY_PROVIDER || 'ballerine';
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      // Initialize Ballerine provider
      if (process.env.BALLERINE_API_KEY) {
        const ballerineConfig = {
          apiKey: process.env.BALLERINE_API_KEY,
          baseUrl: process.env.BALLERINE_BASE_URL || 'https://api.ballerine.com',
          timeout: parseInt(process.env.BALLERINE_TIMEOUT || '30000'),
          retries: parseInt(process.env.BALLERINE_RETRIES || '3')
        };
        this.providers.set('ballerine', new BallerineKycProvider(ballerineConfig));
        logger.info('Ballerine KYC provider initialized');
      } else {
        logger.warn('Ballerine API key not configured, provider disabled');
      }

      // Initialize Jumio provider
      if (process.env.JUMIO_API_KEY && process.env.JUMIO_API_SECRET) {
        const jumioConfig = {
          apiKey: process.env.JUMIO_API_KEY,
          baseUrl: process.env.JUMIO_BASE_URL || 'https://api.jumio.com',
          timeout: parseInt(process.env.JUMIO_TIMEOUT || '30000'),
          retries: parseInt(process.env.JUMIO_RETRIES || '3')
        };
        this.providers.set('jumio', new JumioKycProvider(jumioConfig, process.env.JUMIO_API_SECRET));
        logger.info('Jumio KYC provider initialized');
      } else {
        logger.warn('Jumio API credentials not configured, provider disabled');
      }

      logger.info(`KYC Provider Manager initialized with ${this.providers.size} providers`);

    } catch (error) {
      logger.error('Failed to initialize KYC providers', { error: (error as Error).message });
      throw error;
    }
  }

  async verify(request: KycVerificationRequest): Promise<KycVerificationResult> {
    const provider = this.selectProvider(request);

    if (!provider) {
      throw new Error(`No suitable KYC provider found for jurisdiction: ${request.jurisdiction}`);
    }

    logger.info('Selected KYC provider for verification', {
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      provider: provider.name
    });

    return await provider.verify(request);
  }

  async verifyWithFallback(request: KycVerificationRequest): Promise<KycVerificationResult[]> {
    const results: KycVerificationResult[] = [];
    const errors: string[] = [];

    // Try all available providers
    for (const [name, provider] of this.providers) {
      try {
        if (provider.supportedJurisdictions.includes(request.jurisdiction)) {
          logger.info(`Attempting KYC verification with ${name}`, {
            entityId: request.entityId,
            jurisdiction: request.jurisdiction
          });

          const result = await provider.verify(request);
          results.push(result);

          // If we get a successful verification, we can return early
          if (result.verified && result.confidence > 0.8) {
            logger.info(`Successful KYC verification with ${name}, stopping fallback`, {
              entityId: request.entityId,
              confidence: result.confidence
            });
            break;
          }
        }
      } catch (error) {
        const errorMsg = `${name} verification failed: ${(error as Error).message}`;
        errors.push(errorMsg);
        logger.warn(errorMsg, { entityId: request.entityId });
      }
    }

    if (results.length === 0) {
      throw new Error(`All KYC providers failed: ${errors.join(', ')}`);
    }

    return results;
  }

  private selectProvider(request: KycVerificationRequest): IKycProvider | null {
    // First, try the primary provider if it supports the jurisdiction
    const primary = this.providers.get(this.primaryProvider);
    if (primary && primary.supportedJurisdictions.includes(request.jurisdiction)) {
      return primary;
    }

    // Fallback to any provider that supports the jurisdiction
    for (const provider of this.providers.values()) {
      if (provider.supportedJurisdictions.includes(request.jurisdiction)) {
        return provider;
      }
    }

    return null;
  }

  async getProviderStatus(): Promise<{
    [providerName: string]: {
      healthy: boolean;
      supportedJurisdictions: string[];
      capabilities?: any;
    }
  }> {
    const status: { [key: string]: any } = {};

    for (const [name, provider] of this.providers) {
      try {
        const healthy = await provider.isHealthy();
        const capabilities = await provider.getCapabilities();

        status[name] = {
          healthy,
          supportedJurisdictions: provider.supportedJurisdictions,
          capabilities
        };
      } catch (error) {
        status[name] = {
          healthy: false,
          supportedJurisdictions: provider.supportedJurisdictions,
          error: (error as Error).message
        };
      }
    }

    return status;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderCapabilities(providerName: string): Promise<any> | null {
    const provider = this.providers.get(providerName);
    return provider ? provider.getCapabilities() : null;
  }
}

// Export singleton instance
export const kycProviderManager = new KycProviderManager();