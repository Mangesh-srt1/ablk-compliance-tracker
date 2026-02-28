/**
 * Analytics Routes
 * REST API for compliance metrics, risk trends, and jurisdiction analytics.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { analyticsService } from '../services/analyticsService';

const router = Router();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/analytics-routes.log' }),
  ],
});

/**
 * GET /api/analytics/metrics
 * Overall compliance metrics.
 * Query params: startDate (ISO8601), endDate (ISO8601), jurisdiction (string)
 */
router.get(
  '/metrics',
  requirePermission('compliance:read'),
  [
    query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO8601 date'),
    query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO8601 date'),
    query('jurisdiction').optional().isString().isLength({ min: 1, max: 10 }).withMessage('jurisdiction max 10 chars'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { startDate, endDate, jurisdiction } = req.query as Record<string, string | undefined>;
      const metrics = await analyticsService.getComplianceMetrics(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        jurisdiction
      );

      res.json({ status: 'success', data: metrics });
    } catch (error) {
      logger.error('Error fetching metrics', { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  }
);

/**
 * GET /api/analytics/trends
 * Risk trends over time.
 * Query params: days (integer, default 30), jurisdiction (string)
 */
router.get(
  '/trends',
  requirePermission('compliance:read'),
  [
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be 1-365'),
    query('jurisdiction').optional().isString().isLength({ min: 1, max: 10 }).withMessage('jurisdiction max 10 chars'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { days, jurisdiction } = req.query as Record<string, string | undefined>;
      const trends = await analyticsService.getRiskTrends(
        days ? parseInt(days, 10) : 30,
        jurisdiction
      );

      res.json({ status: 'success', data: trends });
    } catch (error) {
      logger.error('Error fetching trends', { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  }
);

/**
 * GET /api/analytics/jurisdiction/:code
 * Jurisdiction-specific metrics.
 */
router.get(
  '/jurisdiction/:code',
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

      const metrics = await analyticsService.getJurisdictionMetrics(req.params.code);
      res.json({ status: 'success', data: metrics });
    } catch (error) {
      logger.error('Error fetching jurisdiction metrics', {
        jurisdiction: req.params.code,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /api/analytics/risk-factors
 * Top risk factors across all compliance checks.
 * Query params: limit (integer, default 10)
 */
router.get(
  '/risk-factors',
  requirePermission('compliance:read'),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }

      const { limit } = req.query as Record<string, string | undefined>;
      const factors = await analyticsService.getTopRiskFactors(limit ? parseInt(limit, 10) : 10);

      res.json({ status: 'success', data: factors });
    } catch (error) {
      logger.error('Error fetching risk factors', { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  }
);

/**
 * GET /api/analytics/dashboard
 * Dashboard summary: metrics + top risk factors.
 */
router.get(
  '/dashboard',
  requirePermission('compliance:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [metrics, topFactors, trends] = await Promise.all([
        analyticsService.getComplianceMetrics(),
        analyticsService.getTopRiskFactors(5),
        analyticsService.getRiskTrends(7),
      ]);

      res.json({
        status: 'success',
        data: {
          metrics,
          topRiskFactors: topFactors,
          recentTrends: trends,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error fetching dashboard', { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  }
);

export default router;
