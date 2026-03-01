import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { ReScreeningSchedule } from '../types/alerts.types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/re-screening-scheduler.log' }),
  ],
});

export class ReScreeningScheduler {
  private schedules: Map<string, ReScreeningSchedule> = new Map();

  createSchedule(input: {
    clientId: string;
    entityId: string;
    jurisdiction: string;
    frequencyDays: number;
    nextRunAt?: Date;
  }): ReScreeningSchedule {
    const now = new Date();
    const schedule: ReScreeningSchedule = {
      scheduleId: uuidv4(),
      clientId: input.clientId,
      entityId: input.entityId,
      jurisdiction: input.jurisdiction,
      frequencyDays: input.frequencyDays,
      nextRunAt: input.nextRunAt ?? new Date(now.getTime() + input.frequencyDays * 24 * 60 * 60 * 1000),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    this.schedules.set(schedule.scheduleId, schedule);
    logger.info('Re-screening schedule created', {
      scheduleId: schedule.scheduleId,
      clientId: schedule.clientId,
      entityId: schedule.entityId,
      nextRunAt: schedule.nextRunAt,
    });

    return schedule;
  }

  listSchedules(filters?: { clientId?: string; enabled?: boolean }): ReScreeningSchedule[] {
    let items = Array.from(this.schedules.values());

    if (filters?.clientId) {
      items = items.filter((entry) => entry.clientId === filters.clientId);
    }

    if (typeof filters?.enabled === 'boolean') {
      items = items.filter((entry) => entry.enabled === filters.enabled);
    }

    return items;
  }

  runDueSchedules(now: Date = new Date()): {
    processed: number;
    triggered: Array<{
      scheduleId: string;
      clientId: string;
      entityId: string;
      jurisdiction: string;
      nextRunAt: Date;
    }>;
  } {
    const triggered: Array<{
      scheduleId: string;
      clientId: string;
      entityId: string;
      jurisdiction: string;
      nextRunAt: Date;
    }> = [];

    for (const schedule of this.schedules.values()) {
      if (!schedule.enabled || schedule.nextRunAt > now) {
        continue;
      }

      schedule.nextRunAt = new Date(now.getTime() + schedule.frequencyDays * 24 * 60 * 60 * 1000);
      schedule.updatedAt = now;

      triggered.push({
        scheduleId: schedule.scheduleId,
        clientId: schedule.clientId,
        entityId: schedule.entityId,
        jurisdiction: schedule.jurisdiction,
        nextRunAt: schedule.nextRunAt,
      });
    }

    logger.info('Re-screening run completed', {
      processed: this.schedules.size,
      triggered: triggered.length,
    });

    return {
      processed: this.schedules.size,
      triggered,
    };
  }

  resetForTests(): void {
    this.schedules.clear();
  }
}

let instance: ReScreeningScheduler | null = null;

export function getReScreeningScheduler(): ReScreeningScheduler {
  if (!instance) {
    instance = new ReScreeningScheduler();
  }
  return instance;
}
