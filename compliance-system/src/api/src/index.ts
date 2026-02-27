/**
 * AI Compliance System API Gateway
 * Main entry point for the compliance API service
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';

// Import configurations
import db from './config/database';
import { configureRedis } from './config/redis';
import logger from './config/logger';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { localizationMiddleware } from './middleware/localizationMiddleware';

// Import localization service
import { initializeLocalizationService } from './services/localizationService';

// Import routes
import authRoutes from './routes/authRoutes';
import complianceRoutes from './routes/complianceRoutes';
import agentRoutes from './routes/agentRoutes';
import reportRoutes from './routes/reportRoutes';
import healthRoutes from './routes/healthRoutes';
import kycRoutes from './routes/kycRoutes';
import amlRoutes from './routes/amlRoutes';

// Load environment variables
dotenv.config();
console.log('Environment variables loaded:', {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  NODE_ENV: process.env.NODE_ENV,
});

const app: Express = express();
const PORT = process.env.PORT || 3000;

/**
 * Initialize application
 */
async function initializeApp(): Promise<void> {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    try {
      await db.connect();
      logger.info('Database connected successfully');
    } catch (dbError) {
      logger.warn(
        'Database connection failed, continuing without database:',
        dbError instanceof Error ? dbError.message : String(dbError)
      );
    }

    // Configure Redis
    logger.info('Configuring Redis...');
    try {
      configureRedis();
      logger.info('Redis configured successfully');
    } catch (redisError) {
      logger.warn(
        'Redis configuration failed, continuing without Redis:',
        redisError instanceof Error ? redisError.message : String(redisError)
      );
    }

    // Security middleware
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      })
    );

    // CORS configuration
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      })
    );

    // Request logging
    app.use(requestLogger);

    // Localization/i18n middleware
    logger.info('Initializing localization service...');
    try {
      const localesPath = process.env.LOCALES_PATH || './src/locales';
      initializeLocalizationService(localesPath);
      app.use(localizationMiddleware());
      logger.info('Localization service initialized');
    } catch (i18nError) {
      logger.warn(
        'Localization service initialization failed, continuing with defaults:',
        i18nError instanceof Error ? i18nError.message : String(i18nError)
      );
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          category: 'RATE_LIMIT',
          message: 'Too many requests from this IP, please try again later.',
          httpStatus: 429,
          timestamp: new Date().toISOString(),
          requestId: 'rate-limited',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/', limiter);

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    app.use(compression());

    // API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/compliance', complianceRoutes);
    app.use('/api/agents', agentRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/health', healthRoutes);
    app.use('/api', kycRoutes);
    app.use('/api', amlRoutes);

    // 404 handler
    app.use(notFoundHandler);

    // Error handling middleware (must be last)
    app.use(errorHandler);

    // Start server
    app.listen(PORT, () => {
      logger.info(`AI Compliance API Gateway listening on port ${PORT}`);
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
