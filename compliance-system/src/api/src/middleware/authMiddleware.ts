/**
 * JWT Authentication Middleware
 * Validates JWT tokens and extracts user information
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' }),
  ],
});

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        iat: number;
        exp: number;
      };
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

/**
 * JWT token validation middleware
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.warn('No token provided', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING',
        message: 'Authorization header with Bearer token is required',
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR',
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      logger.warn('Expired token used', {
        userId: decoded.id,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Please refresh your token',
      });
      return;
    }

    // Attach user to request
    req.user = decoded;

    logger.debug('Token authenticated successfully', {
      userId: decoded.id,
      role: decoded.role,
      path: req.path,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token', {
        error: error.message,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
        message: 'The provided token is not valid',
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Token expired', {
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Please refresh your token',
      });
    } else {
      logger.error('Token verification error', {
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip,
      });
      res.status(500).json({
        error: 'Authentication error',
        code: 'AUTH_ERROR',
      });
    }
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (req.user.role !== requiredRole) {
      logger.warn('Insufficient role access', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRole,
        path: req.path,
      });
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_ROLE',
        message: `Required role: ${requiredRole}, your role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!req.user.permissions?.includes(requiredPermission)) {
      logger.warn('Insufficient permission access', {
        userId: req.user.id,
        userPermissions: req.user.permissions,
        requiredPermission,
        path: req.path,
      });
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSION',
        message: `Required permission: ${requiredPermission}`,
      });
      return;
    }

    next();
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * Compliance officer middleware
 */
export const requireComplianceOfficer = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const allowedRoles = ['admin', 'compliance_officer'];
  if (!allowedRoles.includes(req.user.role)) {
    logger.warn('Access denied for compliance operations', {
      userId: req.user.id,
      userRole: req.user.role,
      path: req.path,
    });
    res.status(403).json({
      error: 'Compliance officer access required',
      code: 'COMPLIANCE_ACCESS_REQUIRED',
    });
    return;
  }

  next();
};
