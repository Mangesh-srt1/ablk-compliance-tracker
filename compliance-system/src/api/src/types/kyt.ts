/**
 * KYT (Know Your Transaction) Types
 * Type definitions for real-time transaction monitoring and anomaly detection.
 */

import { Jurisdiction } from './aml';

export enum KytRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum KytAlertType {
  AMOUNT_ANOMALY = 'AMOUNT_ANOMALY',
  VELOCITY_ANOMALY = 'VELOCITY_ANOMALY',
  COUNTERPARTY_RISK = 'COUNTERPARTY_RISK',
  GEO_ANOMALY = 'GEO_ANOMALY',
  STRUCTURING_PATTERN = 'STRUCTURING_PATTERN',
  ROUND_TRIP_PATTERN = 'ROUND_TRIP_PATTERN',
  BEHAVIORAL_SHIFT = 'BEHAVIORAL_SHIFT',
}

export interface KytTransaction {
  id: string;
  amount: number;
  currency: string;
  timestamp: string;
  fromAddress?: string;
  toAddress?: string;
  counterparty?: string;
  country?: string;
  type?: string;
}

export interface KytBaselineProfile {
  avgAmount: number;
  stdDevAmount: number;
  avgDailyCount: number;
  commonCountries: string[];
  knownCounterparties: string[];
}

export interface KytAlert {
  type: KytAlertType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  confidence: number; // 0-1
  evidence?: Record<string, any>;
}

export interface KytCheckRequest {
  entityId: string;
  jurisdiction: Jurisdiction;
  transactions: KytTransaction[];
  baseline?: KytBaselineProfile;
}

export interface KytCheckResult {
  checkId: string;
  entityId: string;
  jurisdiction: Jurisdiction;
  score: number; // 0-100
  riskLevel: KytRiskLevel;
  alerts: KytAlert[];
  recommendations: string[];
  analyzedTransactions: number;
  processingTime: number;
  timestamp: string;
}
