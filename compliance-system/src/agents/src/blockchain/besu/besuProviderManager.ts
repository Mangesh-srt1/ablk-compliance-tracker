/**
 * Hyperledger Besu Provider Manager
 * Manages connection to a permissioned Besu network with privacy group support.
 * Client must provide RPC endpoints — Ableka Lumina does NOT provision blockchain infrastructure.
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/besu-provider.log' }),
  ],
});

export interface BesuConfig {
  rpcUrl: string;
  privacyUrl?: string;
  privateKey?: string;
  privacyGroupId?: string;
  networkId?: number;
  timeout?: number;
}

export interface BesuPrivacyGroup {
  privacyGroupId: string;
  name: string;
  members: string[];
  type: 'PANTHEON' | 'ONCHAIN';
}

export class BesuProviderManager extends EventEmitter {
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private readonly config: BesuConfig;

  constructor(config: BesuConfig) {
    super();
    this.config = config;
  }

  /**
   * Get (or lazily initialize) the public JSON-RPC provider.
   */
  getPublicProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      logger.info('Initializing Besu provider', { rpcUrl: this.config.rpcUrl });
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl, undefined, {
        staticNetwork: this.config.networkId
          ? ethers.Network.from(this.config.networkId)
          : undefined,
      });

      if (this.config.privateKey) {
        this.signer = new ethers.Wallet(this.config.privateKey, this.provider);
        logger.info('Besu signer initialized');
      }
    }
    return this.provider;
  }

  /**
   * Get the signer (requires privateKey in config).
   */
  getSigner(): ethers.Wallet {
    if (!this.signer) {
      this.getPublicProvider(); // initializes signer if privateKey present
    }
    if (!this.signer) {
      throw new Error('No private key configured for Besu signer');
    }
    return this.signer;
  }

  /**
   * Internal helper: call a Besu privacy RPC method with timeout support.
   */
  private async fetchPrivacyRPC(method: string, params: unknown[]): Promise<unknown> {
    if (!this.config.privacyUrl) {
      throw new Error('privacyUrl is required to call privacy RPC');
    }

    const timeoutMs = this.config.timeout ?? 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.config.privacyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Besu privacy RPC returned HTTP ${response.status}`);
      }

      const json = (await response.json()) as { result?: unknown; error?: { message: string } };
      if (json.error) {
        throw new Error(`Besu privacy RPC error: ${json.error.message}`);
      }

      return json.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Create a new privacy group via the Besu privacy RPC endpoint.
   * Requires privacyUrl to be configured.
   */
  async createPrivacyGroup(members: string[], name: string): Promise<BesuPrivacyGroup> {
    if (!this.config.privacyUrl) {
      throw new Error('privacyUrl is required to create privacy groups');
    }

    logger.info('Creating Besu privacy group', { name, memberCount: members.length });

    try {
      const privacyGroupId = (await this.fetchPrivacyRPC('eea_createPrivacyGroup', [
        { addresses: members, name, type: 'PANTHEON' },
      ])) as string;

      logger.info('Privacy group created', { privacyGroupId, name });
      const group: BesuPrivacyGroup = { privacyGroupId, name, members, type: 'PANTHEON' };
      this.emit('privacyGroupCreated', group);
      return group;
    } catch (error) {
      logger.error('Failed to create privacy group', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Find privacy groups for a given set of member addresses.
   */
  async findPrivacyGroup(members: string[]): Promise<BesuPrivacyGroup[]> {
    if (!this.config.privacyUrl) {
      throw new Error('privacyUrl is required to find privacy groups');
    }

    logger.info('Finding Besu privacy groups', { memberCount: members.length });

    try {
      const result = (await this.fetchPrivacyRPC('eea_findPrivacyGroup', [members])) as Array<{
        privacyGroupId: string;
        name: string;
        members: string[];
        type: string;
      }>;

      return (result ?? []).map((g) => ({
        privacyGroupId: g.privacyGroupId,
        name: g.name,
        members: g.members,
        type: g.type as 'PANTHEON' | 'ONCHAIN',
      }));
    } catch (error) {
      logger.error('Failed to find privacy groups', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Disconnect and clean up.
   */
  disconnect(): void {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
      this.signer = null;
      logger.info('Besu provider disconnected');
    }
  }
}
