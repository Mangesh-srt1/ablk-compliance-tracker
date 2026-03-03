/**
 * OAuth2 Token Routes
 * Implements OAuth2 Client Credentials grant for B2B partner / tenant backend flows.
 *
 * POST /oauth/token
 *   grant_type=client_credentials
 *   client_id=...
 *   client_secret=...
 *   scope=pe:read pe:write compliance:read   (optional – subset of allowed_scopes)
 *
 * Returns a tenant-scoped JWT access token with:
 *   sub, tenant, products, scope claims (as required by the B2B spec)
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import winston from 'winston';
import db from '../config/database';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';

const router = Router();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' }),
  ],
});

/**
 * POST /oauth/token
 * OAuth2 Client Credentials grant.
 * Accepts application/x-www-form-urlencoded or application/json bodies.
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const {
      grant_type,
      client_id,
      client_secret,
      scope: requestedScope,
    } = req.body as {
      grant_type?: string;
      client_id?: string;
      client_secret?: string;
      scope?: string;
    };

    // Validate grant type
    if (grant_type !== 'client_credentials') {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'unsupported_grant_type: only client_credentials is supported',
          400
        )
      );
    }

    if (!client_id || !client_secret) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.MISSING_REQUIRED_FIELD,
          ErrorCategory.VALIDATION,
          'client_id and client_secret are required',
          400
        )
      );
    }

    // Look up the OAuth client
    const clientResult = await db.query(
      `SELECT id, client_secret_hash, tenant_id, products, allowed_scopes
         FROM oauth_clients
        WHERE client_id = $1
          AND is_active = true`,
      [client_id]
    );

    if (clientResult.rows.length === 0) {
      logger.warn('OAuth token request with unknown client_id', { client_id, ip: req.ip });
      return res.status(401).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_CREDENTIALS,
          ErrorCategory.AUTHENTICATION,
          'invalid_client: client authentication failed',
          401
        )
      );
    }

    const client = clientResult.rows[0];

    // Verify client_secret
    const secretValid = await bcrypt.compare(client_secret, client.client_secret_hash);
    if (!secretValid) {
      logger.warn('OAuth token request with invalid client_secret', { client_id, ip: req.ip });
      return res.status(401).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_CREDENTIALS,
          ErrorCategory.AUTHENTICATION,
          'invalid_client: client authentication failed',
          401
        )
      );
    }

    // Resolve granted scopes: intersection of requested and allowed
    const allowedScopes: string[] = client.allowed_scopes ?? [];
    let grantedScopes: string[];
    if (requestedScope) {
      const requested = requestedScope.split(/\s+/).filter(Boolean);
      grantedScopes = requested.filter((s) => allowedScopes.includes(s));
      if (grantedScopes.length === 0) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            ErrorCategory.AUTHORIZATION,
            'invalid_scope: none of the requested scopes are permitted for this client',
            400
          )
        );
      }
    } else {
      // No scope requested – grant all allowed scopes
      grantedScopes = allowedScopes;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      return res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.CONFIGURATION_ERROR,
          ErrorCategory.INTERNAL,
          'Server configuration error',
          500
        )
      );
    }

    const issuer = process.env.JWT_ISSUER || 'https://auth.abeleka.com';
    const audience = process.env.JWT_AUDIENCE || 'https://api.abeleka.com';
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    // Parse expiresIn to derive the numeric expires_in (seconds) returned in the response
    // Supports simple "Nh" or "Nm" formats; defaults to 3600s (1h)
    let expiresInSeconds = 3600;
    const match = /^(\d+)(h|m|s)?$/.exec(expiresIn);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2] || 's';
      expiresInSeconds = unit === 'h' ? value * 3600 : unit === 'm' ? value * 60 : value;
    }

    const tokenPayload = {
      sub: `client_${client.tenant_id}`,
      tenant: client.tenant_id as string,
      products: client.products as string[],
      scope: grantedScopes.join(' '),
      // The fields below (id, email, role, permissions) are included for
      // compatibility with authenticateToken middleware, which expects these
      // fields when validating any Bearer JWT on protected routes.
      id: client.id as string,
      email: '',
      role: 'api_client',
      permissions: grantedScopes,
    };

    const accessToken = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn,
      issuer,
      audience,
    } as jwt.SignOptions);

    logger.info('OAuth client_credentials token issued', {
      client_id,
      tenant: client.tenant_id,
      scope: grantedScopes.join(' '),
    });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresInSeconds,
      scope: grantedScopes.join(' '),
    });
  } catch (error) {
    logger.error('OAuth token endpoint error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json(
      createErrorResponseFromDetails(
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorCategory.INTERNAL,
        'Token issuance failed'
      )
    );
  }
});

export default router;
