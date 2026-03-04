/**
 * SAR/CTR API Routes
 * Endpoints for automated Suspicious Activity Report (SAR) and Currency Transaction Report (CTR) filing
 * Phase 1 Implementation
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import winston from 'winston';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { getSARCTRAutomationService } from '../services/sarCtrAutomationService';
import { getSARThresholdEngine } from '../services/sarThresholdEngine';
import { getFinCenCtRGenerator } from '../services/finCenCtRGenerator';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';
import { SARJurisdiction, CTRCurrency, SARGenerationRequest, CTRGenerationRequest } from '../types/sar-ctr.types';

const router = Router();
const automationService = getSARCTRAutomationService();
const thresholdEngine = getSARThresholdEngine();
const ctrGenerator = getFinCenCtRGenerator();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/sar-ctr-routes.log' }),
  ],
});

// ═══════════════════════════════════════════════════════════════════
// SAR Routes
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/reports/sar/auto-generate
 * Automatically generate SAR based on transaction evaluation
 */
router.post(
  '/sar/auto-generate',
  authenticateToken,
  requirePermission('sar:file'),
  [
    body('entityId').notEmpty().isUUID(),
    body('jurisdiction').isIn(['US', 'AE', 'IN', 'SA', 'EU']),
    body('transactionIds').isArray().notEmpty(),
    body('amlScore').optional().isNumeric(),
    body('hawalaScore').optional().isNumeric(),
    body('sanctionsDetails').optional().isArray(),
    body('manualNote').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { entityId, jurisdiction, transactionIds, amlScore, hawalaScore, sanctionsDetails, manualNote } =
        req.body as any;

      // TODO: Fetch entity data from database
      const entityData = { id: entityId, name: 'Entity Name', type: 'individual', jurisdiction };

      const sarRequest: SARGenerationRequest = {
        entityId,
        jurisdiction,
        transactionIds,
        amlScore,
        hawalaScore,
        sanctionsDetails,
        manualNote,
      };

      const sarDraft = await automationService.generateSAR(sarRequest, entityData);

      logger.info('SAR auto-generated', {
        sarId: sarDraft.sarId,
        entityId,
        jurisdiction,
        triggers: sarDraft.triggers.length,
      });

      res.status(200).json({
        success: true,
        data: sarDraft,
        message: 'SAR draft generated successfully',
      });
    } catch (error: any) {
      logger.error('SAR generation failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

/**
 * POST /api/v1/reports/sar/submit
 * Submit SAR draft to FIU/regulatory authority
 */
router.post(
  '/sar/submit',
  authenticateToken,
  requirePermission('sar:file'),
  [body('sarId').notEmpty().isUUID(), body('submittedBy').optional().isString()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { sarId, submittedBy } = req.body;
      const userId = submittedBy || req.user?.id || 'system';

      const submission = await automationService.submitSAR(sarId, userId);

      logger.info('SAR submitted', {
        sarId,
        filingId: submission.filingId,
        filingReference: submission.filingReference,
        submittedBy: userId,
      });

      res.status(200).json({
        success: true,
        data: submission,
        message: 'SAR submitted successfully',
      });
    } catch (error: any) {
      logger.error('SAR submission failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

/**
 * GET /api/v1/reports/sar/history
 * List all SARs with optional filtering
 */
router.get(
  '/sar/history',
  authenticateToken,
  requirePermission('reports:read'),
  [
    query('status').optional().isIn(['DRAFT', 'PENDING_REVIEW', 'SUBMITTED', 'ACKNOWLEDGED', 'REJECTED']),
    query('jurisdiction').optional().isIn(['US', 'AE', 'IN', 'SA', 'EU']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { status, jurisdiction, startDate, endDate } = req.query as any;

      const sars = automationService.listSARs({
        status: status as any,
        jurisdiction: jurisdiction as SARJurisdiction,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      res.status(200).json({
        success: true,
        data: {
          sars,
          count: sars.length,
          filters: { status, jurisdiction, startDate, endDate },
        },
        message: 'SAR history retrieved',
      });
    } catch (error: any) {
      logger.error('SAR history retrieval failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

/**
 * GET /api/v1/reports/sar/:sarId
 * Get detailed SAR record and filing status
 */
router.get(
  '/sar/:sarId',
  authenticateToken,
  requirePermission('reports:read'),
  (req: Request, res: Response) => {
    try {
      const { sarId } = req.params;

      const sar = automationService.getSARDraft(sarId);
      if (!sar) {
        return res.status(404).json({
          success: false,
          error: 'SAR not found',
          code: ErrorCode.RESOURCE_NOT_FOUND,
        });
      }

      const auditLog = automationService.getAuditLog({ reportId: sarId });

      res.status(200).json({
        success: true,
        data: {
          sar,
          auditLog,
        },
        message: 'SAR details retrieved',
      });
    } catch (error: any) {
      logger.error('SAR retrieval failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// CTR Routes
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/reports/ctr/auto-generate
 * Automatically populate CTR form from transaction data
 */
router.post(
  '/ctr/auto-generate',
  authenticateToken,
  requirePermission('sar:file'),
  [
    body('entityId').notEmpty().isUUID(),
    body('currency').isIn(['USD', 'AED', 'INR', 'SAR', 'EUR']),
    body('transactionIds').isArray().notEmpty(),
    body('aggregatedAmount').isNumeric().toFloat(),
    body('threshold').optional().isNumeric().toFloat(),
    body('narrative').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { entityId, currency, transactionIds, aggregatedAmount, threshold, narrative } = req.body as any;

      // TODO: Fetch entity data from database
      const entityData = { id: entityId, name: 'Entity Name', type: 'individual' };

      const ctrRequest: CTRGenerationRequest = {
        entityId,
        currency,
        transactionIds,
        aggregatedAmount,
        threshold,
        narrative,
      };

      const ctrForm = await automationService.generateCTR(ctrRequest, entityData);

      logger.info('CTR auto-generated', {
        ctrId: ctrForm.ctrId,
        entityId,
        currency,
        totalAmount: aggregatedAmount,
      });

      res.status(200).json({
        success: true,
        data: ctrForm,
        message: 'CTR form generated successfully',
      });
    } catch (error: any) {
      logger.error('CTR generation failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

/**
 * POST /api/v1/reports/ctr/submit
 * Submit CTR to FinCEN or equivalent banking authority
 */
router.post(
  '/ctr/submit',
  authenticateToken,
  requirePermission('sar:file'),
  [body('ctrId').notEmpty().isUUID(), body('targetAuthority').optional().isString()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { ctrId, targetAuthority } = req.body;
      const userId = req.user?.id || 'system';

      const submission = await automationService.submitCTR(ctrId, userId, { targetAuthority });

      logger.info('CTR submitted', {
        ctrId,
        filingId: submission.filingId,
        filingReference: submission.filingReference,
        targetAuthority,
      });

      res.status(200).json({
        success: true,
        data: submission,
        message: 'CTR submitted successfully',
      });
    } catch (error: any) {
      logger.error('CTR submission failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

/**
 * GET /api/v1/reports/ctr/pending
 * List CTRs awaiting submission before filing deadline
 */
router.get(
  '/ctr/pending',
  authenticateToken,
  requirePermission('reports:read'),
  async (req: Request, res: Response) => {
    try {
      const ctrs = automationService.listCTRs({ status: 'DRAFT' as any });

      const now = new Date();
      const pending = ctrs.filter((ctr) => ctr.filingDeadline >= now);

      // Sort by deadline (urgent first)
      pending.sort((a, b) => a.filingDeadline.getTime() - b.filingDeadline.getTime());

      const urgentCTRs = pending.filter((ctr) => {
        const daysUntilDeadline = (ctr.filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilDeadline <= 3;
      });

      res.status(200).json({
        success: true,
        data: {
          pendingCTRs: pending,
          urgentCTRs,
          totalPending: pending.length,
          totalUrgent: urgentCTRs.length,
        },
        message: 'Pending CTRs retrieved',
      });
    } catch (error: any) {
      logger.error('Pending CTR retrieval failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// Batch Operations
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/reports/batch-submit
 * Submit multiple SARs/CTRs in batch
 */
router.post(
  '/batch-submit',
  authenticateToken,
  requirePermission('sar:file'),
  [body('reportIds').isArray().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { reportIds } = req.body;
      const userId = req.user?.id || 'system';

      const result = await automationService.batchSubmit(reportIds, userId);

      logger.info('Batch submission completed', {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: `Batch submitted: ${result.successCount} successful, ${result.failureCount} failed`,
      });
    } catch (error: any) {
      logger.error('Batch submission failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// Trigger Testing & Configuration
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/reports/trigger-rules/test
 * Test current transactions against SAR/CTR triggers
 */
router.post(
  '/trigger-rules/test',
  authenticateToken,
  requirePermission('compliance:read'),
  [
    body('entityId').notEmpty().isUUID(),
    body('jurisdiction').isIn(['US', 'AE', 'IN', 'SA', 'EU']),
    body('amlScore').optional().isNumeric(),
    body('hawalaScore').optional().isNumeric(),
    body('sanctionsMatches').optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { entityId, jurisdiction, amlScore, hawalaScore, sanctionsMatches } = req.body as any;

      const evaluation = await thresholdEngine.evaluateTriggers({
        entityId,
        jurisdiction,
        transactions: [],
        amlScore: amlScore || 0,
        hawalaScore,
        sanctionsMatches,
      });

      res.status(200).json({
        success: true,
        data: evaluation,
        message: 'Trigger evaluation completed',
      });
    } catch (error: any) {
      logger.error('Trigger evaluation failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

/**
 * GET /api/v1/reports/sar-ctr/config/:jurisdiction
 * Get SAR/CTR configuration for jurisdiction
 */
router.get(
  '/sar-ctr/config/:jurisdiction',
  authenticateToken,
  requirePermission('compliance:read'),
  (req: Request, res: Response) => {
    try {
      const { jurisdiction } = req.params as any;

      const config = thresholdEngine.getConfig(jurisdiction);
      if (!config) {
        return res.status(404).json({
          success: false,
          error: `Configuration not found for jurisdiction: ${jurisdiction}`,
          code: ErrorCode.RESOURCE_NOT_FOUND,
        });
      }

      res.status(200).json({
        success: true,
        data: config,
        message: 'Configuration retrieved',
      });
    } catch (error: any) {
      logger.error('Config retrieval failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message,
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
    }
  }
);

export default router;
