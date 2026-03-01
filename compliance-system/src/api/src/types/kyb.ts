/**
 * KYB (Know Your Business) Types
 * Type definitions for business entity verification operations
 */

import { Jurisdiction } from './kyc';

export { Jurisdiction };

export enum KybStatus {
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
}

export enum KybEntityType {
  SOLE_PROPRIETOR = 'SOLE_PROPRIETOR',
  PARTNERSHIP = 'PARTNERSHIP',
  CORPORATION = 'CORPORATION',
  LLC = 'LLC',
  COOPERATIVE = 'COOPERATIVE',
  TRUST = 'TRUST',
  JOINT_VENTURE = 'JOINT_VENTURE',
  NONPROFIT = 'NONPROFIT',
  GOVERNMENT_ENTITY = 'GOVERNMENT_ENTITY',
  FINANCIAL_INSTITUTION = 'FINANCIAL_INSTITUTION',
}

export enum KybFlagType {
  INVALID_REGISTRATION = 'INVALID_REGISTRATION',
  MISSING_DOCUMENTS = 'MISSING_DOCUMENTS',
  UBO_MISMATCH = 'UBO_MISMATCH',
  SANCTIONS_HIT = 'SANCTIONS_HIT',
  PEP_ASSOCIATED = 'PEP_ASSOCIATED',
  HIGH_RISK_JURISDICTION = 'HIGH_RISK_JURISDICTION',
  CONFLICTING_INFORMATION = 'CONFLICTING_INFORMATION',
  DUPLICATE_ENTITY = 'DUPLICATE_ENTITY',
  UNVERIFIABLE_ADDRESS = 'UNVERIFIABLE_ADDRESS',
  INACTIVE_LICENSE = 'INACTIVE_LICENSE',
  REGULATORY_ACTION = 'REGULATORY_ACTION',
}

export enum FlagSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Business document types
 */
export enum KybDocumentType {
  CERTIFICATE_OF_INCORPORATION = 'CERTIFICATE_OF_INCORPORATION',
  BOARD_RESOLUTION = 'BOARD_RESOLUTION',
  ARTICLES_OF_ASSOCIATION = 'ARTICLES_OF_ASSOCIATION',
  MEMORANDUM_OF_UNDERSTANDING = 'MEMORANDUM_OF_UNDERSTANDING',
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  COMMERCIAL_REGISTER_EXTRACT = 'COMMERCIAL_REGISTER_EXTRACT',
  DIRECTOR_RESOLUTION = 'DIRECTOR_RESOLUTION',
  UBO_DECLARATION = 'UBO_DECLARATION',
  AUDITED_FINANCIALS = 'AUDITED_FINANCIALS',
  COMPANY_REGISTRATION_ID = 'COMPANY_REGISTRATION_ID',
  TAX_REGISTRATION_CERTIFICATE = 'TAX_REGISTRATION_CERTIFICATE',
  BANK_REFERENCE_LETTER = 'BANK_REFERENCE_LETTER',
}

export interface KybDocument {
  type: KybDocumentType;
  data: string; // base64 encoded
  metadata: {
    filename: string;
    contentType: string;
    size: number;
    uploadedAt: string;
  };
}

export interface BusinessAddress {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isPrimary: boolean;
  verifiedAt?: string;
}

export interface UltimatelyBeneficialOwner {
  id: string;
  name: string;
  dateOfBirth: string;
  nationality: string;
  ownershipPercentage: number;
  roleInCompany: string;
  isPoliticallyExposed?: boolean;
  address: BusinessAddress;
  identificationNumber?: string; // Passport, ID, etc
  verifiedAt?: string;
}

export interface Director {
  id: string;
  name: string;
  dateOfBirth: string;
  nationality: string;
  position: string;
  appointmentDate: string;
  resignationDate?: string;
  address: BusinessAddress;
}

export interface KybEntityData {
  businessId: string;
  registrationNumber: string;
  businessName: string;
  entityType: KybEntityType;
  dateOfIncorporation: string;
  jurisdiction: Jurisdiction;
  primaryAddress: BusinessAddress;
  secondaryAddresses?: BusinessAddress[];
  registeredAgent?: {
    name: string;
    address: BusinessAddress;
  };
  numberOfEmployees?: number;
  annualRevenue?: number;
  businessDescription: string;
  website?: string;
  email?: string;
  phoneNumber?: string;
  taxId?: string;
  businessLicenseNumber?: string;
  ultimatelyBeneficialOwners: UltimatelyBeneficialOwner[];
  directors?: Director[];
  shareholders?: Array<{
    name: string;
    ownershipPercentage: number;
  }>;
}

export interface KybFlag {
  type: KybFlagType;
  severity: FlagSeverity;
  message: string;
  reason?: string;
  details?: string;
  evidence?: any;
  confidence?: number; // 0-1
  ruleApplied?: string;
}

export interface SanctionMatch {
  sanctionListName: string;
  matchedName: string;
  matchScore: number; // 0-100
  confidence: number; // 0-1
  jurisdiction?: string;
  associatedNames?: string[];
}

export interface RegistrationValidation {
  isValid: boolean;
  registrationVerified?: boolean;
  registrationNumber: string;
  registeredName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DISSOLVED';
  registrationDate: string;
  lastUpdatedDate: string;
  dataSource: string;
  errors?: string[];
  flags?: string[];
}

export interface UBOVerification {
  isVerified: boolean;
  ubos: UltimatelyBeneficialOwner[];
  disclosureGaps: string[];
  confidence: number; // 0-100
  flags: KybFlag[];
}

export interface SanctionScreeningResult {
  hasSanctionMatches: boolean;
  matches: SanctionMatch[];
  sanctionedMatches?: Array<SanctionMatch & { sanctionsList?: string }>;
  screenedLists: string[];
  screeningTimestamp: string;
  nextScreeningDue: string; // 30-90 days from now
}

export interface KybCheckRequest {
  businessId: string;
  jurisdiction: Jurisdiction;
  documents: KybDocument[];
  entityData: KybEntityData;
  userId?: string; // Officer performing the check
  skipDocumentVerification?: boolean; // For bulk imports
  skipSanctionsScreening?: boolean; // Testing mode
}

export interface KybCheckResult {
  checkId: string;
  businessId: string;
  jurisdiction: Jurisdiction;
  status: KybStatus;
  score: number; // 0-100, higher = more risk
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flags: KybFlag[];
  registrationValidation: RegistrationValidation;
  uboVerification: UBOVerification;
  sanctionScreening: SanctionScreeningResult;
  recommendations: string[];
  processingTime: number; // milliseconds
  timestamp: string;
  nextReviewDue: string;
  verifiedFields: {
    registrationNumber: boolean;
    businessName: boolean;
    primaryAddress: boolean;
    ubos: boolean;
    directors: boolean;
  };
  explanations: {
    reasonForStatus: string;
    keyRisks: string[];
    regulatoryRules: string[];
  };
  jurisdictionRules?: string[];
  auditTrail?: Array<{
    timestamp: string;
    action: string;
    userId: string;
    status: 'success' | 'failure';
  }>;
}

export interface KybCheckRecord extends KybCheckResult {
  entityData: KybEntityData;
  documents: KybDocument[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface KybRiskScore {
  entityId: string;
  score?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  overallScore: number;
  registrationRisk: number; // 0-100
  uboRisk: number; // 0-100
  sanctionRisk: number; // 0-100
  jurisdictionRisk: number; // 0-100
  financialRisk?: number; // 0-100
  historicalRisk?: number; // Based on past flags
  calculatedAt: string;
  nextCalculation: string;
}

export interface ContinuousMonitoringRequest {
  businessId: string;
  jurisdiction: Jurisdiction;
  monitoringFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  screeningScope: Array<'SANCTIONS' | 'NEWS' | 'REGULATORY_ACTIONS' | 'UBO_CHANGES'>;
  alertThreshold: number; // 0-100
}

export interface ContinuousMonitoringAlert {
  businessId: string;
  alertId: string;
  alertType: 'SANCTIONS_HIT' | 'NEWS_MENTION' | 'REGULATORY_ACTION' | 'UBO_CHANGE';
  severity: FlagSeverity;
  description: string;
  evidence: any;
  generatedAt: string;
  requiresAction: boolean;
  actionRequired?: string;
}

export interface BulkKybImport {
  importId: string;
  totalEntities: number;
  successCount: number;
  failureCount: number;
  warnings: string[];
  processedAt: string;
  results: Array<{
    businessId: string;
    status: 'SUCCESS' | 'FAILED' | 'WARNING';
    checkId?: string;
    error?: string;
  }>;
}
