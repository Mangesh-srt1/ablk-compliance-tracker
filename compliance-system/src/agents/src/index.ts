/**
 * AI Compliance Agents Service
 * LangGraph-based AI agents for automated compliance processing
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import winston from 'winston';

// Import configurations
import { connectDatabase } from './config/database';
import { configureRedis } from './config/redis';
import logger from './config/logger';

// Import tools
import { BallerineClient } from './tools/ballerineClient';
import { ChainalysisClient } from './tools/chainalysisClient';
import { OFACClient } from './tools/ofacClient';
import { SEBIClient } from './tools/sebiClient';
import { BSEClient } from './tools/bseClient';
import { NSEClient } from './tools/nseClient';

// Import agents
import { ComplianceSupervisorAgent } from './agents/supervisorAgent';
import { KYCAgent } from './agents/kycAgent';
import { AMLAgent } from './agents/amlAgent';
import { SEBIAgent } from './agents/sebiAgent';

// Import graphs
import { ComplianceGraph } from './graphs/complianceGraph';

// Import services
import { AgentOrchestrator } from './services/agentOrchestrator';
import { EventProcessor } from './services/eventProcessor';

// Import routes
import agentRoutes from './routes/agentRoutes';
import healthRoutes from './routes/healthRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3002;

// Configure Winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'compliance-agents' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/agents-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/agents-combined.log' })
  ]
});

// Global logger instance
global.logger = winstonLogger;

/**
 * Initialize AI Agents
 */
async function initializeAgents(): Promise<{
  supervisorAgent: ComplianceSupervisorAgent;
  kycAgent: KYCAgent;
  amlAgent: AMLAgent;
  sebiAgent: SEBIAgent;
  complianceGraph: ComplianceGraph;
  orchestrator: AgentOrchestrator;
}> {
  logger.info('Initializing AI agents...');

  // Initialize tool clients
  const ballerineClient = new BallerineClient();
  const chainalysisClient = new ChainalysisClient();
  const ofacClient = new OFACClient();
  const sebiClient = new SEBIClient();
  const bseClient = new BSEClient();
  const nseClient = new NSEClient();

  // Initialize individual agents with their tools
  const supervisorAgent = new ComplianceSupervisorAgent();
  const kycAgent = new KYCAgent(ballerineClient);
  const amlAgent = new AMLAgent(chainalysisClient, ofacClient);
  const sebiAgent = new SEBIAgent(sebiClient, bseClient, nseClient);

  // Initialize compliance graph
  const complianceGraph = new ComplianceGraph({
    supervisor: supervisorAgent,
    kyc: kycAgent,
    aml: amlAgent,
    sebi: sebiAgent
  });

  // Initialize agent orchestrator
  const orchestrator = new AgentOrchestrator(complianceGraph);

  logger.info('AI agents initialized successfully');

  return {
    supervisorAgent,
    kycAgent,
    amlAgent,
    sebiAgent,
    complianceGraph,
    orchestrator
  };
}

/**
 * Initialize application
 */
async function initializeApp(): Promise<void> {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();
    logger.info('Database connected successfully');

    // Configure Redis
    logger.info('Configuring Redis...');
    await configureRedis();
    logger.info('Redis configured successfully');

    // Initialize AI agents
    const agents = await initializeAgents();

    // Store agents in app locals for access in routes
    app.locals.agents = agents;

    // Initialize event processor
    const eventProcessor = new EventProcessor(agents.orchestrator);
    await eventProcessor.initialize();

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    app.use(compression());

    // Request logging
    app.use((req: Request, res: Response, next: NextFunction) => {
      logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Health check (no auth required)
    app.use('/health', healthRoutes);

    // API routes
    app.use('/api/agents', agentRoutes);

    // 404 handler
    app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Error handling middleware (must be last)
    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    });

    // Start server
    app.listen(PORT, () => {
      logger.info(`AI Compliance Agents service listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
initializeApp().catch((error) => {
  logger.error('Application startup failed:', error);
  process.exit(1);
});

export default app;