/**
 * KYT Routes
 * API endpoints for Know Your Transaction monitoring.
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { requirePermission } from '../middleware/authMiddleware';
import { transactionMonitoringService } from '../services/transactionMonitoringService';
import { Jurisdiction } from '../types/aml';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();

/**
 * POST /api/kyt-monitor
 * Analyze transaction stream for anomalies.
 */
router.post(
  '/kyt-monitor',
  requirePermission('aml:execute'),
  [
    body('entityId').isString().isLength({ min: 1, max: 255 }),
    body('jurisdiction').isIn(Object.values(Jurisdiction)),
    body('transactions').isArray({ min: 1 }),
    body('transactions.*.id').isString(),
    body('transactions.*.amount').isNumeric(),
    body('transactions.*.currency').isString().isLength({ min: 3, max: 3 }),
    body('transactions.*.timestamp').isISO8601(),
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

      const { entityId, jurisdiction, transactions, baseline } = req.body;
      const result = await transactionMonitoringService.analyzeTransactions({
        entityId,
        jurisdiction,
        transactions,
        baseline,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res
        .status(500)
        .json(
          createErrorResponseFromDetails(
            ErrorCode.DATABASE_ERROR,
            ErrorCategory.INTERNAL,
            error instanceof Error ? error.message : 'KYT monitoring failed'
          )
        );
    }
  }
);

export default router;
