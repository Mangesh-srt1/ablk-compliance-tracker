/**
 * Ethereum Provider Manager
 * Manages multiple RPC providers with health monitoring, fallback, and load balancing.
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ethereum-provider.log' }),
  ],
});

export interface RPCConfig {
  url: string;
  priority: number;
  weight?: number;
  timeout?: number;
}

export interface ProviderHealth {
  url: string;
  isHealthy: boolean;
  latency: number;
  lastChecked: Date;
  errorCount: number;
}

interface ManagedProvider {
  config: RPCConfig;
  provider: ethers.JsonRpcProvider;
  health: ProviderHealth;
}

export class EthereumProviderManager extends EventEmitter {
  private providers: ManagedProvider[] = [];
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly healthCheckIntervalMs: number;

  constructor(configs: RPCConfig[], healthCheckIntervalMs = 30000) {
    super();
    this.healthCheckIntervalMs = healthCheckIntervalMs;
    this.initializeProviders(configs);
  }

  private initializeProviders(configs: RPCConfig[]): void {
    const sorted = [...configs].sort((a, b) => a.priority - b.priority);
    for (const config of sorted) {
      const provider = new ethers.JsonRpcProvider(config.url, undefined, {
        staticNetwork: true,
      });
      this.providers.push({
        config,
        provider,
        health: {
          url: config.url,
          isHealthy: true,
          latency: 0,
          lastChecked: new Date(),
          errorCount: 0,
        },
      });
    }
    logger.info('Ethereum providers initialized', { count: this.providers.length });
    this.startHealthMonitoring();
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllProviders();
    }, this.healthCheckIntervalMs);
  }

  private async checkAllProviders(): Promise<void> {
    await Promise.allSettled(this.providers.map((mp) => this.checkProvider(mp)));
  }

  private async checkProvider(mp: ManagedProvider): Promise<void> {
    const start = Date.now();
    try {
      await mp.provider.getBlockNumber();
      const latency = Date.now() - start;
      const wasUnhealthy = !mp.health.isHealthy;
      mp.health.isHealthy = true;
      mp.health.latency = latency;
      mp.health.lastChecked = new Date();
      mp.health.errorCount = 0;
      if (wasUnhealthy) {
        logger.info('Provider recovered', { url: mp.config.url, latency });
        this.emit('providerRecovered', mp.health);
      }
    } catch (error) {
      mp.health.isHealthy = false;
      mp.health.lastChecked = new Date();
      mp.health.errorCount += 1;
      logger.warn('Provider health check failed', {
        url: mp.config.url,
        errorCount: mp.health.errorCount,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('providerUnhealthy', mp.health);
    }
  }

  /**
   * Get the best available provider (lowest priority, healthy).
   */
  getBestProvider(): ethers.JsonRpcProvider {
    if (this.providers.length === 0) {
      throw new Error('No providers configured');
    }
    const healthy = this.providers.filter((mp) => mp.health.isHealthy);
    if (healthy.length === 0) {
      logger.warn('No healthy providers available, returning first provider as fallback');
      return this.providers[0].provider;
    }
    return healthy[0].provider;
  }

  /**
   * Get a provider by URL.
   */
  getProvider(url?: string): ethers.JsonRpcProvider {
    if (!url) return this.getBestProvider();
    const mp = this.providers.find((p) => p.config.url === url);
    if (!mp) throw new Error(`Provider not found for URL: ${url}`);
    return mp.provider;
  }

  /**
   * Get health status of all providers.
   */
  getHealthStatus(): ProviderHealth[] {
    return this.providers.map((mp) => ({ ...mp.health }));
  }

  /**
   * Stop health monitoring and destroy all providers.
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    for (const mp of this.providers) {
      mp.provider.destroy();
    }
    logger.info('Provider manager stopped');
  }
}
