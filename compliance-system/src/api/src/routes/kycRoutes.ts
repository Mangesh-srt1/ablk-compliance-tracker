/**
 * KYC Routes
 * API endpoints for Know Your Customer operations
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { KycService } from '../services/kycService';
import { Jurisdiction } from '../types/kyc';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kyc-routes.log' }),
  ],
});

const kycService = new KycService();

/**
 * POST /api/kyc-check
 * Perform KYC verification for an entity
 */
router.post(
  '/kyc-check',
  requirePermission('kyc:execute'),
  [
    body('entityId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Entity ID must be a non-empty string (max 255 chars)'),

    body('jurisdiction')
      .isIn(Object.values(Jurisdiction))
      .withMessage('Jurisdiction must be one of: ' + Object.values(Jurisdiction).join(', ')),

    body('documents').isArray({ min: 1 }).withMessage('At least one document is required'),

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

    body('documents.*.data').isString().withMessage('Document data must be a base64 string'),

    body('documents.*.metadata.filename').isString().withMessage('Document filename is required'),

    body('documents.*.metadata.contentType')
      .isString()
      .withMessage('Document content type is required'),

    body('entityData.name')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Entity name is required'),

    body('entityData.dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Date of birth must be a valid ISO date'),

    body('entityData.nationality')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Nationality must be a string (max 100 chars)'),
  ],
  async (req: Request, res: Response) => {
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

      const { entityId, jurisdiction, documents, entityData } = req.body;

      const result = await kycService.performKycCheck(
        {
          entityId,
          jurisdiction,
          documents,
          entityData,
        },
        req.user?.id
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('KYC check endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        entityId: req.body.entityId,
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
            ErrorCode.DATABASE_ERROR,
            ErrorCategory.INTERNAL,
            'KYC check failed'
          )
        );
    }
  }
);

/**
 * GET /api/kyc-check/:checkId
 * Get KYC check result by ID
 */
router.get(
  '/kyc-check/:checkId',
  requirePermission('kyc:read'),
  async (req: Request, res: Response) => {
    try {
      const { checkId } = req.params;

      const result = await kycService.getKycCheck(checkId);

      if (!result) {
        return res
          .status(404)
          .json(
            createErrorResponseFromDetails(
              ErrorCode.RESOURCE_NOT_FOUND,
              ErrorCategory.NOT_FOUND,
              'KYC check not found'
            )
          );
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get KYC check endpoint error', {
        error: error instanceof Error ? error.message : String(error),
        checkId: req.params.checkId,
        userId: req.user?.id,
      });

      res
        .status(500)
        .json(
          createErrorResponseFromDetails(
            ErrorCode.DATABASE_ERROR,
            ErrorCategory.INTERNAL,
            'Failed to retrieve KYC check'
          )
        );
    }
  }
);

export default router;
