/**
 * KYC Provider Service Interfaces
 * Abstractions for KYC provider integrations
 */

export interface KycProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retries: number;
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
  filename: string;
  contentType: string;
}

export interface KycVerificationRequest {
  entityId: string;
  jurisdiction: 'IN' | 'EU' | 'US';
  documents: KycDocument[];
  entityData: {
    name: string;
    dateOfBirth?: string;
    address?: string;
    phoneNumber?: string;
    email?: string;
  };
}

export interface KycVerificationResult {
  provider: string;
  verified: boolean;
  confidence: number;
  flags: KycFlag[];
  extractedData?: {
    name?: string;
    dateOfBirth?: string;
    address?: string;
    documentNumber?: string;
  };
  processingTime: number;
  rawResponse?: any;
}

export interface KycFlag {
  type:
    | 'DOCUMENT_INVALID'
    | 'NAME_MISMATCH'
    | 'AGE_UNDERAGE'
    | 'ADDRESS_MISMATCH'
    | 'DOCUMENT_EXPIRED'
    | 'FACE_NOT_MATCHED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: any;
}

export interface IKycProvider {
  name: string;
  supportedJurisdictions: string[];

  verify(request: KycVerificationRequest): Promise<KycVerificationResult>;
  isHealthy(): Promise<boolean>;
  getCapabilities(): Promise<{
    supportedDocuments: string[];
    supportedJurisdictions: string[];
    features: string[];
  }>;
}
