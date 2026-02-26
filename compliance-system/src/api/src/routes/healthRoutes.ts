/**
 * Health Routes
 * API endpoints for health checks and system status
 */

import { Router, Request, Response } from 'express';
import winston from 'winston';
import db from '../config/database';
import { getRedisClient } from '../config/redis';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/health.log' }),
  ],
});

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    res.json(health);
  } catch (error) {
    logger.error('Health check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * GET /api/health/detailed
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      database: 'unknown',
      redis: 'unknown',
      externalAPIs: 'unknown',
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
  };

  try {
    // Check database connectivity
    try {
      await db.query('SELECT 1');
      health.dependencies.database = 'healthy';
    } catch (dbError) {
      health.dependencies.database = 'unhealthy';
      health.status = 'degraded';
      logger.error('Database health check failed', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    // Check Redis connectivity
    try {
      const redis = getRedisClient();
      await redis.ping();
      health.dependencies.redis = 'healthy';
    } catch (redisError) {
      health.dependencies.redis = 'unhealthy';
      health.status = 'degraded';
      logger.error('Redis health check failed', {
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
    }

    // Check external APIs (mock for now)
    try {
      // TODO: Add actual external API health checks
      health.dependencies.externalAPIs = 'healthy';
    } catch (apiError) {
      health.dependencies.externalAPIs = 'degraded';
      logger.warn('External API health check warning', {
        error: apiError instanceof Error ? apiError.message : String(apiError),
      });
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Detailed health check error', {
      error: error instanceof Error ? error.message : String(error),
    });
    health.status = 'unhealthy';
    res.status(503).json(health);
  }
});

/**
 * GET /api/health/ready
 * Readiness probe for container orchestration
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check critical dependencies
    await db.query('SELECT 1');

    const redis = getRedisClient();
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Critical dependencies unavailable',
    });
  }
});

/**
 * GET /api/health/live
 * Liveness probe for container orchestration
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if the server is responding, it's alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;
