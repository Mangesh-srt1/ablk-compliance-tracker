/**
 * Health Routes
 * Health check endpoints
 */

import { Router, Request, Response } from 'express';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/health-routes.log' })
  ]
});

const router = Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthData = {
      service: 'compliance-agents',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    logger.debug('Health check requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json(healthData);

  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      service: 'compliance-agents',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

/**
 * Detailed health check
 * GET /health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const agents = req.app.locals.agents;

    // Check database connectivity
    let databaseHealthy = false;
    try {
      // This would check actual database connection
      databaseHealthy = true; // Placeholder
    } catch (error) {
      logger.error('Database health check failed', { error });
    }

    // Check Redis connectivity
    let redisHealthy = false;
    try {
      // This would check actual Redis connection
      redisHealthy = true; // Placeholder
    } catch (error) {
      logger.error('Redis health check failed', { error });
    }

    // Check agent health
    let agentsHealthy = false;
    let agentDetails = {};
    try {
      if (agents?.orchestrator) {
        const orchestratorHealth = await agents.orchestrator.getHealthStatus();
        agentsHealthy = orchestratorHealth.healthy;
        agentDetails = {
          orchestrator: orchestratorHealth,
          supervisor: agents.supervisorAgent ? 'available' : 'unavailable',
          kyc: agents.kycAgent ? 'available' : 'unavailable',
          aml: agents.amlAgent ? 'available' : 'unavailable',
          sebi: agents.sebiAgent ? 'available' : 'unavailable'
        };
      }
    } catch (error) {
      logger.error('Agent health check failed', { error });
    }

    // Check external API health
    const externalAPIs = {
      ballerine: false, // Would check actual API
      chainalysis: false,
      ofac: false,
      sebi: false,
      bse: false,
      nse: false
    };

    const overallHealthy = databaseHealthy && redisHealthy && agentsHealthy;

    const healthData = {
      service: 'compliance-agents',
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: {
          status: databaseHealthy ? 'pass' : 'fail',
          message: databaseHealthy ? 'Connected' : 'Connection failed'
        },
        redis: {
          status: redisHealthy ? 'pass' : 'fail',
          message: redisHealthy ? 'Connected' : 'Connection failed'
        },
        agents: {
          status: agentsHealthy ? 'pass' : 'fail',
          message: agentsHealthy ? 'All agents operational' : 'Agent issues detected',
          details: agentDetails
        },
        externalAPIs: {
          status: Object.values(externalAPIs).every(Boolean) ? 'pass' : 'warn',
          message: 'Some external APIs may be unavailable',
          details: externalAPIs
        }
      }
    };

    const statusCode = overallHealthy ? 200 : 503; // 503 Service Unavailable for degraded

    res.status(statusCode).json(healthData);

  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      service: 'compliance-agents',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Detailed health check failed'
    });
  }
});

/**
 * Readiness check
 * GET /health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const agents = req.app.locals.agents;

    // Check if all required components are ready
    const isReady = Boolean(agents?.orchestrator &&
      agents?.supervisorAgent &&
      agents?.kycAgent &&
      agents?.amlAgent &&
      agents?.sebiAgent);

    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        message: 'Required components not initialized'
      });
    }

  } catch (error) {
    logger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Readiness check failed'
    });
  }
});

export default router;