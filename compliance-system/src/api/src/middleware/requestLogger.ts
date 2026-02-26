/**
 * Request Logger Middleware
 * Logs incoming requests with standardized format
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/request.log' }),
  ],
});

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  // Add request ID to response headers
  res.setHeader('x-request-id', requestId);

  // Add request ID to request object for use in other middleware
  (req as any).requestId = requestId;

  const startTime = Date.now();

  // Log request
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    headers: {
      'content-type': req.get('Content-Type'),
      authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
      'x-api-key': req.get('x-api-key') ? '[REDACTED]' : undefined,
    },
    query: req.query,
    body: req.method !== 'GET' && req.body ? JSON.stringify(req.body).substring(0, 500) : undefined,
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  // Log response errors
  res.on('error', (error) => {
    logger.error('Response error', {
      requestId,
      method: req.method,
      url: req.url,
      error: error.message,
      stack: error.stack,
    });
  });

  next();
};
