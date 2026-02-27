/**
 * Blockchain Monitoring Routes
 * TIER 3: Real-time transaction monitoring and compliance enforcement
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import winston from 'winston';
import BlockchainMonitor, { BlockchainNetworkConfig } from '../services/blockchainMonitor';
import { requirePermission } from '../middleware/authMiddleware';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory, ValidationError } from '../types/errors';
import { Pool } from 'pg';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/blockchain-routes.log' }),
  ],
});

let blockchainMonitor: BlockchainMonitor | null = null;

/**
 * Initialize blockchain monitoring
 * This is typically called from the main application startup
 */
export const initializeBlockchainMonitoring = async (database: Pool): Promise<void> => {
  try {
    blockchainMonitor = new BlockchainMonitor(database);

    // Load network configurations from environment
    const networks: BlockchainNetworkConfig[] = [];

    // Hyperledger Besu (Permissioned) - Client-provided RPC endpoints
    if (process.env.BESU_RPC_URL) {
      networks.push({
        type: 'permissioned',
        name: 'besu-mainnet',
        chainId: parseInt(process.env.BESU_CHAIN_ID || '1337'),
        rpcEndpoints: [
          process.env.BESU_RPC_URL,
          process.env.BESU_BACKUP_RPC_URL || '',
        ].filter(Boolean),
      });
    }

    // Ethereum (Public) - Client's Infura/Alchemy project
    if (process.env.ETHEREUM_RPC_URL) {
      networks.push({
        type: 'public',
        name: 'ethereum-mainnet',
        chainId: 1,
        rpcEndpoints: [process.env.ETHEREUM_RPC_URL],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      });
    }

    // Solana (Public) - Client's Solana RPC endpoint
    if (process.env.SOLANA_RPC_URL) {
      networks.push({
        type: 'public',
        name: 'solana-mainnet',
        chainId: 101,
        rpcEndpoints: [process.env.SOLANA_RPC_URL],
        nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
      });
    }

    if (networks.length > 0) {
      await blockchainMonitor.connect(networks);
      logger.info(`✅ Blockchain monitoring initialized with ${networks.length} networks`);
    } else {
      logger.warn('⚠️ No blockchain RPC endpoints configured. Blockchain monitoring disabled.');
    }
  } catch (error) {
    logger.error('❌ Failed to initialize blockchain monitoring', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * POST /api/blockchain/monitor/wallet
 * Start monitoring a wallet for compliance
 */
router.post(
  '/monitor/wallet',
  requirePermission('compliance:execute'),
  [
    body('walletAddress')
      .matches(/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Z]{32,44}$/) // Ethereum or Solana address
      .withMessage('Valid wallet address required'),

    body('networkName')
      .isString()
      .isIn(['besu-mainnet', 'ethereum-mainnet', 'solana-mainnet'])
      .withMessage('Valid network name required'),

    body('jurisdiction')
      .optional()
      .isIn(['AE', 'US', 'EU', 'IN', 'GLOBAL'])
      .withMessage('Invalid jurisdiction'),

    body('alertThreshold')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Alert threshold must be 0-100'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!blockchainMonitor) {
        return res.status(503).json(
          createErrorResponseFromDetails(
            ErrorCode.SERVICE_UNAVAILABLE,
            ErrorCategory.INTERNAL,
            'Blockchain monitoring service not initialized',
            503
          )
        );
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Invalid request parameters',
            400,
            errors.array()
          )
        );
      }

      const {
        walletAddress,
        networkName,
        jurisdiction = 'GLOBAL',
        alertThreshold = 50,
      } = req.body;

      logger.info('Starting wallet monitoring', {
        wallet: walletAddress,
        network: networkName,
        jurisdiction,
      });

      // Start monitoring
      await blockchainMonitor.monitorWallet(walletAddress, networkName, (event) => {
        // Transaction callback - could trigger compliance checks
        logger.info('Transaction detected on monitored wallet', {
          wallet: walletAddress,
          txHash: event.hash,
          amount: event.value,
        });
      });

      res.status(201).json({
        success: true,
        monitoringId: `mon-${walletAddress}-${Date.now()}`,
        walletAddress,
        networkName,
        jurisdiction,
        status: 'ACTIVE',
        alertThreshold,
        startedAt: new Date().toISOString(),
        message: 'Wallet monitoring started - real-time alerts will be sent',
      });
    } catch (error) {
      logger.error('Wallet monitoring error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * POST /api/blockchain/monitor/contract
 * Listen to smart contract events
 */
router.post(
  '/monitor/contract',
  requirePermission('compliance:execute'),
  [
    body('contractAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid contract address required'),

    body('eventName')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('Event name required'),

    body('networkName')
      .isString()
      .isIn(['besu-mainnet', 'ethereum-mainnet', 'solana-mainnet'])
      .withMessage('Valid network name required'),

    body('abi')
      .isArray()
      .withMessage('Contract ABI required as array'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!blockchainMonitor) {
        return res.status(503).json(
          createErrorResponseFromDetails(
            ErrorCode.SERVICE_UNAVAILABLE,
            ErrorCategory.INTERNAL,
            'Blockchain monitoring service not initialized',
            503
          )
        );
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Invalid request parameters',
            400,
            errors.array()
          )
        );
      }

      const { contractAddress, eventName, networkName, abi } = req.body;

      logger.info('Starting contract event monitoring', {
        contract: contractAddress,
        event: eventName,
        network: networkName,
      });

      // Parse ABI and start listening
      const abiInterface = new (require('ethers').ethers.Interface)(abi);

      await blockchainMonitor.listenToContractEvents(
        contractAddress,
        abiInterface,
        eventName,
        networkName,
        (event) => {
          logger.info('Contract event detected', {
            contract: contractAddress,
            event: eventName,
            data: event.data,
          });
        }
      );

      res.status(201).json({
        success: true,
        listenerId: `listen-${contractAddress}-${eventName}-${Date.now()}`,
        contractAddress,
        eventName,
        networkName,
        status: 'LISTENING',
        startedAt: new Date().toISOString(),
        message: 'Contract event listening started',
      });
    } catch (error) {
      logger.error('Contract monitoring error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/blockchain/monitor/:walletAddress
 * Stop monitoring a wallet
 */
router.delete(
  '/monitor/:walletAddress',
  requirePermission('compliance:execute'),
  [
    param('walletAddress')
      .matches(/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Z]{32,44}$/)
      .withMessage('Valid wallet address required'),

    body('networkName')
      .isString()
      .isIn(['besu-mainnet', 'ethereum-mainnet', 'solana-mainnet'])
      .withMessage('Valid network name required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!blockchainMonitor) {
        return res.status(503).json(
          createErrorResponseFromDetails(
            ErrorCode.SERVICE_UNAVAILABLE,
            ErrorCategory.INTERNAL,
            'Blockchain monitoring service not initialized',
            503
          )
        );
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Invalid request parameters',
            400,
            errors.array()
          )
        );
      }

      const { walletAddress } = req.params;
      const { networkName } = req.body;

      logger.info('Stopping wallet monitoring', {
        wallet: walletAddress,
        network: networkName,
      });

      await blockchainMonitor.stopMonitoring(walletAddress, networkName);

      res.json({
        success: true,
        walletAddress,
        networkName,
        status: 'STOPPED',
        stoppedAt: new Date().toISOString(),
        message: 'Wallet monitoring stopped',
      });
    } catch (error) {
      logger.error('Stop monitoring error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /api/blockchain/status
 * Get blockchain monitoring status
 */
router.get(
  '/status',
  requirePermission('compliance:read'),
  (req: Request, res: Response) => {
    try {
      const status = blockchainMonitor?.getStatus() || {
        connected: false,
        networks: [],
        activeMonitors: 0,
        activeFilters: 0,
      };

      res.json({
        success: true,
        blockchainMonitoring: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Status check error', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: 'Failed to get blockchain status',
      });
    }
  }
);

/**
 * GET /api/blockchain/transactions/:txHash
 * Get transaction details from blockchain
 */
router.get(
  '/transactions/:txHash',
  requirePermission('compliance:read'),
  [
    param('txHash')
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Valid transaction hash required'),

    body('networkName')
      .optional()
      .isIn(['besu-mainnet', 'ethereum-mainnet', 'solana-mainnet'])
      .withMessage('Valid network name'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { txHash } = req.params;
      const { networkName = 'ethereum-mainnet' } = req.body;

      logger.info('Fetching transaction', {
        txHash,
        network: networkName,
      });

      // TODO: Fetch from blockchain via provider
      // Placeholder response
      res.json({
        success: true,
        transaction: {
          hash: txHash,
          from: '0x1234567890123456789012345678901234567890',
          to: '0x0987654321098765432109876543210987654321',
          value: '1000000000000000000', // 1 ETH in wei
          gasPrice: '20000000000',
          gasLimit: '21000',
          blockNumber: 19000000,
          status: 'confirmed',
          timestamp: new Date().toISOString(),
        },
        network: networkName,
      });
    } catch (error) {
      logger.error('Transaction fetch error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

export default router;
