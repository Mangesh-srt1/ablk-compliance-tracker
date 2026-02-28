/**
 * Agent Communication Bus
 * Pub/sub message routing for multi-agent coordination.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/agent-bus.log' }),
  ],
});

export type MessageType = 'CHECK_REQUEST' | 'CHECK_RESULT' | 'ESCALATION' | 'STATUS_UPDATE';

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  messageType: MessageType;
  payload: unknown;
  timestamp: Date;
  correlationId?: string;
}

type MessageHandler = (message: AgentMessage) => void | Promise<void>;

export class AgentCommunicationBus extends EventEmitter {
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();

  /**
   * Publish a message to a specific agent.
   */
  publish(message: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };

    logger.debug('Publishing agent message', {
      id: fullMessage.id,
      fromAgent: fullMessage.fromAgent,
      toAgent: fullMessage.toAgent,
      messageType: fullMessage.messageType,
      correlationId: fullMessage.correlationId,
    });

    const handlers = this.subscriptions.get(fullMessage.toAgent);
    if (handlers) {
      for (const handler of handlers) {
        Promise.resolve(handler(fullMessage)).catch((err) => {
          logger.error('Agent message handler error', {
            agentId: fullMessage.toAgent,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }

    this.emit('message', fullMessage);
    this.emit(`message:${fullMessage.toAgent}`, fullMessage);
    return fullMessage;
  }

  /**
   * Subscribe an agent to receive messages.
   */
  subscribe(agentId: string, handler: MessageHandler): void {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Set());
    }
    const handlers = this.subscriptions.get(agentId);
    if (handlers) {
      handlers.add(handler);
    }
    logger.info('Agent subscribed to bus', { agentId });
  }

  /**
   * Unsubscribe an agent handler.
   */
  unsubscribe(agentId: string, handler: MessageHandler): void {
    const handlers = this.subscriptions.get(agentId);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(agentId);
      }
    }
    logger.info('Agent unsubscribed from bus', { agentId });
  }

  /**
   * Broadcast a message to all subscribed agents.
   */
  broadcast(
    fromAgent: string,
    messageType: MessageType,
    payload: unknown,
    correlationId?: string
  ): AgentMessage[] {
    const agentIds = Array.from(this.subscriptions.keys()).filter((id) => id !== fromAgent);
    const messages: AgentMessage[] = [];

    for (const agentId of agentIds) {
      const msg = this.publish({ fromAgent, toAgent: agentId, messageType, payload, correlationId });
      messages.push(msg);
    }

    logger.info('Broadcast sent', { fromAgent, messageType, recipientCount: messages.length });
    return messages;
  }

  /**
   * Get the list of currently subscribed agent IDs.
   */
  getSubscribedAgents(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

export const agentCommunicationBus = new AgentCommunicationBus();
export default agentCommunicationBus;
