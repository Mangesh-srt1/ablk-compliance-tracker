/**
 * Logger Configuration with Structured Logging
 * Winston logger setup with multiple transports and logging contexts
 * Integrates with: TransactionManager, CacheService, RateLimiter, Compliance services
 */

import winston from 'winston';
import path from 'path';
import * as fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Create logs directory if it doesn't exist
const logsDir = process.env.LOGS_DIR || '/app/logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels with severity
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Structured JSON format for file storage
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const logEntry: any = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: 'compliance-api',
    };

    // Include context metadata if provided
    if (info.context) {
      Object.assign(logEntry, info.context);
    }

    // Include error details
    if (info.stack) {
      logEntry.stack = info.stack;
    }

    return JSON.stringify(logEntry);
  })
);

// Console format: Pretty-printed for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, context, ...meta } = info;
    let msg = `${timestamp} [${level}]: ${message}`;
    if (context && typeof context === 'object' && 'correlationId' in context) {
      const correlationId = (context as any).correlationId;
      msg += ` [${String(correlationId).substring(0, 8)}...]`;
    }
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger: winston.Logger = winston.createLogger({
  levels: logLevels,
  defaultMeta: { service: 'compliance-api' },
  transports: [
    // Console transport (development)
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Structured JSON logs (all)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.json'),
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),

    // Error-only logs (structured)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.json'),
      level: 'error',
      format: structuredFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),

    // Exception logs
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.json'),
      format: structuredFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],

  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.json'),
      format: structuredFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.json'),
      format: structuredFormat,
    }),
  ],
});

/**
 * Request correlation ID middleware
 * Attaches unique ID to each request for tracking across logs
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
};

/**
 * Log context builder - accumulates logging context throughout request lifecycle
 */
export class LogContext {
  private context: Record<string, any>;

  constructor(correlationId: string) {
    this.context = {
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  add(key: string, value: any): this {
    this.context[key] = value;
    return this;
  }

  addAll(obj: Record<string, any>): this {
    Object.assign(this.context, obj);
    return this;
  }

  getContext(): Record<string, any> {
    return { ...this.context };
  }
}

/**
 * Transaction Manager Logging
 * Logs all database operations with isolation levels and rollback info
 */
export class TransactionLogger {
  static logStart(context: LogContext, isolationLevel: string) {
    logger.info('Transaction started', {
      context: context.add('event', 'transaction_start').add('isolation_level', isolationLevel).getContext(),
    });
  }

  static logSavepoint(context: LogContext, savepointName: string) {
    logger.debug('Savepoint created', {
      context: context.add('event', 'savepoint_created').add('savepoint_name', savepointName).getContext(),
    });
  }

  static logCommit(context: LogContext, duration: number, operationCount: number) {
    logger.info('Transaction committed', {
      context: context
        .add('event', 'transaction_commit')
        .add('duration_ms', duration)
        .add('operations', operationCount)
        .getContext(),
    });
  }

  static logRollback(context: LogContext, duration: number, reason: string) {
    logger.warn('Transaction rolled back', {
      context: context
        .add('event', 'transaction_rollback')
        .add('duration_ms', duration)
        .add('reason', reason)
        .getContext(),
    });
  }

  static logError(context: LogContext, error: Error, operation: string) {
    logger.error('Transaction error', {
      context: context
        .add('event', 'transaction_error')
        .add('operation', operation)
        .add('error', error.message)
        .getContext(),
    });
  }

  static logConstraintViolation(context: LogContext, constraint: string, value: any) {
    logger.warn('Constraint violation', {
      context: context
        .add('event', 'constraint_violation')
        .add('constraint', constraint)
        .add('value', value)
        .getContext(),
    });
  }
}

/**
 * Cache Service Logging
 * Logs cache hits/misses, TTL management, and invalidation
 */
export class CacheLogger {
  static logHit(context: LogContext, key: string, ttlRemaining: number) {
    logger.debug('Cache hit', {
      context: context
        .add('event', 'cache_hit')
        .add('key', key)
        .add('ttl_remaining_seconds', ttlRemaining)
        .getContext(),
    });
  }

  static logMiss(context: LogContext, key: string) {
    logger.info('Cache miss', {
      context: context.add('event', 'cache_miss').add('key', key).getContext(),
    });
  }

  static logSet(context: LogContext, key: string, ttl: number) {
    logger.debug('Cache set', {
      context: context
        .add('event', 'cache_set')
        .add('key', key)
        .add('ttl_seconds', ttl)
        .getContext(),
    });
  }

  static logInvalidate(context: LogContext, pattern: string, keysRemoved: number) {
    logger.info('Cache invalidation', {
      context: context
        .add('event', 'cache_invalidate')
        .add('pattern', pattern)
        .add('keys_removed', keysRemoved)
        .getContext(),
    });
  }

  static logMetrics(context: LogContext, hits: number, misses: number, hitRate: number) {
    logger.info('Cache metrics', {
      context: context
        .add('event', 'cache_metrics')
        .add('hits', hits)
        .add('misses', misses)
        .add('hit_rate', hitRate.toFixed(2))
        .getContext(),
    });
  }
}

/**
 * Rate Limiter Logging
 * Logs rate limit enforcement, resets, and violations
 */
export class RateLimiterLogger {
  static logCheck(context: LogContext, identifier: string, limitType: string, current: number, max: number) {
    logger.debug('Rate limit check', {
      context: context
        .add('event', 'rate_limit_check')
        .add('identifier', identifier)
        .add('limit_type', limitType)
        .add('current', current)
        .add('max', max)
        .getContext(),
    });
  }

  static logViolation(context: LogContext, identifier: string, limitType: string, retryAfter: number) {
    logger.warn('Rate limit exceeded', {
      context: context
        .add('event', 'rate_limit_exceeded')
        .add('identifier', identifier)
        .add('limit_type', limitType)
        .add('retry_after_seconds', retryAfter)
        .getContext(),
    });
  }

  static logReset(context: LogContext, limitType: string) {
    logger.info('Rate limit reset', {
      context: context.add('event', 'rate_limit_reset').add('limit_type', limitType).getContext(),
    });
  }
}

/**
 * Compliance Decision Logging
 * Logs all KYC/AML/Compliance decisions with reasoning
 */
export class ComplianceLogger {
  static logKYCStart(context: LogContext, entityId: string, jurisdiction: string) {
    logger.info('KYC check started', {
      context: context
        .add('event', 'kyc_start')
        .add('entity_id', entityId)
        .add('jurisdiction', jurisdiction)
        .getContext(),
    });
  }

  static logKYCComplete(
    context: LogContext,
    entityId: string,
    status: string,
    riskScore: number,
    duration: number,
    confidence: number
  ) {
    logger.info('KYC check completed', {
      context: context
        .add('event', 'kyc_complete')
        .add('entity_id', entityId)
        .add('status', status)
        .add('risk_score', riskScore)
        .add('duration_ms', duration)
        .add('confidence', confidence)
        .getContext(),
    });
  }

  static logAMLStart(context: LogContext, walletAddress: string, jurisdiction: string) {
    logger.info('AML check started', {
      context: context
        .add('event', 'aml_start')
        .add('wallet_address', walletAddress)
        .add('jurisdiction', jurisdiction)
        .getContext(),
    });
  }

  static logAMLComplete(
    context: LogContext,
    walletAddress: string,
    status: string,
    riskScore: number,
    duration: number,
    flags: string[]
  ) {
    logger.info('AML check completed', {
      context: context
        .add('event', 'aml_complete')
        .add('wallet_address', walletAddress)
        .add('status', status)
        .add('risk_score', riskScore)
        .add('duration_ms', duration)
        .add('flags', flags)
        .getContext(),
    });
  }

  static logComplianceDecision(
    context: LogContext,
    decisionId: string,
    status: string,
    riskScore: number,
    reasoning: string
  ) {
    logger.info('Compliance decision made', {
      context: context
        .add('event', 'compliance_decision')
        .add('decision_id', decisionId)
        .add('status', status)
        .add('risk_score', riskScore)
        .add('reasoning', reasoning)
        .getContext(),
    });
  }

  static logSARGenerated(context: LogContext, sarId: string, entityId: string, findings: string[]) {
    logger.warn('Suspicious Activity Report generated', {
      context: context
        .add('event', 'sar_generated')
        .add('sar_id', sarId)
        .add('entity_id', entityId)
        .add('findings_count', findings.length)
        .getContext(),
    });
  }
}

/**
 * API Request/Response Logging
 * Logs all HTTP requests with status codes and response times
 */
export class APILogger {
  static logRequest(context: LogContext, method: string, path: string, ip: string) {
    logger.http('Request started', {
      context: context
        .add('event', 'request_start')
        .add('method', method)
        .add('path', path)
        .add('client_ip', ip)
        .getContext(),
    });
  }

  static logResponse(context: LogContext, statusCode: number, duration: number, method: string, path: string) {
    const level = statusCode >= 400 ? 'warn' : 'http';
    logger[level as any]('Request completed', {
      context: context
        .add('event', 'request_complete')
        .add('status_code', statusCode)
        .add('duration_ms', duration)
        .add('method', method)
        .add('path', path)
        .getContext(),
    });
  }

  static logError(context: LogContext, statusCode: number, error: Error, path: string) {
    logger.error('Request error', {
      context: context
        .add('event', 'request_error')
        .add('status_code', statusCode)
        .add('error', error.message)
        .add('path', path)
        .getContext(),
    });
  }
}

/**
 * Audit Trail Logging
 * Logs immutable compliance records for regulatory audit
 */
export class AuditLogger {
  static logAction(
    context: LogContext,
    action: string,
    actor: string,
    resource: string,
    result: string,
    details: any = {}
  ) {
    logger.info('Audit action', {
      context: context
        .add('event', 'audit_action')
        .add('action', action)
        .add('actor', actor)
        .add('resource', resource)
        .add('result', result)
        .add('details', details)
        .getContext(),
    });
  }

  static logApproval(context: LogContext, approverEmail: string, decision: string, notes: string) {
    logger.info('Compliance approval', {
      context: context
        .add('event', 'audit_approval')
        .add('approver', approverEmail)
        .add('decision', decision)
        .add('notes', notes)
        .getContext(),
    });
  }
}

/**
 * System Health Logging
 * Logs system component health, latency, and failures
 */
export class HealthLogger {
  static logComponentCheck(context: LogContext, component: string, status: string, latency: number) {
    const level = status === 'healthy' ? 'info' : 'warn';
    logger[level as any]('Health check result', {
      context: context
        .add('event', 'health_check')
        .add('component', component)
        .add('status', status)
        .add('latency_ms', latency)
        .getContext(),
    });
  }

  static logServiceDown(context: LogContext, serviceName: string, error: Error) {
    logger.error('Service unavailable', {
      context: context
        .add('event', 'service_down')
        .add('service', serviceName)
        .add('error', error.message)
        .getContext(),
    });
  }
}

export default logger;
