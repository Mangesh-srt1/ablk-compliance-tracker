/**
 * Compliance Gateway - P2P Settlement Enforcement
 * Routes all token-to-fiat conversions through monitored compliance gateways
 * Enforces KYC, AML, and settlement compliance before fiat release
 * 
 * File: src/api/src/routes/complianceGatewayRoutes.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import winston from 'winston';
import { AMLAnomalyDetectorAgent, P2PTransfer } from '../agents/amlAnomalyDetectorAgent';

/**
 * Fiat Ramp Request
 */
export interface FiatRampRequest {
  walletAddress: string;
  tokenAmount: number;
  assetId: string;
  fiatCurrency: string;
  bankAccount: string;
  bankCode: string; // SWIFT, NEFT, etc.
  bankCountry?: string;
}

/**
 * Fiat Ramp Response
 */
export interface FiatRampResponse {
  requestId: string;
  status: 'approved' | 'declined' | 'blocked' | 'escalated' | 'error';
  reason?: string;
  riskScore?: number;
  settlementId?: string;
  estimatedCreditTime?: string;
  estimatedReviewTime?: string;
  message?: string;
}

/**
 * Compliance Gateway Service
 * Manages P2P transfer settlement compliance
 */
export class ComplianceGatewayService {
  private logger: winston.Logger;
  private amlDetector: AMLAnomalyDetectorAgent;

  constructor(
    private dbClient: any,
    private kycService: any,
    private besuProvider: any
  ) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'compliance-gateway' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/gateway-error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/compliance-gateway.log'
        })
      ]
    });

    this.amlDetector = new AMLAnomalyDetectorAgent(dbClient, besuProvider);

    this.logger.info('Compliance Gateway Service initialized');
  }

  /**
   * Process Fiat Ramp Request
   * Main entry point: validates request, runs compliance checks, executes settlement
   */
  async processFiatRampRequest(req: FiatRampRequest): Promise<FiatRampResponse> {
    const requestId = uuid();
    const startTime = Date.now();

    this.logger.info('Fiat ramp request received', {
      requestId,
      walletAddress: req.walletAddress,
      tokenAmount: req.tokenAmount,
      assetId: req.assetId,
      fiatCurrency: req.fiatCurrency
    });

    try {
      // ============================================================
      // STEP 1: KYC Verification (Must be current & not expired)
      // ============================================================
      const kycResult = await this.validateKYC(req.walletAddress);
      if (!kycResult.verified) {
        this.logger.warn('KYC verification failed', {
          requestId,
          walletAddress: req.walletAddress,
          reason: kycResult.reason
        });

        await this.logGatewayDecision(requestId, 'KYC_FAILED', 0, kycResult.reason);

        return {
          requestId,
          status: 'declined',
          reason: kycResult.reason,
          message: 'KYC verification required or expired. Please update your profile.'
        };
      }

      // ============================================================
      // STEP 2: AML Screening via Anomaly Detector
      // ============================================================
      const p2pTransfer: P2PTransfer = {
        fromAddress: req.walletAddress,
        toAddress: req.bankAccount,
        amount: req.tokenAmount,
        timestamp: new Date(),
        assetId: req.assetId
      };

      const amlAssessment = await this.amlDetector.assessHawalaRisk(p2pTransfer);

      this.logger.info('AML assessment completed', {
        requestId,
        riskScore: amlAssessment.overallRiskScore,
        escalationLevel: amlAssessment.escalationLevel
      });

      // BLOCK: Definitive illicit activity detected
      if (amlAssessment.shouldBlock) {
        this.logger.warn('AML screening BLOCKED transfer', {
          requestId,
          walletAddress: req.walletAddress,
          riskScore: amlAssessment.overallRiskScore,
          patterns: amlAssessment.patterns.map(p => p.pattern)
        });

        await this.logGatewayDecision(
          requestId,
          'AML_BLOCK',
          amlAssessment.overallRiskScore,
          amlAssessment.recommendations.join('; ')
        );

        return {
          requestId,
          status: 'blocked',
          reason: 'AML compliance check failed',
          riskScore: amlAssessment.overallRiskScore,
          message: 'Transaction blocked due to AML policy. Contact compliance team for appeal.'
        };
      }

      // ESCALATE: Manual review required
      if (amlAssessment.escalationLevel === 'manual_review') {
        this.logger.info('AML assessment escalated to manual review', {
          requestId,
          riskScore: amlAssessment.overallRiskScore
        });

        await this.logGatewayDecision(
          requestId,
          'AML_ESCALATE',
          amlAssessment.overallRiskScore,
          amlAssessment.recommendations.join('; ')
        );

        // Create escalation ticket for compliance team
        await this.createEscalationTicket(requestId, req, amlAssessment);

        return {
          requestId,
          status: 'escalated',
          reason: 'AML review required',
          riskScore: amlAssessment.overallRiskScore,
          estimatedReviewTime: '2-4 business hours',
          message: 'Your request is undergoing compliance review. You will be notified within 24 hours.'
        };
      }

      // ============================================================
      // STEP 3: Bank Account Validation (Sanctions, FATF)
      // ============================================================
      const bankValidation = await this.validateBankAccount(req.bankAccount, req.bankCode, req.bankCountry);
      if (!bankValidation.valid) {
        this.logger.warn('Bank account validation failed', {
          requestId,
          reason: bankValidation.reason
        });

        await this.logGatewayDecision(requestId, 'BANK_INVALID', 0, bankValidation.reason);

        return {
          requestId,
          status: 'declined',
          reason: bankValidation.reason,
          message: 'Bank account validation failed. Please verify your banking details.'
        };
      }

      // ============================================================
      // STEP 4: Settlement Execution
      // ============================================================
      const settlementResult = await this.executeSettlement(
        requestId,
        req.walletAddress,
        req.tokenAmount,
        req.assetId,
        req.fiatCurrency,
        req.bankAccount,
        req.bankCode
      );

      if (!settlementResult.success) {
        this.logger.error('Settlement execution failed', {
          requestId,
          error: settlementResult.error
        });

        return {
          requestId,
          status: 'error',
          reason: settlementResult.error,
          message: 'Settlement processing failed. Please try again or contact support.'
        };
      }

      // ============================================================
      // SUCCESS: Request Approved
      // ============================================================
      this.logger.info('Fiat ramp request APPROVED', {
        requestId,
        settlementId: settlementResult.settlementId,
        elapsedMs: Date.now() - startTime
      });

      await this.logGatewayDecision(
        requestId,
        'APPROVED',
        amlAssessment.overallRiskScore,
        `AML cleared (score: ${amlAssessment.overallRiskScore.toFixed(3)})`
      );

      return {
        requestId,
        status: 'approved',
        settlementId: settlementResult.settlementId,
        estimatedCreditTime: '2-5 business days',
        message: 'Your settlement has been approved and is being processed.'
      };

    } catch (error) {
      this.logger.error('Fiat ramp request processing failed', { requestId, error });

      return {
        requestId,
        status: 'error',
        message: 'Service unavailable. Please try again later.',
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate KYC Status
   * Checks if investor KYC is current and not expired
   */
  private async validateKYC(walletAddress: string): Promise<{
    verified: boolean;
    reason?: string;
  }> {
    try {
      const result = await this.kycService.getKYCStatus(walletAddress);

      if (!result.verified || result.isExpired) {
        return {
          verified: false,
          reason: result.isExpired ? 'KYC verification expired' : 'KYC verification not completed'
        };
      }

      return { verified: true };

    } catch (error) {
      this.logger.error('KYC validation failed', { walletAddress, error });
      return {
        verified: false,
        reason: 'KYC service unavailable'
      };
    }
  }

  /**
   * Validate Bank Account
   * Checks for sanctions, FATF compliance, and account legitimacy
   */
  private async validateBankAccount(
    bankAccount: string,
    bankCode: string,
    bankCountry?: string
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      // 1. IBAN/Account format validation
      if (!this.validateIBAN(bankAccount)) {
        return {
          valid: false,
          reason: 'Invalid bank account format'
        };
      }

      // 2. Bank code validation (SWIFT)
      if (!this.validateSWIFTCode(bankCode)) {
        return {
          valid: false,
          reason: 'Invalid SWIFT code'
        };
      }

      // 3. Check if bank is in FATF non-compliant jurisdiction
      const bankCountryFromCode = bankCode.substring(4, 6).toUpperCase();
      const countryToCheck = bankCountry || bankCountryFromCode;

      const fatfHighRisk = ['IR', 'KP', 'SY', 'CU']; // Iran, N.Korea, Syria, Cuba
      if (fatfHighRisk.includes(countryToCheck)) {
        return {
          valid: false,
          reason: `Bank in high-risk FATF jurisdiction: ${countryToCheck}`
        };
      }

      // 4. Enhanced Due Diligence for high-risk countries
      const highRiskCountries = ['PK', 'BA', 'ZW', 'VI'];
      if (highRiskCountries.includes(countryToCheck)) {
        this.logger.info('High-risk jurisdiction detected, but proceeding', {
          country: countryToCheck
        });
      }

      return { valid: true };

    } catch (error) {
      this.logger.error('Bank account validation failed', { error });
      return {
        valid: false,
        reason: 'Bank validation service error'
      };
    }
  }

  /**
   * Execute Settlement
   * Locks tokens in custody contract and initiates fiat transfer
   */
  private async executeSettlement(
    requestId: string,
    walletAddress: string,
    tokenAmount: number,
    assetId: string,
    fiatCurrency: string,
    bankAccount: string,
    bankCode: string
  ): Promise<{
    success: boolean;
    settlementId?: string;
    error?: string;
  }> {
    const settlementId = uuid();

    try {
      // 1. Create settlement record in database
      await this.dbClient.query(
        `INSERT INTO settlements 
         (id, fiat_ramp_request_id, wallet_address, token_amount, asset_id, fiat_currency, bank_account, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [settlementId, requestId, walletAddress, tokenAmount, assetId, fiatCurrency, bankAccount, 'pending']
      );

      // 2. Call Besu contract to lock tokens in custody
      // (This is a simplified version; real implementation would call actual Besu contract)
      await this.lockTokensInCustody(walletAddress, tokenAmount, assetId);

      // 3. Update settlement status to 'in_progress'
      await this.dbClient.query(
        `UPDATE settlements SET status = $1 WHERE id = $2`,
        ['in_progress', settlementId]
      );

      // 4. Submit to bank partner for fiat transfer
      // In production, this would call a real bank API
      this.logger.info('Settlement submitted to bank partner', {
        settlementId,
        bankAccount,
        fiatAmount: this.estimateFiatAmount(tokenAmount),
        fiatCurrency
      });

      // 5. Update status to 'submitted'
      await this.dbClient.query(
        `UPDATE settlements SET status = $1 WHERE id = $2`,
        ['submitted', settlementId]
      );

      return {
        success: true,
        settlementId
      };

    } catch (error) {
      this.logger.error('Settlement execution failed', { settlementId, error });

      await this.dbClient.query(
        `UPDATE settlements SET status = $1 WHERE id = $2`,
        ['failed', settlementId]
      ).catch((e: any) => this.logger.error('Failed to update settlement status', { error: e }));

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown settlement error'
      };
    }
  }

  /**
   * Create Escalation Ticket
   * For compliance team manual review
   */
  private async createEscalationTicket(
    requestId: string,
    req: FiatRampRequest,
    amlAssessment: any
  ): Promise<void> {
    try {
      const ticketId = `ESC-${uuid().substring(0, 8).toUpperCase()}`;

      await this.dbClient.query(
        `INSERT INTO compliance_escalation_tickets 
         (ticket_id, fiat_ramp_request_id, wallet_address, reason, risk_score, patterns, assignee)
         VALUES ($1, $2, $3, $4, $5, $6, 'unassigned')`,
        [
          ticketId,
          requestId,
          req.walletAddress,
          'AML_ESCALATION',
          amlAssessment.overallRiskScore,
          JSON.stringify(amlAssessment.patterns)
        ]
      );

      this.logger.info('Escalation ticket created', {
        ticketId,
        requestId,
        riskScore: amlAssessment.overallRiskScore
      });

      // In production: Send notification to compliance team
      // await this.notificationService.sendSlack(...);

    } catch (error) {
      this.logger.error('Failed to create escalation ticket', { error });
    }
  }

  /**
   * Log Gateway Decision
   * Audit trail for regulatory compliance
   */
  private async logGatewayDecision(
    requestId: string,
    decision: string,
    riskScore: number,
    reasoning: string
  ): Promise<void> {
    try {
      await this.dbClient.query(
        `INSERT INTO gateway_audit_log 
         (request_id, decision, risk_score, reasoning)
         VALUES ($1, $2, $3, $4)`,
        [requestId, decision, riskScore, reasoning]
      );
    } catch (error) {
      this.logger.error('Failed to log gateway decision', { error });
    }
  }

  /**
   * Lock Tokens in Custody Contract
   * Prevents double-spending while settlement is processed
   */
  private async lockTokensInCustody(
    walletAddress: string,
    tokenAmount: number,
    assetId: string
  ): Promise<void> {
    // In production, call actual Besu smart contract
    this.logger.debug('Locking tokens in custody', {
      wallet: walletAddress,
      amount: tokenAmount,
      asset: assetId
    });
  }

  /**
   * Estimate Fiat Amount
   * Based on current token price from oracle
   */
  private estimateFiatAmount(tokenAmount: number): number {
    // In production, would call price oracle
    // This is simplified: 1 token = $1000 fiat
    return tokenAmount * 1000;
  }

  /**
   * Utility: Validate IBAN
   */
  private validateIBAN(iban: string): boolean {
    // Simplified IBAN validation (real: check digit validation)
    return /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban.toUpperCase());
  }

  /**
   * Utility: Validate SWIFT Code
   */
  private validateSWIFTCode(code: string): boolean {
    // SWIFT codes are 8 or 11 characters
    return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(code);
  }

  /**
   * Get Request Status
   */
  async getRequestStatus(requestId: string): Promise<{
    status: string;
    riskScore?: number;
    createdAt?: Date;
    completedAt?: Date;
  }> {
    try {
      const result = await this.dbClient.query(
        `SELECT * FROM fiat_ramp_access WHERE id = $1`,
        [requestId]
      );

      if (!result.rows.length) {
        throw new Error('Request not found');
      }

      const request = result.rows[0];
      return {
        status: request.request_status,
        riskScore: request.aml_risk_score,
        createdAt: request.created_at,
        completedAt: request.completed_at
      };

    } catch (error) {
      this.logger.error('Failed to get request status', { requestId, error });
      throw error;
    }
  }
}

/**
 * Express Router: Compliance Gateway Routes
 */
export function createComplianceGatewayRouter(
  gatewayService: ComplianceGatewayService
): Router {
  const router = Router();

  /**
   * POST /gateway/request-fiat-ramp
   * Submit fiat ramp request with compliance checks
   */
  router.post('/request-fiat-ramp', async (req: Request, res: Response) => {
    try {
      const { walletAddress, tokenAmount, assetId, fiatCurrency, bankAccount, bankCode, bankCountry } = req.body;

      // Input validation
      if (!walletAddress || !tokenAmount || !assetId || !fiatCurrency || !bankAccount || !bankCode) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields'
        });
      }

      const fiatRampRequest: FiatRampRequest = {
        walletAddress,
        tokenAmount,
        assetId,
        fiatCurrency,
        bankAccount,
        bankCode,
        bankCountry
      };

      const result = await gatewayService.processFiatRampRequest(fiatRampRequest);

      // HTTP status based on result
      const httpStatus =
        result.status === 'approved' || result.status === 'escalated' ? 200 :
        result.status === 'declined' || result.status === 'blocked' ? 403 :
        500;

      return res.status(httpStatus).json(result);

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Service error'
      });
    }
  });

  /**
   * GET /gateway/request-status/:requestId
   * Check status of fiat ramp request
   */
  router.get('/request-status/:requestId', async (req: Request, res: Response) => {
    try {
      const status = await gatewayService.getRequestStatus(req.params.requestId);
      return res.json(status);

    } catch (error) {
      return res.status(404).json({
        error: 'Request not found'
      });
    }
  });

  return router;
}

export default ComplianceGatewayService;
