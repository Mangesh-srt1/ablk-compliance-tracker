/**
 * Redis Configuration
 * Redis connection setup for caching and sessions
 */

import { createClient, RedisClientType } from 'redis';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/redis.log' }),
  ],
});

let redisClient: RedisClientType;

/**
 * Configure Redis connection
 */
export async function configureRedis(): Promise<void> {
  try {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    const redisDb = parseInt(process.env.REDIS_DB || '0', 10);
    const redisKeyPrefix = process.env.REDIS_KEY_PREFIX || 'compliance:';

    logger.info('Configuring Redis client', {
      host: redisHost,
      port: redisPort,
      db: redisDb,
    });

    // Create Redis client with proper v4+ API
    redisClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Max retries exceeded');
          }
          return retries * 100; // Exponential backoff
        },
      } as any,
      password: redisPassword,
      // Database selection (redis client v4+ doesn't have direct db parameter)
      // db is handled after connection for redis-client v4+
      legacyMode: false,
    });

    // Set up event handlers
    redisClient.on('error', (err) => {
      logger.error('Redis client error', {
        error: err.message,
        code: err.code,
      });
    });

    redisClient.on('connect', () => {
      logger.debug('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready', {
        host: redisHost,
        port: redisPort,
        db: redisDb,
      });
    });

    redisClient.on('end', () => {
      logger.info('Redis client connection ended');
    });

    // Connect to Redis
    await redisClient.connect();

    // Select database (if not default 0)
    if (redisDb && redisDb !== 0) {
      try {
        await (redisClient as any).select(redisDb);
        logger.info('Redis database selected', { db: redisDb });
      } catch (err) {
        logger.warn('Failed to select Redis database', {
          error: err instanceof Error ? err.message : String(err),
          db: redisDb,
        });
      }
    }

    logger.info('Redis configuration completed successfully');
  } catch (error) {
    logger.error('Failed to configure Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not configured. Call configureRedis() first.');
  }
  return redisClient;
}

/**
 * Set a key-value pair with optional TTL
 */
export async function setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
  try {
    const serializedValue = JSON.stringify(value);
    const fullKey = `${process.env.REDIS_KEY_PREFIX || 'compliance:'}${key}`;

    if (ttlSeconds) {
      await redisClient.setEx(fullKey, ttlSeconds, serializedValue);
    } else {
      await redisClient.set(fullKey, serializedValue);
    }

    logger.debug('Cache set', { key: fullKey, ttl: ttlSeconds });
  } catch (error) {
    logger.error('Failed to set cache', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get a value from cache
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const fullKey = `${process.env.REDIS_KEY_PREFIX || 'compliance:'}${key}`;
    const value = await redisClient.get(fullKey);

    if (!value) {
      return null;
    }

    const parsedValue = JSON.parse(value);
    logger.debug('Cache hit', { key: fullKey });

    return parsedValue;
  } catch (error) {
    logger.error('Failed to get cache', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Delete a key from cache
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    const fullKey = `${process.env.REDIS_KEY_PREFIX || 'compliance:'}${key}`;
    const result = await redisClient.del(fullKey);

    logger.debug('Cache deleted', { key: fullKey, deleted: result > 0 });

    return result > 0;
  } catch (error) {
    logger.error('Failed to delete cache', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Check if key exists in cache
 */
export async function existsCache(key: string): Promise<boolean> {
  try {
    const fullKey = `${process.env.REDIS_KEY_PREFIX || 'compliance:'}${key}`;
    const result = await redisClient.exists(fullKey);

    return result > 0;
  } catch (error) {
    logger.error('Failed to check cache existence', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Set multiple key-value pairs
 */
export async function setMultipleCache(
  keyValuePairs: Record<string, any>,
  ttlSeconds?: number
): Promise<void> {
  try {
    const pipeline = redisClient.multi();

    Object.entries(keyValuePairs).forEach(([key, value]) => {
      const fullKey = `${process.env.REDIS_KEY_PREFIX || 'compliance:'}${key}`;
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        pipeline.setEx(fullKey, ttlSeconds, serializedValue);
      } else {
        pipeline.set(fullKey, serializedValue);
      }
    });

    await pipeline.exec();

    logger.debug('Multiple cache entries set', {
      count: Object.keys(keyValuePairs).length,
      ttl: ttlSeconds,
    });
  } catch (error) {
    logger.error('Failed to set multiple cache entries', {
      count: Object.keys(keyValuePairs).length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get multiple values from cache
 */
export async function getMultipleCache<T = any>(keys: string[]): Promise<(T | null)[]> {
  try {
    const fullKeys = keys.map((key) => `${process.env.REDIS_KEY_PREFIX || 'compliance:'}${key}`);

    const values = await redisClient.mGet(fullKeys);

    const parsedValues = values.map((value) => (value ? JSON.parse(value) : null));

    logger.debug('Multiple cache entries retrieved', {
      requested: keys.length,
      found: parsedValues.filter((v) => v !== null).length,
    });

    return parsedValues;
  } catch (error) {
    logger.error('Failed to get multiple cache entries', {
      count: keys.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clear all cache entries with the configured prefix
 */
export async function clearCache(): Promise<void> {
  try {
    const pattern = `${process.env.REDIS_KEY_PREFIX || 'compliance:'}*`;
    const keys = await redisClient.keys(pattern);

    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info('Cache cleared', { deletedKeys: keys.length });
    } else {
      logger.debug('No cache keys to clear');
    }
  } catch (error) {
    logger.error('Failed to clear cache', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalKeys: number;
  memoryUsage?: number;
  connectedClients?: number;
}> {
  try {
    const pattern = `${process.env.REDIS_KEY_PREFIX || 'compliance:'}*`;
    const keys = await redisClient.keys(pattern);

    const info = await redisClient.info('memory');
    const clients = await redisClient.info('clients');

    return {
      totalKeys: keys.length,
      memoryUsage: parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0'),
      connectedClients: parseInt(clients.match(/connected_clients:(\d+)/)?.[1] || '0'),
    };
  } catch (error) {
    logger.error('Failed to get cache stats', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      totalKeys: 0,
    };
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  message?: string;
}> {
  try {
    const startTime = Date.now();
    await redisClient.ping();
    const latency = Date.now() - startTime;

    return {
      healthy: true,
      latency,
      message: 'Redis connection healthy',
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Redis health check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}
