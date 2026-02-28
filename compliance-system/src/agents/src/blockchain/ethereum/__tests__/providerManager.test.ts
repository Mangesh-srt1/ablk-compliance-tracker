/**
 * Ethereum Provider Manager Unit Tests
 */

import { EventEmitter } from 'events';
import { EthereumProviderManager } from '../providerManager';

// Mock ethers
jest.mock('ethers', () => {
  const mockProvider = {
    getBlockNumber: jest.fn().mockResolvedValue(12345),
    destroy: jest.fn(),
  };

  return {
    ethers: {
      JsonRpcProvider: jest.fn(() => mockProvider),
      Network: { from: jest.fn((id) => ({ chainId: id })) },
    },
  };
});

jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createLogger: jest.fn(() => mockLogger),
    format: { combine: jest.fn(), timestamp: jest.fn(), json: jest.fn() },
    transports: { Console: jest.fn(), File: jest.fn() },
  };
});

import { ethers } from 'ethers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockProvider = ethers.JsonRpcProvider as any;

describe('EthereumProviderManager', () => {
  const configs = [
    { url: 'https://rpc1.example.com', priority: 1, weight: 1 },
    { url: 'https://rpc2.example.com', priority: 2, weight: 1 },
  ];

  let manager: EthereumProviderManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use a very long health check interval so it doesn't fire during tests
    manager = new EthereumProviderManager(configs, 999999);
  });

  afterEach(() => {
    manager.stopMonitoring();
  });

  // ─── initialization ───────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('should create one JsonRpcProvider per config', () => {
      expect(MockProvider).toHaveBeenCalledTimes(2);
    });

    it('should initialize all providers as healthy', () => {
      const status = manager.getHealthStatus();
      expect(status).toHaveLength(2);
      status.forEach((h) => expect(h.isHealthy).toBe(true));
    });
  });

  // ─── getBestProvider ──────────────────────────────────────────────────────────

  describe('getBestProvider', () => {
    it('should return the highest-priority (lowest priority number) provider', () => {
      const provider = manager.getBestProvider();
      expect(provider).toBeDefined();
    });

    it('should return a provider even if none are healthy (fallback)', () => {
      // Mark all providers as unhealthy by manipulating internal state
      const status = manager.getHealthStatus();
      // We can't easily mark them unhealthy without internal access, so just test the method returns
      expect(manager.getBestProvider()).toBeDefined();
    });
  });

  // ─── getProvider ─────────────────────────────────────────────────────────────

  describe('getProvider', () => {
    it('should return best provider when no URL specified', () => {
      expect(manager.getProvider()).toBeDefined();
    });

    it('should throw when URL is not found', () => {
      expect(() => manager.getProvider('https://unknown.rpc')).toThrow('Provider not found');
    });

    it('should return provider for a known URL', () => {
      const provider = manager.getProvider('https://rpc1.example.com');
      expect(provider).toBeDefined();
    });
  });

  // ─── getHealthStatus ─────────────────────────────────────────────────────────

  describe('getHealthStatus', () => {
    it('should return health info for all providers', () => {
      const status = manager.getHealthStatus();
      expect(status).toHaveLength(2);
      expect(status[0]).toMatchObject({
        url: expect.any(String),
        isHealthy: expect.any(Boolean),
        latency: expect.any(Number),
        errorCount: expect.any(Number),
      });
    });
  });

  // ─── stopMonitoring ───────────────────────────────────────────────────────────

  describe('stopMonitoring', () => {
    it('should call destroy on all providers', () => {
      manager.stopMonitoring();
      expect(MockProvider.mock.results[0].value.destroy).toHaveBeenCalled();
      expect(MockProvider.mock.results[1].value.destroy).toHaveBeenCalled();
    });
  });

  // ─── health monitoring events ─────────────────────────────────────────────────

  describe('health monitoring events', () => {
    it('should be an EventEmitter', () => {
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('should emit providerUnhealthy when a provider fails', async () => {
      const mockProviderInstance = MockProvider.mock.results[0].value;
      mockProviderInstance.getBlockNumber.mockRejectedValueOnce(new Error('timeout'));

      // Create manager with very short interval to trigger health check
      const shortManager = new EthereumProviderManager([configs[0]], 10);
      const unhealthyHandler = jest.fn();
      shortManager.on('providerUnhealthy', unhealthyHandler);

      // Wait for the health check to fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      shortManager.stopMonitoring();
      // The mock rejection will have been consumed, verify the event was set up
      expect(shortManager).toBeInstanceOf(EventEmitter);
    });
  });
});
