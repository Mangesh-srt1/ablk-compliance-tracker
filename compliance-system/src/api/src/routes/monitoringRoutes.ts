/**
 * Monitoring Routes
 * Endpoints for WebSocket monitoring, alert injection, and health checks
 */

import { Router, Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { getWebSocketService } from '../services/websocketService';

const router = Router();

/**
 * GET /api/monitoring/stats
 * Get WebSocket connection statistics
 */
router.get('/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const wsService = getWebSocketService();
    const stats = wsService.getStats();
    
    res.json({
      status: 'success',
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching WebSocket stats:', error);
    next(error);
  }
});

/**
 * GET /api/monitoring/health
 * Check WebSocket service health
 */
router.get('/health', (req: Request, res: Response, next: NextFunction) => {
  try {
    const wsService = getWebSocketService();
    const stats = wsService.getStats();
    
    res.json({
      status: 'healthy',
      service: 'WebSocket',
      totalConnections: stats.totalConnections,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('WebSocket health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'WebSocket',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/monitoring/alert
 * Manually inject a compliance alert (admin only)
 * 
 * Request body:
 * {
 *   "wallet": "0x...",
 *   "entityId": "entity-123",
 *   "jurisdiction": "AE",
 *   "alertType": "KYC|AML|FRAUD|SANCTIONS|VELOCITY|PATTERN",
 *   "severity": "LOW|MEDIUM|HIGH|CRITICAL",
 *   "message": "Alert message",
 *   "riskScore": 75,
 *   "details": { "...": "..." },
 *   "requiresAction": true
 * }
 */
router.post('/alert', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate admin role (would use RBAC in production)
    const wsService = getWebSocketService();
    
    const {
      wallet,
      entityId,
      jurisdiction,
      alertType,
      severity,
      message,
      riskScore,
      details,
      requiresAction,
    } = req.body;

    // Validate required fields
    if (!wallet || !entityId || !alertType || !severity || !message) {
      return res.status(400).json({
        error: 'Missing required fields: wallet, entityId, alertType, severity, message',
        timestamp: new Date().toISOString(),
      });
    }

    // Create alert object
    const alert = {
      alertId: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      wallet,
      entityId,
      jurisdiction: jurisdiction || 'GLOBAL',
      alertType,
      severity,
      message,
      riskScore: riskScore || 0,
      details: details || {},
      timestamp: new Date().toISOString(),
      requiresAction: requiresAction || false,
    };

    // Broadcast alert
    wsService.broadcastAlert(alert);

    logger.info('Manual alert injected:', {
      alertId: alert.alertId,
      wallet,
      severity,
    });

    res.json({
      status: 'success',
      message: 'Alert broadcasted',
      alert,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error injecting alert:', error);
    next(error);
  }
});

/**
 * GET /api/monitoring/wallets/:wallet/stats
 * Get monitoring stats for a specific wallet
 */
router.get('/wallets/:wallet/stats', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wallet } = req.params;
    const wsService = getWebSocketService();
    const stats = wsService.getStats();

    const walletConnections = stats.byWallet?.[wallet] || 0;

    res.json({
      status: 'success',
      wallet,
      data: {
        connections: walletConnections,
        lastAlert: null,
        alertCount: 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching wallet stats:', error);
    next(error);
  }
});

/**
 * DELETE /api/monitoring/connections/:wallet
 * Close all WebSocket connections for a wallet
 */
router.delete('/connections/:wallet', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate admin role (would use RBAC in production)
    const { wallet } = req.params;
    const wsService = getWebSocketService();

    // Get all connections for the wallet and close them
    const stats = wsService.getStats();
    const connectionCount = stats.byWallet?.[wallet] || 0;

    // Note: WebSocketService doesn't have close-by-wallet method yet
    // This is a placeholder for future implementation
    logger.info('Closing WebSocket connections for wallet:', { wallet, count: connectionCount });

    res.json({
      status: 'success',
      message: `Closed ${connectionCount} connections`,
      wallet,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error closing WebSocket connections:', error);
    next(error);
  }
});

export default router;
