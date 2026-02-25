/**
 * AML Provider Manager
 * Manages multiple AML providers and handles provider selection
 */

import winston from 'winston';
import { IAmlProvider, AmlScreeningRequest, AmlScreeningResult, AmlTransactionAnalysisRequest, AmlTransactionAnalysisResult } from './amlProviderInterface';
import { MarbleAmlProvider } from './marbleAmlProvider';
import { ChainalysisAmlProvider } from './chainalysisAmlProvider';
import { AmlCheckRequest, AmlCheckResult, Jurisdiction, AmlRiskLevel, ScreeningResult, AmlFlag, AmlTransaction, AmlFlagType } from '../../types/aml';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/aml-provider-manager.log' })
  ]
});

export class AmlProviderManager {
  private providers: Map<string, IAmlProvider> = new Map();
  private primaryProvider: string;

  constructor() {
    this.primaryProvider = process.env.AML_PRIMARY_PROVIDER || 'marble';
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      // Initialize Marble provider
      if (process.env.MARBLE_API_KEY) {
        const marbleConfig = {
          apiKey: process.env.MARBLE_API_KEY,
          baseUrl: process.env.MARBLE_BASE_URL || 'https://api.marble.com',
          timeout: parseInt(process.env.MARBLE_TIMEOUT || '30000'),
          retries: parseInt(process.env.MARBLE_RETRIES || '3')
        };
        this.providers.set('marble', new MarbleAmlProvider(marbleConfig));
        logger.info('Marble AML provider initialized');
      } else {
        logger.warn('Marble API key not configured, provider disabled');
      }

      // Initialize Chainalysis provider
      if (process.env.CHAINALYSIS_API_KEY && process.env.CHAINALYSIS_API_SECRET) {
        const chainalysisConfig = {
          apiKey: process.env.CHAINALYSIS_API_KEY,
          baseUrl: process.env.CHAINALYSIS_BASE_URL || 'https://api.chainalysis.com',
          timeout: parseInt(process.env.CHAINALYSIS_TIMEOUT || '30000'),
          retries: parseInt(process.env.CHAINALYSIS_RETRIES || '3')
        };
        this.providers.set('chainalysis', new ChainalysisAmlProvider(chainalysisConfig, process.env.CHAINALYSIS_API_SECRET));
        logger.info('Chainalysis AML provider initialized');
      } else {
        logger.warn('Chainalysis API credentials not configured, provider disabled');
      }

      logger.info(`AML Provider Manager initialized with ${this.providers.size} providers`);

    } catch (error) {
      logger.error('Failed to initialize AML providers', { error: (error as Error).message });
      throw error;
    }
  }

  async screenEntity(request: AmlScreeningRequest): Promise<AmlScreeningResult> {
    const provider = this.selectProvider(request);

    if (!provider) {
      throw new Error(`No suitable AML provider found for jurisdiction: ${request.jurisdiction || 'GLOBAL'}`);
    }

    logger.info('Selected AML provider for entity screening', {
      entityId: request.entityId,
      entityName: request.entityName,
      jurisdiction: request.jurisdiction,
      provider: provider.name
    });

    return await provider.screenEntity(request);
  }

  async analyzeTransactions(request: AmlTransactionAnalysisRequest): Promise<AmlTransactionAnalysisResult> {
    const provider = this.selectProvider(request);

    if (!provider) {
      throw new Error(`No suitable AML provider found for transaction analysis`);
    }

    logger.info('Selected AML provider for transaction analysis', {
      entityId: request.entityId,
      transactionCount: request.transactions.length,
      provider: provider.name
    });

    return await provider.analyzeTransactions(request);
  }

  async performAmlCheck(request: AmlCheckRequest): Promise<AmlCheckResult> {
    const provider = this.selectProviderForJurisdiction(request.jurisdiction);

    if (!provider) {
      throw new Error(`No suitable AML provider found for jurisdiction: ${request.jurisdiction}`);
    }

    logger.info('Selected AML provider for comprehensive check', {
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      provider: provider.name
    });

    // Perform entity screening
    const screeningRequest: AmlScreeningRequest = {
      entityId: request.entityId,
      entityName: request.entityData.name,
      entityType: 'individual', // Default to individual since AmlEntityData doesn't specify
      jurisdiction: request.jurisdiction,
      additionalInfo: {
        country: request.entityData.country
        // dateOfBirth, aliases not available in AmlEntityData
      }
    };

    const screeningResult = await provider.screenEntity(screeningRequest);

    // Perform transaction analysis if transactions are provided
    let transactionResult: AmlTransactionAnalysisResult | null = null;
    if (request.transactions && request.transactions.length > 0) {
      const transactionRequest: AmlTransactionAnalysisRequest = {
        entityId: request.entityId,
        transactions: request.transactions.map(t => ({
          amount: t.amount,
          currency: t.currency,
          counterparty: t.counterparty,
          timestamp: t.timestamp,
          description: t.description,
          type: t.type as 'credit' | 'debit' | 'transfer'
        }))
      };
      transactionResult = await provider.analyzeTransactions(transactionRequest);
    }

    // Combine results into AmlCheckResult
    const combinedResult: AmlCheckResult = {
      checkId: `check_${Date.now()}_${request.entityId}`,
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      score: screeningResult.riskScore,
      riskLevel: this.mapRiskLevel(screeningResult.riskLevel),
      flags: this.mapFlags(screeningResult, transactionResult),
      recommendations: this.generateRecommendations(screeningResult, transactionResult),
      screeningResults: {
        ofac: screeningResult.sanctionsLists.includes('OFAC') ? ScreeningResult.HIT : ScreeningResult.CLEAR,
        euSanctions: screeningResult.sanctionsLists.includes('EU') ? ScreeningResult.HIT : ScreeningResult.CLEAR,
        pep: ScreeningResult.CLEAR // Would need PEP-specific logic
      },
      processingTime: screeningResult.processingTime + (transactionResult?.processingTime || 0),
      timestamp: new Date().toISOString(),
      providerResponse: {
        screening: screeningResult,
        transactionAnalysis: transactionResult
      }
    };

    return combinedResult;
  }

  async screenEntityWithFallback(request: AmlScreeningRequest): Promise<AmlScreeningResult[]> {
    const results: AmlScreeningResult[] = [];
    const errors: string[] = [];

    // Try all available providers
    for (const [name, provider] of this.providers) {
      try {
        logger.info(`Attempting entity screening with ${name}`, {
          entityId: request.entityId,
          entityName: request.entityName
        });

        const result = await provider.screenEntity(request);
        results.push(result);

        // If we get a critical risk result, we can return early
        if (result.riskLevel === 'CRITICAL') {
          logger.info(`Critical risk detected with ${name}, stopping fallback`, {
            entityId: request.entityId,
            riskLevel: result.riskLevel
          });
          break;
        }
      } catch (error) {
        const errorMsg = `${name} screening failed: ${(error as Error).message}`;
        errors.push(errorMsg);
        logger.warn(errorMsg, { entityId: request.entityId });
      }
    }

    if (results.length === 0) {
      throw new Error(`All AML providers failed: ${errors.join(', ')}`);
    }

    return results;
  }

  private selectProvider(request: AmlScreeningRequest | AmlTransactionAnalysisRequest): IAmlProvider | null {
    // For transaction analysis, prefer Chainalysis for crypto transactions
    if ('transactions' in request && request.transactions.some(tx =>
      tx.description?.toLowerCase().includes('crypto') ||
      tx.description?.toLowerCase().includes('bitcoin') ||
      tx.description?.toLowerCase().includes('ethereum')
    )) {
      const chainalysis = this.providers.get('chainalysis');
      if (chainalysis) return chainalysis;
    }

    // First, try the primary provider
    const primary = this.providers.get(this.primaryProvider);
    if (primary) {
      return primary;
    }

    // Fallback to any provider that supports the jurisdiction
    const jurisdiction = 'jurisdiction' in request ? request.jurisdiction : undefined;
    for (const provider of this.providers.values()) {
      if (!jurisdiction || provider.supportedJurisdictions.includes(jurisdiction) || provider.supportedJurisdictions.includes('GLOBAL')) {
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

  private selectProviderForJurisdiction(jurisdiction: Jurisdiction): IAmlProvider | null {
    // Try primary provider first if it supports the jurisdiction
    const primary = this.providers.get(this.primaryProvider);
    if (primary && primary.supportedJurisdictions.includes(jurisdiction)) {
      return primary;
    }

    // Find any provider that supports the jurisdiction
    for (const provider of this.providers.values()) {
      if (provider.supportedJurisdictions.includes(jurisdiction)) {
        return provider;
      }
    }

    return null;
  }

  private mapRiskLevel(providerRiskLevel: string): AmlRiskLevel {
    switch (providerRiskLevel) {
      case 'CRITICAL': return AmlRiskLevel.CRITICAL;
      case 'HIGH': return AmlRiskLevel.HIGH;
      case 'MEDIUM': return AmlRiskLevel.MEDIUM;
      case 'LOW': return AmlRiskLevel.LOW;
      default: return AmlRiskLevel.LOW;
    }
  }

  private mapFlags(screeningResult: AmlScreeningResult, transactionResult: AmlTransactionAnalysisResult | null): AmlFlag[] {
    const flags: AmlFlag[] = [];

    // Map screening matches to flags
    for (const match of screeningResult.matches) {
      flags.push({
        type: AmlFlagType.SANCTIONS_MATCH,
        severity: match.confidence > 0.8 ? 'HIGH' : match.confidence > 0.5 ? 'MEDIUM' : 'LOW',
        message: `Match found in ${match.listName}: ${match.matchedEntity.name}`,
        confidence: match.confidence
      });
    }

    // Map transaction risk indicators to flags
    if (transactionResult) {
      for (const indicator of transactionResult.riskIndicators) {
        flags.push({
          type: this.mapRiskIndicatorType(indicator.type),
          severity: indicator.severity,
          message: indicator.description,
          evidence: indicator.evidence
        });
      }
    }

    return flags;
  }

  private mapRiskIndicatorType(indicatorType: string): AmlFlagType {
    switch (indicatorType) {
      case 'UNUSUAL_AMOUNT': return AmlFlagType.LARGE_TRANSACTION;
      case 'FREQUENT_TRANSACTIONS': return AmlFlagType.FREQUENT_TRANSACTIONS;
      case 'HIGH_RISK_COUNTERPARTY': return AmlFlagType.HIGH_RISK_COUNTRY;
      case 'SANCTIONS_MATCH': return AmlFlagType.SANCTIONS_MATCH;
      case 'PEP_ASSOCIATION': return AmlFlagType.PEP_MATCH;
      default: return AmlFlagType.UNUSUAL_TRANSACTION_PATTERN;
    }
  }

  private generateRecommendations(screeningResult: AmlScreeningResult, transactionResult: AmlTransactionAnalysisResult | null): string[] {
    const recommendations: string[] = [];

    if (screeningResult.riskLevel === 'HIGH' || screeningResult.riskLevel === 'CRITICAL') {
      recommendations.push('Enhanced due diligence required');
      recommendations.push('Obtain additional documentation');
    }

    if (transactionResult) {
      if (transactionResult.overallRisk === 'HIGH' || transactionResult.overallRisk === 'CRITICAL') {
        recommendations.push('Review transaction patterns for suspicious activity');
        recommendations.push('Monitor account activity closely');
      }

      recommendations.push(...transactionResult.recommendations);
    }

    return recommendations;
  }
}

// Export singleton instance
export const amlProviderManager = new AmlProviderManager();