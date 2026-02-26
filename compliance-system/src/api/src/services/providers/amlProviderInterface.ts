/**
 * AML Provider Service Interfaces
 * Abstractions for AML/sanctions provider integrations
 */

export interface AmlProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface AmlScreeningRequest {
  entityId: string;
  entityName: string;
  entityType: 'individual' | 'organization';
  jurisdiction?: string;
  additionalInfo?: {
    dateOfBirth?: string;
    country?: string;
    aliases?: string[];
  };
}

export interface AmlTransactionAnalysisRequest {
  entityId: string;
  transactions: Array<{
    amount: number;
    currency: string;
    counterparty: string;
    timestamp: string;
    description?: string;
    type: 'credit' | 'debit' | 'transfer';
  }>;
  analysisPeriod?: {
    startDate: string;
    endDate: string;
  };
}

export interface AmlScreeningResult {
  provider: string;
  entityId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  matches: AmlMatch[];
  sanctionsLists: string[];
  processingTime: number;
  rawResponse?: any;
}

export interface AmlTransactionAnalysisResult {
  provider: string;
  entityId: string;
  riskIndicators: AmlRiskIndicator[];
  patterns: AmlPattern[];
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
  processingTime: number;
  rawResponse?: any;
}

export interface AmlMatch {
  listName: string;
  matchType: 'EXACT' | 'FUZZY' | 'PARTIAL';
  confidence: number;
  matchedEntity: {
    name: string;
    aliases?: string[];
    country?: string;
    sanctionsType?: string;
  };
  details?: any;
}

export interface AmlRiskIndicator {
  type:
    | 'UNUSUAL_AMOUNT'
    | 'FREQUENT_TRANSACTIONS'
    | 'HIGH_RISK_COUNTERPARTY'
    | 'SANCTIONS_MATCH'
    | 'PEP_ASSOCIATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence: any;
}

export interface AmlPattern {
  type: 'STRUCTURING' | 'SMURFING' | 'ROUND_DOLLAR' | 'RAPID_MOVEMENT' | 'HIGH_FREQUENCY';
  confidence: number;
  description: string;
  transactions: string[]; // transaction IDs
}

export interface IAmlProvider {
  name: string;
  supportedJurisdictions: string[];

  screenEntity(request: AmlScreeningRequest): Promise<AmlScreeningResult>;
  analyzeTransactions(
    request: AmlTransactionAnalysisRequest
  ): Promise<AmlTransactionAnalysisResult>;
  isHealthy(): Promise<boolean>;
  getCapabilities(): Promise<{
    supportedLists: string[];
    supportedJurisdictions: string[];
    features: string[];
  }>;
}
