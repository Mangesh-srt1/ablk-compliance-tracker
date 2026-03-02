/**
 * Webhook Routes
 * FR-9.1: Client webhook registration and delivery management
 * Allows clients to register HTTPS webhook URLs for real-time compliance event notifications.
 *
 * Supported events: kyc.approved, kyc.rejected, kyc.escalated, aml.flagged,
 *                   transfer.blocked, str.filed, case.opened
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission, authenticateToken } from '../middleware/authMiddleware';
import { getWebhookService } from '../services/webhookService';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/webhook-routes.log' }),
  ],
});

/** Supported webhook event types (FR-9.1) */
const SUPPORTED_EVENTS = [
  'kyc.approved',
  'kyc.rejected',
  'kyc.escalated',
  'aml.flagged',
  'transfer.blocked',
  'str.filed',
  'case.opened',
];

/**
 * POST /api/v1/webhooks
 * Register a new webhook endpoint for compliance event notifications.
 *
 * Request body:
 * {
 *   "url": "https://client.example.com/webhook",
 *   "events": ["kyc.approved", "aml.flagged"],
 *   "secret": "optional-hmac-secret"
 * }
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('webhooks:write'),
  [
    body('url')
      .isURL({ protocols: ['https'], require_tld: process.env.NODE_ENV === 'production' })
      .withMessage('A valid HTTPS URL is required'),

    body('events')
      .isArray({ min: 1 })
      .withMessage('At least one event type is required'),

    body('events.*')
      .isIn(SUPPORTED_EVENTS)
      .withMessage(`Event must be one of: ${SUPPORTED_EVENTS.join(', ')}`),

    body('secret')
      .optional()
      .isString()
      .isLength({ min: 8 })
      .withMessage('Secret must be at least 8 characters'),
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

      const { url, events, secret } = req.body;
      const clientId = req.user!.id;

      const webhookService = getWebhookService();
      const registration = webhookService.registerWebhook({
        clientId,
        url,
        events,
        secret,
        enabled: true,
      });

      logger.info('Webhook registered', {
        webhookId: registration.webhookId,
        clientId,
        events,
      });

      res.status(201).json({
        success: true,
        data: {
          webhookId: registration.webhookId,
          url: registration.url,
          events: registration.events,
          enabled: registration.enabled,
          createdAt: registration.createdAt,
        },
      });
    } catch (error) {
      logger.error('Webhook registration failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to register webhook'
        )
      );
    }
  }
);

/**
 * GET /api/v1/webhooks
 * List all webhook registrations for the authenticated client.
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('webhooks:read'),
  async (req: Request, res: Response) => {
    try {
      const clientId = req.user!.id;
      const webhookService = getWebhookService();
      const registrations = webhookService.listRegistrations(clientId);

      res.json({
        success: true,
        data: registrations.map((r) => ({
          webhookId: r.webhookId,
          url: r.url,
          events: r.events,
          enabled: r.enabled,
          createdAt: r.createdAt,
        })),
        count: registrations.length,
      });
    } catch (error) {
      logger.error('Failed to list webhooks', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to retrieve webhooks'
        )
      );
    }
  }
);

/**
 * DELETE /api/v1/webhooks/:webhookId
 * Delete (deactivate) a webhook registration.
 */
router.delete(
  '/:webhookId',
  authenticateToken,
  requirePermission('webhooks:write'),
  [
    param('webhookId')
      .isUUID()
      .withMessage('Valid webhook ID (UUID) is required'),
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

      const { webhookId } = req.params;
      const clientId = req.user!.id;

      const webhookService = getWebhookService();
      const registrations = webhookService.listRegistrations(clientId);
      const target = registrations.find((r) => r.webhookId === webhookId);

      if (!target) {
        return res.status(404).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_NOT_FOUND,
            ErrorCategory.NOT_FOUND,
            'Webhook not found',
            404
          )
        );
      }

      webhookService.deleteWebhook(webhookId);

      logger.info('Webhook deleted', { webhookId, clientId });

      res.json({
        success: true,
        message: 'Webhook deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete webhook', {
        error: error instanceof Error ? error.message : String(error),
        webhookId: req.params.webhookId,
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to delete webhook'
        )
      );
    }
  }
);

/**
 * GET /api/v1/webhooks/:webhookId/logs
 * Get delivery logs for a specific webhook (FR-9.1: 30-day retention).
 */
router.get(
  '/:webhookId/logs',
  authenticateToken,
  requirePermission('webhooks:read'),
  [
    param('webhookId')
      .isUUID()
      .withMessage('Valid webhook ID (UUID) is required'),
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

      const { webhookId } = req.params;
      const clientId = req.user!.id;

      // Verify ownership
      const webhookService = getWebhookService();
      const registrations = webhookService.listRegistrations(clientId);
      const target = registrations.find((r) => r.webhookId === webhookId);

      if (!target) {
        return res.status(404).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_NOT_FOUND,
            ErrorCategory.NOT_FOUND,
            'Webhook not found',
            404
          )
        );
      }

      const logs = webhookService.listDeliveries({ clientId });
      const webhookLogs = logs.filter((l) => l.webhookId === webhookId);

      res.json({
        success: true,
        data: webhookLogs,
        count: webhookLogs.length,
      });
    } catch (error) {
      logger.error('Failed to retrieve webhook logs', {
        error: error instanceof Error ? error.message : String(error),
        webhookId: req.params.webhookId,
      });
      res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to retrieve webhook logs'
        )
      );
    }
  }
);

export default router;
