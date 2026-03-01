import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertConfig,
  AlertDeliveryRecord,
  AlertDispatchResult,
  AlertEvent,
  AlertSeverity,
} from '../types/alerts.types';
import { getWebhookService } from './webhookService';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/alert-dispatch-service.log' }),
  ],
});

const severityRank: Record<AlertSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export class AlertDispatchService {
  private configs: Map<string, AlertConfig> = new Map();
  private deliveryLog: AlertDeliveryRecord[] = [];
  private suppressionMap: Map<string, Date> = new Map();
  private webhookService = getWebhookService();

  configureClientAlerts(input: Omit<AlertConfig, 'updatedAt'>): AlertConfig {
    const config: AlertConfig = {
      ...input,
      updatedAt: new Date(),
    };

    this.configs.set(config.clientId, config);
    logger.info('Alert config updated', {
      clientId: config.clientId,
      channels: config.channels,
      suppressionWindowMinutes: config.suppressionWindowMinutes,
    });

    return config;
  }

  getClientAlertSettings(clientId: string): AlertConfig | undefined {
    return this.configs.get(clientId);
  }

  async dispatchAlert(event: AlertEvent): Promise<AlertDispatchResult> {
    const config = this.configs.get(event.clientId);
    if (!config || !config.enabled) {
      return {
        alertId: event.alertId,
        suppressed: true,
        reason: 'Alerting not configured or disabled',
        deliveryRecords: [],
      };
    }

    const minThreshold = config.thresholds.byAlertType?.[event.alertType] ?? config.thresholds.defaultRiskScore;
    if (event.riskScore < minThreshold) {
      return {
        alertId: event.alertId,
        suppressed: true,
        reason: `Risk score ${event.riskScore} below threshold ${minThreshold}`,
        deliveryRecords: [],
      };
    }

    const suppressionKey = `${event.clientId}:${event.entityId}:${event.alertType}:${event.severity}`;
    const previousEventTime = this.suppressionMap.get(suppressionKey);
    if (previousEventTime) {
      const suppressionMs = config.suppressionWindowMinutes * 60 * 1000;
      if (event.timestamp.getTime() - previousEventTime.getTime() < suppressionMs) {
        return {
          alertId: event.alertId,
          suppressed: true,
          reason: 'Suppressed duplicate alert within suppression window',
          deliveryRecords: [],
        };
      }
    }

    this.suppressionMap.set(suppressionKey, event.timestamp);

    const records: AlertDeliveryRecord[] = [];

    for (const channel of config.channels) {
      if (channel === 'WEBHOOK') {
        const webhookRecords = await this.webhookService.dispatchEvent(
          event.clientId,
          event.alertType,
          {
            alertId: event.alertId,
            entityId: event.entityId,
            severity: event.severity,
            riskScore: event.riskScore,
            message: event.message,
            metadata: event.metadata,
          }
        );

        for (const entry of webhookRecords) {
          records.push({
            deliveryId: entry.deliveryId,
            alertId: event.alertId,
            clientId: event.clientId,
            channel: 'WEBHOOK',
            destination: entry.webhookId,
            status: entry.status === 'SENT' ? 'SENT' : 'FAILED',
            attemptedAt: entry.attemptedAt,
            ...(entry.error ? { error: entry.error } : {}),
          });
        }
        continue;
      }

      const destinations = this.getChannelDestinations(config, channel);
      for (const destination of destinations) {
        const record: AlertDeliveryRecord = {
          deliveryId: uuidv4(),
          alertId: event.alertId,
          clientId: event.clientId,
          channel,
          destination,
          status: 'SENT',
          attemptedAt: new Date(),
        };
        records.push(record);
      }
    }

    this.deliveryLog.push(...records);

    logger.info('Alert dispatched', {
      alertId: event.alertId,
      clientId: event.clientId,
      severity: event.severity,
      deliveries: records.length,
    });

    return {
      alertId: event.alertId,
      suppressed: false,
      deliveryRecords: records,
    };
  }

  listDeliveryLog(clientId?: string): AlertDeliveryRecord[] {
    if (!clientId) {
      return this.deliveryLog;
    }
    return this.deliveryLog.filter((entry) => entry.clientId === clientId);
  }

  private getChannelDestinations(config: AlertConfig, channel: AlertDeliveryRecord['channel']): string[] {
    switch (channel) {
      case 'EMAIL':
        return config.recipients.email ?? [];
      case 'SMS':
        return config.recipients.sms ?? [];
      case 'SLACK':
        return config.recipients.slackWebhookUrls ?? [];
      default:
        return [];
    }
  }

  resetForTests(): void {
    this.configs.clear();
    this.deliveryLog = [];
    this.suppressionMap.clear();
  }
}

let instance: AlertDispatchService | null = null;

export function getAlertDispatchService(): AlertDispatchService {
  if (!instance) {
    instance = new AlertDispatchService();
  }
  return instance;
}
