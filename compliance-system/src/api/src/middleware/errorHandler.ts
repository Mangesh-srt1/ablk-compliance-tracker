/**
 * Centralized Error Handler Middleware
 * Maps internal exceptions to standardized error responses
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import {
  AppError,
  ErrorResponse,
  ErrorCategory,
  ErrorCode
} from '../types/errors';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error-handler.log' })
  ]
});

/**
 * Generate standardized error response
 */
function createErrorResponse(
  code: ErrorCode,
  category: ErrorCategory,
  message: string,
  httpStatus: number,
  details?: any,
  requestId?: string
): ErrorResponse {
  return {
    code,
    category,
    message,
    details,
    httpStatus,
    timestamp: new Date().toISOString(),
    requestId: requestId || uuidv4()
  };
}

/**
 * Map common errors to standardized format
 */
function mapErrorToResponse(error: any, requestId: string): ErrorResponse {
  // Handle AppError instances
  if (error instanceof AppError) {
    return createErrorResponse(
      error.code,
      error.category,
      error.message,
      error.httpStatus,
      error.details,
      requestId
    );
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return createErrorResponse(
      ErrorCode.TOKEN_INVALID,
      ErrorCategory.AUTHENTICATION,
      'Invalid authentication token',
      401,
      undefined,
      requestId
    );
  }

  if (error.name === 'TokenExpiredError') {
    return createErrorResponse(
      ErrorCode.TOKEN_EXPIRED,
      ErrorCategory.AUTHENTICATION,
      'Authentication token has expired',
      401,
      undefined,
      requestId
    );
  }

  // Handle database errors
  if (error.code?.startsWith('42')) { // PostgreSQL syntax/schema errors
    return createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      ErrorCategory.INTERNAL,
      'Database operation failed',
      500,
      process.env.NODE_ENV === 'development' ? error.message : undefined,
      requestId
    );
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return createErrorResponse(
      ErrorCode.EXTERNAL_API_ERROR,
      ErrorCategory.EXTERNAL_SERVICE,
      'External service unavailable',
      502,
      undefined,
      requestId
    );
  }

  // Handle validation errors (e.g., from Joi)
  if (error.isJoi) {
    return createErrorResponse(
      ErrorCode.INVALID_INPUT,
      ErrorCategory.VALIDATION,
      'Validation failed',
      400,
      error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message
      })),
      requestId
    );
  }

  // Handle rate limiting
  if (error.message?.includes('rate limit')) {
    return createErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCategory.RATE_LIMIT,
      'Too many requests',
      429,
      undefined,
      requestId
    );
  }

  // Default to internal server error
  return createErrorResponse(
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCategory.INTERNAL,
    'An unexpected error occurred',
    500,
    process.env.NODE_ENV === 'development' ? error.message : undefined,
    requestId
  );
}

/**
 * Centralized error handling middleware
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // Log the error
  logger.error('Request error', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    error: {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  });

  // Map error to standardized response
  const errorResponse = mapErrorToResponse(error, requestId);

  // Send response
  res.status(errorResponse.httpStatus).json({
    error: errorResponse
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  const errorResponse = createErrorResponse(
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCategory.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    404,
    undefined,
    requestId
  );

  res.status(404).json({
    error: errorResponse
  });
};