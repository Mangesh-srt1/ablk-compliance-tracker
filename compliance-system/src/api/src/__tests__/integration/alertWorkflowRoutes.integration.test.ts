import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      permissions: ['alerts:read', 'alerts:write', 'monitoring:write'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    next();
  },
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

const configureClientAlertsMock = jest.fn();
const getClientAlertSettingsMock = jest.fn();
const dispatchAlertMock = jest.fn();

jest.mock('../../services/alertDispatchService', () => ({
  getAlertDispatchService: () => ({
    configureClientAlerts: configureClientAlertsMock,
    getClientAlertSettings: getClientAlertSettingsMock,
    dispatchAlert: dispatchAlertMock,
  }),
}));

const registerWebhookMock = jest.fn();
const listDeliveriesMock = jest.fn();

jest.mock('../../services/webhookService', () => ({
  getWebhookService: () => ({
    registerWebhook: registerWebhookMock,
    listDeliveries: listDeliveriesMock,
  }),
}));

const createScheduleMock = jest.fn();
const runDueSchedulesMock = jest.fn();

jest.mock('../../services/reScreeningScheduler', () => ({
  getReScreeningScheduler: () => ({
    createSchedule: createScheduleMock,
    runDueSchedules: runDueSchedulesMock,
  }),
}));

import alertWorkflowRoutes from '../../routes/alertWorkflowRoutes';

describe('Integration: Option B alert workflow routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', alertWorkflowRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/v1/alerts/configure validates payload', async () => {
    const response = await request(app).post('/api/v1/alerts/configure').send({
      clientId: 'client-001',
      channels: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_INPUT');
  });

  it('POST /api/v1/alerts/configure stores alert settings', async () => {
    configureClientAlertsMock.mockReturnValue({
      clientId: 'client-001',
      channels: ['EMAIL'],
      suppressionWindowMinutes: 30,
      thresholds: { defaultRiskScore: 60 },
      recipients: { email: ['ops@client.com'] },
      enabled: true,
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app).post('/api/v1/alerts/configure').send({
      clientId: 'client-001',
      channels: ['EMAIL'],
      suppressionWindowMinutes: 30,
      thresholds: { defaultRiskScore: 60 },
      recipients: { email: ['ops@client.com'] },
      enabled: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(configureClientAlertsMock).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/alerts/settings/:clientId returns 404 when missing', async () => {
    getClientAlertSettingsMock.mockReturnValue(undefined);

    const response = await request(app).get('/api/v1/alerts/settings/client-404');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('POST /api/v1/alerts/dispatch dispatches alert event', async () => {
    (dispatchAlertMock as any).mockResolvedValue({
      alertId: 'alert-123',
      suppressed: false,
      deliveryRecords: [{ deliveryId: 'd1', channel: 'EMAIL' }],
    });

    const response = await request(app).post('/api/v1/alerts/dispatch').send({
      clientId: 'client-001',
      entityId: 'entity-001',
      jurisdiction: 'US',
      alertType: 'AML_SCORE_HIGH',
      severity: 'HIGH',
      riskScore: 82,
      message: 'High AML score detected',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(dispatchAlertMock).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/webhooks/register creates webhook registration', async () => {
    registerWebhookMock.mockReturnValue({
      webhookId: 'wh-1',
      clientId: 'client-001',
      url: 'https://example.com/webhook',
      events: ['AML_SCORE_HIGH'],
      enabled: true,
      createdAt: new Date().toISOString(),
    });

    const response = await request(app).post('/api/v1/webhooks/register').send({
      clientId: 'client-001',
      url: 'https://example.com/webhook',
      events: ['AML_SCORE_HIGH'],
      enabled: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(registerWebhookMock).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/monitoring/rescreening/schedule creates schedule', async () => {
    createScheduleMock.mockReturnValue({
      scheduleId: 'sched-1',
      clientId: 'client-001',
      entityId: 'entity-001',
      jurisdiction: 'IN',
      frequencyDays: 30,
      nextRunAt: new Date().toISOString(),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app).post('/api/v1/monitoring/rescreening/schedule').send({
      clientId: 'client-001',
      entityId: 'entity-001',
      jurisdiction: 'IN',
      frequencyDays: 30,
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(createScheduleMock).toHaveBeenCalledTimes(1);
  });
});
