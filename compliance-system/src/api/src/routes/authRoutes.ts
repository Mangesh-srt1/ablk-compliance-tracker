/**
 * Authentication Routes
 * Login, logout, and token management endpoints
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import winston from 'winston';
import db from '../config/database';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' })
  ]
});

/**
 * POST /api/auth/login
 * User login endpoint
 */
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Validation failed',
          400,
          errors.array()
        ));
      }

      const { email, password } = req.body;

      // Find user by email
      const userQuery = 'SELECT id, email, password_hash, role, permissions FROM users WHERE email = $1 AND is_active = true';
      const userResult = await db.query(userQuery, [email]);

      if (userResult.rows.length === 0) {
        return res.status(401).json(createErrorResponseFromDetails(
          ErrorCode.INVALID_CREDENTIALS,
          ErrorCategory.AUTHENTICATION,
          'Invalid email or password'
        ));
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json(createErrorResponseFromDetails(
          ErrorCode.INVALID_CREDENTIALS,
          ErrorCategory.AUTHENTICATION,
          'Invalid email or password'
        ));
      }

      // Generate JWT token
      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'default-secret',
        {
          expiresIn: process.env.JWT_EXPIRES_IN || '24h',
          issuer: 'compliance-api',
          audience: 'compliance-client'
        } as jwt.SignOptions
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default-secret',
        {
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
          issuer: 'compliance-api',
          audience: 'compliance-client'
        } as jwt.SignOptions
      );

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.json({
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          }
        }
      });

    } catch (error) {
      logger.error('Login error', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json(createErrorResponseFromDetails(
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorCategory.INTERNAL,
        'Login failed'
      ));
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh',
  [
    body('refreshToken').isLength({ min: 1 })
  ],
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'default-secret'
      ) as jwt.JwtPayload;

      // Get user details
      const userQuery = 'SELECT id, email, role, permissions FROM users WHERE id = $1 AND is_active = true';
      const userResult = await db.query(userQuery, [decoded.id]);

      if (userResult.rows.length === 0) {
        return res.status(401).json(createErrorResponseFromDetails(
          ErrorCode.INVALID_CREDENTIALS,
          ErrorCategory.AUTHENTICATION,
          'Invalid refresh token'
        ));
      }

      const user = userResult.rows[0];

      // Generate new access token
      const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      };

      const newToken = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'default-secret',
        {
          expiresIn: process.env.JWT_EXPIRES_IN || '24h',
          issuer: 'compliance-api',
          audience: 'compliance-client'
        } as jwt.SignOptions
      );

      res.json({
        success: true,
        data: {
          token: newToken
        }
      });

    } catch (error) {
      logger.error('Token refresh error', { error: error instanceof Error ? error.message : String(error) });
      res.status(401).json(createErrorResponseFromDetails(
        ErrorCode.TOKEN_INVALID,
        ErrorCategory.AUTHENTICATION,
        'Invalid refresh token'
      ));
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout endpoint (client-side token removal)
 */
router.post('/logout', (req: Request, res: Response) => {
  // In a stateless JWT system, logout is handled client-side
  // For enhanced security, you could implement token blacklisting here
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
