/**
 * Rate Limiting Middleware
 * Implements per-IP and per-user rate limiting using Redis
 * 
 * Rate Limits:
 * - Per-IP: 100 requests/minute (public endpoints)
 * - Per-user (JWT): 1000 requests/minute (authenticated endpoints)
 * - Per-jurisdiction: 500 requests/minute (jurisdiction-specific operations)
 */

import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import logger from '../config/logger';

export interface RateLimitConfig {
  perIpLimit?: number; // Requests per minute from single IP
  perUserLimit?: number; // Requests per minute per authenticated user
  perJurisdictionLimit?: number; // Requests per minute per jurisdiction
  windowSizeSeconds?: number; // Time window for rate limit (default 60 seconds)
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetSeconds: number;
  isLimited: boolean;
}

// ─── FR-8.4: Per-tier rate limit policy ──────────────────────────────────────

/**
 * Subscription tiers supported for rate limiting (FR-8.4).
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * Per-tier general API limits (req/min) as defined in FR-8.4.
 * Enterprise tier defaults to Pro values; custom limits may override.
 */
export const TIER_GENERAL_LIMITS: Record<SubscriptionTier, number> = {
  free: 60,
  pro: 600,
  enterprise: 6000, // Default for enterprise; overridable via config
};

/**
 * Per-tier auth endpoint limits (req/min) as defined in FR-8.4.
 */
export const TIER_AUTH_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  pro: 30,
  enterprise: 300, // Default for enterprise; overridable via config
};

const DEFAULT_CONFIG: RateLimitConfig = {
  perIpLimit: 100,
  perUserLimit: 1000,
  perJurisdictionLimit: 500,
  windowSizeSeconds: 60,
};

export class RateLimiter {
  private redis: Redis;
  private config: Required<RateLimitConfig>;

  constructor(redisClient: Redis, config: RateLimitConfig = {}) {
    this.redis = redisClient;
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<RateLimitConfig>;
  }

  /**
   * Create Express middleware for rate limiting
   * Checks IP-based limits by default; for authenticated users reads tier from JWT claims (FR-8.4).
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get client IP (account for proxies)
        const clientIp = this.getClientIp(req);

        // Determine effective per-user limit based on subscription tier (FR-8.4)
        const tier = this.getTierFromRequest(req);
        const isAuthEndpoint = this.isAuthEndpoint(req);
        const tierUserLimit = isAuthEndpoint
          ? TIER_AUTH_LIMITS[tier]
          : TIER_GENERAL_LIMITS[tier];

        // Check IP-based rate limit
        const ipStatus = await this.checkRateLimit(
          `rate_limit:ip:${clientIp}`,
          this.config.perIpLimit
        );

        // Set headers
        res.setHeader('X-RateLimit-Limit', String(ipStatus.limit));
        res.setHeader('X-RateLimit-Remaining', String(ipStatus.remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ipStatus.resetSeconds));

        if (ipStatus.isLimited) {
          logger.warn(`[RATE_LIMIT] IP limit exceeded: ${clientIp}`);
          return res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Maximum ${ipStatus.limit} requests per minute.`,
            retryAfter: ipStatus.resetSeconds,
          });
        }

        // For authenticated users, apply tier-based limit (FR-8.4)
        if (req.user) {
          const effectiveLimit = Math.min(tierUserLimit, this.config.perUserLimit);
          const userStatus = await this.checkRateLimit(
            `rate_limit:user:${req.user.id}`,
            effectiveLimit
          );

          // Override headers with the more specific tier-based limit
          res.setHeader('X-RateLimit-Limit', String(userStatus.limit));
          res.setHeader('X-RateLimit-Remaining', String(userStatus.remaining));
          res.setHeader('X-RateLimit-Tier', tier);

          if (userStatus.isLimited) {
            logger.warn(`[RATE_LIMIT] User limit exceeded: ${req.user.id} (tier=${tier})`);
            return res.status(429).json({
              error: 'Too Many Requests',
              message: `User rate limit exceeded. Maximum ${userStatus.limit} requests per minute for ${tier} tier.`,
              retryAfter: userStatus.resetSeconds,
            });
          }
        }

        // For jurisdiction-specific operations
        if (req.body?.jurisdiction) {
          const jurisdictionStatus = await this.checkRateLimit(
            `rate_limit:jurisdiction:${req.body.jurisdiction}`,
            this.config.perJurisdictionLimit
          );

          if (jurisdictionStatus.isLimited) {
            logger.warn(
              `[RATE_LIMIT] Jurisdiction limit exceeded: ${req.body.jurisdiction}`
            );
            return res.status(429).json({
              error: 'Too Many Requests',
              message: `Jurisdiction rate limit exceeded. Maximum ${jurisdictionStatus.limit} requests per minute.`,
              retryAfter: jurisdictionStatus.resetSeconds,
            });
          }
        }

        next();
      } catch (error) {
        logger.error('[RATE_LIMIT] Middleware error:', {
          error: error instanceof Error ? error.message : String(error),
        });
        // On error, allow request to proceed (fail open)
        next();
      }
    };
  }

  /**
   * Determine subscription tier from JWT claims (FR-8.4).
   * Falls back to 'free' if no tier claim is present.
   */
  getTierFromRequest(req: Request): SubscriptionTier {
    const user = req.user as Record<string, unknown> | undefined;
    const tier = user?.['tier'];
    if (tier === 'pro' || tier === 'enterprise') return tier;
    return 'free';
  }

  /**
   * Determine whether the current request targets an authentication endpoint.
   * Auth endpoints have stricter per-tier limits (FR-8.4).
   */
  private isAuthEndpoint(req: Request): boolean {
    return req.path?.startsWith('/auth') || req.path?.startsWith('/api/v1/auth');
  }

  /**
   * Check if rate limit exceeded for a key
   * Uses sliding window counter pattern with Redis
   */
  private async checkRateLimit(
    key: string,
    limit: number
  ): Promise<RateLimitStatus> {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - this.config.windowSizeSeconds;

    try {
      // Use Redis ZSET for sliding window
      // Remove old entries outside the window
      await this.redis.zremrangebyscore(key, 0, windowStart);

      // Get current count
      const count = await this.redis.zcard(key);

      // Add current request
      const isLimited = count >= limit;
      if (!isLimited) {
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      }

      // Set expiration
      await this.redis.expire(key, this.config.windowSizeSeconds + 10);

      const remaining = Math.max(0, limit - count - (isLimited ? 0 : 1));
      const resetSeconds = this.config.windowSizeSeconds;

      return {
        limit,
        remaining,
        resetSeconds,
        isLimited,
      };
    } catch (error) {
      logger.error('[RATE_LIMIT] Check failed:', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });

      // On error, allow request
      return {
        limit,
        remaining: limit,
        resetSeconds: 0,
        isLimited: false,
      };
    }
  }

  /**
   * Reset rate limit for a key (admin operation)
   */
  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.info(`[RATE_LIMIT] Reset limit for key: ${key}`);
    } catch (error) {
      logger.error('[RATE_LIMIT] Reset failed:', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
    }
  }

  /**
   * Reset rate limit for a user
   */
  async resetUser(userId: string): Promise<void> {
    await this.reset(`rate_limit:user:${userId}`);
  }

  /**
   * Reset rate limit for an IP
   */
  async resetIp(ip: string): Promise<void> {
    await this.reset(`rate_limit:ip:${ip}`);
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(key: string, limit: number): Promise<RateLimitStatus> {
    return this.checkRateLimit(key, limit);
  }

  /**
   * Extract client IP from request (account for proxies)
   */
  private getClientIp(req: Request): string {
    // Check for IP in headers (proxies)
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }

    if (typeof forwarded === 'object' && forwarded.length > 0) {
      return forwarded[0];
    }

    // Check other common headers
    const clientIp = 
      (req.headers['x-client-ip'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      'unknown';

    // Remove IPv6 prefix if present
    return clientIp.replace(/^::ffff:/, '');
  }
}

/**
 * Create rate limiter middleware for Express
 * 
 * @example
 * const rateLimiter = new RateLimiter(redisClient, {
 *   perIpLimit: 100,
 *   perUserLimit: 1000
 * });
 * 
 * app.use('/api', rateLimiter.middleware());
 */
export function createRateLimiterMiddleware(
  redisClient: Redis,
  config?: RateLimitConfig
) {
  const limiter = new RateLimiter(redisClient, config);
  return limiter.middleware();
}
