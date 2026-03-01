/**
 * KYB Routes
 * API endpoints for Know Your Business operations
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { kybService } from '../services/kybService';
import { Jurisdiction } from '../types/kyb';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kyb-routes.log' }),
  ],
});

/**
 * POST /api/kyb-check
 * Perform KYB verification for a business entity
 *
 * Request body:
 * {
 *   "businessId": "string (required)",
 *   "jurisdiction": "AE|IN|US|EU|SA (required)",
 *   "documents": [
 *     {
 *       "type": "CERTIFICATE_OF_INCORPORATION|...",
 *       "data": "base64 string",
 *       "metadata": { "filename": "string", "contentType": "string", "size": number }
 *     }
 *   ],
 *   "entityData": {
 *     "registrationNumber": "string",
 *     "businessName": "string",
 *     "entityType": "CORPORATION|...",
 *     "dateOfIncorporation": "ISO date",
 *     "primaryAddress": { "street", "city", "country", "postalCode" },
 *     "ultimatelyBeneficialOwners": [
 *       { "name", "nationality", "ownershipPercentage", "address" }
 *     ]
 *   }
 * }
 */
router.post(
  '/kyb-check',
  requirePermission('kyb:execute'),
  [
    body('businessId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Business ID must be a non-empty string (max 255 chars)'),

    body('jurisdiction')
      .isIn(Object.values(Jurisdiction))
      .withMessage('Jurisdiction must be one of: ' + Object.values(Jurisdiction).join(', ')),

    body('entityData.businessName')
      .isString()
      .isLength({ min: 1, max: 500 })
      .withMessage('Business name is required (max 500 chars)'),

    body('entityData.registrationNumber')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Registration number is required'),

    body('entityData.entityType')
      .isString()
      .withMessage('Entity type is required'),

    body('entityData.dateOfIncorporation')
      .isISO8601()
      .withMessage('Valid incorporation date required (ISO 8601 format)'),

    body('entityData.primaryAddress.country')
      .isString()
      .withMessage('Country in primary address is required'),

    body('documents').isArray({ min: 1 }).withMessage('At least one document is required'),

    body('documents.*.type')
      .isString()
      .withMessage('Document type is required'),

    body('documents.*.data')
      .isString()
      .isLength({ min: 100 })
      .withMessage('Document data must be provided (base64 encoded)'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('KYB check validation failed', {
          businessId: req.body.businessId,
          errors: errors.array(),
        });

        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { businessId, jurisdiction, documents, entityData, skipDocumentVerification } =
        req.body;
      const userId = (req as any).user?.id || 'api-client';

      logger.info('Processing KYB check request', {
        businessId,
        jurisdiction,
        documentCount: documents?.length,
        userId,
      });

      // Perform KYB check
      const result = await kybService.performKybCheck(
        {
          businessId,
          jurisdiction,
          documents,
          entityData,
          userId,
          skipDocumentVerification,
        },
        userId
      );

      // Return result
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });

      logger.info('KYB check completed successfully', {
        checkId: result.checkId,
        businessId,
        status: result.status,
        score: result.score,
      });
    } catch (error) {
      logger.error('KYB check failed', {
        businessId: req.body?.businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof Error && error.message.includes('Unsupported jurisdiction')) {
        return res.status(400).json({
          error: ErrorCode.INVALID_INPUT,
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'KYB_CHECK_FAILED',
        message: 'Failed to process KYB check',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/kyb-check/:businessId
 * Get the latest KYB check result for a business
 *
 * @param businessId - Business entity ID
 */
router.get(
  '/kyb-check/:businessId',
  requirePermission('kyb:read'),
  [
    param('businessId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Valid business ID required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { businessId } = req.params;

      logger.info('Retrieving KYB check history', {
        businessId,
        user: (req as any).user?.id,
      });

      const history = await kybService.getKybCheckHistory(businessId, 1);

      if (history.length === 0) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `No KYB check found for business ${businessId}`,
        });
      }

      res.status(200).json({
        success: true,
        data: history[0],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to retrieve KYB check', {
        businessId: req.params?.businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: 'RETRIEVAL_FAILED',
        message: 'Failed to retrieve KYB check',
      });
    }
  }
);

/**
 * GET /api/kyb-history/:businessId
 * Get full KYB verification history for a business
 *
 * @param businessId - Business entity ID
 * @param limit - Number of records to return (default 10, max 100)
 */
router.get(
  '/kyb-history/:businessId',
  requirePermission('kyb:read'),
  [
    param('businessId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Valid business ID required'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { businessId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      logger.info('Retrieving KYB check history', {
        businessId,
        limit,
        user: (req as any).user?.id,
      });

      const history = await kybService.getKybCheckHistory(businessId, limit);

      res.status(200).json({
        success: true,
        data: history,
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to retrieve KYB history', {
        businessId: req.params?.businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: 'HISTORY_RETRIEVAL_FAILED',
        message: 'Failed to retrieve KYB history',
      });
    }
  }
);

/**
 * GET /api/kyb-risk-score/:businessId
 * Get current KYB risk score assessment
 *
 * @param businessId - Business entity ID
 */
router.get(
  '/kyb-risk-score/:businessId',
  requirePermission('kyb:read'),
  [
    param('businessId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Valid business ID required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { businessId } = req.params;

      logger.info('Retrieving KYB risk score', {
        businessId,
        user: (req as any).user?.id,
      });

      const riskScore = await kybService.getCurrentKybRiskScore(businessId);

      if (!riskScore) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `No risk score available for business ${businessId}`,
        });
      }

      res.status(200).json({
        success: true,
        data: riskScore,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to retrieve risk score', {
        businessId: req.params?.businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: 'RISK_SCORE_FAILED',
        message: 'Failed to retrieve risk score',
      });
    }
  }
);

/**
 * POST /api/kyb-continuous-monitoring
 * Enable continuous monitoring for a business
 *
 * Request body:
 * {
 *   "businessId": "string",
 *   "jurisdiction": "AE|IN|US|EU|SA",
 *   "monitoringFrequency": "DAILY|WEEKLY|MONTHLY|QUARTERLY",
 *   "screeningScope": ["SANCTIONS", "NEWS", "REGULATORY_ACTIONS", "UBO_CHANGES"],
 *   "alertThreshold": 50
 * }
 */
router.post(
  '/kyb-continuous-monitoring',
  requirePermission('kyb:execute'),
  [
    body('businessId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Business ID is required'),

    body('jurisdiction')
      .isIn(Object.values(Jurisdiction))
      .withMessage('Valid jurisdiction is required'),

    body('monitoringFrequency')
      .isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'])
      .withMessage('Valid monitoring frequency is required'),

    body('screeningScope')
      .isArray({ min: 1 })
      .withMessage('At least one screening scope is required'),

    body('alertThreshold')
      .isInt({ min: 0, max: 100 })
      .withMessage('Alert threshold must be between 0 and 100'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { businessId, jurisdiction, monitoringFrequency, screeningScope, alertThreshold } =
        req.body;
      const userId = (req as any).user?.id || 'api-client';

      logger.info('Enabling continuous monitoring', {
        businessId,
        monitoringFrequency,
        userId,
      });

      const result = await kybService.enableContinuousMonitoring({
        businessId,
        jurisdiction,
        monitoringFrequency,
        screeningScope,
        alertThreshold,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });

      logger.info('Continuous monitoring enabled', {
        monitoringId: result.monitoringId,
        businessId,
      });
    } catch (error) {
      logger.error('Failed to enable continuous monitoring', {
        businessId: req.body?.businessId,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        error: 'MONITORING_FAILED',
        message: 'Failed to enable continuous monitoring',
      });
    }
  }
);

export default router;
