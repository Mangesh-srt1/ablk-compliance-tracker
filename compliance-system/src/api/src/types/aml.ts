/**
 * AML (Anti-Money Laundering) Types
 * Type definitions for AML risk scoring operations
 */

import { Jurisdiction } from './kyc';

export { Jurisdiction };

export enum AmlRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AmlFlagType {
  SANCTIONS_MATCH = 'SANCTIONS_MATCH',
  PEP_MATCH = 'PEP_MATCH',
  HIGH_RISK_COUNTRY = 'HIGH_RISK_COUNTRY',
  UNUSUAL_TRANSACTION_PATTERN = 'UNUSUAL_TRANSACTION_PATTERN',
  LARGE_TRANSACTION = 'LARGE_TRANSACTION',
  FREQUENT_TRANSACTIONS = 'FREQUENT_TRANSACTIONS',
  ROUND_NUMBER_TRANSACTIONS = 'ROUND_NUMBER_TRANSACTIONS',
  STRUCTURING_SUSPICION = 'STRUCTURING_SUSPICION',
  SOURCE_OF_FUNDS_UNCLEAR = 'SOURCE_OF_FUNDS_UNCLEAR'
}

export enum ScreeningResult {
  CLEAR = 'CLEAR',
  HIT = 'HIT',
  PENDING = 'PENDING',
  ERROR = 'ERROR'
}

export interface AmlTransaction {
  id: string;
  amount: number;
  currency: string;
  counterparty: string;
  counterpartyId?: string;
  timestamp: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'exchange';
  description?: string;
  location?: string;
}

export interface AmlEntityData {
  name: string;
  country: string;
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
}

export interface AmlCheckRecord extends AmlCheckResult {
  transactions: AmlTransaction[];
  entityData: AmlEntityData;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}