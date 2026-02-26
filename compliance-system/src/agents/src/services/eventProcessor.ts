/**
 * Event Processor
 * Processes compliance events from message queues
 */

import winston from 'winston';
import { AgentOrchestrator } from './agentOrchestrator';
import { Transaction, EventMessage } from '../types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/event-processor.log' })
  ]
});

export class EventProcessor {
  private orchestrator: AgentOrchestrator;
  private isRunning: boolean = false;
  private eventQueue: EventMessage[] = [];
  private processingInterval?: NodeJS.Timeout;

  constructor(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Initialize event processor
   */
  async initialize(): Promise<void> {
    logger.info('Initializing event processor');

    // Start processing events
    this.startProcessing();

    // Set up graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    logger.info('Event processor initialized');
  }

  /**
   * Process a compliance event
   */
  async processEvent(event: EventMessage): Promise<void> {
    try {
      logger.info('Processing compliance event', {
        eventId: event.id,
        type: event.type,
        source: event.source
      });

      switch (event.type) {
        case 'transaction.created':
          await this.processTransactionEvent(event);
          break;

        case 'user.updated':
          await this.processUserEvent(event);
          break;

        case 'compliance.check.requested':
          await this.processComplianceCheckEvent(event);
          break;

        default:
          logger.warn('Unknown event type', {
            eventId: event.id,
            type: event.type
          });
      }

    } catch (error) {
      logger.error('Failed to process event', {
        eventId: event.id,
        type: event.type,
        error: error instanceof Error ? error.message : String(error)
      });

      // Could implement retry logic here
    }
  }

  /**
   * Process transaction created event
   */
  private async processTransactionEvent(event: EventMessage): Promise<void> {
    const transaction: Transaction = event.data;

    logger.info('Processing transaction event', {
      transactionId: transaction.id,
      type: transaction.type,
      amount: transaction.amount
    });

    // Execute compliance check
    const result = await this.orchestrator.executeComplianceCheck(transaction);

    // Publish result event
    await this.publishEvent({
      id: `compliance-result-${transaction.id}-${Date.now()}`,
      type: 'compliance.check.completed',
      source: 'event-processor',
      timestamp: new Date().toISOString(),
      data: result,
      metadata: {
        originalEventId: event.id,
        processingTime: result.processingTime
      }
    });

    // If escalated, publish alert
    if (result.status === 'escalated' || result.status === 'rejected') {
      await this.publishAlert({
        transactionId: transaction.id,
        status: result.status,
        riskScore: result.riskScore,
        findings: result.findings,
        recommendations: result.recommendations
      });
    }
  }

  /**
   * Process user updated event
   */
  private async processUserEvent(event: EventMessage): Promise<void> {
    const userData = event.data;

    logger.info('Processing user event', {
      userId: userData.id,
      action: event.type
    });

    // Could trigger re-evaluation of user's transactions
    // For now, just log
    logger.info('User event processed', { userId: userData.id });
  }

  /**
   * Process compliance check requested event
   */
  private async processComplianceCheckEvent(event: EventMessage): Promise<void> {
    const checkData = event.data;

    logger.info('Processing compliance check request', {
      checkId: checkData.id,
      transactionId: checkData.transactionId
    });

    // Execute the requested check
    const result = await this.orchestrator.executeComplianceCheck(checkData.transaction);

    // Publish result
    await this.publishEvent({
      id: `check-result-${checkData.id}-${Date.now()}`,
      type: 'compliance.check.result',
      source: 'event-processor',
      timestamp: new Date().toISOString(),
      data: {
        checkId: checkData.id,
        result
      }
    });
  }

  /**
   * Start processing events from queue
   */
  private startProcessing(): void {
    if (this.isRunning) {return;}

    this.isRunning = true;
    logger.info('Starting event processing loop');

    // Process events every 100ms
    this.processingInterval = setInterval(async () => {
      if (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      }
    }, 100);
  }

  /**
   * Stop processing events
   */
  private stopProcessing(): void {
    if (!this.isRunning) {return;}

    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    logger.info('Stopped event processing');
  }

  /**
   * Add event to processing queue
   */
  enqueueEvent(event: EventMessage): void {
    this.eventQueue.push(event);
    logger.debug('Event enqueued', {
      eventId: event.id,
      queueLength: this.eventQueue.length
    });
  }

  /**
   * Publish event to message queue
   */
  private async publishEvent(event: EventMessage): Promise<void> {
    try {
      // This would publish to Redis/EventBridge/etc.
      logger.info('Publishing event', {
        eventId: event.id,
        type: event.type
      });

      // For now, just log the event
      // In production, this would send to message queue

    } catch (error) {
      logger.error('Failed to publish event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Publish compliance alert
   */
  private async publishAlert(alertData: any): Promise<void> {
    try {
      logger.warn('Publishing compliance alert', {
        transactionId: alertData.transactionId,
        status: alertData.status,
        riskScore: alertData.riskScore
      });

      await this.publishEvent({
        id: `alert-${alertData.transactionId}-${Date.now()}`,
        type: 'compliance.alert',
        source: 'event-processor',
        timestamp: new Date().toISOString(),
        data: alertData,
        metadata: {
          severity: alertData.status === 'rejected' ? 'high' : 'medium'
        }
      });

    } catch (error) {
      logger.error('Failed to publish alert', {
        transactionId: alertData.transactionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Shutdown event processor
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down event processor');

    this.stopProcessing();

    // Process remaining events
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        try {
          await this.processEvent(event);
        } catch (error) {
          logger.error('Error processing event during shutdown', {
            eventId: event.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    logger.info('Event processor shutdown complete');
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isRunning: boolean;
    queueLength: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      queueLength: this.eventQueue.length,
      uptime: process.uptime()
    };
  }
}