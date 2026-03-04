/**
 * JWT Authentication Middleware
 * Validates JWT tokens and extracts user information
 * FR-8.2: JWT Token Blacklisting on logout
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import winston from 'winston';
import { getRedisClient } from '../config/redis';
import db from '../config/database';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' }),
  ],
});

// Redis key prefix for blacklisted JWT IDs (FR-8.2)
const BLACKLIST_PREFIX = 'jwt_blacklist:';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        jti?: string;
        iat: number;
        exp: number;
        // B2B / tenant context
        sub?: string;
        tenant?: string;
        products?: string[];
        scope?: string;
      };
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  jti?: string;
  iat: number;
  exp: number;
  // B2B / tenant context
  sub?: string;
  tenant?: string;
  products?: string[];
  scope?: string;
}

/**
 * Add a JWT ID (jti) to the Redis blacklist.
 * TTL is set to the remaining token lifetime so entries auto-expire (FR-8.2).
 */
export async function blacklistToken(jti: string, expSeconds: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(expSeconds - now, 1);
  try {
    const redis = getRedisClient();
    await redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttl);
    logger.info('Token blacklisted', { jti, ttlSeconds: ttl });
  } catch (error) {
    logger.error('Failed to blacklist token', {
      error: error instanceof Error ? error.message : String(error),
      jti,
    });
    throw error;
  }
}

/**
 * Check whether a JWT ID is blacklisted.
 */
async function isTokenBlacklisted(jti: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const value = await redis.get(`${BLACKLIST_PREFIX}${jti}`);
    return value !== null;
  } catch (error) {
    // Fail open: if Redis is unavailable, do not block legitimate requests
    logger.error('Redis blacklist check failed, failing open', {
      error: error instanceof Error ? error.message : String(error),
      jti,
    });
    return false;
  }
}

/**
 * JWT token validation middleware
 * FR-8.2: Also checks Redis blacklist to reject revoked tokens within 100ms.
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  (async () => {
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

      // FR-8.2: Check Redis blacklist for revoked tokens
      if (decoded.jti) {
        const blacklisted = await isTokenBlacklisted(decoded.jti);
        if (blacklisted) {
          logger.warn('Blacklisted token used', {
            userId: decoded.id,
            jti: decoded.jti,
            ip: req.ip,
          });
          res.status(401).json({
            error: 'Token revoked',
            code: 'TOKEN_BLACKLISTED',
            message: 'This token has been revoked. Please log in again.',
          });
          return;
        }
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
          error: (error as Error).message,
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
  })().catch((err) => {
    logger.error('Unexpected authentication error', {
      error: err instanceof Error ? err.message : String(err),
      ip: req.ip,
    });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Authentication error', code: 'AUTH_ERROR' });
    }
  });
};

// ─── Role constants ───────────────────────────────────────────────────────────

/**
 * Ableka Lumina platform roles.
 * GLOBAL_ADMIN (admin) is the Ableka-internal super-admin.
 * The remaining five are tenant-scoped roles used in the self-registration flow.
 */
export const ROLES = {
  GLOBAL_ADMIN:       'admin',
  TENANT_ADMIN:       'tenant_admin',
  COMPLIANCE_OFFICER: 'compliance_officer',
  COMPLIANCE_ANALYST: 'compliance_analyst',
  OPERATOR:           'operator',
  READ_ONLY:          'read_only',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];

/**
 * All roles that can be selected during self-registration (excludes global admin).
 */
export const SELF_REGISTERABLE_ROLES: RoleType[] = [
  ROLES.TENANT_ADMIN,
  ROLES.COMPLIANCE_OFFICER,
  ROLES.COMPLIANCE_ANALYST,
  ROLES.OPERATOR,
  ROLES.READ_ONLY,
];

/**
 * Ordered role hierarchy – index 0 is lowest, last is highest.
 * Used by requireAtLeastRole.
 */
const ROLE_HIERARCHY: string[] = [
  ROLES.READ_ONLY,
  ROLES.OPERATOR,
  ROLES.COMPLIANCE_ANALYST,
  ROLES.COMPLIANCE_OFFICER,
  ROLES.TENANT_ADMIN,
  ROLES.GLOBAL_ADMIN,
];

/**
 * Default permissions granted to each role.
 * These are injected into the JWT at login so that requirePermission() works
 * consistently for both role-based and permission-based checks.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  [ROLES.GLOBAL_ADMIN]: ['*'],
  [ROLES.TENANT_ADMIN]: [
    'tenant:settings',
    'tenant:api_keys:view',
    'tenant:api_keys:rotate',
    'tenant:users:invite',
    'tenant:users:manage',
    'compliance:read',
    'aml:read',
    'kyc:read',
    'reports:read',
    'cases:read',
    'alerts:read',
    'alerts:write',
    'audit:read',
  ],
  [ROLES.COMPLIANCE_OFFICER]: [
    'compliance:read',
    'compliance:write',
    'aml:read',
    'aml:write',
    'kyc:read',
    'cases:read',
    'cases:manage',
    'cases:approve',
    'cases:reject',
    'cases:notes',
    'sar:file',
    'rules:edit',
    'alerts:read',
    'alerts:write',
    'reports:read',
    'reports:write',
    'reports:submit',
    'audit:read',
    'monitoring:write',
  ],
  [ROLES.COMPLIANCE_ANALYST]: [
    'compliance:read',
    'aml:read',
    'kyc:read',
    'cases:read',
    'cases:notes',
    'transactions:read',
    'alerts:read',
    'reports:read',
    'audit:read',
  ],
  [ROLES.OPERATOR]: [
    'compliance:read',
    'aml:read',
    'kyc:read',
    'cases:read',
    'reviews:trigger',
    'reports:read',
    'reports:export',
    'assets:view',
    'alerts:read',
  ],
  [ROLES.READ_ONLY]: [
    'compliance:read',
    'aml:read',
    'kyc:read',
    'cases:read',
    'reports:read',
    'audit:read',
    'alerts:read',
  ],
  // ── Legacy / backward-compat aliases ─────────────────────────────────────
  // These role values existed before the 5-role expansion and are kept for
  // existing rows in the users table.  Do NOT use them in new code.
  // Mapping: 'analyst' → compliance_analyst, 'client' → read_only
  analyst:    ['compliance:read', 'aml:read', 'kyc:read'],
  client:     ['compliance:read'],
  api_client: [],
};

// ─── Role-based authorization middleware ──────────────────────────────────────

/**
 * Require an exact role match.
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
 * Pass if the authenticated user has ANY of the specified roles.
 */
export const requireAnyRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      logger.warn('Role not in allowed set', {
        userId: req.user.id,
        userRole: req.user.role,
        allowedRoles: roles,
        path: req.path,
      });
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_ROLE',
        message: `Required one of: ${roles.join(', ')}`,
      });
      return;
    }
    next();
  };
};

/**
 * Pass if the user has the specified role OR any higher role in the hierarchy.
 * E.g. requireAtLeastRole('compliance_analyst') passes for compliance_officer,
 * tenant_admin, and admin as well.
 */
export const requireAtLeastRole = (minRole: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }
    const userLevel = ROLE_HIERARCHY.indexOf(req.user.role);
    const requiredLevel = ROLE_HIERARCHY.indexOf(minRole);
    if (userLevel < 0 || requiredLevel < 0 || userLevel < requiredLevel) {
      logger.warn('Role below minimum required', {
        userId: req.user.id,
        userRole: req.user.role,
        minRole,
        path: req.path,
      });
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_ROLE',
        message: `Minimum required role: ${minRole}`,
      });
      return;
    }
    next();
  };
};

/**
 * Permission-based authorization middleware.
 * Also grants access when the user holds the wildcard permission '*' (global admin).
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

    const perms = req.user.permissions ?? [];
    const hasPermission = perms.includes('*') || perms.includes(requiredPermission);

    if (!hasPermission) {
      logger.warn('Insufficient permission access', {
        userId: req.user.id,
        userPermissions: perms,
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
 * Tenant-admin-or-above middleware.
 * Passes for tenant_admin and global admin.
 */
export const requireTenantAdmin = requireAtLeastRole(ROLES.TENANT_ADMIN);

/**
 * Compliance officer middleware – allows compliance_officer, tenant_admin, and admin.
 */
export const requireComplianceOfficer = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const allowedRoles: string[] = [ROLES.GLOBAL_ADMIN, ROLES.TENANT_ADMIN, ROLES.COMPLIANCE_OFFICER];
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

/**
 * API Key authentication middleware (B2B partner / tenant backend flows).
 * Reads the X-API-Key header, looks up the api_keys table, and populates
 * req.user with the tenant_id, products, and allowed_scopes for the key.
 */
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  (async () => {
    try {
      const apiKey = req.headers['x-api-key'] as string | undefined;

      if (!apiKey) {
        res.status(401).json({
          error: 'API key required',
          code: 'API_KEY_MISSING',
          message: 'X-API-Key header is required for this endpoint',
        });
        return;
      }

      // Hash the incoming key and use constant-time lookup against stored hash.
      // Falls back to plaintext comparison for legacy seed keys (no key_hash).
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      const result = await db.query(
        `SELECT ak.id, ak.tenant_id, ak.products, ak.allowed_scopes
           FROM api_keys ak
          WHERE (ak.key_hash = $1 OR (ak.key_hash IS NULL AND ak.api_key = $2))
            AND ak.is_active = true`,
        [keyHash, apiKey]
      );

      if (result.rows.length === 0) {
        logger.warn('Invalid or inactive API key used', { ip: req.ip, path: req.path });
        res.status(401).json({
          error: 'Invalid API key',
          code: 'API_KEY_INVALID',
          message: 'The provided API key is not valid or has been revoked',
        });
        return;
      }

      const row = result.rows[0];
      const now = Math.floor(Date.now() / 1000);

      // Synthesize a lightweight user context so downstream middleware is consistent
      // permissions is mapped to allowed_scopes so that requirePermission() checks work
      // identically for both JWT-authenticated users and API-key-authenticated clients.
      req.user = {
        id: row.id,
        email: '',
        role: 'api_client',
        permissions: row.allowed_scopes as string[],
        iat: now,
        exp: now + 3600,
        tenant: row.tenant_id as string,
        products: row.products as string[],
        scope: (row.allowed_scopes as string[]).join(' '),
      };

      logger.debug('API key authenticated', { tenant: row.tenant_id, path: req.path });
      next();
    } catch (error) {
      logger.error('API key authentication error', {
        error: error instanceof Error ? error.message : String(error),
        ip: req.ip,
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Authentication error', code: 'AUTH_ERROR' });
      }
    }
  })().catch((err) => {
    logger.error('Unexpected API key authentication error', {
      error: err instanceof Error ? err.message : String(err),
      ip: req.ip,
    });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Authentication error', code: 'AUTH_ERROR' });
    }
  });
};

/**
 * Product-based authorization middleware.
 * Ensures the authenticated principal has access to the required product.
 * Works with both JWT-based users and API-key-authenticated clients.
 */
export const requireProduct = (requiredProduct: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const products = req.user.products ?? [];
    if (!products.includes(requiredProduct)) {
      logger.warn('Product access denied', {
        userId: req.user.id,
        tenant: req.user.tenant,
        userProducts: products,
        requiredProduct,
        path: req.path,
      });
      res.status(403).json({
        error: 'Product access denied',
        code: 'PRODUCT_ACCESS_DENIED',
        message: `Access to product "${requiredProduct}" is not permitted for this token`,
      });
      return;
    }

    next();
  };
};

/**
 * Scope-based authorization middleware.
 * Ensures the authenticated principal's token includes the required OAuth2 scope.
 * Works with both JWT-based users and API-key-authenticated clients.
 */
export const requireScope = (requiredScope: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const scopeList = req.user.scope ? req.user.scope.split(' ') : [];
    if (!scopeList.includes(requiredScope)) {
      logger.warn('Insufficient scope', {
        userId: req.user.id,
        tenant: req.user.tenant,
        userScope: req.user.scope,
        requiredScope,
        path: req.path,
      });
      res.status(403).json({
        error: 'Insufficient scope',
        code: 'INSUFFICIENT_SCOPE',
        message: `Required scope: ${requiredScope}`,
      });
      return;
    }

    next();
  };
};
