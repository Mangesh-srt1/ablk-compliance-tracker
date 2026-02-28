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
      if (error instanceof Error) throw error;
      throw new Error((error as any)?.message || 'Failed to create Ballerine workflow');
    }
  }

  /**
   * Get workflow status (with retry on transient network errors)
   */
  async getWorkflowStatus(workflowId: string, retries = 2): Promise<BallerineWorkflowResult> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.info('Getting Ballerine workflow status', { workflowId, attempt });

        const response = await this.client.get(`/workflows/${workflowId}`);
        const workflow = response.data;

        logger.info('Ballerine workflow status retrieved', { workflowId, status: workflow.status });

        return this.mapWorkflowResponse(workflow);
      } catch (error: any) {
        // Retry on transient network errors
        const isTransient = error?.code === 'ECONNABORTED' || error?.code === 'ECONNRESET' || error?.message === 'Network timeout';
        if (isTransient && attempt < retries) {
          await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
          continue;
        }
        logger.error('Failed to get Ballerine workflow status', {
          workflowId,
          error: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof Error) throw error;
        throw new Error((error as any)?.message || 'Failed to get Ballerine workflow status');
      }
    }
    throw new Error('Failed to get workflow status after retries');
  }

  /**
   * Update workflow with additional documents.
   * Accepts either an array of documents or an object with a documents property.
   */
  async updateWorkflow(workflowId: string, update: any[] | { documents: any[] }): Promise<BallerineWorkflowResult> {
    try {
      const documents = Array.isArray(update) ? update : (update as any).documents ?? [];
      logger.info('Updating Ballerine workflow', { workflowId, documentCount: documents.length });

      const response = await this.client.put(`/workflows/${workflowId}`, { documents });

      logger.info('Ballerine workflow updated', { workflowId });
      return this.mapWorkflowResponse(response.data);
    } catch (error) {
      logger.error('Failed to update Ballerine workflow', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) throw error;
      throw new Error((error as any)?.message || 'Failed to update Ballerine workflow');
    }
  }

  /**
   * Submit document for verification.
   * Accepts either (workflowId, documentType, documentData) or (workflowId, { type, file })
   */
  async submitDocument(workflowId: string, documentOrType: string | { type: string; file?: string }, documentData?: any): Promise<{ documentId: string; workflowId: string; status: string; uploadedAt: string }> {
    try {
      const body = typeof documentOrType === 'string'
        ? { type: documentOrType, data: documentData }
        : { type: documentOrType.type, data: documentOrType.file };

      logger.info('Submitting document to Ballerine', { workflowId, type: body.type });

      const response = await this.client.post(`/workflows/${workflowId}/documents`, body);

      logger.info('Document submitted to Ballerine', { workflowId, type: body.type });
      return response.data;
    } catch (error) {
      logger.error('Failed to submit document to Ballerine', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) throw error;
      throw new Error((error as any)?.message || 'Failed to submit document');
    }
  }

  /**
   * Get supported document types (async, fetches from API or falls back to hardcoded list)
   */
  async getSupportedDocumentTypes(): Promise<string[]> {
    try {
      const response = await this.client.get('/document-types');
      return response.data?.documentTypes ?? this._defaultDocTypes();
    } catch (error) {
      logger.error('Failed to fetch supported document types', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) throw error;
      throw new Error((error as any)?.message || 'Failed to fetch document types');
    }
  }

  private _defaultDocTypes(): string[] {
    return ['passport', 'national_id', 'drivers_license', 'utility_bill', 'bank_statement', 'proof_of_address', 'selfie'];
  }

  /**
   * Map API response to internal format.
   * Handles both nested (verifications/checks) and flat (documentVerification/sanctionsCheck) API shapes.
   */
  private mapWorkflowResponse(apiResponse: any): BallerineWorkflowResult {
    const docVerif = apiResponse.documentVerification ?? (apiResponse.verifications?.document ? { status: apiResponse.verifications.document.status, reasons: apiResponse.verifications.document.reasons } : undefined);
    const bioVerif = apiResponse.biometricVerification ?? (apiResponse.verifications?.biometric ? { status: apiResponse.verifications.biometric.status, reasons: apiResponse.verifications.biometric.reasons } : undefined);
    const addrVerif = apiResponse.addressVerification ?? (apiResponse.verifications?.address ? { status: apiResponse.verifications.address.status, reasons: apiResponse.verifications.address.reasons } : undefined);
    const sanctions = apiResponse.sanctionsCheck ?? (apiResponse.checks?.sanctions ? { hit: apiResponse.checks.sanctions.hit, matches: apiResponse.checks.sanctions.matches } : undefined);
    const pep = apiResponse.pepCheck ?? (apiResponse.checks?.pep ? { hit: apiResponse.checks.pep.hit, matches: apiResponse.checks.pep.matches } : undefined);

    return {
      id: apiResponse.id,
      status: apiResponse.status,
      documentVerification: docVerif,
      biometricVerification: bioVerif,
      addressVerification: addrVerif,
      sanctionsCheck: sanctions,
      pepCheck: pep,
      ...(apiResponse.documents ? { documents: apiResponse.documents } : {}),
    } as any;
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
