/**
 * Full Compliance Scan Route
 * API endpoint for comprehensive compliance scanning (KYC → AML → Fraud)
 *
 * FR-3.4: POST /api/scan
 * Chains KYC verification, AML risk scoring, and fraud detection
 * into a single comprehensive compliance report.
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { KycService } from '../services/kycService';
import { AmlService } from '../services/amlService';
import { FraudDetectionService } from '../services/fraudDetectionService';
import { Jurisdiction } from '../types/kyc';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/scan-routes.log' }),
  ],
});

const kycService = new KycService();
const amlService = new AmlService();
const fraudService = new FraudDetectionService();

/**
 * POST /api/scan
 * Full compliance scan: KYC → AML → Fraud Detection
 *
 * Body:
 *   entityId      - string (required)
 *   jurisdiction  - "IN" | "EU" | "US" (required)
 *   entityData    - { name, dateOfBirth?, address?, email? } (required)
 *   documents     - array of KYC documents (required for KYC check)
 *   transactions  - array of transaction objects (optional, for AML/Fraud check)
 *   walletAddress - string (optional, for blockchain check)
 *   scanTypes     - array of scan types to include (optional, defaults to all)
 */
router.post(
  '/scan',
  requirePermission('compliance:create'),
  [
    body('entityId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('entityId must be a non-empty string'),

    body('jurisdiction')
      .isIn(Object.values(Jurisdiction))
      .withMessage('jurisdiction must be one of: ' + Object.values(Jurisdiction).join(', ')),

    body('entityData.name')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('entityData.name is required'),

    body('entityData.dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('entityData.dateOfBirth must be a valid ISO date'),

    body('documents')
      .isArray({ min: 1 })
      .withMessage('documents must be a non-empty array'),

    body('documents.*.type')
      .isIn([
        'aadhaar',
        'passport',
        'drivers_license',
        'national_id',
        'utility_bill',
        'bank_statement',
      ])
      .withMessage('Invalid document type'),

    body('documents.*.data')
      .isString()
      .withMessage('Document data must be a base64 string'),

    body('documents.*.metadata.filename')
      .isString()
      .withMessage('Document filename is required'),

    body('documents.*.metadata.contentType')
      .isString()
      .withMessage('Document content type is required'),

    body('transactions')
      .optional()
      .isArray()
      .withMessage('transactions must be an array'),

    body('transactions.*.id')
      .optional()
      .isString()
      .withMessage('Each transaction must have a string id'),

    body('transactions.*.amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Transaction amount must be a non-negative number'),

    body('transactions.*.currency')
      .optional()
      .isString()
      .isLength({ min: 3, max: 10 })
      .withMessage('Transaction currency must be a valid currency code'),

    body('transactions.*.timestamp')
      .optional()
      .isISO8601()
      .withMessage('Transaction timestamp must be a valid ISO 8601 date'),

    body('walletAddress')
      .optional()
      .isString()
      .withMessage('walletAddress must be a string'),
  ],
  async (req: Request, res: Response) => {
    const scanId = uuidv4();
    const scanStart = Date.now();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json(
            createErrorResponseFromDetails(
              ErrorCode.INVALID_INPUT,
              ErrorCategory.VALIDATION,
              'Validation failed',
              400,
              errors.array()
            )
          );
      }

      const { entityId, jurisdiction, entityData, documents, transactions, walletAddress } =
        req.body;

      logger.info('Full compliance scan started', {
        scanId,
        entityId,
        jurisdiction,
        hasTransactions: !!transactions?.length,
        hasWalletAddress: !!walletAddress,
        userId: req.user?.id,
      });

      // -----------------------------------------------------------------------
      // Step 1: KYC check (always included)
      // -----------------------------------------------------------------------
      let kycResult: any = null;
      let kycError: string | null = null;
      try {
        kycResult = await kycService.performKycCheck(
          { entityId, jurisdiction, documents, entityData },
          req.user?.id
        );
      } catch (err) {
        kycError = err instanceof Error ? err.message : 'KYC check unavailable';
        logger.warn('KYC check failed during scan', { scanId, entityId, error: kycError });
      }

      // -----------------------------------------------------------------------
      // Step 2: AML check (when transactions are provided)
      // -----------------------------------------------------------------------
      let amlResult: any = null;
      let amlError: string | null = null;
      if (transactions && transactions.length > 0) {
        try {
          amlResult = await amlService.performAmlCheck(
            {
              entityId,
              jurisdiction,
              transactions,
              entityData: { name: entityData.name, country: jurisdiction },
            },
            req.user?.id
          );
        } catch (err) {
          amlError = err instanceof Error ? err.message : 'AML check unavailable';
          logger.warn('AML check failed during scan', { scanId, entityId, error: amlError });
        }
      }

      // -----------------------------------------------------------------------
      // Step 3: Fraud detection (when transactions are provided)
      // -----------------------------------------------------------------------
      let fraudResult: any = null;
      let fraudError: string | null = null;
      if (transactions && transactions.length > 0) {
        try {
          fraudResult = await fraudService.detectFraud(
            { entityId, transactions, jurisdiction },
            req.user?.id
          );
        } catch (err) {
          fraudError = err instanceof Error ? err.message : 'Fraud detection unavailable';
          logger.warn('Fraud detection failed during scan', { scanId, entityId, error: fraudError });
        }
      }

      // -----------------------------------------------------------------------
      // Aggregate results
      // -----------------------------------------------------------------------
      const overallStatus = determineOverallStatus(kycResult, amlResult, fraudResult);
      const overallRiskScore = calculateOverallRisk(kycResult, amlResult, fraudResult);
      const allRecommendations = [
        ...(kycResult?.recommendations || []),
        ...(amlResult?.recommendations || []),
        ...(fraudResult?.recommendations || []),
      ];

      const scanDuration = Date.now() - scanStart;

      logger.info('Full compliance scan completed', {
        scanId,
        entityId,
        overallStatus,
        overallRiskScore,
        scanDuration,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        data: {
          scanId,
          entityId,
          jurisdiction,
          overallStatus,
          overallRiskScore,
          recommendations: [...new Set(allRecommendations)],
          results: {
            kyc: kycResult
              ? {
                  checkId: kycResult.checkId,
                  status: kycResult.status,
                  score: kycResult.score,
                  flags: kycResult.flags,
                }
              : { status: 'SKIPPED', error: kycError },
            aml: amlResult
              ? {
                  checkId: amlResult.checkId,
                  riskLevel: amlResult.riskLevel,
                  score: amlResult.score,
                  flags: amlResult.flags,
                }
              : transactions?.length
                ? { status: 'FAILED', error: amlError }
                : { status: 'SKIPPED', reason: 'No transactions provided' },
            fraud: fraudResult
              ? {
                  checkId: fraudResult.checkId,
                  anomaly: fraudResult.anomaly,
                  riskScore: fraudResult.riskScore,
                  reason: fraudResult.reason,
                  patterns: fraudResult.patterns,
                }
              : transactions?.length
                ? { status: 'FAILED', error: fraudError }
                : { status: 'SKIPPED', reason: 'No transactions provided' },
          },
          walletAddress: walletAddress || null,
          processingTime: scanDuration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Full compliance scan failed', {
        scanId,
        error: error instanceof Error ? error.message : String(error),
        entityId: req.body?.entityId,
        userId: req.user?.id,
      });

      if (error instanceof Error && 'httpStatus' in error) {
        const appError = error as any;
        return res
          .status(appError.httpStatus)
          .json(
            createErrorResponseFromDetails(
              appError.code,
              appError.category,
              appError.message,
              appError.httpStatus,
              appError.details
            )
          );
      }

      res
        .status(500)
        .json(
          createErrorResponseFromDetails(
            ErrorCode.SERVICE_UNAVAILABLE,
            ErrorCategory.INTERNAL,
            'Compliance scan failed'
          )
        );
    }
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determineOverallStatus(
  kyc: any,
  aml: any,
  fraud: any
): 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING' {
  // If any check produced a critical failure, reject
  if (kyc?.status === 'FAIL') {
    return 'REJECTED';
  }
  if (aml?.riskLevel === 'critical') {
    return 'REJECTED';
  }
  if (fraud?.riskLevel === 'critical') {
    return 'REJECTED';
  }

  // If any check requires review or is high-risk, escalate
  if (kyc?.status === 'REQUIRES_REVIEW') {
    return 'ESCALATED';
  }
  if (aml?.riskLevel === 'high') {
    return 'ESCALATED';
  }
  if (fraud?.riskLevel === 'high') {
    return 'ESCALATED';
  }
  if (fraud?.anomaly) {
    return 'ESCALATED';
  }

  // If KYC passed and no high-risk AML/fraud, approve
  if (kyc?.status === 'PASS') {
    return 'APPROVED';
  }

  return 'PENDING';
}

function calculateOverallRisk(kyc: any, aml: any, fraud: any): number {
  const scores: number[] = [];

  // KYC score is on a 0–100 scale where 100=perfect; invert for risk calculation
  if (kyc?.score !== undefined) {
    scores.push(Math.max(0, Math.min(100, 100 - (kyc.score as number))));
  }
  if (aml?.score !== undefined) {
    scores.push(aml.score as number);
  }
  if (fraud?.riskScore !== undefined) {
    scores.push(fraud.riskScore as number);
  }

  if (scores.length === 0) return 0;

  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round(avg);
}

export default router;
