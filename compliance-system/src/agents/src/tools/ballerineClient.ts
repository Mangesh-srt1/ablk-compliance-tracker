/**
 * Ballerine Client
 * Integration with Ballerine for KYC verification
 */

import axios, { AxiosInstance } from 'axios';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ballerine-client.log' }),
  ],
});

export interface BallerineWorkflowData {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  documents: any[];
  workflowType: string;
}

export interface BallerineWorkflowResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  documentVerification?: {
    status: 'approved' | 'rejected' | 'pending';
    reasons?: string[];
  };
  biometricVerification?: {
    status: 'approved' | 'rejected' | 'pending';
    reasons?: string[];
  };
  addressVerification?: {
    status: 'approved' | 'rejected' | 'pending';
    reasons?: string[];
  };
  sanctionsCheck?: {
    hit: boolean;
    matches?: any[];
  };
  pepCheck?: {
    hit: boolean;
    matches?: any[];
  };
}

export class BallerineClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.BALLERINE_API_KEY || '';
    this.baseUrl = process.env.BALLERINE_BASE_URL || 'https://api.ballerine.io/v1';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Ballerine API error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  /**
   * Create a new KYC workflow
   */
  async createWorkflow(workflowData: BallerineWorkflowData): Promise<BallerineWorkflowResult> {
    try {
      logger.info('Creating Ballerine workflow', {
        customerId: workflowData.customer.id,
        workflowType: workflowData.workflowType,
      });

      const response = await this.client.post('/workflows', {
        type: workflowData.workflowType,
        customer: workflowData.customer,
        documents: workflowData.documents,
        config: {
          enableDocumentVerification: true,
          enableBiometricVerification: true,
          enableAddressVerification: true,
          enableSanctionsCheck: true,
          enablePepCheck: true,
        },
      });

      const workflow = response.data;

      logger.info('Ballerine workflow created', {
        workflowId: workflow.id,
        customerId: workflowData.customer.id,
      });

      return this.mapWorkflowResponse(workflow);
    } catch (error) {
      logger.error('Failed to create Ballerine workflow', {
        customerId: workflowData.customer.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<BallerineWorkflowResult> {
    try {
      logger.info('Getting Ballerine workflow status', { workflowId });

      const response = await this.client.get(`/workflows/${workflowId}`);

      const workflow = response.data;

      logger.info('Ballerine workflow status retrieved', {
        workflowId,
        status: workflow.status,
      });

      return this.mapWorkflowResponse(workflow);
    } catch (error) {
      logger.error('Failed to get Ballerine workflow status', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update workflow with additional documents
   */
  async updateWorkflow(workflowId: string, documents: any[]): Promise<void> {
    try {
      logger.info('Updating Ballerine workflow', {
        workflowId,
        documentCount: documents.length,
      });

      await this.client.patch(`/workflows/${workflowId}`, {
        documents,
      });

      logger.info('Ballerine workflow updated', { workflowId });
    } catch (error) {
      logger.error('Failed to update Ballerine workflow', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Submit document for verification
   */
  async submitDocument(workflowId: string, documentType: string, documentData: any): Promise<void> {
    try {
      logger.info('Submitting document to Ballerine', {
        workflowId,
        documentType,
      });

      await this.client.post(`/workflows/${workflowId}/documents`, {
        type: documentType,
        data: documentData,
      });

      logger.info('Document submitted to Ballerine', {
        workflowId,
        documentType,
      });
    } catch (error) {
      logger.error('Failed to submit document to Ballerine', {
        workflowId,
        documentType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get supported document types
   */
  getSupportedDocumentTypes(): string[] {
    return [
      'passport',
      'national_id',
      'drivers_license',
      'utility_bill',
      'bank_statement',
      'proof_of_address',
      'selfie',
    ];
  }

  /**
   * Map API response to internal format
   */
  private mapWorkflowResponse(apiResponse: any): BallerineWorkflowResult {
    return {
      id: apiResponse.id,
      status: apiResponse.status,
      documentVerification: apiResponse.verifications?.document
        ? {
            status: apiResponse.verifications.document.status,
            reasons: apiResponse.verifications.document.reasons,
          }
        : undefined,
      biometricVerification: apiResponse.verifications?.biometric
        ? {
            status: apiResponse.verifications.biometric.status,
            reasons: apiResponse.verifications.biometric.reasons,
          }
        : undefined,
      addressVerification: apiResponse.verifications?.address
        ? {
            status: apiResponse.verifications.address.status,
            reasons: apiResponse.verifications.address.reasons,
          }
        : undefined,
      sanctionsCheck: apiResponse.checks?.sanctions
        ? {
            hit: apiResponse.checks.sanctions.hit,
            matches: apiResponse.checks.sanctions.matches,
          }
        : undefined,
      pepCheck: apiResponse.checks?.pep
        ? {
            hit: apiResponse.checks.pep.hit,
            matches: apiResponse.checks.pep.matches,
          }
        : undefined,
    };
  }

  /**
   * Check if client is properly configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl);
  }

  /**
   * Get client health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; latency?: number }> {
    try {
      const startTime = Date.now();
      await this.client.get('/health');
      const latency = Date.now() - startTime;

      return { healthy: true, latency };
    } catch (error) {
      logger.error('Ballerine health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return { healthy: false };
    }
  }
}
