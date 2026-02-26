/**
 * AML Routes
 * API endpoints for Anti-Money Laundering operations
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { AmlService } from '../services/amlService';
import { Jurisdiction } from '../types/kyc';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/aml-routes.log' }),
  ],
});

const amlService = new AmlService();

/**
 * POST /api/aml-score
 * Perform AML risk scoring for an entity
 */
router.post(
  '/aml-score',
  requirePermission('aml:execute'),
  [
    body('entityId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Entity ID must be a non-empty string (max 255 chars)'),

    body('jurisdiction')
      .isIn(Object.values(Jurisdiction))
      .withMessage('Jurisdiction must be one of: ' + Object.values(Jurisdiction).join(', ')),

    body('transactions').isArray().withMessage('Transactions must be an array'),

    body('transactions.*.id').isString().withMessage('Transaction ID is required'),

    body('transactions.*.amount').isNumeric().withMessage('Transaction amount must be a number'),

    body('transactions.*.currency')
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter code'),

    body('transactions.*.counterparty').isString().withMessage('Counterparty is required'),

    body('transactions.*.timestamp')
      .isISO8601()
      .withMessage('Transaction timestamp must be a valid ISO date'),

    body('transactions.*.type')
      .isIn(['deposit', 'withdrawal', 'transfer', 'payment', 'exchange'])
      .withMessage('Invalid transaction type'),

    body('entityData.name')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Entity name is required'),

    body('entityData.country')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Entity country is required'),
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

      const { entityId, jurisdiction, transactions, entityData } = req.body;

      const result = await amlService.performAmlCheck(
        {
          entityId,
          jurisdiction,
          transactions,
          entityData,
        },
        req.user?.id
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('AML score endpoint error', {
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
            'AML scoring failed'
          )
        );
    }
  }
);

/**
 * GET /api/aml-score/:checkId
 * Get AML check result by ID
 */
router.get(
  '/aml-score/:checkId',
  requirePermission('aml:read'),
  async (req: Request, res: Response) => {
    try {
      const { checkId } = req.params;

      const result = await amlService.getAmlCheck(checkId);

      if (!result) {
        return res
          .status(404)
          .json(
            createErrorResponseFromDetails(
              ErrorCode.RESOURCE_NOT_FOUND,
              ErrorCategory.NOT_FOUND,
              'AML check not found'
            )
          );
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Get AML check endpoint error', {
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
            'Failed to retrieve AML check'
          )
        );
    }
  }
);

export default router;
