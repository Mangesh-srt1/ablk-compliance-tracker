/**
 * Jumio KYC Provider Implementation
 * High-accuracy KYC verification with biometric support
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import winston from 'winston';
import {
  IKycProvider,
  KycProviderConfig,
  KycVerificationRequest,
  KycVerificationResult,
  KycFlag
} from './kycProviderInterface';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/jumio-kyc.log' })
  ]
});

export class JumioKycProvider implements IKycProvider {
  public readonly name = 'Jumio';
  public readonly supportedJurisdictions = ['IN', 'EU', 'US'];

  private client: AxiosInstance;
  private config: KycProviderConfig;
  private apiSecret: string;

  constructor(config: KycProviderConfig, apiSecret: string) {
    this.config = config;
    this.apiSecret = apiSecret;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Ableka-Lumina/1.0'
      }
    });

    // Add request/response interceptors for logging and auth
    this.client.interceptors.request.use(
      (config) => {
        // Generate Jumio authorization header
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(16).toString('hex');
        const method = config.method?.toUpperCase() || 'GET';
        const path = config.url || '';

        const signature = this.generateSignature(method, path, timestamp, nonce, config.data);

        config.headers = {
          ...config.headers,
          'Authorization': `Jumio ${this.config.apiKey}:${signature}`,
          'X-Jumio-Timestamp': timestamp.toString(),
          'X-Jumio-Nonce': nonce
        } as any;

        logger.debug('Jumio API Request', {
          url: config.url,
          method: config.method,
          entityId: config.data?.entityId
        });
        return config;
      },
      (error) => {
        logger.error('Jumio API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Jumio API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Jumio API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  async verify(request: KycVerificationRequest): Promise<KycVerificationResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting Jumio KYC verification', {
        entityId: request.entityId,
        jurisdiction: request.jurisdiction,
        documentCount: request.documents.length
      });

      // Prepare the verification payload for Jumio
      const payload = {
        customerInternalReference: request.entityId,
        userReference: request.entityId,
        country: this.mapJurisdictionToCountry(request.jurisdiction),
        merchantIdScanReference: `scan_${request.entityId}_${Date.now()}`,
        frontsideImage: this.extractDocumentImage(request.documents, 'front'),
        backsideImage: this.extractDocumentImage(request.documents, 'back'),
        faceImage: this.extractDocumentImage(request.documents, 'face'),
        callbackUrl: process.env.JUMIO_CALLBACK_URL || 'https://api.ableka-lumina.com/webhooks/jumio'
      };

      // Make the API call with retry logic
      let response: any;
      let attempt = 0;
      while (attempt < this.config.retries) {
        try {
          response = await this.client.post('/api/v1/initiate', payload);
          break;
        } catch (error: any) {
          attempt++;
          if (attempt >= this.config.retries) {
            throw error;
          }
          logger.warn(`Jumio API call failed, retrying (${attempt}/${this.config.retries})`, {
            error: error.message,
            entityId: request.entityId
          });
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (!response) {
        throw new Error('Failed to get response from Jumio API');
      }

      const processingTime = Date.now() - startTime;

      // For Jumio, we typically get a transaction reference and need to poll for results
      // For this implementation, we'll simulate the result based on the response
      const flags = this.parseJumioFlags(response.data);
      const verified = response.data.verified && flags.filter(f => f.severity === 'CRITICAL').length === 0;

      const result: KycVerificationResult = {
        provider: this.name,
        verified,
        confidence: response.data.confidence || 0.98, // Jumio typically has higher accuracy
        flags,
        extractedData: response.data.extractedData,
        processingTime,
        rawResponse: response.data
      };

      logger.info('Jumio KYC verification completed', {
        entityId: request.entityId,
        verified: result.verified,
        confidence: result.confidence,
        flagCount: flags.length,
        processingTime
      });

      return result;

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error('Jumio KYC verification failed', {
        entityId: request.entityId,
        error: error.message,
        processingTime
      });

      return {
        provider: this.name,
        verified: false,
        confidence: 0,
        flags: [{
          type: 'DOCUMENT_INVALID',
          severity: 'CRITICAL',
          message: `Verification failed: ${error.message}`,
          details: { error: error.message }
        }],
        processingTime,
        rawResponse: error.response?.data
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/health');
      return response.status === 200 && response.data.status === 'OK';
    } catch (error) {
      logger.error('Jumio health check failed', { error: (error as Error).message });
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
        supportedDocuments: response.data.supportedDocuments || ['passport', 'drivers_license', 'national_id', 'aadhaar'],
        supportedJurisdictions: response.data.supportedCountries || this.supportedJurisdictions,
        features: response.data.features || ['document_verification', 'biometric_check', 'liveness_detection', 'face_matching']
      };
    } catch (error) {
      logger.warn('Failed to get Jumio capabilities, using defaults', { error: (error as Error).message });
      return {
        supportedDocuments: ['passport', 'drivers_license', 'national_id', 'aadhaar'],
        supportedJurisdictions: this.supportedJurisdictions,
        features: ['document_verification', 'biometric_check', 'liveness_detection', 'face_matching']
      };
    }
  }

  private generateSignature(method: string, path: string, timestamp: number, nonce: string, data?: any): string {
    const body = data ? JSON.stringify(data) : '';
    const message = `${method}${path}${timestamp}${nonce}${body}`;

    return crypto.createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  private mapJurisdictionToCountry(jurisdiction: string): string {
    const countryMap: { [key: string]: string } = {
      'IN': 'IND',
      'EU': 'DEU', // Default to Germany for EU
      'US': 'USA'
    };
    return countryMap[jurisdiction] || 'USA';
  }

  private extractDocumentImage(documents: any[], side: string): string | undefined {
    // Find the appropriate document image based on side
    // This is a simplified implementation
    const document = documents.find(doc => doc.type.includes(side) || doc.filename.includes(side));
    return document?.data;
  }

  private parseJumioFlags(responseData: any): KycFlag[] {
    const flags: KycFlag[] = [];

    if (!responseData) {return flags;}

    // Parse Jumio-specific rejection reasons
    if (responseData.rejectionReason) {
      const rejection = responseData.rejectionReason;

      switch (rejection.code) {
        case '100': // Document expired
          flags.push({
            type: 'DOCUMENT_EXPIRED',
            severity: 'HIGH',
            message: 'Document has expired',
            details: rejection.details
          });
          break;
        case '200': // Document not readable
          flags.push({
            type: 'DOCUMENT_INVALID',
            severity: 'CRITICAL',
            message: 'Document is not readable or valid',
            details: rejection.details
          });
          break;
        case '300': // Face not found
          flags.push({
            type: 'FACE_NOT_MATCHED',
            severity: 'HIGH',
            message: 'Face image not found or not clear',
            details: rejection.details
          });
          break;
        case '400': // Underage
          flags.push({
            type: 'AGE_UNDERAGE',
            severity: 'CRITICAL',
            message: 'Individual appears to be underage',
            details: rejection.details
          });
          break;
        default:
          flags.push({
            type: 'DOCUMENT_INVALID',
            severity: 'MEDIUM',
            message: `Document verification issue: ${rejection.message}`,
            details: rejection.details
          });
      }
    }

    // Parse identity verification results
    if (responseData.identityVerification) {
      const identity = responseData.identityVerification;

      if (!identity.nameMatch) {
        flags.push({
          type: 'NAME_MISMATCH',
          severity: 'MEDIUM',
          message: 'Name verification failed',
          details: identity.nameCheckDetails
        });
      }

      if (!identity.addressMatch) {
        flags.push({
          type: 'ADDRESS_MISMATCH',
          severity: 'LOW',
          message: 'Address verification failed',
          details: identity.addressCheckDetails
        });
      }
    }

    return flags;
  }
}