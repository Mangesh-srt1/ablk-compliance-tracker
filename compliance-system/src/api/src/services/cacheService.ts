/**
 * Cache Service - Redis Integration
 * Implements decision caching with 24-hour TTL
 * Provides cache hit/miss/expiry tracking for compliance decisions
 * 
 * Cache Keys:
 * - kyc:{entityId} → KYC check result (24h TTL)
 * - aml:{walletAddress} → AML risk score (24h TTL)
 * - compliance:{checkId} → Aggregated compliance decision (24h TTL)
 */

import { Redis } from 'ioredis';
import { Logger } from 'winston';
import logger from '../config/logger';

export interface CacheOptions {
  ttlSeconds?: number; // Default 86400 (24 hours)
  forceRefresh?: boolean; // Skip cache and always compute fresh
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number; // hits / (hits + misses)
  lastUpdate: Date;
}

export class CacheService {
  private redis: Redis;
  private metrics: Map<string, CacheMetrics> = new Map();
  private readonly DEFAULT_TTL = 86400; // 24 hours in seconds

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Get a value from cache
   * @returns Cached value or null if not found or expired
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (options.forceRefresh) {
      logger.debug(`[CACHE] Force refresh for key: ${key}`);
      return null;
    }

    try {
      const cached = await this.redis.get(key);
      
      if (cached === null) {
        this.recordMiss(key);
        logger.debug(`[CACHE] MISS: ${key}`);
        return null;
      }

      this.recordHit(key);
      logger.debug(`[CACHE] HIT: ${key}`);
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.warn(`[CACHE] Get failed for ${key}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttlSeconds || this.DEFAULT_TTL;

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
      logger.debug(`[CACHE] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.warn(`[CACHE] Set failed for ${key}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get or set pattern (cache-aside)
   * If cache hit, return cached value
   * If cache miss, compute value, cache it, and return
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - compute new value
    logger.info(`[CACHE] Computing fresh value for key: ${key}`);
    const freshValue = await computeFn();

    // Store in cache
    await this.set(key, freshValue, options);

    return freshValue;
  }

  /**
   * Invalidate cache entries by pattern
   * @example
   * await cache.invalidate('kyc:user-123-*'); // Invalidate all KYC checks for user-123
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        logger.debug(`[CACHE] No keys found to invalidate: ${pattern}`);
        return 0;
      }

      const deletedCount = await this.redis.del(...keys);
      logger.info(`[CACHE] Invalidated ${deletedCount} keys matching ${pattern}`);
      return deletedCount;
    } catch (error) {
      logger.warn(`[CACHE] Invalidation failed for pattern ${pattern}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Clear entire cache (use cautiously)
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
      logger.warn('[CACHE] Cache cleared');
      this.metrics.clear();
    } catch (error) {
      logger.error('[CACHE] Clear failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cache statistics
   */
  getMetrics(): Record<string, CacheMetrics> {
    const result: Record<string, CacheMetrics> = {};
    this.metrics.forEach((value, key) => {
      result[key] = { ...value };
    });
    return result;
  }

  /**
   * Get cache TTL for a key
   * @returns remaining TTL in seconds, or -1 if key doesn't exist, -2 if no expiry set
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logger.warn(`[CACHE] TTL check failed for ${key}`);
      return -2;
    }
  }

  /**
   * Record cache hit for metrics
   */
  private recordHit(key: string): void {
    const metrics = this.getOrCreateMetrics(key);
    metrics.hits++;
    metrics.hitRate = metrics.hits / (metrics.hits + metrics.misses);
    metrics.lastUpdate = new Date();
  }

  /**
   * Record cache miss for metrics
   */
  private recordMiss(key: string): void {
    const metrics = this.getOrCreateMetrics(key);
    metrics.misses++;
    metrics.hitRate = metrics.hits / (metrics.hits + metrics.misses);
    metrics.lastUpdate = new Date();
  }

  /**
   * Get or create metrics record for a key
   */
  private getOrCreateMetrics(key: string): CacheMetrics {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        hits: 0,
        misses: 0,
        hitRate: 0,
        lastUpdate: new Date(),
      });
    }
    return this.metrics.get(key)!;
  }
}

/**
 * Cache key builders (consistent key naming)
 */
export const CacheKeys = {
  kyc: (entityId: string, entityType: string) => `kyc:${entityType}:${entityId}`,
  aml: (walletAddress: string) => `aml:${walletAddress}`,
  compliance: (checkId: string) => `compliance:${checkId}`,
  sanctions: (entityId: string) => `sanctions:${entityId}`,
  pep: (name: string) => `pep:${name.toLowerCase()}`,
  jurisdiction: (code: string) => `jurisdiction:${code}`,
};

/**
 * Default cache invalidation strategy
 * Call when entity data is updated to maintain cache freshness
 */
export async function invalidateCacheForEntity(
  cache: CacheService,
  entityId: string,
  entityType: string
): Promise<void> {
  const patterns = [
    CacheKeys.kyc(entityId, entityType),
    `kyc:${entityType}:${entityId}:*`,
    `compliance:*:${entityId}*`,
  ];

  for (const pattern of patterns) {
    await cache.invalidate(pattern);
  }

  logger.info(`[CACHE] Invalidated cache for ${entityType} ${entityId}`);
}
