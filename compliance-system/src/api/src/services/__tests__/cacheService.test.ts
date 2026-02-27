/**
 * Cache Service Tests
 * Validates Redis caching with 24-hour TTL and cache-aside pattern
 */

import { Redis } from 'ioredis';
import { CacheService, CacheKeys, invalidateCacheForEntity } from '../cacheService';
import logger from '../../config/logger';

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  flushdb: jest.fn(),
  ttl: jest.fn(),
};

jest.mock('../../config/logger');

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockClear();
    mockRedis.setex.mockClear();
    cacheService = new CacheService(mockRedis as any);
  });

  describe('get', () => {
    it('should return cached value when cache hits', async () => {
      const cachedData = { status: 'APPROVED', riskScore: 15 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheService.get('kyc:individual:user-123');

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('kyc:individual:user-123');
    });

    it('should return null when cache misses', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('kyc:individual:nonexistent');

      expect(result).toBeNull();
    });

    it('should skip cache when forceRefresh is true', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));

      const result = await cacheService.get('kyc:individual:user-123', {
        forceRefresh: true,
      });

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return null on redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('kyc:individual:user-123');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in cache with default TTL', async () => {
      const data = { status: 'APPROVED' };
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set('kyc:individual:user-123', data);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'kyc:individual:user-123',
        86400, // 24 hours
        JSON.stringify(data)
      );
    });

    it('should set value with custom TTL', async () => {
      const data = { status: 'PENDING' };
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set('compliance:check-456', data, {
        ttlSeconds: 3600, // 1 hour
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'compliance:check-456',
        3600,
        JSON.stringify(data)
      );
    });

    it('should handle set errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        cacheService.set('kyc:individual:user-123', { data: 'test' })
      ).resolves.not.toThrow();

      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { status: 'APPROVED' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      const computeFn = jest.fn();

      const result = await cacheService.getOrSet(
        'kyc:individual:user-123',
        computeFn
      );

      expect(result).toEqual(cachedData);
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('should compute and cache value if cache misses', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const computedData = { status: 'APPROVED', computed: true };
      const computeFn = jest.fn().mockResolvedValue(computedData);

      const result = await cacheService.getOrSet(
        'kyc:individual:user-123',
        computeFn
      );

      expect(result).toEqual(computedData);
      expect(computeFn).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'kyc:individual:user-123',
        86400,
        JSON.stringify(computedData)
      );
    });

    it('should respect forceRefresh option', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));
      mockRedis.setex.mockResolvedValue('OK');

      const computedData = { status: 'FRESH' };
      const computeFn = jest.fn().mockResolvedValue(computedData);

      const result = await cacheService.getOrSet(
        'kyc:individual:user-123',
        computeFn,
        { forceRefresh: true }
      );

      expect(result).toEqual(computedData);
      expect(computeFn).toHaveBeenCalled();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('should delete matching keys', async () => {
      const keys = ['kyc:individual:user-123', 'kyc:individual:user-456'];
      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.del.mockResolvedValue(2);

      const deleted = await cacheService.invalidate('kyc:individual:user-*');

      expect(deleted).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('kyc:individual:user-*');
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle no matching keys', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const deleted = await cacheService.invalidate('kyc:nonexistent:*');

      expect(deleted).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle invalidation errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const deleted = await cacheService.invalidate('kyc:*');

      expect(deleted).toBe(0);
    });
  });

  describe('clear', () => {
    it('should flush all cache entries', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');

      await cacheService.clear();

      expect(mockRedis.flushdb).toHaveBeenCalled();
    });

    it('should clear metrics on flush', async () => {
      // First populate metrics
      mockRedis.get.mockResolvedValue(null);
      await cacheService.set('test:key', { data: 'test' });

      // Then flush
      mockRedis.flushdb.mockResolvedValue('OK');
      await cacheService.clear();

      const metrics = cacheService.getMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });
  });

  describe('getTTL', () => {
    it('should return remaining TTL for key', async () => {
      mockRedis.ttl.mockResolvedValue(3600);

      const ttl = await cacheService.getTTL('kyc:individual:user-123');

      expect(ttl).toBe(3600);
      expect(mockRedis.ttl).toHaveBeenCalledWith('kyc:individual:user-123');
    });

    it('should return -1 when key does not exist', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const ttl = await cacheService.getTTL('nonexistent:key');

      expect(ttl).toBe(-1);
    });

    it('should handle TTL check errors', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'));

      const ttl = await cacheService.getTTL('kyc:individual:user-123');

      expect(ttl).toBe(-2);
    });
  });

  describe('getMetrics', () => {
    it('should return cache hit rate metrics', async () => {
      // Simulate some hits and misses
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit1' })) // Hit
        .mockResolvedValueOnce(null) // Miss
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit2' })); // Hit

      await cacheService.get('test:key:1');
      await cacheService.get('test:key:2');
      await cacheService.get('test:key:1');

      const metrics = cacheService.getMetrics();

      expect(metrics['test:key:1'].hits).toBe(2);
      expect(metrics['test:key:2'].misses).toBe(1);
      expect(metrics['test:key:1'].hitRate).toBeGreaterThan(0);
    });
  });

  describe('CacheKeys', () => {
    it('should generate consistent KYC cache keys', () => {
      const key = CacheKeys.kyc('user-123', 'individual');
      expect(key).toBe('kyc:individual:user-123');
    });

    it('should generate consistent AML cache keys', () => {
      const key = CacheKeys.aml('0x1234567890abcdef');
      expect(key).toBe('aml:0x1234567890abcdef');
    });

    it('should generate consistent compliance cache keys', () => {
      const key = CacheKeys.compliance('check-456');
      expect(key).toBe('compliance:check-456');
    });
  });

  describe('invalidateCacheForEntity', () => {
    it('should invalidate all cache entries for entity', async () => {
      mockRedis.keys.mockResolvedValue(['kyc:individual:user-123']);
      mockRedis.del.mockResolvedValue(1);

      await invalidateCacheForEntity(cacheService, 'user-123', 'individual');

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
