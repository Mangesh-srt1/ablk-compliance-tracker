/**
 * AML (Anti-Money Laundering) Types
 * Type definitions for AML risk scoring operations
 */

import { Jurisdiction } from './kyc';

export { Jurisdiction };

export enum AmlRiskLevel {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export enum AmlFlagType {
  SANCTIONS_MATCH = 'SANCTIONS_MATCH',
  PEP_MATCH = 'PEP_MATCH',
  HIGH_RISK_COUNTRY = 'HIGH_RISK_COUNTRY',
  UNUSUAL_TRANSACTION_PATTERN = 'UNUSUAL_TRANSACTION_PATTERN',
  LARGE_TRANSACTION = 'LARGE_TRANSACTION',
  FREQUENT_TRANSACTIONS = 'FREQUENT_TRANSACTIONS',
  VELOCITY_ANOMALY = 'VELOCITY_ANOMALY',
  ROUND_NUMBER_TRANSACTIONS = 'ROUND_NUMBER_TRANSACTIONS',
  STRUCTURING = 'STRUCTURING',
  STRUCTURING_SUSPICION = 'STRUCTURING_SUSPICION',
  SOURCE_OF_FUNDS_UNCLEAR = 'SOURCE_OF_FUNDS_UNCLEAR',
}

export enum ScreeningResult {
  CLEAR = 'CLEAR',
  HIT = 'HIT',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
}

export interface AmlTransaction {
  // Standard AML fields
  id?: string;
  currency?: string;
  counterparty?: string;
  
  // Blockchain transaction fields (alternate format)
  txHash?: string;
  from?: string;
  to?: string;
  
  // Common fields (type can be string for flexibility with test data)
  amount: number;
  timestamp: number | string;
  type?: string | 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'exchange';
  counterpartyId?: string;
  description?: string;
  location?: string;
}

export interface AmlEntityData {
  // Standard fields
  name?: string;
  country?: string;
  
  // Alternate fields (from tests)
  fullName?: string;
  walletAddress?: string;
  blockchainAddress?: string; // Blockchain-specific address
  
  // Optional fields
  occupation?: string;
  sourceOfFunds?: string;
  businessType?: string;
  isPep?: boolean;
  isSanctioned?: boolean;
}

export interface AmlFlag {
  type: AmlFlagType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: string;
  evidence?: any;
  confidence?: number; // 0-1
}

export interface ScreeningResults {
  ofac: ScreeningResult;
  euSanctions: ScreeningResult;
  pep: ScreeningResult;
  sanctionsMatch?: boolean; // For test compatibility
  interpol?: ScreeningResult;
  unSc?: ScreeningResult;
}

export interface AmlCheckRequest {
  entityId: string;
  jurisdiction: Jurisdiction;
  transactions: AmlTransaction[];
  entityData: AmlEntityData;
  apiKey?: string; // For external API access
}

export interface AmlCheckResult {
  checkId: string;
  entityId: string;
  jurisdiction: Jurisdiction;
  score: number; // 0-100
  riskLevel: AmlRiskLevel;
  flags: AmlFlag[];
  recommendations: string[];
  screeningResults: ScreeningResults;
  processingTime: number; // milliseconds
  timestamp: string;
  providerResponse?: any; // Response from external AML provider
  metadata?: {
    screeningConfidence: number;
    analysisCompletedAt: string;
    dataQuality: 'COMPLETE' | 'PARTIAL';
  };
}

export interface AmlCheckRecord extends AmlCheckResult {
  transactions: AmlTransaction[];
  entityData: AmlEntityData;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
