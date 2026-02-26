/**
 * Shared Error Types and Enums
 * Standardized error handling across all services
 */

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  RATE_LIMIT = 'RATE_LIMIT',
}

export enum ErrorCode {
  // Validation Errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication Errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',

  // Authorization Errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',

  // Not Found Errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',

  // Conflict Errors
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

  // Internal Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // External Service Errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  THIRD_PARTY_TIMEOUT = 'THIRD_PARTY_TIMEOUT',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ErrorResponse {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  details?: any;
  httpStatus: number;
  timestamp: string;
  requestId: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly httpStatus: number;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    category: ErrorCategory,
    message: string,
    httpStatus: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

// Convenience error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.INVALID_INPUT, ErrorCategory.VALIDATION, message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCode.INVALID_CREDENTIALS, ErrorCategory.AUTHENTICATION, message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorCode.INSUFFICIENT_PERMISSIONS, ErrorCategory.AUTHORIZATION, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(ErrorCode.RESOURCE_NOT_FOUND, ErrorCategory.NOT_FOUND, `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ErrorCode.RESOURCE_EXISTS, ErrorCategory.CONFLICT, message, 409);
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(ErrorCode.SERVICE_UNAVAILABLE, ErrorCategory.INTERNAL, message, 500);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, details?: any) {
    super(
      ErrorCode.EXTERNAL_API_ERROR,
      ErrorCategory.EXTERNAL_SERVICE,
      `${service} service error`,
      502,
      details
    );
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(ErrorCode.RATE_LIMIT_EXCEEDED, ErrorCategory.RATE_LIMIT, message, 429);
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(error: AppError | Error, requestId: string): ErrorResponse {
  if (error instanceof AppError) {
    return {
      code: error.code,
      category: error.category,
      message: error.message,
      details: error.details,
      httpStatus: error.httpStatus,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  // Handle generic errors
  return {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    category: ErrorCategory.INTERNAL,
    message: error.message || 'An unexpected error occurred',
    httpStatus: 500,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Create error response from error details
 */
export function createErrorResponseFromDetails(
  code: ErrorCode,
  category: ErrorCategory,
  message: string,
  httpStatus: number = 500,
  details?: any,
  requestId: string = 'unknown'
): ErrorResponse {
  return {
    code,
    category,
    message,
    details,
    httpStatus,
    timestamp: new Date().toISOString(),
    requestId,
  };
}
