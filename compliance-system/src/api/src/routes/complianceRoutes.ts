/**
 * Compliance Routes
 * API endpoints for compliance operations
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission, requireComplianceOfficer } from '../middleware/authMiddleware';
import { ComplianceService } from '../services/complianceService';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/compliance.log' }),
  ],
});

const complianceService = new ComplianceService();

/**
 * GET /api/compliance/checks
 * Get compliance check history
 */
router.get('/checks', requirePermission('compliance:read'), async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, agentType, riskLevel } = req.query;

    const result = await complianceService.getComplianceChecks({
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      agentType: agentType as string,
      riskLevel: riskLevel as string,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: result.checks,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error('Error fetching compliance checks:', error);
    res.status(500).json({
      error: 'Failed to fetch compliance checks',
      code: 'FETCH_CHECKS_ERROR',
    });
  }
});

/**
 * GET /api/compliance/checks/:id
 * Get specific compliance check details
 */
router.get(
  '/checks/:id',
  requirePermission('compliance:read'),
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const check = await complianceService.getComplianceCheckById(req.params.id);

      if (!check) {
        return res.status(404).json({
          error: 'Compliance check not found',
          code: 'CHECK_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: check,
      });
    } catch (error) {
      logger.error('Error fetching compliance check:', error);
      res.status(500).json({
        error: 'Failed to fetch compliance check',
        code: 'FETCH_CHECK_ERROR',
      });
    }
  }
);

/**
 * POST /api/compliance/checks
 * Trigger manual compliance check
 */
router.post(
  '/checks',
  requirePermission('compliance:create'),
  body('transactionId').isString().notEmpty(),
  body('checkType').isIn(['kyc', 'aml', 'sebi', 'full']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { transactionId, checkType, priority = 'normal' } = req.body;

      const check = await complianceService.createComplianceCheck({
        transactionId,
        checkType,
        priority,
        requestedBy: req.user!.id,
      });

      res.status(201).json({
        success: true,
        data: check,
        message: 'Compliance check initiated successfully',
      });
    } catch (error) {
      logger.error('Error creating compliance check:', error);
      res.status(500).json({
        error: 'Failed to create compliance check',
        code: 'CREATE_CHECK_ERROR',
      });
    }
  }
);

/**
 * PUT /api/compliance/checks/:id/approve
 * Approve compliance check (compliance officer only)
 */
router.put(
  '/checks/:id/approve',
  requireComplianceOfficer,
  param('id').isUUID(),
  body('notes').optional().isString().isLength({ max: 1000 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { notes } = req.body;

      const result = await complianceService.approveComplianceCheck(
        req.params.id,
        req.user!.id,
        notes
      );

      if (!result) {
        return res.status(404).json({
          error: 'Compliance check not found or cannot be approved',
          code: 'CHECK_NOT_APPROVABLE',
        });
      }

      res.json({
        success: true,
        message: 'Compliance check approved successfully',
      });
    } catch (error) {
      logger.error('Error approving compliance check:', error);
      res.status(500).json({
        error: 'Failed to approve compliance check',
        code: 'APPROVE_CHECK_ERROR',
      });
    }
  }
);

/**
 * PUT /api/compliance/checks/:id/reject
 * Reject compliance check (compliance officer only)
 */
router.put(
  '/checks/:id/reject',
  requireComplianceOfficer,
  param('id').isUUID(),
  body('reason').isString().notEmpty().isLength({ max: 500 }),
  body('notes').optional().isString().isLength({ max: 1000 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const { reason, notes } = req.body;

      const result = await complianceService.rejectComplianceCheck(
        req.params.id,
        req.user!.id,
        reason,
        notes
      );

      if (!result) {
        return res.status(404).json({
          error: 'Compliance check not found or cannot be rejected',
          code: 'CHECK_NOT_REJECTABLE',
        });
      }

      res.json({
        success: true,
        message: 'Compliance check rejected successfully',
      });
    } catch (error) {
      logger.error('Error rejecting compliance check:', error);
      res.status(500).json({
        error: 'Failed to reject compliance check',
        code: 'REJECT_CHECK_ERROR',
      });
    }
  }
);

/**
 * GET /api/compliance/rules
 * Get compliance rules
 */
router.get('/rules', requirePermission('compliance:read'), async (req: Request, res: Response) => {
  try {
    const { active = true } = req.query;

    const rules = await complianceService.getComplianceRules(Boolean(active));

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    logger.error('Error fetching compliance rules:', error);
    res.status(500).json({
      error: 'Failed to fetch compliance rules',
      code: 'FETCH_RULES_ERROR',
    });
  }
});

/**
 * POST /api/compliance/rules
 * Create compliance rule (admin only)
 */
router.post(
  '/rules',
  requirePermission('compliance:admin'),
  body('ruleName').isString().notEmpty().isLength({ max: 100 }),
  body('ruleType').isIn(['aml', 'kyc', 'regulatory', 'risk']),
  body('conditions').isObject(),
  body('actions').isObject(),
  body('priority').optional().isInt({ min: 1, max: 10 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        });
      }

      const rule = await complianceService.createComplianceRule({
        ...req.body,
        createdBy: req.user!.id,
      });

      res.status(201).json({
        success: true,
        data: rule,
        message: 'Compliance rule created successfully',
      });
    } catch (error) {
      logger.error('Error creating compliance rule:', error);
      res.status(500).json({
        error: 'Failed to create compliance rule',
        code: 'CREATE_RULE_ERROR',
      });
    }
  }
);

/**
 * GET /api/compliance/dashboard
 * Get compliance dashboard metrics
 */
router.get(
  '/dashboard',
  requirePermission('compliance:read'),
  async (req: Request, res: Response) => {
    try {
      const metrics = await complianceService.getDashboardMetrics();

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Error fetching dashboard metrics:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard metrics',
        code: 'FETCH_METRICS_ERROR',
      });
    }
  }
);

export default router;
