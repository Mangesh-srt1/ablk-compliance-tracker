/**
 * Fraud Detection Routes
 * API endpoint for transaction anomaly / fraud detection
 *
 * FR-3.3: POST /api/fraud-detect
 * Detects velocity anomalies, structuring, and layering in transaction data.
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { FraudDetectionService } from '../services/fraudDetectionService';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/fraud-routes.log' }),
  ],
});

const fraudDetectionService = new FraudDetectionService();

/**
 * POST /api/fraud-detect
 * Detect fraud anomalies in transaction data
 *
 * Body:
 *   entityId      - string (required)
 *   transactions  - array of transaction objects (required, min 1)
 *   jurisdiction  - "IN" | "EU" | "US" (optional)
 */
router.post(
  '/fraud-detect',
  requirePermission('fraud:create'),
  [
    body('entityId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('entityId must be a non-empty string (max 255 chars)'),

    body('transactions')
      .isArray({ min: 1 })
      .withMessage('transactions must be a non-empty array'),

    body('transactions.*.id')
      .isString()
      .withMessage('Each transaction must have a string id'),

    body('transactions.*.amount')
      .isFloat({ min: 0 })
      .withMessage('Transaction amount must be a non-negative number'),

    body('transactions.*.currency')
      .isString()
      .isLength({ min: 3, max: 10 })
      .withMessage('Transaction currency must be a valid currency code'),

    body('transactions.*.timestamp')
      .isISO8601()
      .withMessage('Transaction timestamp must be a valid ISO 8601 date'),

    body('transactions.*.type')
      .optional()
      .isIn(['deposit', 'withdrawal', 'transfer', 'payment', 'exchange'])
      .withMessage('Invalid transaction type'),

    body('jurisdiction')
      .optional()
      .isIn(['IN', 'EU', 'US'])
      .withMessage('jurisdiction must be one of: IN, EU, US'),
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

      const { entityId, transactions, jurisdiction, metadata } = req.body;

      const result = await fraudDetectionService.detectFraud(
        { entityId, transactions, jurisdiction, metadata },
        req.user?.id
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Fraud detect endpoint error', {
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
            'Fraud detection failed'
          )
        );
    }
  }
);

export default router;
