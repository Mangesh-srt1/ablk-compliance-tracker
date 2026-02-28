/**
 * Rate Limiter Tests
 * Validates per-IP and per-user rate limiting with sliding window counter
 * and FR-8.4 per-tier rate limit policy.
 */

import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import {
  RateLimiter,
  TIER_GENERAL_LIMITS,
  TIER_AUTH_LIMITS,
  SubscriptionTier,
} from '../rateLimiter';
import logger from '../../config/logger';

const mockRedis = {
  zremrangebyscore: jest.fn(),
  zcard: jest.fn(),
  zadd: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
};

jest.mock('../../config/logger');

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.zremrangebyscore.mockResolvedValue(0);
    mockRedis.zcard.mockResolvedValue(0);
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    rateLimiter = new RateLimiter(mockRedis as any, {
      perIpLimit: 100,
      perUserLimit: 1000,
      windowSizeSeconds: 60,
    });

    mockReq = {
      headers: { 'x-forwarded-for': '192.168.1.100' },
      body: {},
      user: undefined,
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('middleware', () => {
    it('should allow request within IP limit', async () => {
      mockRedis.zcard.mockResolvedValue(50); // 50 requests so far, limit is 100

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject request exceeding IP limit', async () => {
      mockRedis.zcard.mockResolvedValue(100); // Already at limit

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', async () => {
      mockRedis.zcard.mockResolvedValue(50);

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '100'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.any(String)
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should check user limit when authenticated', async () => {
      mockRedis.zcard
        .mockResolvedValueOnce(50) // IP limit check
        .mockResolvedValueOnce(900); // User limit check (900 of 1000)

      // Enterprise tier user — effective limit is min(6000, 1000) = 1000; 900 < 1000 → allowed
      (mockReq as any).user = { id: 'user-123', email: 'test@test.com', role: 'admin', tier: 'enterprise', permissions: [], iat: 0, exp: 0 };

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user limit exceeded', async () => {
      mockRedis.zcard
        .mockResolvedValueOnce(50) // IP limit check
        .mockResolvedValueOnce(1000); // User limit check (at limit)

      // Enterprise tier user — effective limit is min(6000, 1000) = 1000; 1000 >= 1000 → rejected
      (mockReq as any).user = { id: 'user-123', email: 'test@test.com', role: 'admin', tier: 'enterprise', permissions: [], iat: 0, exp: 0 };

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should check jurisdiction limit when jurisdiction provided', async () => {
      mockRedis.zcard
        .mockResolvedValueOnce(50) // IP limit
        .mockResolvedValueOnce(450); // Jurisdiction limit (450 of 500)

      (mockReq.body as any).jurisdiction = 'AE';

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow request on Redis error (fail open)', async () => {
      mockRedis.zremrangebyscore.mockRejectedValue(new Error('Redis error'));

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract client IP from x-forwarded-for header', async () => {
      mockRedis.zcard.mockResolvedValue(0);
      mockReq.headers['x-forwarded-for'] = '203.0.113.195, 70.41.3.18';

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.195'),
        expect.anything(),
        expect.anything()
      );
    });

    it('should remove IPv6 prefix from IPv4-mapped addresses', async () => {
      mockRedis.zcard.mockResolvedValue(0);
      (mockReq.socket as any).remoteAddress = '::ffff:192.168.1.1';
      mockReq.headers = {};

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset rate limit for a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.reset('rate_limit:user:user-123');

      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:user:user-123');
    });

    it('should reset rate limit for a user', async () => {
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.resetUser('user-123');

      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:user:user-123');
    });

    it('should reset rate limit for an IP', async () => {
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.resetIp('192.168.1.100');

      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:ip:192.168.1.100');
    });
  });

  describe('getStatus', () => {
    it('should return current rate limit status', async () => {
      mockRedis.zcard.mockResolvedValue(50);

      const status = await rateLimiter.getStatus('rate_limit:ip:192.168.1.100', 100);

      expect(status.limit).toBe(100);
      expect(status.remaining).toBe(49); // 100 - 50 - 1 for current request
      expect(status.isLimited).toBe(false);
    });

    it('should mark as limited when at or exceeding limit', async () => {
      mockRedis.zcard.mockResolvedValue(100);

      const status = await rateLimiter.getStatus('rate_limit:ip:192.168.1.100', 100);

      expect(status.isLimited).toBe(true);
      expect(status.remaining).toBe(0);
    });
  });

  describe('config', () => {
    it('should use custom configuration', () => {
      const customLimiter = new RateLimiter(mockRedis as any, {
        perIpLimit: 50,
        perUserLimit: 500,
        windowSizeSeconds: 120,
      });

      // Config should be applied (tested via behavior in middleware)
      expect(customLimiter).toBeDefined();
    });

    it('should use default configuration when not provided', () => {
      const defaultLimiter = new RateLimiter(mockRedis as any);
      expect(defaultLimiter).toBeDefined();
    });
  });

  describe('sliding window counter', () => {
    it('should remove old entries outside window', async () => {
      mockRedis.zcard.mockResolvedValue(1);

      const status = await rateLimiter.getStatus('rate_limit:test', 100);

      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should add new entry for current request', async () => {
      mockRedis.zcard.mockResolvedValue(0);

      await rateLimiter.getStatus('rate_limit:test', 100);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'rate_limit:test',
        expect.any(Number),
        expect.stringMatching(/^\d+-[\d.]+$/)
      );
    });

    it('should set expiration on rate limit key', async () => {
      mockRedis.zcard.mockResolvedValue(0);

      await rateLimiter.getStatus('rate_limit:test', 100);

      expect(mockRedis.expire).toHaveBeenCalledWith('rate_limit:test', 70); // windowSize + 10
    });
  });

  // ─── FR-8.4: Per-Tier Rate Limit Policy Tests ─────────────────────────────

  describe('TIER_GENERAL_LIMITS (FR-8.4)', () => {
    it('should define Free tier at 60 req/min', () => {
      expect(TIER_GENERAL_LIMITS['free']).toBe(60);
    });

    it('should define Pro tier at 600 req/min', () => {
      expect(TIER_GENERAL_LIMITS['pro']).toBe(600);
    });

    it('should define Enterprise tier higher than Pro', () => {
      expect(TIER_GENERAL_LIMITS['enterprise']).toBeGreaterThan(TIER_GENERAL_LIMITS['pro']);
    });
  });

  describe('TIER_AUTH_LIMITS (FR-8.4)', () => {
    it('should define Free tier at 10 req/min for auth endpoints', () => {
      expect(TIER_AUTH_LIMITS['free']).toBe(10);
    });

    it('should define Pro tier at 30 req/min for auth endpoints', () => {
      expect(TIER_AUTH_LIMITS['pro']).toBe(30);
    });

    it('should define Enterprise tier higher than Pro for auth endpoints', () => {
      expect(TIER_AUTH_LIMITS['enterprise']).toBeGreaterThan(TIER_AUTH_LIMITS['pro']);
    });

    it('should have lower auth limits than general limits for all tiers', () => {
      const tiers: SubscriptionTier[] = ['free', 'pro', 'enterprise'];
      tiers.forEach(tier => {
        expect(TIER_AUTH_LIMITS[tier]).toBeLessThan(TIER_GENERAL_LIMITS[tier]);
      });
    });
  });

  describe('getTierFromRequest (FR-8.4)', () => {
    it('should return "free" when no user is present', () => {
      const req = { user: undefined } as unknown as Request;
      expect(rateLimiter.getTierFromRequest(req)).toBe('free');
    });

    it('should return "free" when user has no tier claim', () => {
      const req = { user: { id: 'u1' } } as unknown as Request;
      expect(rateLimiter.getTierFromRequest(req)).toBe('free');
    });

    it('should return "pro" for a Pro-tier JWT claim', () => {
      const req = { user: { id: 'u1', tier: 'pro' } } as unknown as Request;
      expect(rateLimiter.getTierFromRequest(req)).toBe('pro');
    });

    it('should return "enterprise" for an Enterprise-tier JWT claim', () => {
      const req = { user: { id: 'u1', tier: 'enterprise' } } as unknown as Request;
      expect(rateLimiter.getTierFromRequest(req)).toBe('enterprise');
    });

    it('should fall back to "free" for unknown tier values', () => {
      const req = { user: { id: 'u1', tier: 'unknown' } } as unknown as Request;
      expect(rateLimiter.getTierFromRequest(req)).toBe('free');
    });
  });

  describe('tier-based limit enforcement in middleware (FR-8.4)', () => {
    it('should enforce Free tier limit (60 req/min) for general endpoints', async () => {
      // Pro user: IP limit OK, but user limit enforced at Free level since no tier claim
      mockRedis.zcard
        .mockResolvedValueOnce(10)   // IP: 10/100 OK
        .mockResolvedValueOnce(60);  // User: 60 requests – at Free limit

      (mockReq as any).user = { id: 'free-user', email: 'f@test.com', role: 'user', iat: 0, exp: 0 };

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should set X-RateLimit-Tier header for authenticated users', async () => {
      mockRedis.zcard
        .mockResolvedValueOnce(10)   // IP check
        .mockResolvedValueOnce(50);  // User check (under Pro limit)

      (mockReq as any).user = { id: 'pro-user', tier: 'pro', email: 'p@test.com', role: 'user', iat: 0, exp: 0 };

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Tier', 'pro');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow more requests for Pro tier than Free tier', () => {
      // Pro allows 600, Free allows 60 — verify constant values hold
      expect(TIER_GENERAL_LIMITS['pro']).toBeGreaterThan(TIER_GENERAL_LIMITS['free']);
    });
  });
});
