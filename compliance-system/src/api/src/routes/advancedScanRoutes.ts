/**
 * Advanced Scan Routes
 * Exposes the AdvancedComplianceScanner via REST API.
 * Mount at /api/compliance so full path is /api/compliance/advanced-scan.
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { AdvancedComplianceScanner } from '../services/advancedComplianceScanner';
import { RiskAssessmentEngine } from '../services/riskAssessmentEngine';
import { MultiJurisdictionalMonitor } from '../services/multiJurisdictionalMonitor';
import { ComplianceReportingSystem } from '../services/complianceReportingSystem';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/advanced-scan-routes.log' }),
  ],
});

const scanner = new AdvancedComplianceScanner(
  new RiskAssessmentEngine(),
  new MultiJurisdictionalMonitor(),
  new ComplianceReportingSystem()
);

/**
 * POST /api/compliance/advanced-scan
 * Runs a comprehensive advanced compliance scan for an entity.
 *
 * Body:
 *   entityId      - string (required)
 *   jurisdiction  - string[] (required, e.g. ["IN", "GLOBAL"])
 *   entityData    - { name: string, country?, age?, pepStatus? } (required)
 *   scanType      - "comprehensive" | "targeted" | "regulatory" | "ad-hoc" (required)
 *   kycScore      - number 0-100 (optional)
 *   amlScore      - number 0-100 (optional)
 *   sanctionsMatch - boolean (optional)
 *   transactionData - { amount?, currency? } (optional)
 */
router.post(
  '/advanced-scan',
  requirePermission('compliance:create'),
  [
    body('entityId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('entityId must be a non-empty string'),

    body('jurisdiction')
      .isArray({ min: 1 })
      .withMessage('jurisdiction must be a non-empty array of jurisdiction codes'),

    body('entityData.name')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('entityData.name must be a non-empty string'),

    body('scanType')
      .isIn(['comprehensive', 'targeted', 'regulatory', 'ad-hoc'])
      .withMessage('scanType must be one of: comprehensive, targeted, regulatory, ad-hoc'),

    body('kycScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('kycScore must be a number between 0 and 100'),

    body('amlScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('amlScore must be a number between 0 and 100'),

    body('sanctionsMatch')
      .optional()
      .isBoolean()
      .withMessage('sanctionsMatch must be a boolean'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Validation failed',
          400,
          errors.array(),
          req.headers['x-request-id'] as string | undefined ?? 'unknown'
        )
      );
      return;
    }

    try {
      const {
        entityId,
        jurisdiction,
        entityData,
        scanType,
        kycScore,
        amlScore,
        sanctionsMatch,
        transactionData,
      } = req.body as {
        entityId: string;
        jurisdiction: string[];
        entityData: { name: string; country?: string; age?: number; pepStatus?: boolean };
        scanType: 'comprehensive' | 'targeted' | 'regulatory' | 'ad-hoc';
        kycScore?: number;
        amlScore?: number;
        sanctionsMatch?: boolean;
        transactionData?: { amount?: number; currency?: string };
      };

      logger.info('Advanced scan request received', { entityId, scanType, jurisdiction });

      const result = await scanner.runScan({
        entityId,
        scanType,
        jurisdiction,
        entityData,
        kycScore,
        amlScore,
        sanctionsMatch,
        transactionData,
      });

      res.status(200).json(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      logger.error('Advanced scan request failed', { error: error.message });

      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Advanced compliance scan failed',
          500,
          { message: error.message },
          req.headers['x-request-id'] as string | undefined ?? 'unknown'
        )
      );
    }
  }
);

export default router;
