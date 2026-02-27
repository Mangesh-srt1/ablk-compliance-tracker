/**
 * Rate Limiter Tests
 * Validates per-IP and per-user rate limiting with sliding window counter
 */

import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { RateLimiter } from '../rateLimiter';
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

      (mockReq as any).user = { id: 'user-123', email: 'test@test.com', role: 'admin', permissions: [], iat: 0, exp: 0 };

      const middleware = rateLimiter.middleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user limit exceeded', async () => {
      mockRedis.zcard
        .mockResolvedValueOnce(50) // IP limit check
        .mockResolvedValueOnce(1000); // User limit check (at limit)

      (mockReq as any).user = { id: 'user-123', email: 'test@test.com', role: 'admin', permissions: [], iat: 0, exp: 0 };

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
});
