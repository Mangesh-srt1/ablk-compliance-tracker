/**
 * KYC (Know Your Customer) Types
 * Type definitions for KYC verification operations
 */

export enum Jurisdiction {
  INDIA = 'IN',
  EUROPEAN_UNION = 'EU',
  UNITED_STATES = 'US',
}

export enum KycStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PENDING = 'PENDING',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
}

export enum KycFlagType {
  DOCUMENT_EXPIRED = 'DOCUMENT_EXPIRED',
  DOCUMENT_INVALID = 'DOCUMENT_INVALID',
  NAME_MISMATCH = 'NAME_MISMATCH',
  AGE_UNDERAGE = 'AGE_UNDERAGE',
  ADDRESS_MISMATCH = 'ADDRESS_MISMATCH',
  DUPLICATE_ENTITY = 'DUPLICATE_ENTITY',
  SANCTIONS_MATCH = 'SANCTIONS_MATCH',
  PEP_MATCH = 'PEP_MATCH',
}

export enum FlagSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface KycDocument {
  type:
    | 'aadhaar'
    | 'passport'
    | 'drivers_license'
    | 'national_id'
    | 'utility_bill'
    | 'bank_statement';
  data: string; // base64 encoded
  metadata: {
    filename: string;
    contentType: string;
    size: number;
  };
}

export interface KycEntityData {
  name: string;
  dateOfBirth?: string;
  address?: string;
  nationality?: string;
  phoneNumber?: string;
  email?: string;
  occupation?: string;
}

export interface KycFlag {
  type: KycFlagType;
  severity: FlagSeverity;
  message: string;
  details?: string;
  evidence?: any;
}

export interface KycCheckRequest {
  entityId: string;
  jurisdiction: Jurisdiction;
  documents: KycDocument[];
  entityData: KycEntityData;
  apiKey?: string; // For external API access
}

export interface KycCheckResult {
  checkId: string;
  entityId: string;
  jurisdiction: Jurisdiction;
  status: KycStatus;
  score: number; // 0-100
  flags: KycFlag[];
  recommendations: string[];
  processingTime: number; // milliseconds
  timestamp: string;
  providerResponse?: any; // Response from external KYC provider
}

export interface KycCheckRecord extends KycCheckResult {
  documents: KycDocument[];
  entityData: KycEntityData;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
