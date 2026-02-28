/**
 * Ethereum Event Listener
 * Listens for contract events and transactions on Ethereum-compatible networks.
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ethereum-events.log' }),
  ],
});

export interface EventListenerConfig {
  contractAddress?: string;
  abi?: ethers.InterfaceAbi;
  eventName?: string;
  topics?: string[];
  fromBlock?: number | string;
  pollingInterval?: number;
}

export class EthereumEventListener extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private contractListeners: Map<string, ethers.Contract> = new Map();
  private isListening = false;

  constructor(provider: ethers.JsonRpcProvider) {
    super();
    this.provider = provider;
  }

  /**
   * Add a contract event listener.
   */
  addContractListener(config: EventListenerConfig): void {
    if (!config.contractAddress || !config.abi || !config.eventName) {
      throw new Error('contractAddress, abi, and eventName are required for contract listeners');
    }

    const key = `${config.contractAddress}:${config.eventName}`;
    if (this.contractListeners.has(key)) {
      logger.warn('Contract listener already registered', { key });
      return;
    }

    const contract = new ethers.Contract(config.contractAddress, config.abi, this.provider);
    this.contractListeners.set(key, contract);

    contract.on(config.eventName, (...args: unknown[]) => {
      const event = args[args.length - 1];
      logger.info('Contract event received', {
        contract: config.contractAddress,
        eventName: config.eventName,
      });
      this.emit('contractEvent', {
        contractAddress: config.contractAddress,
        eventName: config.eventName,
        args: args.slice(0, -1),
        event,
      });
    });

    logger.info('Contract listener added', { key });
  }

  /**
   * Start listening for new blocks and pending transactions.
   */
  startListening(): void {
    if (this.isListening) {
      logger.warn('Event listener already running');
      return;
    }

    this.isListening = true;

    this.provider.on('block', (blockNumber: number) => {
      logger.debug('New block', { blockNumber });
      this.emit('block', blockNumber);
    });

    logger.info('Ethereum event listener started');
  }

  /**
   * Stop all listeners.
   */
  stopListening(): void {
    if (!this.isListening) return;

    this.provider.removeAllListeners('block');

    for (const [key, contract] of this.contractListeners.entries()) {
      contract.removeAllListeners();
      logger.info('Contract listener removed', { key });
    }
    this.contractListeners.clear();

    this.isListening = false;
    logger.info('Ethereum event listener stopped');
  }
}
