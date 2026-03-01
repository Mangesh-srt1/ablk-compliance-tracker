import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { requirePermission } from '../middleware/authMiddleware';
import { getAlertDispatchService } from '../services/alertDispatchService';
import { getWebhookService } from '../services/webhookService';
import { getReScreeningScheduler } from '../services/reScreeningScheduler';
import { createErrorResponseFromDetails, ErrorCategory, ErrorCode } from '../types/errors';

const router = Router();
const alertService = getAlertDispatchService();
const webhookService = getWebhookService();
const scheduler = getReScreeningScheduler();

router.post(
  '/alerts/configure',
  requirePermission('alerts:write'),
  [
    body('clientId').isString().notEmpty(),
    body('channels').isArray({ min: 1 }),
    body('suppressionWindowMinutes').isInt({ min: 1, max: 1440 }),
    body('thresholds.defaultRiskScore').isInt({ min: 0, max: 100 }),
    body('enabled').isBoolean(),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid alert configuration payload',
          400,
          errors.array()
        )
      );
    }

    const config = alertService.configureClientAlerts(req.body);
    return res.status(200).json({ success: true, data: config });
  }
);

router.get(
  '/alerts/settings/:clientId',
  requirePermission('alerts:read'),
  [param('clientId').isString().notEmpty()],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid clientId',
          400,
          errors.array()
        )
      );
    }

    const item = alertService.getClientAlertSettings(req.params.clientId);
    if (!item) {
      return res.status(404).json(
        createErrorResponseFromDetails(
          ErrorCode.RESOURCE_NOT_FOUND,
          ErrorCategory.NOT_FOUND,
          'Alert settings not found',
          404
        )
      );
    }

    return res.status(200).json({ success: true, data: item });
  }
);

router.post(
  '/alerts/dispatch',
  requirePermission('alerts:write'),
  [
    body('clientId').isString().notEmpty(),
    body('entityId').isString().notEmpty(),
    body('jurisdiction').isString().notEmpty(),
    body('alertType').isString().notEmpty(),
    body('severity').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    body('riskScore').isInt({ min: 0, max: 100 }),
    body('message').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid alert payload',
          400,
          errors.array()
        )
      );
    }

    const result = await alertService.dispatchAlert({
      ...req.body,
      alertId: `alert-${Date.now()}`,
      timestamp: new Date(),
    });

    return res.status(200).json({ success: true, data: result });
  }
);

router.post(
  '/webhooks/register',
  requirePermission('alerts:write'),
  [body('clientId').isString().notEmpty(), body('url').isURL(), body('events').isArray({ min: 1 })],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid webhook registration payload',
          400,
          errors.array()
        )
      );
    }

    const registration = webhookService.registerWebhook(req.body);
    return res.status(201).json({ success: true, data: registration });
  }
);

router.get(
  '/webhooks/deliveries',
  requirePermission('alerts:read'),
  [query('clientId').optional().isString(), query('eventType').optional().isString(), query('status').optional().isIn(['SENT', 'FAILED'])],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid delivery filter',
          400,
          errors.array()
        )
      );
    }

    const data = webhookService.listDeliveries({
      ...(req.query.clientId ? { clientId: String(req.query.clientId) } : {}),
      ...(req.query.eventType ? { eventType: String(req.query.eventType) } : {}),
      ...(req.query.status ? { status: req.query.status as 'SENT' | 'FAILED' } : {}),
    });

    return res.status(200).json({ success: true, data, count: data.length });
  }
);

router.post(
  '/monitoring/rescreening/schedule',
  requirePermission('monitoring:write'),
  [
    body('clientId').isString().notEmpty(),
    body('entityId').isString().notEmpty(),
    body('jurisdiction').isString().notEmpty(),
    body('frequencyDays').isInt({ min: 1, max: 365 }),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid rescreening payload',
          400,
          errors.array()
        )
      );
    }

    const schedule = scheduler.createSchedule(req.body);
    return res.status(201).json({ success: true, data: schedule });
  }
);

router.post('/monitoring/rescreening/run', requirePermission('monitoring:write'), (req: Request, res: Response) => {
  const result = scheduler.runDueSchedules(new Date());
  return res.status(200).json({ success: true, data: result });
});

export default router;
