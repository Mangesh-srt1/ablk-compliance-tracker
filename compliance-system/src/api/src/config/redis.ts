/**
 * Redis Configuration
 * Connection and client setup for Redis
 */

import Redis from 'ioredis';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/redis.log' }),
  ],
});

let redisClient: Redis | null = null;

/**
 * Configure and create Redis client
 */
export function configureRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisConfig = {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '0'),
    password: process.env.REDIS_PASSWORD || undefined,
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '1000'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    lazyConnect: true,
    keepAlive: parseInt(process.env.REDIS_TIMEOUT || '5000'),
    enableReadyCheck: false,
  };

  redisClient = new Redis(redisConfig);

  // Event handlers
  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('error', (error: Error) => {
    logger.error('Redis client error', { error: error.message });
  });

  redisClient.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    return configureRedis();
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

export default getRedisClient;
