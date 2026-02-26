/**
 * Oracle Verified Ownership Guard - Implementation Service
 * Real-time verification of off-chain asset ownership against public registries
 * Integrates Chainlink Proof of Reserve + custom land registry oracles
 *
 * File: src/agents/src/services/oracleOwnershipGuard.ts
 */

import { ethers, Contract, Provider } from 'ethers';
import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { EventEmitter } from 'events';

/**
 * Oracle Verification Result Structure
 */
export interface OwnershipVerification {
  assetId: string;
  isOwned: boolean;
  ownershipStatus: 'valid' | 'transferred' | 'disputed' | 'not_found';
  lastVerified: Date;
  riskFlags: string[];
  oracleScore: number; // 0-1, higher = more confident in ownership
  recommendedAction: 'none' | 'pause_trading' | 'burn_tokens' | 'escalate';
  verificationDetails: {
    landRegistryCheck: boolean;
    proofOfReserveCheck: boolean;
    spvControlCheck: boolean;
    anomalyCheck: boolean;
  };
}

interface OracleConfig {
  besuRpcUrl: string;
  chainlinkOracleAddresses?: Map<string, string>; // assetId -> contract address
  landRegistryConfigs?: Map<string, LandRegistryConfig>;
  pollingIntervalSeconds?: number;
}

interface LandRegistryConfig {
  apiEndpoint: string;
  apiKey: string;
  jurisdiction: string;
}

/**
 * OracleVerifiedOwnershipGuard
 * Orchestrates multi-source verification to detect double-dipping fraud
 */
export class OracleVerifiedOwnershipGuard extends EventEmitter {
  private logger: winston.Logger;
  private besuProvider: Provider;
  private httpClient: AxiosInstance;
  private chainlinkOracleAddresses: Map<string, string>;
  private landRegistryConfigs: Map<string, LandRegistryConfig>;
  private pollingIntervalSeconds: number;
  private activePolls: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: OracleConfig,
    private dbClient: any // PostgreSQL client (pool)
  ) {
    super();

    this.besuProvider = new ethers.JsonRpcProvider(config.besuRpcUrl);
    this.chainlinkOracleAddresses = config.chainlinkOracleAddresses || new Map();
    this.landRegistryConfigs = config.landRegistryConfigs || new Map();
    this.pollingIntervalSeconds = config.pollingIntervalSeconds || 3600; // Default: hourly

    this.httpClient = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'OracleOwnershipGuard/1.0',
        'X-API-Version': '1.0',
      },
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'oracle-ownership-guard' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/oracle-ownership-guard-error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/oracle-ownership-guard.log',
        }),
      ],
    });

    this.logger.info('OracleVerifiedOwnershipGuard initialized', {
      besuRpcUrl: config.besuRpcUrl,
      chainlinkOraclesCount: this.chainlinkOracleAddresses.size,
      landRegistriesCount: this.landRegistryConfigs.size,
    });
  }

  /**
   * Main entry point: Real-time verification of asset ownership
   * Returns comprehensive ownership status and recommended action
   */
  async verifyOwnership(assetId: string, spvAddress: string): Promise<OwnershipVerification> {
    const startTime = Date.now();
    const riskFlags: string[] = [];
    let oracleScore = 1.0; // Start with full confidence
    const verificationDetails = {
      landRegistryCheck: false,
      proofOfReserveCheck: false,
      spvControlCheck: false,
      anomalyCheck: false,
    };

    try {
      this.logger.info('Starting ownership verification', {
        assetId,
        spvAddress,
      });

      // Retrieve asset metadata from database
      const assetResult = await this.dbClient.query('SELECT * FROM rwa_assets WHERE id = $1', [
        assetId,
      ]);

      if (!assetResult.rows.length) {
        this.logger.warn('Asset not found in registry', { assetId });
        return {
          assetId,
          isOwned: false,
          ownershipStatus: 'not_found',
          lastVerified: new Date(),
          riskFlags: ['Asset not registered in compliance system'],
          oracleScore: 0,
          recommendedAction: 'escalate',
          verificationDetails,
        };
      }

      const assetData = assetResult.rows[0];

      // 1. Check Land Registry (Jurisdiction-Specific)
      try {
        const registryResult = await this.checkLandRegistry(assetData);
        verificationDetails.landRegistryCheck = true;

        if (!registryResult.isOwned) {
          riskFlags.push(
            `Land registry ownership mismatch: ${registryResult.details?.registryOwner || 'Unknown'} does not match SPV ${assetData.spv_legal_entity_id}`
          );
          oracleScore -= 0.5;
        } else if (registryResult.details?.lastModified) {
          const lastModified = new Date(registryResult.details.lastModified);
          const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceModified < 7) {
            riskFlags.push(
              `Land registry recently modified (${daysSinceModified.toFixed(1)} days ago)`
            );
            oracleScore -= 0.2; // Minor deduction for recent changes
          }
        }
      } catch (error) {
        this.logger.error('Land registry check failed', { assetId, error });
        riskFlags.push('Land registry verification unavailable');
        oracleScore -= 0.1; // Slight deduction for unavailability
      }

      // 2. Check Chainlink Proof of Reserve
      try {
        const porResult = await this.checkProofOfReserve(spvAddress, assetData);
        verificationDetails.proofOfReserveCheck = true;

        if (!porResult.isVerified) {
          riskFlags.push(
            'Proof of Reserve verification failed: token supply exceeds documented reserves'
          );
          oracleScore -= 0.3;
        }
      } catch (error) {
        this.logger.error('Proof of Reserve check failed', { assetId, error });
        // POR failure doesn't immediately indicate fraud, but should be flagged
        riskFlags.push('Proof of Reserve verification unavailable');
      }

      // 3. Check SPV On-Chain Status & Control Transfer
      try {
        const spvStatus = await this.verifySPVControlTransfer(spvAddress, assetData);
        verificationDetails.spvControlCheck = true;

        if (!spvStatus.hasControl) {
          riskFlags.push('SPV control verification failed: possible unauthorized transfer');
          oracleScore -= 0.4;
        } else if (spvStatus.recentTransfer) {
          riskFlags.push('Recent SPV control transfer detected: verify transfer authorization');
          oracleScore -= 0.15;
        }
      } catch (error) {
        this.logger.error('SPV control verification failed', { assetId, error });
        riskFlags.push('SPV control verification unavailable');
      }

      // 4. Check for Trading Anomalies (Volume spikes, unusual liquidity)
      try {
        const anomalies = await this.checkTransactionAnomalies(assetData);
        verificationDetails.anomalyCheck = true;

        if (anomalies.detected) {
          riskFlags.push(...anomalies.flags);
          oracleScore -= 0.2;
        }
      } catch (error) {
        this.logger.error('Anomaly detection failed', { assetId, error });
      }

      // 5. Determine Ownership Status
      const ownershipStatus =
        oracleScore >= 0.7 ? 'valid' : oracleScore >= 0.3 ? 'disputed' : 'transferred';

      const recommendedAction = this.recommendAction(oracleScore, assetData);

      const verificationResult: OwnershipVerification = {
        assetId,
        isOwned: oracleScore >= 0.7,
        ownershipStatus,
        lastVerified: new Date(),
        riskFlags,
        oracleScore: Math.max(0, Math.min(1, oracleScore)), // Clamp 0-1
        recommendedAction,
        verificationDetails,
      };

      // 6. Store verification result in audit trail
      await this.storeVerificationResult(verificationResult, assetData);

      // 7. Emit event if action required
      if (recommendedAction !== 'none') {
        this.emit('ownershipVerificationAlert', {
          assetId,
          action: recommendedAction,
          riskScore: verificationResult.oracleScore,
          flags: riskFlags,
        });
      }

      const elapsedMs = Date.now() - startTime;
      this.logger.info('Ownership verification completed', {
        assetId,
        status: ownershipStatus,
        oracleScore: verificationResult.oracleScore,
        elapsedMs,
        flagCount: riskFlags.length,
      });

      return verificationResult;
    } catch (error) {
      this.logger.error('Ownership verification failed with exception', { assetId, error });
      return {
        assetId,
        isOwned: false,
        ownershipStatus: 'disputed',
        lastVerified: new Date(),
        riskFlags: ['Verification service error: please escalate manually'],
        oracleScore: 0.5,
        recommendedAction: 'escalate',
        verificationDetails,
      };
    }
  }

  /**
   * Start continuous polling for an asset
   * Periodically verifies ownership and triggers alerts on changes
   */
  startContinuousPolling(assetId: string, spvAddress: string): void {
    if (this.activePolls.has(assetId)) {
      this.logger.warn('Polling already active for asset', { assetId });
      return;
    }

    this.logger.info('Starting continuous ownership polling', {
      assetId,
      interval: this.pollingIntervalSeconds,
    });

    const pollTask = async () => {
      try {
        await this.verifyOwnership(assetId, spvAddress);
      } catch (error) {
        this.logger.error('Polling verification failed', { assetId, error });
      }
    };

    // Execute immediately, then on interval
    pollTask();
    const intervalId = setInterval(pollTask, this.pollingIntervalSeconds * 1000);
    this.activePolls.set(assetId, intervalId);

    this.emit('pollingStarted', { assetId });
  }

  /**
   * Stop polling for an asset
   */
  stopContinuousPolling(assetId: string): void {
    const intervalId = this.activePolls.get(assetId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activePolls.delete(assetId);
      this.logger.info('Stopped continuous polling', { assetId });
      this.emit('pollingStopped', { assetId });
    }
  }

  /**
   * Check Land Registry for off-chain ownership changes
   * Supports India, EU, and US registries
   */
  private async checkLandRegistry(
    assetData: any
  ): Promise<{ isOwned: boolean; details?: Record<string, any> }> {
    const jurisdiction = assetData.jurisdiction;
    const registryConfig = this.landRegistryConfigs.get(jurisdiction);

    if (!registryConfig) {
      this.logger.warn('No land registry configured for jurisdiction', {
        jurisdiction,
        assetId: assetData.id,
      });
      return { isOwned: true }; // Default to trusting if not configured
    }

    try {
      const url = `${registryConfig.apiEndpoint}/${assetData.registry_reference}`;

      const response = await this.httpClient.get(url, {
        headers: {
          Authorization: `Bearer ${registryConfig.apiKey}`,
        },
      });

      const registryData = response.data;

      // Verify current legal owner matches SPV entity
      const ownerMatches =
        registryData.current_owner_name === assetData.spv_legal_entity_id ||
        registryData.current_owner_id === assetData.spv_legal_entity_id;

      if (!ownerMatches) {
        this.logger.warn('Land registry ownership mismatch', {
          assetId: assetData.id,
          registryOwner: registryData.current_owner_name,
          spvEntity: assetData.spv_legal_entity_id,
          jurisdiction,
        });
      }

      return {
        isOwned: ownerMatches,
        details: {
          registryOwner: registryData.current_owner_name,
          lastModified: registryData.last_modified_date,
          registryStatus: registryData.status,
          jurisdiction,
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error('Land registry API error', {
          jurisdiction,
          statusCode: error.response?.status,
          message: error.message,
        });
      }
      throw error;
    }
  }

  /**
   * Verify Chainlink Proof of Reserve
   * Ensures token supply is backed by reserves
   */
  private async checkProofOfReserve(
    spvAddress: string,
    assetData: any
  ): Promise<{ isVerified: boolean; reserves?: number; supply?: number }> {
    try {
      const chainlinkAddress = this.chainlinkOracleAddresses.get(assetData.id);
      if (!chainlinkAddress) {
        this.logger.debug('No Chainlink oracle configured for asset', { assetId: assetData.id });
        return { isVerified: true }; // Skip if not configured
      }

      // ABI for Chainlink Proof of Reserve feed
      const abi = [
        'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
      ];

      const oracle = new Contract(chainlinkAddress, abi, this.besuProvider);

      try {
        const latestRound = await oracle.latestRoundData();
        const reserveAmount = BigInt(latestRound.answer);

        // Get token supply from ERC-1400 contract
        const tokenSupply = await this.getERC1400TokenSupply(assetData.spv_contract_address);

        // Check if reserves >= token supply
        const isFullyReserved = reserveAmount >= BigInt(tokenSupply);

        if (!isFullyReserved) {
          this.logger.warn('Proof of Reserve check failed', {
            assetId: assetData.id,
            reserves: reserveAmount.toString(),
            supply: tokenSupply.toString(),
            coverageRatio: (Number(reserveAmount) / tokenSupply).toFixed(2),
          });
        }

        return {
          isVerified: isFullyReserved,
          reserves: Number(reserveAmount),
          supply: tokenSupply,
        };
      } catch (error) {
        this.logger.error('Chainlink latestRoundData call failed', { error });
        throw error;
      }
    } catch (error) {
      this.logger.error('Proof of Reserve check failed', { error });
      return { isVerified: false };
    }
  }

  /**
   * Verify SPV retains control over tokenized asset
   * Detects unauthorized control transfers
   */
  private async verifySPVControlTransfer(
    spvAddress: string,
    assetData: any
  ): Promise<{ hasControl: boolean; recentTransfer?: boolean }> {
    try {
      // Check if SPV contract still exists and hasn't been destroyed
      const code = await this.besuProvider.getCode(spvAddress);
      if (code === '0x') {
        this.logger.error('SPV contract not found or destroyed', { spvAddress });
        return { hasControl: false };
      }

      // ABI for asset control verification
      const abi = [
        'function assetOwner() external view returns (address)',
        'function assetControlStatus() external view returns (bool)',
        'function lastControlTransfer() external view returns (uint256)',
      ];

      const spvContract = new Contract(spvAddress, abi, this.besuProvider);

      try {
        const hasControl = await spvContract.assetControlStatus();
        const lastTransferBlock = await spvContract.lastControlTransfer();

        // Check if control transfer occurred recently (within last 7 days ~50400 blocks at 12s/block)
        const currentBlock = await this.besuProvider.getBlockNumber();
        const blocksSinceTransfer = currentBlock - lastTransferBlock;
        const daysSinceTransfer = (blocksSinceTransfer * 12) / (60 * 60 * 24); // 12s block time
        const recentTransfer = daysSinceTransfer < 7;

        if (recentTransfer) {
          this.logger.warn('Recent SPV control transfer detected', {
            assetId: assetData.id,
            daysSinceTransfer: daysSinceTransfer.toFixed(2),
            blockNumber: lastTransferBlock,
          });
        }

        return { hasControl, recentTransfer };
      } catch (error) {
        this.logger.error('SPV contract method call failed', { spvAddress, error });
        return { hasControl: true }; // Default to trusting if call fails
      }
    } catch (error) {
      this.logger.error('SPV control verification failed', { error });
      return { hasControl: true }; // Default to trusting if unable to verify
    }
  }

  /**
   * Check for trading anomalies: volume spikes, unusual liquidity events
   * Indicates possible double-dipping fraud or asset sale
   */
  private async checkTransactionAnomalies(assetData: any): Promise<{
    detected: boolean;
    flags: string[];
  }> {
    try {
      // Get trading activity in last 24 hours
      const txResult = await this.dbClient.query(
        `SELECT 
          COUNT(*) as tx_count,
          SUM(token_amount) as total_volume,
          AVG(encoded_offer_price) as avg_price,
          MAX(token_amount) as max_single_tx
        FROM p2p_transfers 
        WHERE asset_id = $1 
          AND transfer_status = 'completed'
          AND created_at > NOW() - INTERVAL '1 day'`,
        [assetData.id]
      );

      const txData = txResult.rows[0] || {
        tx_count: 0,
        total_volume: 0,
        avg_price: 0,
        max_single_tx: 0,
      };

      const flags: string[] = [];

      // 1. Unusual transaction count spike (>100 txs in 24h)
      if (txData.tx_count > 100) {
        flags.push(`Transaction volume spike: ${txData.tx_count} transfers in 24 hours`);
      }

      // 2. Total volume spike (5x normal)
      const avgHistoricalVolume = await this.getHistoricalAverageVolume(assetData.id, 30);
      if (avgHistoricalVolume > 0 && txData.total_volume > avgHistoricalVolume * 5) {
        flags.push(
          `Total trading volume spike: ${txData.total_volume} vs ${avgHistoricalVolume} 30-day avg`
        );
      }

      // 3. Price anomaly: >30% deviation from historical
      const avgHistoricalPrice = await this.getHistoricalAveragePrice(assetData.id, 30);
      if (avgHistoricalPrice > 0 && txData.avg_price < avgHistoricalPrice * 0.7) {
        const priceDropPercent = ((1 - txData.avg_price / avgHistoricalPrice) * 100).toFixed(1);
        flags.push(`Price drop ${priceDropPercent}% below 30-day average`);
      }

      // 4. Large single transaction (selling large portion)
      const totalSupply = await this.getERC1400TokenSupply(assetData.spv_contract_address);
      const singleTxPercent = (txData.max_single_tx / totalSupply) * 100;
      if (singleTxPercent > 10) {
        flags.push(`Large single transaction: ${singleTxPercent.toFixed(1)}% of supply`);
      }

      return {
        detected: flags.length > 0,
        flags,
      };
    } catch (error) {
      this.logger.error('Anomaly detection failed', { error });
      return { detected: false, flags: [] };
    }
  }

  /**
   * Recommend action based on oracle score
   */
  private recommendAction(
    oracleScore: number,
    assetData: any
  ): 'none' | 'pause_trading' | 'burn_tokens' | 'escalate' {
    // Critical failure: immediate token burn to protect investors
    if (oracleScore < 0.3) {
      return 'burn_tokens';
    }

    // High risk: pause trading pending verification
    if (oracleScore < 0.7) {
      return 'pause_trading';
    }

    return 'none';
  }

  /**
   * Store verification result in audit trail for regulatory compliance
   */
  private async storeVerificationResult(
    result: OwnershipVerification,
    assetData: any
  ): Promise<void> {
    try {
      await this.dbClient.query(
        `INSERT INTO rwa_compliance_audit 
         (asset_id, decision_type, decision, risk_score, agent_reasoning)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          assetData.id,
          'ownership_verification',
          result.ownershipStatus,
          result.oracleScore,
          JSON.stringify({
            flags: result.riskFlags,
            verificationDetails: result.verificationDetails,
            recommendedAction: result.recommendedAction,
          }),
        ]
      );
    } catch (error) {
      this.logger.error('Failed to store verification result', { error });
    }
  }

  /**
   * Get ERC-1400 token supply from Besu contract
   */
  private async getERC1400TokenSupply(contractAddress: string): Promise<number> {
    try {
      const abi = ['function totalSupply() external view returns (uint256)'];
      const contract = new Contract(contractAddress, abi, this.besuProvider);
      const supply = await contract.totalSupply();
      return Number(supply);
    } catch (error) {
      this.logger.error('Failed to get token supply', { contractAddress, error });
      return 0;
    }
  }

  /**
   * Get historical average price (30-day)
   */
  private async getHistoricalAveragePrice(assetId: string, days: number): Promise<number> {
    try {
      const result = await this.dbClient.query(
        `SELECT AVG(encoded_offer_price) as avg_price FROM p2p_transfers 
         WHERE asset_id = $1 
           AND created_at > NOW() - INTERVAL $2 'day'
           AND transfer_status = 'completed'`,
        [assetId, days]
      );
      return result.rows[0]?.avg_price || 0;
    } catch (error) {
      this.logger.error('Failed to get historical price', { error });
      return 0;
    }
  }

  /**
   * Get historical average trading volume
   */
  private async getHistoricalAverageVolume(assetId: string, days: number): Promise<number> {
    try {
      const result = await this.dbClient.query(
        `SELECT SUM(token_amount) / $2 as avg_daily_volume FROM p2p_transfers 
         WHERE asset_id = $1 
           AND created_at > NOW() - INTERVAL $2 'day'
           AND transfer_status = 'completed'`,
        [assetId, days]
      );
      return result.rows[0]?.avg_daily_volume || 0;
    } catch (error) {
      this.logger.error('Failed to get historical volume', { error });
      return 0;
    }
  }
}

// Export for integration into agents service
export default OracleVerifiedOwnershipGuard;
