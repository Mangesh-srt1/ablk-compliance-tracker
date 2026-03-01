import { beforeEach, describe, expect, it } from '@jest/globals';
import { getAlertDispatchService } from '../alertDispatchService';
import { getWebhookService } from '../webhookService';
import { getReScreeningScheduler } from '../reScreeningScheduler';

describe('Option B: Alerting, Webhooks, Re-screening', () => {
  const alertService = getAlertDispatchService();
  const webhookService = getWebhookService();
  const scheduler = getReScreeningScheduler();

  beforeEach(() => {
    alertService.resetForTests();
    webhookService.resetForTests();
    scheduler.resetForTests();
  });

  it('configures alerts and dispatches over email/slack', async () => {
    alertService.configureClientAlerts({
      clientId: 'client-001',
      channels: ['EMAIL', 'SLACK'],
      suppressionWindowMinutes: 30,
      thresholds: { defaultRiskScore: 60 },
      recipients: {
        email: ['compliance@client.com'],
        slackWebhookUrls: ['https://hooks.slack.com/test'],
      },
      enabled: true,
    });

    const result = await alertService.dispatchAlert({
      alertId: 'alert-1',
      clientId: 'client-001',
      entityId: 'entity-001',
      jurisdiction: 'US',
      alertType: 'AML_SCORE_HIGH',
      severity: 'HIGH',
      riskScore: 80,
      message: 'High AML score',
      timestamp: new Date(),
    });

    expect(result.suppressed).toBe(false);
    expect(result.deliveryRecords.length).toBe(2);
  });

  it('suppresses duplicate alerts within suppression window', async () => {
    alertService.configureClientAlerts({
      clientId: 'client-001',
      channels: ['EMAIL'],
      suppressionWindowMinutes: 60,
      thresholds: { defaultRiskScore: 0 },
      recipients: { email: ['ops@client.com'] },
      enabled: true,
    });

    const now = new Date();
    await alertService.dispatchAlert({
      alertId: 'alert-1',
      clientId: 'client-001',
      entityId: 'entity-001',
      jurisdiction: 'AE',
      alertType: 'STRUCTURING_PATTERN',
      severity: 'HIGH',
      riskScore: 95,
      message: 'Potential structuring',
      timestamp: now,
    });

    const second = await alertService.dispatchAlert({
      alertId: 'alert-2',
      clientId: 'client-001',
      entityId: 'entity-001',
      jurisdiction: 'AE',
      alertType: 'STRUCTURING_PATTERN',
      severity: 'HIGH',
      riskScore: 95,
      message: 'Potential structuring duplicate',
      timestamp: new Date(now.getTime() + 10 * 60 * 1000),
    });

    expect(second.suppressed).toBe(true);
    expect(second.reason).toContain('Suppressed duplicate');
  });

  it('registers webhook and records webhook delivery', async () => {
    webhookService.registerWebhook({
      clientId: 'client-001',
      url: 'https://example.com/webhook',
      events: ['AML_SCORE_HIGH'],
      enabled: true,
    });

    alertService.configureClientAlerts({
      clientId: 'client-001',
      channels: ['WEBHOOK'],
      suppressionWindowMinutes: 30,
      thresholds: { defaultRiskScore: 0 },
      recipients: {},
      enabled: true,
    });

    const dispatch = await alertService.dispatchAlert({
      alertId: 'alert-3',
      clientId: 'client-001',
      entityId: 'entity-777',
      jurisdiction: 'US',
      alertType: 'AML_SCORE_HIGH',
      severity: 'CRITICAL',
      riskScore: 99,
      message: 'Critical event',
      timestamp: new Date(),
    });

    const deliveries = webhookService.listDeliveries({ clientId: 'client-001' });

    expect(dispatch.suppressed).toBe(false);
    expect(dispatch.deliveryRecords.length).toBe(1);
    expect(deliveries.length).toBe(1);
    expect(deliveries[0]?.status).toBe('SENT');
  });

  it('creates schedule and runs due re-screening jobs', () => {
    scheduler.createSchedule({
      clientId: 'client-001',
      entityId: 'entity-001',
      jurisdiction: 'IN',
      frequencyDays: 30,
      nextRunAt: new Date('2026-03-01T00:00:00Z'),
    });

    const result = scheduler.runDueSchedules(new Date('2026-03-01T01:00:00Z'));

    expect(result.processed).toBe(1);
    expect(result.triggered.length).toBe(1);
    expect(result.triggered[0]?.entityId).toBe('entity-001');
  });
});
