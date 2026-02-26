/**
 * KYC Agent
 * Handles Know Your Customer compliance checks using Ballerine integration
 */

import { BaseAgent } from './baseAgent';
import winston from 'winston';
import { BallerineClient } from '../tools/ballerineClient';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kyc-agent.log' }),
  ],
});

export interface KYCResult {
  status: 'approved' | 'rejected' | 'pending' | 'escalated';
  riskScore: number;
  findings: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
  }>;
  recommendations: string[];
  metadata: {
    ballerineWorkflowId?: string;
    documentVerification?: boolean;
    biometricVerification?: boolean;
    addressVerification?: boolean;
    sanctionsCheck?: boolean;
    pepCheck?: boolean;
  };
}

export class KYCAgent extends BaseAgent {
  private ballerineClient: BallerineClient;

  constructor(ballerineClient: BallerineClient) {
    super('kyc-agent');
    this.ballerineClient = ballerineClient;
  }

  /**
   * Execute KYC check for a transaction
   */
  async check(transaction: any): Promise<KYCResult> {
    const startTime = Date.now();

    logger.info('Starting KYC check', {
      transactionId: transaction.id,
      userId: transaction.userId,
    });

    try {
      // Skip if no user ID
      if (!transaction.userId) {
        return this.createApprovedResult('No user ID provided - KYC not required');
      }

      // Get user profile from database
      const userProfile = await this.getUserProfile(transaction.userId);
      if (!userProfile) {
        return this.createEscalatedResult('User profile not found', 0.8);
      }

      // Check if KYC is already completed
      if (userProfile.kycStatus === 'verified') {
        return this.createApprovedResult('KYC already verified');
      }

      // Initialize Ballerine workflow if needed
      let workflowResult = null;
      if (!userProfile.ballerineWorkflowId) {
        workflowResult = await this.initializeBallerineWorkflow(userProfile);
      } else {
        // Check existing workflow status
        workflowResult = await this.ballerineClient.getWorkflowStatus(
          userProfile.ballerineWorkflowId
        );
      }

      // Analyze workflow result
      const analysis = await this.analyzeWorkflowResult(workflowResult, userProfile);
      const processingTime = Date.now() - startTime;

      logger.info('KYC check completed', {
        transactionId: transaction.id,
        userId: transaction.userId,
        status: analysis.status,
        riskScore: analysis.riskScore,
        processingTime,
      });

      return analysis;
    } catch (error) {
      logger.error('KYC check failed', {
        transactionId: transaction.id,
        userId: transaction.userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.createEscalatedResult(
        `KYC check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0.9
      );
    }
  }

  /**
   * Get user profile from database
   */
  private async getUserProfile(userId: string): Promise<any> {
    // This would typically query the database
    // For now, return mock data
    return {
      id: userId,
      kycStatus: 'pending',
      ballerineWorkflowId: null,
      documents: [],
      personalInfo: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        address: '123 Main St, City, Country',
      },
    };
  }

  /**
   * Initialize Ballerine KYC workflow
   */
  private async initializeBallerineWorkflow(userProfile: any): Promise<any> {
    try {
      const workflowData = {
        customer: {
          id: userProfile.id,
          name: userProfile.personalInfo.name,
          email: userProfile.personalInfo.email,
          phone: userProfile.personalInfo.phone,
        },
        documents: userProfile.documents || [],
        workflowType: 'kyc',
      };

      const workflow = await this.ballerineClient.createWorkflow(workflowData);

      // Update user profile with workflow ID
      await this.updateUserProfile(userProfile.id, {
        ballerineWorkflowId: workflow.id,
      });

      return workflow;
    } catch (error) {
      logger.error('Failed to initialize Ballerine workflow', {
        userId: userProfile.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Analyze Ballerine workflow result
   */
  private async analyzeWorkflowResult(workflowResult: any, userProfile: any): Promise<KYCResult> {
    const findings: KYCResult['findings'] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Analyze document verification
    if (workflowResult.documentVerification) {
      const docStatus = workflowResult.documentVerification.status;
      if (docStatus === 'approved') {
        findings.push({
          type: 'document_verification',
          severity: 'low',
          message: 'Document verification passed',
        });
      } else if (docStatus === 'rejected') {
        findings.push({
          type: 'document_verification',
          severity: 'high',
          message: 'Document verification failed',
          details: workflowResult.documentVerification.reasons,
        });
        riskScore += 0.4;
        recommendations.push('Provide valid identification documents');
      }
    }

    // Analyze biometric verification
    if (workflowResult.biometricVerification) {
      const bioStatus = workflowResult.biometricVerification.status;
      if (bioStatus === 'approved') {
        findings.push({
          type: 'biometric_verification',
          severity: 'low',
          message: 'Biometric verification passed',
        });
      } else if (bioStatus === 'rejected') {
        findings.push({
          type: 'biometric_verification',
          severity: 'high',
          message: 'Biometric verification failed',
          details: workflowResult.biometricVerification.reasons,
        });
        riskScore += 0.3;
        recommendations.push('Complete biometric verification process');
      }
    }

    // Analyze address verification
    if (workflowResult.addressVerification) {
      const addrStatus = workflowResult.addressVerification.status;
      if (addrStatus === 'approved') {
        findings.push({
          type: 'address_verification',
          severity: 'low',
          message: 'Address verification passed',
        });
      } else if (addrStatus === 'rejected') {
        findings.push({
          type: 'address_verification',
          severity: 'medium',
          message: 'Address verification failed',
          details: workflowResult.addressVerification.reasons,
        });
        riskScore += 0.2;
        recommendations.push('Provide proof of address');
      }
    }

    // Analyze sanctions and PEP checks
    if (workflowResult.sanctionsCheck) {
      if (workflowResult.sanctionsCheck.hit) {
        findings.push({
          type: 'sanctions_check',
          severity: 'critical',
          message: 'Sanctions list match detected',
          details: workflowResult.sanctionsCheck.matches,
        });
        riskScore += 1.0;
        recommendations.push('Immediate compliance review required');
      }
    }

    if (workflowResult.pepCheck) {
      if (workflowResult.pepCheck.hit) {
        findings.push({
          type: 'pep_check',
          severity: 'high',
          message: 'Politically Exposed Person detected',
          details: workflowResult.pepCheck.matches,
        });
        riskScore += 0.6;
        recommendations.push('Enhanced due diligence required');
      }
    }

    // Determine overall status
    let status: KYCResult['status'] = 'approved';
    if (riskScore >= 0.8) {
      status = 'rejected';
    } else if (riskScore >= 0.4) {
      status = 'escalated';
    } else if (workflowResult.status === 'pending') {
      status = 'pending';
    }

    // Add general recommendations
    if (status === 'pending') {
      recommendations.push('Complete all required verification steps');
    }

    return {
      status,
      riskScore: Math.min(riskScore, 1.0),
      findings,
      recommendations,
      metadata: {
        ballerineWorkflowId: workflowResult.id,
        documentVerification: workflowResult.documentVerification?.status === 'approved',
        biometricVerification: workflowResult.biometricVerification?.status === 'approved',
        addressVerification: workflowResult.addressVerification?.status === 'approved',
        sanctionsCheck: !workflowResult.sanctionsCheck?.hit,
        pepCheck: !workflowResult.pepCheck?.hit,
      },
    };
  }

  /**
   * Update user profile in database
   */
  private async updateUserProfile(userId: string, updates: any): Promise<void> {
    // This would typically update the database
    logger.info('Updating user profile', { userId, updates });
  }

  /**
   * Create approved KYC result
   */
  private createApprovedResult(message: string): KYCResult {
    return {
      status: 'approved',
      riskScore: 0.0,
      findings: [
        {
          type: 'kyc_check',
          severity: 'low',
          message,
        },
      ],
      recommendations: [],
      metadata: {},
    };
  }

  /**
   * Create escalated KYC result
   */
  private createEscalatedResult(message: string, riskScore: number): KYCResult {
    return {
      status: 'escalated',
      riskScore,
      findings: [
        {
          type: 'kyc_check',
          severity: 'high',
          message,
        },
      ],
      recommendations: ['Manual KYC review required'],
      metadata: {},
    };
  }
}
