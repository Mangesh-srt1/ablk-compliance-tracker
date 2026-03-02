import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { WebhookDeliveryRecord, WebhookRegistration } from '../types/alerts.types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/webhook-service.log' }),
  ],
});

export class WebhookService {
  private registrations: Map<string, WebhookRegistration> = new Map();
  private deliveryLog: WebhookDeliveryRecord[] = [];

  registerWebhook(input: Omit<WebhookRegistration, 'webhookId' | 'createdAt'>): WebhookRegistration {
    const registration: WebhookRegistration = {
      ...input,
      webhookId: uuidv4(),
      createdAt: new Date(),
    };

    this.registrations.set(registration.webhookId, registration);
    logger.info('Webhook registered', {
      webhookId: registration.webhookId,
      clientId: registration.clientId,
      events: registration.events,
    });

    return registration;
  }

  listRegistrations(clientId?: string): WebhookRegistration[] {
    const values = Array.from(this.registrations.values());
    if (!clientId) {
      return values;
    }
    return values.filter((entry) => entry.clientId === clientId);
  }

  async dispatchEvent(clientId: string, eventType: string, payload: Record<string, unknown>): Promise<WebhookDeliveryRecord[]> {
    const targets = Array.from(this.registrations.values()).filter(
      (entry) => entry.enabled && entry.clientId === clientId && entry.events.includes(eventType)
    );

    const results: WebhookDeliveryRecord[] = [];

    for (const target of targets) {
      const deliveryId = uuidv4();
      try {
        if (process.env.WEBHOOK_REAL_DISPATCH === 'true') {
          const response = await fetch(target.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(target.secret ? { 'x-webhook-secret': target.secret } : {}),
            },
            body: JSON.stringify({ eventType, payload }),
          });

          const record: WebhookDeliveryRecord = {
            deliveryId,
            webhookId: target.webhookId,
            clientId,
            eventType,
            status: response.ok ? 'SENT' : 'FAILED',
            responseCode: response.status,
            attemptedAt: new Date(),
            ...(response.ok ? {} : { error: `HTTP_${response.status}` }),
          };

          this.deliveryLog.push(record);
          results.push(record);
        } else {
          const record: WebhookDeliveryRecord = {
            deliveryId,
            webhookId: target.webhookId,
            clientId,
            eventType,
            status: 'SENT',
            responseCode: 200,
            attemptedAt: new Date(),
          };

          this.deliveryLog.push(record);
          results.push(record);
        }
      } catch (error) {
        const record: WebhookDeliveryRecord = {
          deliveryId,
          webhookId: target.webhookId,
          clientId,
          eventType,
          status: 'FAILED',
          attemptedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };

        this.deliveryLog.push(record);
        results.push(record);
      }
    }

    logger.info('Webhook dispatch completed', {
      clientId,
      eventType,
      totalTargets: targets.length,
      sent: results.filter((entry) => entry.status === 'SENT').length,
      failed: results.filter((entry) => entry.status === 'FAILED').length,
    });

    return results;
  }

  listDeliveries(filters?: {
    clientId?: string;
    eventType?: string;
    status?: 'SENT' | 'FAILED';
  }): WebhookDeliveryRecord[] {
    let items = this.deliveryLog;

    if (filters?.clientId) {
      items = items.filter((entry) => entry.clientId === filters.clientId);
    }

    if (filters?.eventType) {
      items = items.filter((entry) => entry.eventType === filters.eventType);
    }

    if (filters?.status) {
      items = items.filter((entry) => entry.status === filters.status);
    }

    return items;
  }

  /**
   * Delete (deactivate) a webhook registration (FR-9.1).
   */
  deleteWebhook(webhookId: string): boolean {
    const existed = this.registrations.has(webhookId);
    if (existed) {
      this.registrations.delete(webhookId);
      logger.info('Webhook deleted', { webhookId });
    }
    return existed;
  }

  resetForTests(): void {
    this.registrations.clear();
    this.deliveryLog = [];
  }
}

let instance: WebhookService | null = null;

export function getWebhookService(): WebhookService {
  if (!instance) {
    instance = new WebhookService();
  }
  return instance;
}
