/**
 * Tenant Management Routes
 * Covers:
 *   - Tenant registration (POST /api/v1/tenants)
 *   - Tenant user onboarding (POST /api/v1/tenants/:id/users)
 *   - Secure API key generation + delivery (POST /api/v1/tenants/:id/api-keys)
 *   - OAuth2 client credentials generation (POST /api/v1/tenants/:id/oauth-clients)
 *   - Read/revoke endpoints for each resource
 *
 * All routes require a valid JWT (authenticateToken).
 * Mutation routes additionally require the 'admin' role.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import db from '../config/database';
import { authenticateToken, requireRole, requireAtLeastRole, ROLES } from '../middleware/authMiddleware';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/tenants.log' }),
  ],
});

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of characters kept from a generated API key for masked display. */
const KEY_PREFIX_LENGTH = 15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res
      .status(400)
      .json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Validation failed',
          400,
          errors.array()
        )
      );
    return true;
  }
  return false;
}

/**
 * Middleware: allows global admin to act on any tenant, or a tenant_admin to
 * act only on their own tenant (matched via req.user.tenant === req.params.tenantId).
 */
function requireTenantAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }
  if (user.role === ROLES.GLOBAL_ADMIN) {
    next();
    return;
  }
  if (user.role === ROLES.TENANT_ADMIN && user.tenant === req.params.tenantId) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Access denied',
    code: 'INSUFFICIENT_ROLE',
    message: 'Global admin or the tenant\'s own admin is required',
  });
}

/**
 * Generate a random API key, store only its SHA-256 hash in the DB.
 * Format: lmk_live_<32 hex chars>
 * Returns { rawKey, keyHash, keyPrefix }
 */
function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `lmk_live_${crypto.randomBytes(16).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, KEY_PREFIX_LENGTH);
  return { rawKey, keyHash, keyPrefix };
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/tenants
 * Register a new tenant.
 */
router.post(
  '/',
  authenticateToken,
  requireRole('admin'),
  [
    body('id')
      .matches(/^[A-Z0-9_-]{3,64}$/)
      .withMessage('Tenant ID must be 3–64 uppercase alphanumeric characters, underscores, or dashes'),
    body('name').isLength({ min: 2, max: 255 }).withMessage('Name must be 2–255 characters'),
  ],
  async (req: Request, res: Response) => {
    if (validationErrors(req, res)) return;
    const { id, name } = req.body;

    try {
      await db.query(
        `INSERT INTO tenants (id, name, is_active) VALUES ($1, $2, true)`,
        [id, name]
      );
      logger.info('Tenant registered', { tenantId: id, by: req.user?.id });
      res.status(201).json({ success: true, data: { id, name, is_active: true } });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_EXISTS,
            ErrorCategory.CONFLICT,
            `Tenant with ID "${id}" already exists`,
            409
          )
        );
      }
      logger.error('Failed to register tenant', { error: err.message });
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to register tenant')
      );
    }
  }
);

/**
 * GET /api/v1/tenants
 * List all tenants (admin only).
 */
router.get('/', authenticateToken, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, name, is_active, created_at, updated_at FROM tenants ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Failed to list tenants', { error: err.message });
    res.status(500).json(
      createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to list tenants')
    );
  }
});

/**
 * GET /api/v1/tenants/:tenantId
 * Get a single tenant.
 */
router.get(
  '/:tenantId',
  authenticateToken,
  [param('tenantId').notEmpty()],
  async (req: Request, res: Response) => {
    if (validationErrors(req, res)) return;
    try {
      const result = await db.query(
        `SELECT id, name, is_active, created_at, updated_at FROM tenants WHERE id = $1`,
        [req.params.tenantId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json(
          createErrorResponseFromDetails(ErrorCode.RESOURCE_NOT_FOUND, ErrorCategory.NOT_FOUND, 'Tenant not found', 404)
        );
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to get tenant')
      );
    }
  }
);

// ─── Tenant Users ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/tenants/:tenantId/users
 * Onboard a new user for a tenant.
 * Returns the user row + a one-time temporary password if auto-generated.
 */
router.post(
  '/:tenantId/users',
  authenticateToken,
  requireTenantAccess,
  [
    param('tenantId').notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('full_name').isLength({ min: 2, max: 255 }),
    body('role').isIn(['admin', 'tenant_admin', 'compliance_officer', 'compliance_analyst', 'operator', 'read_only', 'analyst', 'client']),
    body('products').optional().isArray(),
    body('password')
      .optional()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req: Request, res: Response) => {
    if (validationErrors(req, res)) return;

    const { tenantId } = req.params;
    const { email, full_name, role, products = [], password } = req.body;

    // Use provided password or auto-generate a secure one
    const isAutoGenerated = !password;
    const plainPassword = password ?? crypto.randomBytes(16).toString('base64url');
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    try {
      const result = await db.query(
        `INSERT INTO users
           (id, email, full_name, role, password_hash, tenant_id, products, permissions, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', true)
         RETURNING id, email, full_name, role, tenant_id, products, created_at`,
        [uuidv4(), email, full_name, role, passwordHash, tenantId, products]
      );

      const user = result.rows[0];
      logger.info('Tenant user onboarded', { tenantId, email, role, by: req.user?.id });

      res.status(201).json({
        success: true,
        data: {
          ...user,
          ...(isAutoGenerated ? { temporary_password: plainPassword } : {}),
        },
        ...(isAutoGenerated
          ? { notice: 'A temporary password was generated. This will not be shown again.' }
          : {}),
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_EXISTS,
            ErrorCategory.CONFLICT,
            `User with email "${email}" already exists`,
            409
          )
        );
      }
      logger.error('Failed to onboard user', { error: err.message });
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to onboard user')
      );
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantId/users
 * List all users for a tenant (no password hashes).
 */
router.get(
  '/:tenantId/users',
  authenticateToken,
  [param('tenantId').notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT id, email, full_name, role, products, permissions, is_active, created_at
           FROM users
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
        [req.params.tenantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to list users')
      );
    }
  }
);

// ─── API Keys ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/tenants/:tenantId/api-keys
 * Generate a new API key for a tenant.
 * The full key is returned ONCE and never stored in plaintext; only its SHA-256
 * hash and a display prefix are persisted.
 */
router.post(
  '/:tenantId/api-keys',
  authenticateToken,
  requireTenantAccess,
  [
    param('tenantId').notEmpty(),
    body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
    body('allowed_scopes').isArray({ min: 1 }).withMessage('At least one scope is required'),
    body('rate_limit_per_min').optional().isInt({ min: 1, max: 10000 }),
  ],
  async (req: Request, res: Response) => {
    if (validationErrors(req, res)) return;

    const { tenantId } = req.params;
    const { products, allowed_scopes, rate_limit_per_min = 60 } = req.body;
    const { rawKey, keyHash, keyPrefix } = generateApiKey();

    try {
      const result = await db.query(
        `INSERT INTO api_keys
           (id, api_key, key_hash, key_prefix, tenant_id, products, allowed_scopes, rate_limit_per_min, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING id, key_prefix, tenant_id, products, allowed_scopes, rate_limit_per_min, is_active, created_at`,
        [uuidv4(), keyPrefix, keyHash, keyPrefix, tenantId, products, allowed_scopes, rate_limit_per_min]
      );

      logger.info('API key generated', { tenantId, keyPrefix, by: req.user?.id });

      res.status(201).json({
        success: true,
        data: {
          ...result.rows[0],
          // Full key returned exactly once – never stored, never shown again
          api_key: rawKey,
        },
        notice: 'Copy this API key now. It will not be shown again.',
      });
    } catch (err: any) {
      logger.error('Failed to generate API key', { error: err.message });
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to generate API key')
      );
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantId/api-keys
 * List API keys for a tenant (masked – only prefix shown, no secrets).
 */
router.get(
  '/:tenantId/api-keys',
  authenticateToken,
  [param('tenantId').notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT id, key_prefix, tenant_id, products, allowed_scopes, rate_limit_per_min, is_active, created_at
           FROM api_keys
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
        [req.params.tenantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to list API keys')
      );
    }
  }
);

/**
 * DELETE /api/v1/tenants/:tenantId/api-keys/:keyId
 * Revoke an API key (sets is_active = false).
 */
router.delete(
  '/:tenantId/api-keys/:keyId',
  authenticateToken,
  requireTenantAccess,
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE api_keys SET is_active = false, updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING id`,
        [req.params.keyId, req.params.tenantId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json(
          createErrorResponseFromDetails(ErrorCode.RESOURCE_NOT_FOUND, ErrorCategory.NOT_FOUND, 'API key not found', 404)
        );
      }
      logger.info('API key revoked', { keyId: req.params.keyId, tenantId: req.params.tenantId });
      res.json({ success: true, message: 'API key revoked' });
    } catch (err: any) {
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to revoke API key')
      );
    }
  }
);

// ─── OAuth2 Clients ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/tenants/:tenantId/oauth-clients
 * Generate a new OAuth2 client (client_id + client_secret).
 * client_secret is returned ONCE; only its bcrypt hash is stored.
 */
router.post(
  '/:tenantId/oauth-clients',
  authenticateToken,
  requireTenantAccess,
  [
    param('tenantId').notEmpty(),
    body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
    body('allowed_scopes').isArray({ min: 1 }).withMessage('At least one scope is required'),
  ],
  async (req: Request, res: Response) => {
    if (validationErrors(req, res)) return;

    const { tenantId } = req.params;
    const { products, allowed_scopes } = req.body;

    const clientId = `client_${tenantId}_${crypto.randomBytes(4).toString('hex')}`;
    const clientSecret = crypto.randomBytes(24).toString('base64url');
    const clientSecretHash = await bcrypt.hash(clientSecret, 10);

    try {
      const result = await db.query(
        `INSERT INTO oauth_clients
           (id, client_id, client_secret_hash, tenant_id, products, allowed_scopes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, client_id, tenant_id, products, allowed_scopes, is_active, created_at`,
        [uuidv4(), clientId, clientSecretHash, tenantId, products, allowed_scopes, true]
      );

      logger.info('OAuth client generated', { tenantId, clientId, by: req.user?.id });

      res.status(201).json({
        success: true,
        data: {
          ...result.rows[0],
          // client_secret returned exactly once – never stored in plaintext
          client_secret: clientSecret,
        },
        notice: 'Copy the client_secret now. It will not be shown again.',
      });
    } catch (err: any) {
      if (err.code === '23505') {
        return res.status(409).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_EXISTS,
            ErrorCategory.CONFLICT,
            'An OAuth client with this ID already exists',
            409
          )
        );
      }
      logger.error('Failed to generate OAuth client', { error: err.message });
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to generate OAuth client')
      );
    }
  }
);

/**
 * GET /api/v1/tenants/:tenantId/oauth-clients
 * List OAuth clients for a tenant (no secrets).
 */
router.get(
  '/:tenantId/oauth-clients',
  authenticateToken,
  [param('tenantId').notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT id, client_id, tenant_id, products, allowed_scopes, is_active, created_at
           FROM oauth_clients
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
        [req.params.tenantId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to list OAuth clients')
      );
    }
  }
);

/**
 * DELETE /api/v1/tenants/:tenantId/oauth-clients/:clientId
 * Deactivate an OAuth client.
 */
router.delete(
  '/:tenantId/oauth-clients/:clientDbId',
  authenticateToken,
  requireTenantAccess,
  async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `UPDATE oauth_clients SET is_active = false, updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING id`,
        [req.params.clientDbId, req.params.tenantId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json(
          createErrorResponseFromDetails(ErrorCode.RESOURCE_NOT_FOUND, ErrorCategory.NOT_FOUND, 'OAuth client not found', 404)
        );
      }
      logger.info('OAuth client deactivated', { clientDbId: req.params.clientDbId });
      res.json({ success: true, message: 'OAuth client deactivated' });
    } catch (err: any) {
      res.status(500).json(
        createErrorResponseFromDetails(ErrorCode.DATABASE_ERROR, ErrorCategory.INTERNAL, 'Failed to deactivate OAuth client')
      );
    }
  }
);

export default router;
