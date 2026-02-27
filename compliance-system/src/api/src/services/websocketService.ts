/**
 * WebSocket Service - Real-time Monitoring for Compliance Alerts
 * Manages WebSocket connections for streaming compliance alerts
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/websocket.log' })
  ]
});

export interface ComplianceAlert {
  alertId: string;
  wallet: string;
  entityId: string;
  jurisdiction: string;
  alertType: 'KYC' | 'AML' | 'FRAUD' | 'SANCTIONS' | 'VELOCITY' | 'PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  riskScore: number;
  details: Record<string, any>;
  timestamp: string;
  requiresAction: boolean;
}

export interface ClientConnection {
  clientId: string;
  wallet: string;
  userId: string;
  jurisdiction?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

/**
 * WebSocketService: Manages real-time compliance monitoring
 */
export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, { ws: WebSocket; connection: ClientConnection }> = new Map();
  private alertQueue: ComplianceAlert[] = [];
  private maxQueueSize: number = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  public initialize(httpServer: HTTPServer): void {
    try {
      this.wss = new WebSocketServer({ server: httpServer, path: '/stream' });

      this.wss.on('connection', (ws: WebSocket, req) => {
        this.handleNewConnection(ws, req);
      });

      // Start heartbeat to detect stale connections
      this.startHeartbeat();

      logger.info('WebSocketService initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocketService:', error);
      throw new Error('WebSocket initialization failed');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleNewConnection(ws: WebSocket, req: any): void {
    try {
      // Extract wallet address from URL
      const url = req.url || '';
      const walletMatch = url.match(/\/monitoring\/([a-zA-Z0-9]+)/);
      const wallet = walletMatch ? walletMatch[1] : null;

      if (!wallet) {
        logger.warn('WebSocket connection rejected: no wallet provided');
        ws.close(1008, 'wallet parameter required');
        return;
      }

      // Extract JWT from headers for authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('WebSocket connection rejected: no authentication', { wallet });
        ws.close(1008, 'authentication required');
        return;
      }

      const clientId = `${wallet}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const connection: ClientConnection = {
        clientId,
        wallet,
        userId: authHeader.replace('Bearer ', ''),
        connectedAt: new Date(),
        lastHeartbeat: new Date()
      };

      // Store connection
      this.clients.set(clientId, { ws, connection });

      logger.info('WebSocket connection established', {
        clientId,
        wallet,
        totalClients: this.clients.size
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'CONNECTED',
        clientId,
        message: 'Connected to compliance monitoring',
        timestamp: new Date().toISOString()
      });

      // Handle messages
      ws.on('message', (data) => this.handleMessage(clientId, data));

      // Handle disconnection
      ws.on('close', () => this.handleDisconnection(clientId));

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error:', { clientId, error: error.message });
        this.handleDisconnection(clientId);
      });

      // Emit connection event
      this.emit('client-connected', connection);
    } catch (error) {
      logger.error('Failed to handle WebSocket connection:', error);
      ws.close(1011, 'server error');
    }
  }

  /**
   * Handle incoming client messages
   */
  private handleMessage(clientId: string, data: any): void {
    try {
      const connection = this.clients.get(clientId);
      if (!connection) return;

      const message = JSON.parse(data.toString());

      logger.debug('WebSocket message received', { clientId, messageType: message.type });

      switch (message.type) {
        case 'HEARTBEAT':
          connection.connection.lastHeartbeat = new Date();
          this.sendToClient(clientId, { type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() });
          break;

        case 'FILTER':
          // Update filter settings
          if (message.jurisdiction) {
            connection.connection.jurisdiction = message.jurisdiction;
          }
          this.sendToClient(clientId, {
            type: 'FILTER_UPDATED',
            filters: { jurisdiction: connection.connection.jurisdiction }
          });
          break;

        case 'REQUEST_CACHE':
          // Send cached alerts for this wallet
          const walletAlerts = this.alertQueue.filter(
            (alert) => alert.wallet === connection.connection.wallet
          );
          this.sendToClient(clientId, {
            type: 'ALERT_CACHE',
            alerts: walletAlerts.slice(-100), // Last 100 alerts
            count: walletAlerts.length
          });
          break;

        default:
          logger.warn('Unknown message type:', message.type);
      }

      this.emit('message-received', { clientId, message });
    } catch (error) {
      logger.error('Failed to handle message:', error);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    const clientData = this.clients.get(clientId);
    if (clientData) {
      logger.info('WebSocket connection closed', {
        clientId,
        wallet: clientData.connection.wallet,
        duration: Date.now() - clientData.connection.connectedAt.getTime()
      });

      this.clients.delete(clientId);
      this.emit('client-disconnected', clientData.connection);
    }
  }

  /**
   * Send compliance alert
   */
  public broadcastAlert(alert: ComplianceAlert): void {
    try {
      // Add to queue for caching
      this.alertQueue.push(alert);
      if (this.alertQueue.length > this.maxQueueSize) {
        this.alertQueue.shift(); // Remove oldest alert
      }

      // Broadcast to relevant clients
      for (const [clientId, { connection }] of this.clients.entries()) {
        // Check if client is monitoring this wallet
        if (connection.wallet === alert.wallet) {
          // Check jurisdiction filter if set
          if (!connection.jurisdiction || connection.jurisdiction === alert.jurisdiction) {
            this.sendToClient(clientId, {
              type: 'COMPLIANCE_ALERT',
              alert
            });

            logger.debug('Alert sent to client', { clientId, alertType: alert.alertType });
          }
        }
      }

      this.emit('alert-broadcast', alert);
    } catch (error) {
      logger.error('Failed to broadcast alert:', error);
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: any): void {
    const clientData = this.clients.get(clientId);
    if (clientData && clientData.ws.readyState === WebSocket.OPEN) {
      try {
        clientData.ws.send(JSON.stringify({
          ...message,
          timestamp: message.timestamp || new Date().toISOString()
        }));
      } catch (error) {
        logger.error('Failed to send message to client:', { clientId, error });
      }
    }
  }

  /**
   * Broadcast message to all clients
   */
  public broadcastToAll(message: any): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Broadcast message to specific wallet
   */
  public broadcastToWallet(wallet: string, message: any): void {
    for (const [clientId, { connection }] of this.clients.entries()) {
      if (connection.wallet === wallet) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 30000; // 30 seconds

      for (const [clientId, { connection, ws }] of this.clients.entries()) {
        if (now.getTime() - connection.lastHeartbeat.getTime() > staleThreshold) {
          logger.warn('Closing stale connection', { clientId, wallet: connection.wallet });
          ws.close(1000, 'stale connection');
          this.clients.delete(clientId);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop heartbeat
   */
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number;
    byWallet: Record<string, number>;
    queueSize: number;
  } {
    const byWallet: Record<string, number> = {};
    for (const { connection } of this.clients.values()) {
      byWallet[connection.wallet] = (byWallet[connection.wallet] || 0) + 1;
    }

    return {
      totalConnections: this.clients.size,
      byWallet,
      queueSize: this.alertQueue.length
    };
  }

  /**
   * Close all connections
   */
  public closeAll(): void {
    this.stopHeartbeat();

    for (const { ws } of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'server shutting down');
      }
    }

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocketService shut down');
  }
}

let instance: WebSocketService | null = null;

export function initializeWebSocketService(): WebSocketService {
  if (!instance) {
    instance = new WebSocketService();
  }
  return instance;
}

export function getWebSocketService(): WebSocketService {
  if (!instance) {
    instance = new WebSocketService();
  }
  return instance;
}
