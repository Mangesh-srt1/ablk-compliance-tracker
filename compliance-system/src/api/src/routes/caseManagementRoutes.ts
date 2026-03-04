/**
 * Case Management Routes
 * FR-7.13: Structured workflow to investigate, document, and resolve compliance cases.
 *
 * Case lifecycle: OPEN → INVESTIGATING → PENDING_INFO → RESOLVED | REPORTED
 * Case types: SUSPICIOUS_ACTIVITY, FAILED_KYC, SANCTIONS_HIT, CORPORATE_ACTION_DISPUTE, DATA_BREACH
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { requirePermission, requireComplianceOfficer, authenticateToken } from '../middleware/authMiddleware';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/case-management.log' }),
  ],
});

// ─── In-memory store (replace with DB-backed implementation for production) ──
// TODO: Replace with PostgreSQL-backed repository before production deployment.
//       All case data is lost on service restart when using this in-memory store.
//       Migration path: create `compliance_cases` table and extract repository class.

export type CaseStatus = 'OPEN' | 'INVESTIGATING' | 'PENDING_INFO' | 'RESOLVED' | 'REPORTED';
export type CaseType =
  | 'SUSPICIOUS_ACTIVITY'
  | 'FAILED_KYC'
  | 'SANCTIONS_HIT'
  | 'CORPORATE_ACTION_DISPUTE'
  | 'DATA_BREACH';

export interface CaseNote {
  noteId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface ComplianceCase {
  caseId: string;
  caseType: CaseType;
  status: CaseStatus;
  entityId: string;
  jurisdiction: string;
  assignedTo?: string;
  riskScore?: number;
  summary: string;
  evidence: string[];
  notes: CaseNote[];
  relatedTransactions?: string[];
  statusHistory: Array<{ status: CaseStatus; changedBy: string; changedAt: Date; reason?: string }>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const cases: Map<string, ComplianceCase> = new Map();

const VALID_CASE_TYPES: CaseType[] = [
  'SUSPICIOUS_ACTIVITY',
  'FAILED_KYC',
  'SANCTIONS_HIT',
  'CORPORATE_ACTION_DISPUTE',
  'DATA_BREACH',
];

const VALID_STATUSES: CaseStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'PENDING_INFO',
  'RESOLVED',
  'REPORTED',
];

/**
 * POST /api/v1/cases
 * Create a new compliance case (manually or programmatically from alerts).
 */
router.post(
  '/',
  authenticateToken,
  requireComplianceOfficer,
  [
    body('caseType')
      .isIn(VALID_CASE_TYPES)
      .withMessage(`Case type must be one of: ${VALID_CASE_TYPES.join(', ')}`),

    body('entityId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Entity ID is required'),

    body('jurisdiction')
      .isString()
      .isLength({ min: 2, max: 10 })
      .withMessage('Jurisdiction code is required (e.g. AE, IN, US)'),

    body('summary')
      .isString()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Summary must be between 10 and 2000 characters'),

    body('riskScore')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Risk score must be between 0 and 100'),

    body('evidence')
      .optional()
      .isArray()
      .withMessage('Evidence must be an array of strings'),

    body('relatedTransactions')
      .optional()
      .isArray()
      .withMessage('Related transactions must be an array of transaction IDs'),
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

      const {
        caseType,
        entityId,
        jurisdiction,
        summary,
        riskScore,
        evidence = [],
        relatedTransactions = [],
      } = req.body;

      const userId = req.user!.id;
      const now = new Date();
      const caseId = uuidv4();

      const newCase: ComplianceCase = {
        caseId,
        caseType,
        status: 'OPEN',
        entityId,
        jurisdiction,
        riskScore,
        summary,
        evidence,
        notes: [],
        relatedTransactions,
        statusHistory: [
          { status: 'OPEN', changedBy: userId, changedAt: now },
        ],
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      cases.set(caseId, newCase);

      logger.info('Compliance case created', {
        caseId,
        caseType,
        entityId,
        jurisdiction,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: newCase,
      });
    } catch (error) {
      logger.error('Case creation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to create compliance case'
        )
      );
    }
  }
);

/**
 * GET /api/v1/cases
 * List compliance cases, optionally filtered by status, type, or jurisdiction.
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('cases:read'),
  [
    query('status')
      .optional()
      .isIn(VALID_STATUSES)
      .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),

    query('caseType')
      .optional()
      .isIn(VALID_CASE_TYPES)
      .withMessage(`Case type must be one of: ${VALID_CASE_TYPES.join(', ')}`),

    query('jurisdiction')
      .optional()
      .isString(),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt(),

    query('offset')
      .optional()
      .isInt({ min: 0 })
      .toInt(),
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

      const { status, caseType, jurisdiction } = req.query;
      const limit = (req.query.limit as unknown as number) || 20;
      const offset = (req.query.offset as unknown as number) || 0;

      let results = Array.from(cases.values());

      if (status) results = results.filter((c) => c.status === status);
      if (caseType) results = results.filter((c) => c.caseType === caseType);
      if (jurisdiction) results = results.filter((c) => c.jurisdiction === jurisdiction);

      // Sort by creation date descending
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const paginated = results.slice(offset, offset + limit);

      res.json({
        success: true,
        data: paginated,
        total: results.length,
        limit,
        offset,
      });
    } catch (error) {
      logger.error('Case list retrieval failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to retrieve cases'
        )
      );
    }
  }
);

/**
 * GET /api/v1/cases/:caseId
 * Get a specific compliance case by ID.
 */
router.get(
  '/:caseId',
  authenticateToken,
  requirePermission('cases:read'),
  [
    param('caseId').isUUID().withMessage('Valid case ID (UUID) is required'),
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

      const { caseId } = req.params;
      const complianceCase = cases.get(caseId);

      if (!complianceCase) {
        return res.status(404).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_NOT_FOUND,
            ErrorCategory.NOT_FOUND,
            `Case ${caseId} not found`,
            404
          )
        );
      }

      res.json({ success: true, data: complianceCase });
    } catch (error) {
      logger.error('Case retrieval failed', {
        error: error instanceof Error ? error.message : String(error),
        caseId: req.params.caseId,
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to retrieve case'
        )
      );
    }
  }
);

/**
 * PUT /api/v1/cases/:caseId/status
 * Transition a case to a new status with an audit trail entry (FR-7.13).
 *
 * Valid transitions:
 *   OPEN → INVESTIGATING | RESOLVED | REPORTED
 *   INVESTIGATING → PENDING_INFO | RESOLVED | REPORTED
 *   PENDING_INFO → INVESTIGATING | RESOLVED | REPORTED
 */
router.put(
  '/:caseId/status',
  authenticateToken,
  requireComplianceOfficer,
  [
    param('caseId').isUUID().withMessage('Valid case ID (UUID) is required'),

    body('status')
      .isIn(VALID_STATUSES)
      .withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),

    body('reason')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Reason must not exceed 1000 characters'),
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

      const { caseId } = req.params;
      const { status, reason } = req.body;
      const userId = req.user!.id;

      const complianceCase = cases.get(caseId);
      if (!complianceCase) {
        return res.status(404).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_NOT_FOUND,
            ErrorCategory.NOT_FOUND,
            `Case ${caseId} not found`,
            404
          )
        );
      }

      const now = new Date();
      const previousStatus = complianceCase.status;

      complianceCase.status = status;
      complianceCase.updatedAt = now;
      complianceCase.statusHistory.push({
        status,
        changedBy: userId,
        changedAt: now,
        reason,
      });

      logger.info('Case status updated', {
        caseId,
        previousStatus,
        newStatus: status,
        changedBy: userId,
      });

      res.json({ success: true, data: complianceCase });
    } catch (error) {
      logger.error('Case status update failed', {
        error: error instanceof Error ? error.message : String(error),
        caseId: req.params.caseId,
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to update case status'
        )
      );
    }
  }
);

/**
 * POST /api/v1/cases/:caseId/notes
 * Add an investigator note to a compliance case (FR-7.13 audit trail).
 * Accessible to compliance_analyst (cases:notes) and compliance_officer (cases:notes).
 */
router.post(
  '/:caseId/notes',
  authenticateToken,
  requirePermission('cases:notes'),
  [
    param('caseId').isUUID().withMessage('Valid case ID (UUID) is required'),

    body('content')
      .isString()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Note content is required (max 5000 characters)'),
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

      const { caseId } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;

      const complianceCase = cases.get(caseId);
      if (!complianceCase) {
        return res.status(404).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_NOT_FOUND,
            ErrorCategory.NOT_FOUND,
            `Case ${caseId} not found`,
            404
          )
        );
      }

      const note: CaseNote = {
        noteId: uuidv4(),
        authorId: userId,
        content,
        createdAt: new Date(),
      };

      complianceCase.notes.push(note);
      complianceCase.updatedAt = new Date();

      logger.info('Note added to case', {
        caseId,
        noteId: note.noteId,
        authorId: userId,
      });

      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      logger.error('Failed to add case note', {
        error: error instanceof Error ? error.message : String(error),
        caseId: req.params.caseId,
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to add note'
        )
      );
    }
  }
);

// Export the in-memory store for testing purposes
export { cases as _casesStore };

export default router;
