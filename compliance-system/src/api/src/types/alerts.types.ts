/**
 * Alerting and monitoring types for Option B.
 */

export type AlertChannel = 'EMAIL' | 'SMS' | 'SLACK' | 'WEBHOOK';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SUPPRESSED';

export interface AlertThresholds {
  defaultRiskScore: number;
  byAlertType?: Record<string, number>;
}

export interface AlertConfig {
  clientId: string;
  channels: AlertChannel[];
  suppressionWindowMinutes: number;
  thresholds: AlertThresholds;
  recipients: {
    email?: string[];
    sms?: string[];
    slackWebhookUrls?: string[];
  };
  enabled: boolean;
  updatedAt: Date;
}

export interface AlertEvent {
  alertId: string;
  clientId: string;
  entityId: string;
  jurisdiction: string;
  alertType: string;
  severity: AlertSeverity;
  riskScore: number;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AlertDeliveryRecord {
  deliveryId: string;
  alertId: string;
  clientId: string;
  channel: AlertChannel;
  destination: string;
  status: AlertDeliveryStatus;
  error?: string;
  attemptedAt: Date;
}

export interface AlertDispatchResult {
  alertId: string;
  suppressed: boolean;
  reason?: string;
  deliveryRecords: AlertDeliveryRecord[];
}

export interface WebhookRegistration {
  webhookId: string;
  clientId: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  createdAt: Date;
}

export interface WebhookDeliveryRecord {
  deliveryId: string;
  webhookId: string;
  clientId: string;
  eventType: string;
  status: 'SENT' | 'FAILED';
  responseCode?: number;
  error?: string;
  attemptedAt: Date;
}

export interface ReScreeningSchedule {
  scheduleId: string;
  clientId: string;
  entityId: string;
  jurisdiction: string;
  frequencyDays: number;
  nextRunAt: Date;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
