/**
 * Agent Routes
 * API endpoints for compliance agent operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import winston from 'winston';
import { Transaction, ComplianceResult } from '../types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/routes.log' })
  ]
});

const router = Router();

/**
 * Execute compliance check for a transaction
 * POST /api/agents/check
 */
router.post('/check',
  [
    body('transaction').isObject().withMessage('Transaction object is required'),
    body('transaction.id').isString().notEmpty().withMessage('Transaction ID is required'),
    body('transaction.type').isString().isIn(['transfer', 'trade', 'withdrawal', 'deposit', 'security']).withMessage('Valid transaction type is required'),
    body('transaction.amount').isNumeric().withMessage('Transaction amount must be a number'),
    body('transaction.timestamp').isISO8601().withMessage('Valid timestamp is required')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { transaction } = req.body;
      const agents = req.app.locals.agents;

      if (!agents?.orchestrator) {
        return res.status(500).json({
          error: 'Agent orchestrator not available'
        });
      }

      logger.info('Executing compliance check via API', {
        transactionId: transaction.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Execute compliance check
      const result: ComplianceResult = await agents.orchestrator.executeComplianceCheck(transaction);

      logger.info('Compliance check completed via API', {
        transactionId: transaction.id,
        status: result.status,
        riskScore: result.riskScore,
        processingTime: result.processingTime
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('API compliance check failed', {
        error: error instanceof Error ? error.message : String(error),
        transactionId: req.body.transaction?.id
      });

      next(error);
    }
  }
);

/**
 * Execute batch compliance checks
 * POST /api/agents/check/batch
 */
router.post('/check/batch',
  [
    body('transactions').isArray({ min: 1, max: 100 }).withMessage('Transactions array is required (1-100 items)'),
    body('transactions.*.id').isString().notEmpty().withMessage('Transaction ID is required'),
    body('transactions.*.type').isString().isIn(['transfer', 'trade', 'withdrawal', 'deposit', 'security']).withMessage('Valid transaction type is required'),
    body('transactions.*.amount').isNumeric().withMessage('Transaction amount must be a number'),
    body('transactions.*.timestamp').isISO8601().withMessage('Valid timestamp is required')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { transactions } = req.body;
      const agents = req.app.locals.agents;

      if (!agents?.orchestrator) {
        return res.status(500).json({
          error: 'Agent orchestrator not available'
        });
      }

      logger.info('Executing batch compliance checks via API', {
        batchSize: transactions.length,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Execute batch compliance checks
      const results: ComplianceResult[] = await agents.orchestrator.executeBatchComplianceChecks(transactions);

      const summary = {
        total: results.length,
        approved: results.filter(r => r.status === 'approved').length,
        escalated: results.filter(r => r.status === 'escalated').length,
        rejected: results.filter(r => r.status === 'rejected').length,
        pending: results.filter(r => r.status === 'pending').length
      };

      logger.info('Batch compliance checks completed via API', {
        batchSize: transactions.length,
        summary
      });

      res.json({
        success: true,
        data: {
          results,
          summary
        }
      });

    } catch (error) {
      logger.error('API batch compliance check failed', {
        error: error instanceof Error ? error.message : String(error),
        batchSize: req.body.transactions?.length
      });

      next(error);
    }
  }
);

/**
 * Get compliance status for a transaction
 * GET /api/agents/check/:transactionId
 */
router.get('/check/:transactionId',
  [
    param('transactionId').isString().notEmpty().withMessage('Transaction ID is required')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { transactionId } = req.params;
      const agents = req.app.locals.agents;

      if (!agents?.orchestrator) {
        return res.status(500).json({
          error: 'Agent orchestrator not available'
        });
      }

      logger.info('Getting compliance status via API', {
        transactionId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Get compliance status
      const result: ComplianceResult | null = await agents.orchestrator.getComplianceStatus(transactionId);

      if (!result) {
        return res.status(404).json({
          error: 'Compliance check not found',
          transactionId
        });
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('API get compliance status failed', {
        error: error instanceof Error ? error.message : String(error),
        transactionId: req.params.transactionId
      });

      next(error);
    }
  }
);

/**
 * Get agent health status
 * GET /api/agents/health
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = req.app.locals.agents;

    if (!agents?.orchestrator) {
      return res.status(500).json({
        error: 'Agent orchestrator not available'
      });
    }

    const healthStatus = await agents.orchestrator.getHealthStatus();

    res.json({
      success: true,
      data: {
        service: 'compliance-agents',
        ...healthStatus
      }
    });

  } catch (error) {
    logger.error('API health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    next(error);
  }
});

/**
 * Get agent statistics
 * GET /api/agents/stats
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // This would collect statistics from the agents
    // For now, return basic info
    const agents = req.app.locals.agents;

    const stats = {
      agents: {
        supervisor: agents?.supervisorAgent?.getName() || 'not available',
        kyc: agents?.kycAgent?.getName() || 'not available',
        aml: agents?.amlAgent?.getName() || 'not available',
        sebi: agents?.sebiAgent?.getName() || 'not available'
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('API stats check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    next(error);
  }
});

export default router;