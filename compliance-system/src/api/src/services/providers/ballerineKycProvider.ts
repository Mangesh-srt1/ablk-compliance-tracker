/**
 * Ballerine KYC Provider Implementation
 * AI-powered KYC verification for global markets
 */

import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import {
  IKycProvider,
  KycProviderConfig,
  KycVerificationRequest,
  KycVerificationResult,
  KycFlag,
} from './kycProviderInterface';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ballerine-kyc.log' }),
  ],
});

export class BallerineKycProvider implements IKycProvider {
  public readonly name = 'Ballerine';
  public readonly supportedJurisdictions = ['IN', 'EU', 'US'];

  private client: AxiosInstance;
  private config: KycProviderConfig;

  constructor(config: KycProviderConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Ballerine API Request', {
          url: config.url,
          method: config.method,
          entityId: config.data?.entityId,
        });
        return config;
      },
      (error) => {
        logger.error('Ballerine API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Ballerine API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Ballerine API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  async verify(request: KycVerificationRequest): Promise<KycVerificationResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting Ballerine KYC verification', {
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        documentCount: request.documents.length,
      });

      // Prepare the verification payload
      const payload = {
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        entityData: request.entityData,
        documents: request.documents.map((doc) => ({
          type: doc.type,
          data: doc.data,
          filename: doc.filename,
          contentType: doc.contentType,
        })),
      };

      // Make the API call with retry logic
      let response;
      let attempt = 0;
      while (attempt < this.config.retries) {
        try {
          response = await this.client.post('/api/v1/kyc/verify', payload);
          break;
        } catch (error: any) {
          attempt++;
          if (attempt >= this.config.retries) {
            throw error;
          }
          logger.warn(`Ballerine API call failed, retrying (${attempt}/${this.config.retries})`, {
            error: error.message,
            entityId: request.entityId,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }

      const processingTime = Date.now() - startTime;

      // Parse the response and create flags
      const flags = this.parseFlags(response.data);
      const verified =
        response.data.verified && flags.filter((f) => f.severity === 'CRITICAL').length === 0;

      const result: KycVerificationResult = {
        provider: this.name,
        verified,
        confidence: response.data.confidence || 0.95,
        flags,
        extractedData: response.data.extractedData,
        processingTime,
        rawResponse: response.data,
      };

      logger.info('Ballerine KYC verification completed', {
        entityId: request.entityId,
        verified: result.verified,
        confidence: result.confidence,
        flagCount: flags.length,
        processingTime,
      });

      return result;
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error('Ballerine KYC verification failed', {
        entityId: request.entityId,
        error: error.message,
        processingTime,
      });

      // Return failed result with critical flag
      return {
        provider: this.name,
        verified: false,
        confidence: 0,
        flags: [
          {
            type: 'DOCUMENT_INVALID',
            severity: 'CRITICAL',
            message: `Verification failed: ${error.message}`,
            details: { error: error.message },
          },
        ],
        processingTime,
        rawResponse: error.response?.data,
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/health');
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      logger.error('Ballerine health check failed', { error: (error as Error).message });
      return false;
    }
  }

  async getCapabilities(): Promise<{
    supportedDocuments: string[];
    supportedJurisdictions: string[];
    features: string[];
  }> {
    try {
      const response = await this.client.get('/api/v1/capabilities');
      return {
        supportedDocuments: response.data.supportedDocuments || [
          'aadhaar',
          'passport',
          'drivers_license',
          'national_id',
        ],
        supportedJurisdictions: response.data.supportedJurisdictions || this.supportedJurisdictions,
        features: response.data.features || [
          'document_verification',
          'biometric_check',
          'liveness_detection',
        ],
      };
    } catch (error) {
      logger.warn('Failed to get Ballerine capabilities, using defaults', {
        error: (error as Error).message,
      });
      return {
        supportedDocuments: ['aadhaar', 'passport', 'drivers_license', 'national_id'],
        supportedJurisdictions: this.supportedJurisdictions,
        features: ['document_verification', 'biometric_check', 'liveness_detection'],
      };
    }
  }

  private parseFlags(responseData: any): KycFlag[] {
    const flags: KycFlag[] = [];

    if (!responseData) {
      return flags;
    }

    // Parse document validation flags
    if (responseData.documentValidation) {
      const docValidation = responseData.documentValidation;

      if (!docValidation.isValid) {
        flags.push({
          type: 'DOCUMENT_INVALID',
          severity: 'CRITICAL',
          message: 'Document validation failed',
          details: docValidation.errors,
        });
      }

      if (docValidation.isExpired) {
        flags.push({
          type: 'DOCUMENT_EXPIRED',
          severity: 'HIGH',
          message: 'Document has expired',
          details: { expiryDate: docValidation.expiryDate },
        });
      }
    }

    // Parse biometric/face matching flags
    if (responseData.biometricCheck) {
      const biometric = responseData.biometricCheck;

      if (!biometric.faceMatch) {
        flags.push({
          type: 'FACE_NOT_MATCHED',
          severity: 'HIGH',
          message: 'Face does not match document photo',
          details: { confidence: biometric.confidence },
        });
      }
    }

    // Parse data consistency flags
    if (responseData.dataConsistency) {
      const consistency = responseData.dataConsistency;

      if (!consistency.nameMatch) {
        flags.push({
          type: 'NAME_MISMATCH',
          severity: 'MEDIUM',
          message: 'Name does not match between documents',
          details: consistency.nameDifferences,
        });
      }

      if (!consistency.addressMatch) {
        flags.push({
          type: 'ADDRESS_MISMATCH',
          severity: 'LOW',
          message: 'Address inconsistencies detected',
          details: consistency.addressDifferences,
        });
      }

      if (consistency.ageUnderage) {
        flags.push({
          type: 'AGE_UNDERAGE',
          severity: 'CRITICAL',
          message: 'Entity appears to be underage',
          details: { age: consistency.calculatedAge },
        });
      }
    }

    return flags;
  }
}
