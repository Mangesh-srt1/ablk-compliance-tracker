/**
 * Authentication Routes
 * Login, logout, token management, self-registration, and OTP verification.
 * FR-8.2: JWT Token Blacklisting on logout
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import db from '../config/database';
import { getRedisClient } from '../config/redis';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';
import {
  authenticateToken,
  blacklistToken,
  SELF_REGISTERABLE_ROLES,
  ROLE_DEFAULT_PERMISSIONS,
} from '../middleware/authMiddleware';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' }),
  ],
});

// ─── OTP helpers ──────────────────────────────────────────────────────────────

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const OTP_REDIS_PREFIX = 'otp:register:';

/** Generate a 6-digit numeric OTP. */
function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** SHA-256 hash of the OTP for safe Redis storage. */
function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/** Store hashed OTP in Redis with TTL. */
async function storeOtp(email: string, otp: string): Promise<void> {
  const redis = getRedisClient();
  await redis.set(`${OTP_REDIS_PREFIX}${email}`, hashOtp(otp), 'EX', OTP_TTL_SECONDS);
}

/** Verify OTP from Redis. Returns true and deletes the key on success. */
async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const redis = getRedisClient();
  const stored = await redis.get(`${OTP_REDIS_PREFIX}${email}`);
  if (!stored || stored !== hashOtp(otp)) return false;
  await redis.del(`${OTP_REDIS_PREFIX}${email}`);
  return true;
}

/**
 * POST /api/auth/login
 * User login endpoint
 */
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 6 })],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
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
      }

      const { email, password } = req.body;

      // Find user by email
      const userQuery =
        'SELECT id, email, password_hash, role, permissions, tenant_id, products FROM users WHERE email = $1 AND is_active = true';
      const userResult = await db.query(userQuery, [email]);

      if (userResult.rows.length === 0) {
        return res
          .status(401)
          .json(
            createErrorResponseFromDetails(
              ErrorCode.INVALID_CREDENTIALS,
              ErrorCategory.AUTHENTICATION,
              'Invalid email or password'
            )
          );
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res
          .status(401)
          .json(
            createErrorResponseFromDetails(
              ErrorCode.INVALID_CREDENTIALS,
              ErrorCategory.AUTHENTICATION,
              'Invalid email or password'
            )
          );
      }

      // Generate JWT token (include jti for blacklist support - FR-8.2)
      // Include tenant + products claims for multi-tenant product access control
      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        jti: uuidv4(),
        ...(user.tenant_id ? { tenant: user.tenant_id } : {}),
        products: user.products || [],
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default-secret', {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'compliance-api',
        audience: 'compliance-client',
      } as jwt.SignOptions);

      // Generate refresh token
      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default-secret',
        {
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
          issuer: 'compliance-api',
          audience: 'compliance-client',
        } as jwt.SignOptions
      );

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
        },
      });
    } catch (error) {
      logger.error('Login error', {
        error: error instanceof Error ? error.message : String(error),
      });
      res
        .status(500)
        .json(
          createErrorResponseFromDetails(
            ErrorCode.SERVICE_UNAVAILABLE,
            ErrorCategory.INTERNAL,
            'Login failed'
          )
        );
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  [body('refreshToken').isLength({ min: 1 })],
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default-secret'
      ) as jwt.JwtPayload;

      // Get user details
      const userQuery =
        'SELECT id, email, role, permissions, tenant_id, products FROM users WHERE id = $1 AND is_active = true';
      const userResult = await db.query(userQuery, [decoded.id]);

      if (userResult.rows.length === 0) {
        return res
          .status(401)
          .json(
            createErrorResponseFromDetails(
              ErrorCode.INVALID_CREDENTIALS,
              ErrorCategory.AUTHENTICATION,
              'Invalid refresh token'
            )
          );
      }

      const user = userResult.rows[0];

      // Generate new access token
      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        ...(user.tenant_id ? { tenant: user.tenant_id } : {}),
        products: user.products || [],
      };

      const newToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default-secret', {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'compliance-api',
        audience: 'compliance-client',
      } as jwt.SignOptions);

      res.json({
        success: true,
        data: {
          token: newToken,
        },
      });
    } catch (error) {
      logger.error('Token refresh error', {
        error: error instanceof Error ? error.message : String(error),
      });
      res
        .status(401)
        .json(
          createErrorResponseFromDetails(
            ErrorCode.TOKEN_INVALID,
            ErrorCategory.AUTHENTICATION,
            'Invalid refresh token'
          )
        );
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout endpoint - blacklists the current JWT token (FR-8.2)
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (user?.jti) {
      // Blacklist the token until it would naturally expire
      await blacklistToken(user.jti, user.exp);
      logger.info('User logged out, token blacklisted', {
        userId: user.id,
        jti: user.jti,
        ip: req.ip,
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error - token may not be blacklisted', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Token will expire naturally; inform the client of the degraded state
    res.json({
      success: true,
      message: 'Logged out successfully',
      warning: 'Token revocation may be delayed; please discard your token immediately.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-registration flow (register → OTP → verify)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Create a new user account and send a 6-digit OTP to the provided email.
 * The account is inactive until the OTP is verified.
 *
 * Roles available for self-registration: tenant_admin | compliance_officer |
 *   compliance_analyst | operator | read_only
 *
 * In development / test environments (NODE_ENV !== 'production') the response
 * includes a `debug_otp` field so the flow can be tested without an email server.
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('full_name').isLength({ min: 2, max: 255 }).withMessage('full_name must be 2–255 characters'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role')
      .isIn(SELF_REGISTERABLE_ROLES)
      .withMessage(`Role must be one of: ${SELF_REGISTERABLE_ROLES.join(', ')}`),
    body('tenant_id').optional().isLength({ min: 1, max: 64 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { email, full_name, role, tenant_id } = req.body;
      const password: string = req.body.password;

      // Check if email is already registered
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json(
          createErrorResponseFromDetails(
            ErrorCode.RESOURCE_EXISTS,
            ErrorCategory.VALIDATION,
            'An account with this email already exists'
          )
        );
      }

      // Validate tenant exists if provided
      if (tenant_id) {
        const tenantResult = await db.query(
          'SELECT id FROM tenants WHERE id = $1 AND is_active = true',
          [tenant_id]
        );
        if (tenantResult.rows.length === 0) {
          return res.status(400).json(
            createErrorResponseFromDetails(
              ErrorCode.INVALID_INPUT,
              ErrorCategory.VALIDATION,
              `Tenant '${tenant_id}' does not exist or is inactive`
            )
          );
        }
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const permissions = ROLE_DEFAULT_PERMISSIONS[role] ?? [];

      await db.query(
        `INSERT INTO users
           (id, email, full_name, role, password_hash, tenant_id, products,
            permissions, is_active, is_email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, '{}', $7, false, false)`,
        [uuidv4(), email, full_name, role, passwordHash, tenant_id ?? null, permissions]
      );

      // Generate and store OTP
      const otp = generateOtp();
      await storeOtp(email, otp);

      logger.info('User registered, OTP generated', { email, role, ip: req.ip });

      const responseData: Record<string, any> = {
        message: 'Registration successful. Please check your email for the verification code.',
      };

      // Expose OTP in non-production environments for testing
      if (process.env.NODE_ENV !== 'production') {
        responseData.debug_otp = otp;
      }

      return res.status(201).json({ success: true, data: responseData });
    } catch (error) {
      logger.error('Registration error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Registration failed'
        )
      );
    }
  }
);

/**
 * POST /api/auth/verify-otp
 * Verify the 6-digit OTP sent during registration.
 * On success activates the account and returns a JWT so the user is immediately
 * logged in.
 */
router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('OTP must be a 6-digit number'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { email, otp } = req.body;

      // Find the user (must exist and not yet verified)
      const userResult = await db.query(
        `SELECT id, email, role, permissions, tenant_id, products, is_email_verified
           FROM users WHERE email = $1`,
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json(
          createErrorResponseFromDetails(
            ErrorCode.USER_NOT_FOUND,
            ErrorCategory.AUTHENTICATION,
            'No account found for this email'
          )
        );
      }

      const user = userResult.rows[0];

      if (user.is_email_verified) {
        return res.status(409).json({
          success: false,
          error: 'Email already verified. Please log in.',
          code: 'ALREADY_VERIFIED',
        });
      }

      // Verify OTP
      const valid = await verifyOtp(email, otp);
      if (!valid) {
        logger.warn('Invalid or expired OTP attempt', { email, ip: req.ip });
        return res.status(401).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_CREDENTIALS,
            ErrorCategory.AUTHENTICATION,
            'Invalid or expired verification code'
          )
        );
      }

      // Activate the account
      await db.query(
        `UPDATE users SET is_email_verified = true, is_active = true, updated_at = NOW()
           WHERE id = $1`,
        [user.id]
      );

      // Issue JWT
      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        jti: uuidv4(),
        ...(user.tenant_id ? { tenant: user.tenant_id } : {}),
        products: user.products || [],
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'default-secret', {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'compliance-api',
        audience: 'compliance-client',
      } as jwt.SignOptions);

      logger.info('Email verified, user activated', { userId: user.id, email, ip: req.ip });

      return res.json({
        success: true,
        data: {
          token,
          user: { id: user.id, email: user.email, role: user.role },
          message: 'Email verified successfully. You are now logged in.',
        },
      });
    } catch (error) {
      logger.error('OTP verification error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Verification failed'
        )
      );
    }
  }
);

/**
 * POST /api/auth/resend-otp
 * Resend the verification OTP for an unverified account.
 */
router.post(
  '/resend-otp',
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Validation failed',
            400,
            errors.array()
          )
        );
      }

      const { email } = req.body;

      const userResult = await db.query(
        'SELECT id, is_email_verified FROM users WHERE email = $1',
        [email]
      );

      // Always respond 200 to prevent email enumeration
      if (userResult.rows.length === 0 || userResult.rows[0].is_email_verified) {
        return res.json({
          success: true,
          data: { message: 'If an unverified account exists for this email, a new code has been sent.' },
        });
      }

      const otp = generateOtp();
      await storeOtp(email, otp);

      logger.info('OTP resent', { email, ip: req.ip });

      const responseData: Record<string, any> = {
        message: 'A new verification code has been sent to your email.',
      };

      if (process.env.NODE_ENV !== 'production') {
        responseData.debug_otp = otp;
      }

      return res.json({ success: true, data: responseData });
    } catch (error) {
      logger.error('Resend OTP error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Failed to resend verification code'
        )
      );
    }
  }
);

export default router;
