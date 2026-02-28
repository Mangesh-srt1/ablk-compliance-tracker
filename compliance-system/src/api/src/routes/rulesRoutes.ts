/**
 * Rules Routes
 * REST API for the RAG compliance document store.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { ragService } from '../services/ragService';

const router = Router();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rules-routes.log' }),
  ],
});

/**
 * GET /api/rules
 * Query compliance rule documents.
 * Query params: query (string), jurisdiction (string), limit (number)
 */
router.get(
  '/rules',
  requirePermission('compliance:read'),
  [
    query('query').isString().isLength({ min: 1, max: 500 }).withMessage('query must be 1-500 chars'),
    query('jurisdiction').isString().isLength({ min: 1, max: 10 }).withMessage('jurisdiction is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { query: q, jurisdiction, limit } = req.query as Record<string, string>;
      const result = await ragService.queryDocuments(q, jurisdiction, limit ? parseInt(limit, 10) : 10);

      res.json({ status: 'success', data: result });
    } catch (error) {
      logger.error('Error querying rules', { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  }
);

/**
 * POST /api/rules
 * Ingest a new compliance rule document.
 */
router.post(
  '/rules',
  requirePermission('compliance:write'),
  [
    body('content').isString().isLength({ min: 1, max: 50000 }).withMessage('content must be 1-50000 chars'),
    body('jurisdiction').isString().isLength({ min: 1, max: 10 }).withMessage('jurisdiction is required'),
    body('documentType')
      .isIn(['regulation', 'rule', 'guideline'])
      .withMessage('documentType must be regulation, rule, or guideline'),
    body('metadata').optional().isObject().withMessage('metadata must be an object'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { content, jurisdiction, documentType, metadata } = req.body as {
        content: string;
        jurisdiction: string;
        documentType: string;
        metadata?: Record<string, unknown>;
      };

      const doc = await ragService.ingestDocument({ content, jurisdiction, documentType, metadata });
      res.status(201).json({ status: 'success', data: doc });
    } catch (error) {
      logger.error('Error ingesting rule', { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  }
);

/**
 * DELETE /api/rules/:id
 * Delete a compliance rule document.
 */
router.delete(
  '/rules/:id',
  requirePermission('admin'),
  [
    param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const id = parseInt(req.params.id, 10);
      await ragService.deleteDocument(id);
      res.json({ status: 'success', message: `Document ${id} deleted` });
    } catch (error) {
      logger.error('Error deleting rule', {
        id: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/rules/jurisdiction/:code
 * Get all compliance documents for a jurisdiction.
 */
router.get(
  '/rules/jurisdiction/:code',
  requirePermission('compliance:read'),
  [
    param('code').isString().isLength({ min: 1, max: 10 }).withMessage('jurisdiction code is required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const documents = await ragService.getDocumentsByJurisdiction(req.params.code);
      res.json({ status: 'success', data: { documents, count: documents.length } });
    } catch (error) {
      logger.error('Error fetching rules by jurisdiction', {
        jurisdiction: req.params.code,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

export default router;
