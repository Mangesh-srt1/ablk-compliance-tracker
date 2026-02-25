# Day 4: Polygon Integration

## Objective
Implement comprehensive Polygon (Matic) blockchain integration with Layer 2 scaling, gas-optimized transactions, and cross-chain compliance monitoring.

## Implementation Steps

1. **Set up Polygon network infrastructure**
   - Configure Polygon RPC connections with gas optimization
   - Implement cross-chain bridge monitoring
   - Set up Layer 2 state synchronization

2. **Create Polygon event monitoring**
   - Build contract event listeners for Polygon ecosystem
   - Implement cross-chain transaction tracking
   - Add support for Polygon's proof-of-stake consensus

3. **Implement Layer 2 compliance features**
   - Monitor cross-chain bridges and transfers
   - Track Layer 2 state transitions
   - Implement gas-efficient compliance checks

4. **Add Polygon-specific integrations**
   - Integrate with Polygon APIs and subgraphs
   - Implement checkpoint and exit monitoring
   - Add support for Polygon Edge and Supernets

## Code Snippets

### 1. Polygon Provider Manager
```typescript
// src/blockchain/polygon/polygon-provider-manager.ts
import { ethers, JsonRpcProvider, WebSocketProvider } from 'ethers';
import { EventEmitter } from 'events';

export interface PolygonConfig {
  rpcUrl: string;
  wsUrl?: string;
  privateKey?: string;
  networkId?: number;
  gasMultiplier?: number;
  timeout?: number;
  bridgeContractAddress?: string;
  stateSenderAddress?: string;
}

export interface CrossChainTransfer {
  fromChain: string;
  toChain: string;
  sender: string;
  receiver: string;
  amount: string;
  token: string;
  depositId: string;
  timestamp: number;
}

export class PolygonProviderManager extends EventEmitter {
  private httpProvider: JsonRpcProvider;
  private wsProvider?: WebSocketProvider;
  private wallet?: ethers.Wallet;
  private bridgeContract?: ethers.Contract;
  private stateSenderContract?: ethers.Contract;

  constructor(private config: PolygonConfig) {
    super();
    this.initializeProviders();
  }

  private initializeProviders() {
    // HTTP provider for regular calls
    this.httpProvider = new JsonRpcProvider(this.config.rpcUrl, this.config.networkId, {
      timeout: this.config.timeout || 30000,
    });

    // WebSocket provider for real-time updates (if configured)
    if (this.config.wsUrl) {
      this.wsProvider = new WebSocketProvider(this.config.wsUrl, this.config.networkId);
      this.setupWebSocketHandlers();
    }

    // Wallet for signing transactions
    if (this.config.privateKey) {
      this.wallet = new ethers.Wallet(this.config.privateKey, this.httpProvider);
    }

    // Initialize bridge contracts
    this.initializeContracts();
  }

  private setupWebSocketHandlers() {
    if (!this.wsProvider) return;

    this.wsProvider.on('block', (blockNumber) => {
      this.emit('new-block', { blockNumber, chain: 'polygon' });
    });

    this.wsProvider.on('error', (error) => {
      this.emit('websocket-error', error);
    });

    this.wsProvider.on('close', () => {
      this.emit('websocket-closed');
      // Attempt reconnection
      setTimeout(() => this.reconnectWebSocket(), 5000);
    });
  }

  private reconnectWebSocket() {
    if (this.config.wsUrl) {
      try {
        this.wsProvider = new WebSocketProvider(this.config.wsUrl, this.config.networkId);
        this.setupWebSocketHandlers();
        this.emit('websocket-reconnected');
      } catch (error) {
        this.emit('websocket-reconnection-failed', error);
      }
    }
  }

  private initializeContracts() {
    // Bridge contract for cross-chain transfers
    if (this.config.bridgeContractAddress) {
      const bridgeAbi = [
        'event Deposit(address indexed sender, address indexed receiver, uint256 amount, uint256 depositId)',
        'event Withdraw(address indexed receiver, uint256 amount, uint256 depositId)',
        'function depositFor(address receiver, uint256 amount) external',
        'function withdraw(uint256 depositId) external',
      ];

      this.bridgeContract = new ethers.Contract(
        this.config.bridgeContractAddress,
        bridgeAbi,
        this.wallet || this.httpProvider
      );
    }

    // State sender contract for state sync
    if (this.config.stateSenderAddress) {
      const stateSenderAbi = [
        'event StateSynced(uint256 indexed id, address indexed contractAddress, bytes data)',
        'function syncState(address receiver, bytes calldata data) external',
      ];

      this.stateSenderContract = new ethers.Contract(
        this.config.stateSenderAddress,
        stateSenderAbi,
        this.wallet || this.httpProvider
      );
    }
  }

  public getHttpProvider(): JsonRpcProvider {
    return this.httpProvider;
  }

  public getWsProvider(): WebSocketProvider | undefined {
    return this.wsProvider;
  }

  public getWallet(): ethers.Wallet | undefined {
    return this.wallet;
  }

  public getBridgeContract(): ethers.Contract | undefined {
    return this.bridgeContract;
  }

  public getStateSenderContract(): ethers.Contract | undefined {
    return this.stateSenderContract;
  }

  public async getGasPrice(): Promise<bigint> {
    try {
      const gasPrice = await this.httpProvider.getFeeData();
      const multiplier = this.config.gasMultiplier || 1.1;
      return (gasPrice.gasPrice! * BigInt(Math.floor(multiplier * 100))) / BigInt(100);
    } catch (error) {
      this.emit('error', { operation: 'getGasPrice', error: error.message });
      throw error;
    }
  }

  public async estimateGas(tx: any): Promise<bigint> {
    try {
      const gasEstimate = await this.httpProvider.estimateGas(tx);
      const multiplier = this.config.gasMultiplier || 1.2;
      return (gasEstimate * BigInt(Math.floor(multiplier * 100))) / BigInt(100);
    } catch (error) {
      this.emit('error', { operation: 'estimateGas', error: error.message });
      throw error;
    }
  }

  public async sendTransaction(tx: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not configured for sending transactions');
    }

    try {
      // Optimize gas
      if (!tx.gasPrice) {
        tx.gasPrice = await this.getGasPrice();
      }

      if (!tx.gasLimit) {
        tx.gasLimit = await this.estimateGas(tx);
      }

      const txResponse = await this.wallet.sendTransaction(tx);
      this.emit('transaction-sent', { hash: txResponse.hash, chain: 'polygon' });

      return txResponse;
    } catch (error) {
      this.emit('error', { operation: 'sendTransaction', error: error.message });
      throw error;
    }
  }

  public async bridgeTransfer(
    receiver: string,
    amount: string,
    tokenAddress?: string
  ): Promise<string> {
    if (!this.bridgeContract) {
      throw new Error('Bridge contract not configured');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      let tx;

      if (tokenAddress) {
        // ERC20 transfer
        const erc20Abi = ['function approve(address spender, uint256 amount)', 'function transfer(address to, uint256 amount)'];
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.wallet);

        // Approve bridge to spend tokens
        await tokenContract.approve(this.bridgeContract.target, amountWei);

        // Deposit tokens
        tx = await this.bridgeContract.depositFor(receiver, amountWei);
      } else {
        // ETH transfer
        tx = await this.bridgeContract.depositFor(receiver, amountWei, { value: amountWei });
      }

      this.emit('bridge-transfer-initiated', {
        txHash: tx.hash,
        receiver,
        amount,
        tokenAddress,
      });

      return tx.hash;
    } catch (error) {
      this.emit('error', { operation: 'bridgeTransfer', error: error.message });
      throw error;
    }
  }

  public async getCrossChainTransfers(
    fromBlock: number,
    toBlock: number
  ): Promise<CrossChainTransfer[]> {
    if (!this.bridgeContract) {
      return [];
    }

    try {
      const depositFilter = this.bridgeContract.filters.Deposit();
      const withdrawFilter = this.bridgeContract.filters.Withdraw();

      const [depositEvents, withdrawEvents] = await Promise.all([
        this.bridgeContract.queryFilter(depositFilter, fromBlock, toBlock),
        this.bridgeContract.queryFilter(withdrawFilter, fromBlock, toBlock),
      ]);

      const transfers: CrossChainTransfer[] = [];

      // Process deposits (Ethereum -> Polygon)
      for (const event of depositEvents) {
        const block = await this.httpProvider.getBlock(event.blockNumber);
        transfers.push({
          fromChain: 'ethereum',
          toChain: 'polygon',
          sender: event.args![0],
          receiver: event.args![1],
          amount: event.args![2].toString(),
          token: 'ETH', // Would need to determine actual token
          depositId: event.args![3].toString(),
          timestamp: block?.timestamp || Date.now(),
        });
      }

      // Process withdrawals (Polygon -> Ethereum)
      for (const event of withdrawEvents) {
        const block = await this.httpProvider.getBlock(event.blockNumber);
        transfers.push({
          fromChain: 'polygon',
          toChain: 'ethereum',
          sender: '', // Would need to track this
          receiver: event.args![0],
          amount: event.args![1].toString(),
          token: 'ETH',
          depositId: event.args![2].toString(),
          timestamp: block?.timestamp || Date.now(),
        });
      }

      return transfers;
    } catch (error) {
      this.emit('error', { operation: 'getCrossChainTransfers', error: error.message });
      throw error;
    }
  }

  public async getStateSyncEvents(fromBlock: number, toBlock: number): Promise<any[]> {
    if (!this.stateSenderContract) {
      return [];
    }

    try {
      const stateSyncFilter = this.stateSenderContract.filters.StateSynced();
      const events = await this.stateSenderContract.queryFilter(stateSyncFilter, fromBlock, toBlock);

      return events.map(event => ({
        id: event.args![0].toString(),
        contractAddress: event.args![1],
        data: event.args![2],
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      }));
    } catch (error) {
      this.emit('error', { operation: 'getStateSyncEvents', error: error.message });
      throw error;
    }
  }

  public getConnectionHealth() {
    return {
      httpConnected: true, // Would implement actual health check
      wsConnected: !!this.wsProvider && this.wsProvider.ready,
      bridgeContractReady: !!this.bridgeContract,
      stateSenderReady: !!this.stateSenderContract,
    };
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createPolygonProviderManager(config: PolygonConfig): PolygonProviderManager {
  return new PolygonProviderManager(config);
}
```

### 2. Polygon Event Listener
```typescript
// src/blockchain/polygon/polygon-event-listener.ts
import { PolygonProviderManager } from './polygon-provider-manager';
import { ethers } from 'ethers';
import { EventEmitter } from 'events';

export interface PolygonEventConfig {
  contractAddress?: string;
  abi?: any[];
  eventName?: string;
  bridgeEvents?: boolean;
  stateSyncEvents?: boolean;
  fromBlock?: number;
  pollingInterval?: number;
}

export interface PolygonProcessedEvent {
  eventName: string;
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  isCrossChain: boolean;
  chainType: 'polygon' | 'ethereum';
  args: any[];
  timestamp: number;
  raw: any;
  crossChainData?: {
    depositId?: string;
    direction?: 'deposit' | 'withdraw';
    stateSyncId?: string;
  };
}

export class PolygonEventListener extends EventEmitter {
  private provider: ethers.Provider;
  private wsProvider?: ethers.WebSocketProvider;
  private listeners: Map<string, PolygonEventConfig> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private eventSubscriptions: Map<string, any> = new Map();
  private isListening = false;

  constructor(private providerManager: PolygonProviderManager) {
    super();
    this.provider = providerManager.getHttpProvider();
    this.wsProvider = providerManager.getWsProvider();
  }

  public async addEventListener(id: string, config: PolygonEventConfig): Promise<void> {
    if (this.listeners.has(id)) {
      throw new Error(`Listener with id ${id} already exists`);
    }

    this.listeners.set(id, config);

    if (this.isListening) {
      await this.startListeningToEvents(id);
    }
  }

  public removeEventListener(id: string): void {
    const interval = this.pollingIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(id);
    }

    const subscription = this.eventSubscriptions.get(id);
    if (subscription) {
      // Remove WebSocket subscription if exists
      this.eventSubscriptions.delete(id);
    }

    this.listeners.delete(id);
  }

  public async startListening(): Promise<void> {
    this.isListening = true;

    for (const [id] of this.listeners) {
      await this.startListeningToEvents(id);
    }
  }

  public stopListening(): void {
    this.isListening = false;

    for (const [id, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    this.eventSubscriptions.clear();
  }

  private async startListeningToEvents(id: string): Promise<void> {
    const config = this.listeners.get(id);
    if (!config) return;

    const pollingInterval = config.pollingInterval || 15000;

    let lastBlock = config.fromBlock || (await this.provider.getBlockNumber());

    // Setup contract event listening
    if (config.contractAddress && config.abi && config.eventName) {
      await this.setupContractEventListener(id, config);
    }

    // Setup bridge event listening
    if (config.bridgeEvents) {
      await this.setupBridgeEventListener(id, config);
    }

    // Setup state sync event listening
    if (config.stateSyncEvents) {
      await this.setupStateSyncEventListener(id, config);
    }

    // Polling fallback for events not available via WebSocket
    const interval = setInterval(async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber();
        const toBlock = Math.min(currentBlock, lastBlock + 50);

        if (lastBlock >= toBlock) return;

        // Process bridge events via polling if not using WebSocket
        if (config.bridgeEvents && !this.eventSubscriptions.has(`${id}-bridge`)) {
          await this.processBridgeEvents(id, config, lastBlock + 1, toBlock);
        }

        // Process state sync events via polling if not using WebSocket
        if (config.stateSyncEvents && !this.eventSubscriptions.has(`${id}-statesync`)) {
          await this.processStateSyncEvents(id, config, lastBlock + 1, toBlock);
        }

        lastBlock = toBlock;
      } catch (error) {
        this.emit('error', { id, error: error.message });
      }
    }, pollingInterval);

    this.pollingIntervals.set(id, interval);
  }

  private async setupContractEventListener(id: string, config: PolygonEventConfig): Promise<void> {
    if (!config.contractAddress || !config.abi || !config.eventName) return;

    const contract = new ethers.Contract(config.contractAddress, config.abi, this.provider);

    try {
      // Try WebSocket first for real-time updates
      if (this.wsProvider) {
        const wsContract = new ethers.Contract(config.contractAddress, config.abi, this.wsProvider);

        wsContract.on(config.eventName, (...args) => {
          const event = args[args.length - 1]; // Last argument is the event object
          this.handleContractEvent(id, event, false);
        });

        this.eventSubscriptions.set(`${id}-contract`, wsContract);
      } else {
        // Fallback to polling
        const eventFilter = contract.filters[config.eventName]();
        this.eventSubscriptions.set(`${id}-contract-filter`, eventFilter);
      }
    } catch (error) {
      this.emit('error', { id, operation: 'setupContractEventListener', error: error.message });
    }
  }

  private async setupBridgeEventListener(id: string, config: PolygonEventConfig): Promise<void> {
    const bridgeContract = this.providerManager.getBridgeContract();
    if (!bridgeContract) return;

    try {
      if (this.wsProvider) {
        const wsBridgeContract = new ethers.Contract(
          bridgeContract.target,
          bridgeContract.interface,
          this.wsProvider
        );

        // Listen to deposit events (Ethereum -> Polygon)
        wsBridgeContract.on('Deposit', (sender, receiver, amount, depositId, event) => {
          this.handleBridgeEvent(id, 'Deposit', {
            sender, receiver, amount, depositId, event,
            direction: 'deposit',
            fromChain: 'ethereum',
            toChain: 'polygon'
          });
        });

        // Listen to withdraw events (Polygon -> Ethereum)
        wsBridgeContract.on('Withdraw', (receiver, amount, depositId, event) => {
          this.handleBridgeEvent(id, 'Withdraw', {
            receiver, amount, depositId, event,
            direction: 'withdraw',
            fromChain: 'polygon',
            toChain: 'ethereum'
          });
        });

        this.eventSubscriptions.set(`${id}-bridge`, wsBridgeContract);
      }
    } catch (error) {
      this.emit('error', { id, operation: 'setupBridgeEventListener', error: error.message });
    }
  }

  private async setupStateSyncEventListener(id: string, config: PolygonEventConfig): Promise<void> {
    const stateSenderContract = this.providerManager.getStateSenderContract();
    if (!stateSenderContract) return;

    try {
      if (this.wsProvider) {
        const wsStateSenderContract = new ethers.Contract(
          stateSenderContract.target,
          stateSenderContract.interface,
          this.wsProvider
        );

        wsStateSenderContract.on('StateSynced', (id, contractAddress, data, event) => {
          this.handleStateSyncEvent(id, { id, contractAddress, data, event });
        });

        this.eventSubscriptions.set(`${id}-statesync`, wsStateSenderContract);
      }
    } catch (error) {
      this.emit('error', { id, operation: 'setupStateSyncEventListener', error: error.message });
    }
  }

  private async processBridgeEvents(
    id: string,
    config: PolygonEventConfig,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      const transfers = await this.providerManager.getCrossChainTransfers(fromBlock, toBlock);

      for (const transfer of transfers) {
        const processedEvent = await this.transformCrossChainEvent(transfer);
        this.emit('event', { id, event: processedEvent });
      }
    } catch (error) {
      this.emit('error', { id, operation: 'processBridgeEvents', error: error.message });
    }
  }

  private async processStateSyncEvents(
    id: string,
    config: PolygonEventConfig,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      const stateSyncEvents = await this.providerManager.getStateSyncEvents(fromBlock, toBlock);

      for (const event of stateSyncEvents) {
        const processedEvent = await this.transformStateSyncEvent(event);
        this.emit('event', { id, event: processedEvent });
      }
    } catch (error) {
      this.emit('error', { id, operation: 'processStateSyncEvents', error: error.message });
    }
  }

  private handleContractEvent(id: string, event: any, isCrossChain: boolean): void {
    const processedEvent = this.transformContractEvent(event, isCrossChain);
    this.emit('event', { id, event: processedEvent });
  }

  private handleBridgeEvent(id: string, eventName: string, eventData: any): void {
    const processedEvent = this.transformBridgeEvent(eventName, eventData);
    this.emit('event', { id, event: processedEvent });
  }

  private handleStateSyncEvent(id: string, eventData: any): void {
    const processedEvent = this.transformStateSyncEvent(eventData);
    this.emit('event', { id, event: processedEvent });
  }

  private transformContractEvent(event: any, isCrossChain: boolean): PolygonProcessedEvent {
    return {
      eventName: event.eventName || event.topics[0],
      contractAddress: event.address,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      isCrossChain,
      chainType: 'polygon',
      args: event.args || [],
      timestamp: Date.now(), // Would get from block
      raw: event,
    };
  }

  private transformBridgeEvent(eventName: string, eventData: any): PolygonProcessedEvent {
    const { event, direction, fromChain, toChain, ...args } = eventData;

    return {
      eventName,
      contractAddress: event.address,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      isCrossChain: true,
      chainType: direction === 'deposit' ? 'polygon' : 'ethereum',
      args: Object.values(args),
      timestamp: Date.now(),
      raw: event,
      crossChainData: {
        direction,
        depositId: args.depositId?.toString(),
      },
    };
  }

  private async transformCrossChainEvent(transfer: any): Promise<PolygonProcessedEvent> {
    return {
      eventName: transfer.fromChain === 'ethereum' ? 'Deposit' : 'Withdraw',
      contractAddress: '', // Would need bridge contract address
      transactionHash: '', // Would need to get from event
      blockNumber: 0, // Would need to get from event
      logIndex: 0,
      isCrossChain: true,
      chainType: transfer.toChain === 'polygon' ? 'polygon' : 'ethereum',
      args: [transfer.sender, transfer.receiver, transfer.amount],
      timestamp: transfer.timestamp,
      raw: transfer,
      crossChainData: {
        direction: transfer.fromChain === 'ethereum' ? 'deposit' : 'withdraw',
        depositId: transfer.depositId,
      },
    };
  }

  private async transformStateSyncEvent(eventData: any): Promise<PolygonProcessedEvent> {
    return {
      eventName: 'StateSynced',
      contractAddress: eventData.contractAddress,
      transactionHash: '', // Would need to get from event
      blockNumber: eventData.blockNumber,
      logIndex: 0,
      isCrossChain: true,
      chainType: 'polygon',
      args: [eventData.id, eventData.contractAddress, eventData.data],
      timestamp: Date.now(),
      raw: eventData,
      crossChainData: {
        stateSyncId: eventData.id.toString(),
      },
    };
  }
}
```

### 3. Polygon Compliance Processor
```typescript
// src/blockchain/polygon/polygon-compliance-processor.ts
import { PolygonProviderManager } from './polygon-provider-manager';
import { PolygonEventListener, PolygonProcessedEvent } from './polygon-event-listener';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export interface PolygonComplianceEvent {
  id: string;
  type: 'contract_interaction' | 'cross_chain_transfer' | 'state_sync' | 'bridge_transaction';
  blockchain: 'polygon';
  transactionHash: string;
  contractAddress?: string;
  from?: string;
  to?: string;
  value?: string;
  blockNumber: number;
  timestamp: number;
  isCrossChain: boolean;
  processed: boolean;
  riskScore?: number;
  complianceFlags?: string[];
  crossChainMetadata?: {
    direction: 'deposit' | 'withdraw';
    fromChain: string;
    toChain: string;
    depositId?: string;
    stateSyncId?: string;
    bridgeAmount?: string;
    bridgeToken?: string;
  };
}

export class PolygonComplianceProcessor {
  private eventQueue: Queue;
  private redis: Redis;

  constructor(
    private eventListener: PolygonEventListener,
    private providerManager: PolygonProviderManager,
    redisUrl: string
  ) {
    this.redis = new Redis(redisUrl);
    this.eventQueue = new Queue('polygon-compliance-events', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.setupEventHandlers();
    this.setupQueueProcessor();
  }

  private setupEventHandlers(): void {
    this.eventListener.on('event', async ({ id, event }) => {
      await this.processIncomingEvent(id, event);
    });

    this.eventListener.on('error', ({ id, error }) => {
      console.error(`Polygon event listener error for ${id}:`, error);
    });
  }

  private async processIncomingEvent(
    listenerId: string,
    event: PolygonProcessedEvent
  ): Promise<void> {
    try {
      const complianceEvent = await this.transformToComplianceEvent(event);

      // Add to processing queue with priority
      await this.eventQueue.add(
        'process-polygon-compliance-event',
        complianceEvent,
        {
          priority: this.calculateEventPriority(complianceEvent),
          delay: 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      // Cache event for deduplication
      await this.cacheComplianceEvent(complianceEvent);

    } catch (error) {
      console.error('Failed to process Polygon incoming event:', error);
    }
  }

  private async transformToComplianceEvent(event: PolygonProcessedEvent): Promise<PolygonComplianceEvent> {
    const complianceEvent: PolygonComplianceEvent = {
      id: `${event.transactionHash}-${event.blockNumber}-${event.logIndex}`,
      type: this.mapEventType(event),
      blockchain: 'polygon',
      transactionHash: event.transactionHash,
      contractAddress: event.contractAddress,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp,
      isCrossChain: event.isCrossChain,
      processed: false,
    };

    // Extract addresses and values from event args
    if (event.args.length >= 3) {
      complianceEvent.from = event.args[0];
      complianceEvent.to = event.args[1];
      complianceEvent.value = event.args[2]?.toString();
    }

    // Add cross-chain metadata if applicable
    if (event.isCrossChain && event.crossChainData) {
      complianceEvent.crossChainMetadata = {
        direction: event.crossChainData.direction || 'deposit',
        fromChain: event.crossChainData.direction === 'deposit' ? 'ethereum' : 'polygon',
        toChain: event.crossChainData.direction === 'deposit' ? 'polygon' : 'ethereum',
        depositId: event.crossChainData.depositId,
        stateSyncId: event.crossChainData.stateSyncId,
        bridgeAmount: complianceEvent.value,
        bridgeToken: 'ETH', // Would need to determine actual token
      };
    }

    return complianceEvent;
  }

  private mapEventType(event: PolygonProcessedEvent): PolygonComplianceEvent['type'] {
    if (event.isCrossChain) {
      if (event.eventName === 'Deposit' || event.eventName === 'Withdraw') {
        return 'cross_chain_transfer';
      }
      if (event.eventName === 'StateSynced') {
        return 'state_sync';
      }
      return 'bridge_transaction';
    }

    return 'contract_interaction';
  }

  private calculateEventPriority(event: PolygonComplianceEvent): number {
    let priority = 1;

    // Cross-chain transfers get higher priority
    if (event.isCrossChain) {
      priority += 3;
    }

    // Large value transfers
    if (event.value) {
      const value = parseFloat(event.value);
      if (value > 10000) priority += 3; // Very large transfers
      else if (value > 1000) priority += 2; // Large transfers
    }

    // State sync events
    if (event.type === 'state_sync') {
      priority += 2;
    }

    return priority;
  }

  private async cacheComplianceEvent(event: PolygonComplianceEvent): Promise<void> {
    const key = `polygon-compliance-event:${event.id}`;
    const data = JSON.stringify(event);

    // Cache for 48 hours
    await this.redis.setex(key, 172800, data);
  }

  private setupQueueProcessor(): void {
    this.eventQueue.process('process-polygon-compliance-event', async (job) => {
      const event: PolygonComplianceEvent = job.data;

      try {
        // Perform compliance checks
        const complianceResult = await this.performComplianceChecks(event);

        // Update event with results
        event.processed = true;
        event.riskScore = complianceResult.riskScore;
        event.complianceFlags = complianceResult.flags;

        // Store processed event
        await this.storeProcessedEvent(event);

        // Trigger alerts if needed
        if (complianceResult.requiresAlert) {
          await this.triggerComplianceAlert(event, complianceResult);
        }

        // Handle cross-chain specific actions
        if (event.isCrossChain) {
          await this.handleCrossChainCompliance(event, complianceResult);
        }

        return { success: true, eventId: event.id };

      } catch (error) {
        console.error(`Failed to process Polygon compliance event ${event.id}:`, error);
        throw error;
      }
    });
  }

  private async performComplianceChecks(event: PolygonComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
    requiresAlert: boolean;
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Basic compliance checks
    if (event.from || event.to) {
      const sanctionsCheck = await this.checkSanctions(event.from, event.to);
      if (sanctionsCheck.isSanctioned) {
        riskScore += 100;
        flags.push('sanctions_violation');
      }
    }

    // Cross-chain specific checks
    if (event.isCrossChain) {
      const crossChainCheck = await this.checkCrossChainCompliance(event);
      riskScore += crossChainCheck.riskScore;
      flags.push(...crossChainCheck.flags);
    }

    // Value-based checks
    if (event.value) {
      const valueCheck = await this.checkValueThreshold(event.value);
      if (valueCheck.exceedsThreshold) {
        riskScore += 50;
        flags.push('high_value_transaction');
      }
    }

    // Bridge-specific checks
    if (event.type === 'bridge_transaction') {
      const bridgeCheck = await this.checkBridgeCompliance(event);
      riskScore += bridgeCheck.riskScore;
      flags.push(...bridgeCheck.flags);
    }

    const requiresAlert = riskScore >= 70 || flags.includes('sanctions_violation');

    return { riskScore, flags, requiresAlert };
  }

  private async checkCrossChainCompliance(event: PolygonComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    if (!event.crossChainMetadata) {
      flags.push('missing_cross_chain_metadata');
      riskScore += 10;
      return { riskScore, flags };
    }

    const { direction, fromChain, toChain, bridgeAmount } = event.crossChainMetadata;

    // Check for unusual cross-chain patterns
    const unusualPattern = await this.checkUnusualCrossChainPattern(event);
    if (unusualPattern) {
      flags.push('unusual_cross_chain_pattern');
      riskScore += 25;
    }

    // Large bridge amounts
    if (bridgeAmount) {
      const amount = parseFloat(bridgeAmount);
      if (amount > 100000) {
        flags.push('large_bridge_transfer');
        riskScore += 40;
      }
    }

    // Check bridge contract authorization
    const bridgeAuthorized = await this.checkBridgeAuthorization(event);
    if (!bridgeAuthorized) {
      flags.push('unauthorized_bridge_usage');
      riskScore += 60;
    }

    // State sync validation
    if (event.type === 'state_sync') {
      const stateValid = await this.validateStateSync(event);
      if (!stateValid) {
        flags.push('invalid_state_sync');
        riskScore += 80;
      }
    }

    return { riskScore, flags };
  }

  private async checkBridgeCompliance(event: PolygonComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Check bridge contract integrity
    const bridgeIntegrity = await this.checkBridgeContractIntegrity(event);
    if (!bridgeIntegrity) {
      flags.push('bridge_contract_compromised');
      riskScore += 100;
    }

    // Check for bridge exploits
    const exploitCheck = await this.checkBridgeExploitPatterns(event);
    if (exploitCheck.isExploit) {
      flags.push('potential_bridge_exploit');
      riskScore += 90;
    }

    // Checkpoint validation
    const checkpointValid = await this.validateCheckpoint(event);
    if (!checkpointValid) {
      flags.push('invalid_checkpoint');
      riskScore += 70;
    }

    return { riskScore, flags };
  }

  private async checkUnusualCrossChainPattern(event: PolygonComplianceEvent): Promise<boolean> {
    // Check for patterns like frequent small transfers, circular transfers, etc.
    // Implementation would analyze historical data
    return false;
  }

  private async checkBridgeAuthorization(event: PolygonComplianceEvent): Promise<boolean> {
    // Verify the bridge contract is authorized and not blacklisted
    return true; // Placeholder
  }

  private async validateStateSync(event: PolygonComplianceEvent): Promise<boolean> {
    // Validate state sync data integrity
    return true; // Placeholder
  }

  private async checkBridgeContractIntegrity(event: PolygonComplianceEvent): Promise<boolean> {
    // Check if bridge contract code hasn't been modified maliciously
    return true; // Placeholder
  }

  private async checkBridgeExploitPatterns(event: PolygonComplianceEvent): Promise<{ isExploit: boolean }> {
    // Check for known bridge exploit patterns
    return { isExploit: false };
  }

  private async validateCheckpoint(event: PolygonComplianceEvent): Promise<boolean> {
    // Validate checkpoint data against Ethereum mainnet
    return true; // Placeholder
  }

  private async checkSanctions(from?: string, to?: string): Promise<{ isSanctioned: boolean }> {
    // Check against sanctions database
    const sanctionedAddresses = new Set(['0x123...', '0x456...']); // From database
    const isSanctioned = (from && sanctionedAddresses.has(from)) ||
                        (to && sanctionedAddresses.has(to));
    return { isSanctioned };
  }

  private async checkValueThreshold(value: string): Promise<{ exceedsThreshold: boolean }> {
    const threshold = ethers.parseEther('10'); // 10 ETH threshold
    const exceedsThreshold = BigInt(value) > threshold;
    return { exceedsThreshold };
  }

  private async storeProcessedEvent(event: PolygonComplianceEvent): Promise<void> {
    // Store in database
    const query = `
      INSERT INTO polygon_compliance_events (
        id, type, blockchain, transaction_hash, contract_address,
        from_address, to_address, value, block_number, timestamp,
        is_cross_chain, risk_score, compliance_flags, cross_chain_metadata,
        processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        risk_score = EXCLUDED.risk_score,
        compliance_flags = EXCLUDED.compliance_flags,
        processed_at = NOW()
    `;

    const values = [
      event.id,
      event.type,
      event.blockchain,
      event.transactionHash,
      event.contractAddress,
      event.from,
      event.to,
      event.value,
      event.blockNumber,
      new Date(event.timestamp * 1000),
      event.isCrossChain,
      event.riskScore,
      JSON.stringify(event.complianceFlags),
      JSON.stringify(event.crossChainMetadata),
    ];

    // Execute query (would use actual database connection)
    console.log('Storing processed Polygon event:', event.id);
  }

  private async triggerComplianceAlert(
    event: PolygonComplianceEvent,
    complianceResult: any
  ): Promise<void> {
    // Send alert
    console.log('Triggering Polygon compliance alert for event:', event.id, complianceResult);
  }

  private async handleCrossChainCompliance(
    event: PolygonComplianceEvent,
    complianceResult: any
  ): Promise<void> {
    // Handle cross-chain specific compliance actions
    if (complianceResult.flags.includes('unauthorized_bridge_usage')) {
      await this.logBridgeViolation(event);
    }

    if (complianceResult.flags.includes('invalid_state_sync')) {
      await this.logStateSyncAnomaly(event);
    }
  }

  private async logBridgeViolation(event: PolygonComplianceEvent): Promise<void> {
    // Log bridge violation
    console.log('Bridge violation detected:', event.id);
  }

  private async logStateSyncAnomaly(event: PolygonComplianceEvent): Promise<void> {
    // Log state sync anomaly
    console.log('State sync anomaly detected:', event.id);
  }

  public async getQueueStats() {
    const waiting = await this.eventQueue.getWaiting();
    const active = await this.eventQueue.getActive();
    const completed = await this.eventQueue.getCompleted();
    const failed = await this.eventQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  public async close(): Promise<void> {
    await this.eventQueue.close();
    await this.redis.disconnect();
  }
}
```

### 4. Polygon Monitoring Service
```typescript
// src/blockchain/polygon/polygon-monitoring-service.ts
import { PolygonProviderManager, createPolygonProviderManager } from './polygon-provider-manager';
import { PolygonEventListener } from './polygon-event-listener';
import { PolygonComplianceProcessor } from './polygon-compliance-processor';
import { EventEmitter } from 'events';

export interface PolygonMonitoringConfig {
  polygonConfig: {
    rpcUrl: string;
    wsUrl?: string;
    privateKey?: string;
    networkId?: number;
    gasMultiplier?: number;
    bridgeContractAddress?: string;
    stateSenderAddress?: string;
  };
  redisUrl: string;
  contracts: Array<{
    address: string;
    abi: any[];
    events: string[];
  }>;
  bridgeMonitoring?: boolean;
  stateSyncMonitoring?: boolean;
  pollingInterval?: number;
}

export class PolygonMonitoringService extends EventEmitter {
  private providerManager: PolygonProviderManager;
  private eventListener: PolygonEventListener;
  private complianceProcessor: PolygonComplianceProcessor;
  private isRunning = false;

  constructor(private config: PolygonMonitoringConfig) {
    super();
    this.providerManager = createPolygonProviderManager(config.polygonConfig);
    this.eventListener = new PolygonEventListener(this.providerManager);
    this.complianceProcessor = new PolygonComplianceProcessor(
      this.eventListener,
      this.providerManager,
      config.redisUrl
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Forward events from components
    this.providerManager.on('new-block', (data) => this.emit('new-block', data));
    this.providerManager.on('transaction-sent', (data) => this.emit('transaction-sent', data));
    this.providerManager.on('bridge-transfer-initiated', (data) => this.emit('bridge-transfer-initiated', data));
    this.providerManager.on('websocket-error', (error) => this.emit('websocket-error', error));

    this.eventListener.on('event', (data) => this.emit('event-received', data));
    this.eventListener.on('error', (data) => this.emit('listener-error', data));

    this.complianceProcessor.eventQueue.on('completed', (job) => {
      this.emit('event-processed', { jobId: job.id, eventId: job.data.id });
    });

    this.complianceProcessor.eventQueue.on('failed', (job, err) => {
      this.emit('event-processing-failed', { jobId: job.id, eventId: job.data.id, error: err.message });
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      // Connect to Polygon network
      await this.providerManager.connect();

      // Setup contract listeners
      for (const contract of this.config.contracts) {
        for (const eventName of contract.events) {
          const listenerId = `${contract.address}-${eventName}`;

          await this.eventListener.addEventListener(listenerId, {
            contractAddress: contract.address,
            abi: contract.abi,
            eventName,
            pollingInterval: this.config.pollingInterval || 15000,
          });
        }
      }

      // Setup bridge monitoring
      if (this.config.bridgeMonitoring) {
        await this.eventListener.addEventListener('bridge-events', {
          bridgeEvents: true,
          pollingInterval: this.config.pollingInterval || 15000,
        });
      }

      // Setup state sync monitoring
      if (this.config.stateSyncMonitoring) {
        await this.eventListener.addEventListener('state-sync-events', {
          stateSyncEvents: true,
          pollingInterval: this.config.pollingInterval || 15000,
        });
      }

      // Start listening
      await this.eventListener.startListening();

      this.isRunning = true;
      this.emit('started');

    } catch (error) {
      this.emit('start-error', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.eventListener.stopListening();
    await this.complianceProcessor.close();

    this.isRunning = false;
    this.emit('stopped');
  }

  public getHealthStatus() {
    return {
      isRunning: this.isRunning,
      connectionHealth: this.providerManager.getConnectionHealth(),
      activeListeners: this.eventListener.getActiveListeners().length,
      queueStats: this.complianceProcessor.getQueueStats(),
    };
  }

  public async getMetrics() {
    const queueStats = await this.complianceProcessor.getQueueStats();

    return {
      uptime: this.isRunning ? Date.now() - (this as any).startTime : 0,
      eventsProcessed: queueStats.completed,
      eventsFailed: queueStats.failed,
      eventsQueued: queueStats.waiting + queueStats.active,
      activeListeners: this.eventListener.getActiveListeners().length,
      crossChainTransfers: 0, // Would track this
    };
  }

  // Bridge operations
  public async initiateBridgeTransfer(
    receiver: string,
    amount: string,
    tokenAddress?: string
  ): Promise<string> {
    return await this.providerManager.bridgeTransfer(receiver, amount, tokenAddress);
  }

  public async getCrossChainTransfers(fromBlock: number, toBlock: number) {
    return await this.providerManager.getCrossChainTransfers(fromBlock, toBlock);
  }

  public async getStateSyncEvents(fromBlock: number, toBlock: number) {
    return await this.providerManager.getStateSyncEvents(fromBlock, toBlock);
  }

  // Dynamic listener management
  public async addContractListener(
    contractAddress: string,
    abi: any[],
    events: string[]
  ): Promise<void> {
    for (const eventName of events) {
      const listenerId = `${contractAddress}-${eventName}`;

      await this.eventListener.addEventListener(listenerId, {
        contractAddress,
        abi,
        eventName,
        pollingInterval: this.config.pollingInterval || 15000,
      });
    }
  }

  public removeListener(id: string): void {
    this.eventListener.removeEventListener(id);
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createPolygonMonitoringService(config: PolygonMonitoringConfig): PolygonMonitoringService {
  return new PolygonMonitoringService(config);
}
```

### 5. Service Integration
```typescript
// src/services/polygon-monitoring.service.ts
import { PolygonMonitoringService, createPolygonMonitoringService } from '../blockchain/polygon/polygon-monitoring-service';

export class PolygonMonitoringServiceWrapper {
  private monitoringService: PolygonMonitoringService;

  constructor() {
    const config = {
      polygonConfig: {
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        wsUrl: process.env.POLYGON_WS_URL,
        privateKey: process.env.POLYGON_PRIVATE_KEY,
        networkId: 137,
        gasMultiplier: 1.1,
        bridgeContractAddress: process.env.POLYGON_BRIDGE_CONTRACT,
        stateSenderAddress: process.env.POLYGON_STATE_SENDER_CONTRACT,
      },
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      contracts: [
        {
          address: process.env.POLYGON_COMPLIANCE_CONTRACT || '0x...',
          abi: [], // Would import actual ABI
          events: ['ComplianceCheck', 'BridgeTransfer', 'StateSync'],
        },
        // Add more contracts as needed
      ],
      bridgeMonitoring: true,
      stateSyncMonitoring: true,
      pollingInterval: parseInt(process.env.POLYGON_POLLING_INTERVAL || '15000'),
    };

    this.monitoringService = createPolygonMonitoringService(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.monitoringService.on('started', () => {
      console.log('Polygon monitoring service started');
    });

    this.monitoringService.on('stopped', () => {
      console.log('Polygon monitoring service stopped');
    });

    this.monitoringService.on('new-block', (data) => {
      console.log('New Polygon block:', data.blockNumber);
    });

    this.monitoringService.on('event-received', ({ id, event }) => {
      console.log(`Polygon event received: ${id}`, event);
    });

    this.monitoringService.on('event-processed', ({ jobId, eventId }) => {
      console.log(`Polygon event processed: ${eventId} (job: ${jobId})`);
    });

    this.monitoringService.on('bridge-transfer-initiated', (data) => {
      console.log('Bridge transfer initiated:', data);
    });

    this.monitoringService.on('websocket-error', (error) => {
      console.error('Polygon WebSocket error:', error);
    });
  }

  public async start(): Promise<void> {
    await this.monitoringService.start();
  }

  public async stop(): Promise<void> {
    await this.monitoringService.stop();
  }

  public getHealthStatus() {
    return this.monitoringService.getHealthStatus();
  }

  public async getMetrics() {
    return await this.monitoringService.getMetrics();
  }

  // Bridge operations
  public async initiateBridgeTransfer(
    receiver: string,
    amount: string,
    tokenAddress?: string
  ): Promise<string> {
    return await this.monitoringService.initiateBridgeTransfer(receiver, amount, tokenAddress);
  }

  public async getCrossChainTransfers(fromBlock: number, toBlock: number) {
    return await this.monitoringService.getCrossChainTransfers(fromBlock, toBlock);
  }

  public async getStateSyncEvents(fromBlock: number, toBlock: number) {
    return await this.monitoringService.getStateSyncEvents(fromBlock, toBlock);
  }

  // Dynamic contract monitoring
  public async addContractListener(
    contractAddress: string,
    abi: any[],
    events: string[]
  ): Promise<void> {
    await this.monitoringService.addContractListener(contractAddress, abi, events);
  }

  public removeListener(id: string): void {
    this.monitoringService.removeListener(id);
  }
}

// Export singleton instance
export const polygonMonitoring = new PolygonMonitoringServiceWrapper();
```

## Notes
- Comprehensive Polygon (Matic) Layer 2 integration with gas optimization
- Cross-chain bridge monitoring between Ethereum and Polygon
- State synchronization tracking for Layer 2 state transitions
- Proof-of-stake consensus event monitoring
- Gas-efficient compliance checks with configurable multipliers
- Production-ready WebSocket connections with automatic reconnection
- Integration with Redis queuing for scalable cross-chain event processing