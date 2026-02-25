# Day 5: Subgraph Support

## Objective
Implement comprehensive The Graph protocol integration with subgraph indexing, GraphQL queries, and decentralized data compliance monitoring for efficient blockchain data retrieval and analysis.

## Implementation Steps

1. **Set up Graph protocol infrastructure**
   - Configure subgraph endpoints and authentication
   - Implement GraphQL client with query optimization
   - Set up decentralized subgraph monitoring

2. **Create subgraph event indexing**
   - Build entity-based data indexing for compliance events
   - Implement real-time subgraph updates via GraphQL subscriptions
   - Add support for cross-chain subgraph queries

3. **Implement decentralized compliance features**
   - Monitor subgraph data integrity and curation
   - Track indexing rewards and delegation
   - Implement query result validation and compliance

4. **Add Graph protocol integrations**
   - Integrate with The Graph's hosted service and decentralized network
   - Implement subgraph deployment and management
   - Add support for assemblyscript and wasm-based subgraphs

## Code Snippets

### 1. Graph Client Manager
```typescript
// src/blockchain/graph/graph-client-manager.ts
import { ApolloClient, InMemoryCache, HttpLink, split, from } from '@apollo/client/core';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { EventEmitter } from 'events';
import fetch from 'cross-fetch';

export interface GraphConfig {
  httpEndpoint: string;
  wsEndpoint?: string;
  apiKey?: string;
  subgraphId?: string;
  network?: string;
  timeout?: number;
  retries?: number;
}

export interface SubgraphInfo {
  id: string;
  displayName: string;
  description?: string;
  image?: string;
  createdAt: number;
  updatedAt: number;
  currentVersion?: string;
  versions: SubgraphVersion[];
  network: string;
}

export interface SubgraphVersion {
  id: string;
  version: string;
  createdAt: number;
  deployment: {
    id: string;
    manifest: string;
    network: string;
    latestEthereumBlockNumber?: number;
    totalEthereumBlocksCount?: number;
    synced: boolean;
  };
}

export class GraphClientManager extends EventEmitter {
  private httpClient: ApolloClient<any>;
  private wsClient?: ApolloClient<any>;
  private subgraphInfo: Map<string, SubgraphInfo> = new Map();

  constructor(private config: GraphConfig) {
    super();
    this.initializeClients();
  }

  private initializeClients() {
    // Error handling link
    const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
      if (graphQLErrors) {
        graphQLErrors.forEach(({ message, locations, path }) => {
          console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
          this.emit('graphql-error', { message, locations, path, operation: operation.operationName });
        });
      }

      if (networkError) {
        console.error(`[Network error]: ${networkError}`);
        this.emit('network-error', { error: networkError, operation: operation.operationName });
      }
    });

    // Authentication link
    const authLink = setContext((_, { headers }) => {
      const token = this.config.apiKey;
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : '',
        },
      };
    });

    // HTTP link
    const httpLink = new HttpLink({
      uri: this.config.httpEndpoint,
      fetch,
      fetchOptions: {
        timeout: this.config.timeout || 30000,
      },
    });

    // Create HTTP client
    this.httpClient = new ApolloClient({
      link: from([errorLink, authLink, httpLink]),
      cache: new InMemoryCache(),
      defaultOptions: {
        query: {
          fetchPolicy: 'network-only',
          errorPolicy: 'all',
        },
        mutate: {
          errorPolicy: 'all',
        },
      },
    });

    // WebSocket client for subscriptions (if WS endpoint provided)
    if (this.config.wsEndpoint) {
      const wsLink = new WebSocketLink({
        uri: this.config.wsEndpoint,
        options: {
          reconnect: true,
          connectionParams: {
            authorization: this.config.apiKey ? `Bearer ${this.config.apiKey}` : '',
          },
        },
      });

      const splitLink = split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        httpLink,
      );

      this.wsClient = new ApolloClient({
        link: from([errorLink, authLink, splitLink]),
        cache: new InMemoryCache(),
      });
    }
  }

  public getHttpClient(): ApolloClient<any> {
    return this.httpClient;
  }

  public getWsClient(): ApolloClient<any> | undefined {
    return this.wsClient;
  }

  public async query(query: any, variables?: any): Promise<any> {
    try {
      const result = await this.httpClient.query({
        query,
        variables,
        fetchPolicy: 'network-only',
      });

      if (result.errors) {
        this.emit('query-errors', { errors: result.errors, query: query.loc?.source.body });
      }

      return result.data;
    } catch (error) {
      this.emit('query-error', { error: error.message, query: query.loc?.source.body });
      throw error;
    }
  }

  public async mutate(mutation: any, variables?: any): Promise<any> {
    try {
      const result = await this.httpClient.mutate({
        mutation,
        variables,
      });

      if (result.errors) {
        this.emit('mutation-errors', { errors: result.errors, mutation: mutation.loc?.source.body });
      }

      return result.data;
    } catch (error) {
      this.emit('mutation-error', { error: error.message, mutation: mutation.loc?.source.body });
      throw error;
    }
  }

  public subscribe(subscription: any, variables?: any): ZenObservable.Subscription {
    if (!this.wsClient) {
      throw new Error('WebSocket client not configured');
    }

    return this.wsClient.subscribe({
      query: subscription,
      variables,
    }).subscribe({
      next: (result) => {
        if (result.errors) {
          this.emit('subscription-errors', { errors: result.errors });
        } else {
          this.emit('subscription-data', result.data);
        }
      },
      error: (error) => {
        this.emit('subscription-error', error);
      },
      complete: () => {
        this.emit('subscription-complete');
      },
    });
  }

  public async getSubgraphInfo(subgraphId?: string): Promise<SubgraphInfo | null> {
    const id = subgraphId || this.config.subgraphId;
    if (!id) {
      throw new Error('Subgraph ID not provided');
    }

    // Check cache first
    if (this.subgraphInfo.has(id)) {
      return this.subgraphInfo.get(id)!;
    }

    try {
      const query = `
        query GetSubgraph($id: ID!) {
          subgraph(id: $id) {
            id
            displayName
            description
            image
            createdAt
            updatedAt
            currentVersion
            versions {
              id
              version
              createdAt
              deployment {
                id
                manifest
                network
                latestEthereumBlockNumber
                totalEthereumBlocksCount
                synced
              }
            }
            network
          }
        }
      `;

      const data = await this.query(query, { id });

      if (data.subgraph) {
        this.subgraphInfo.set(id, data.subgraph);
        return data.subgraph;
      }

      return null;
    } catch (error) {
      this.emit('error', { operation: 'getSubgraphInfo', error: error.message });
      throw error;
    }
  }

  public async getIndexingStatus(subgraphId?: string): Promise<any> {
    const id = subgraphId || this.config.subgraphId;
    if (!id) {
      throw new Error('Subgraph ID not provided');
    }

    try {
      const query = `
        query GetIndexingStatus($id: ID!) {
          subgraph(id: $id) {
            currentVersion
            versions {
              version
              deployment {
                id
                synced
                latestEthereumBlockNumber
                totalEthereumBlocksCount
                entityCount
                fatalError {
                  message
                  block {
                    number
                    hash
                  }
                }
              }
            }
          }
        }
      `;

      const data = await this.query(query, { id });
      return data.subgraph;
    } catch (error) {
      this.emit('error', { operation: 'getIndexingStatus', error: error.message });
      throw error;
    }
  }

  public async getEntityCount(entityName: string, subgraphId?: string): Promise<number> {
    const id = subgraphId || this.config.subgraphId;
    if (!id) {
      throw new Error('Subgraph ID not provided');
    }

    try {
      const query = `
        query GetEntityCount($id: ID!) {
          subgraph(id: $id) {
            currentVersion
            versions {
              deployment {
                entityCount
              }
            }
          }
        }
      `;

      const data = await this.query(query, { id });
      return data.subgraph?.versions?.[0]?.deployment?.entityCount || 0;
    } catch (error) {
      this.emit('error', { operation: 'getEntityCount', error: error.message });
      throw error;
    }
  }

  public async getSubgraphEntities(
    entityName: string,
    first: number = 100,
    skip: number = 0,
    orderBy?: string,
    orderDirection: 'asc' | 'desc' = 'desc',
    where?: any
  ): Promise<any[]> {
    try {
      const query = `
        query GetEntities(
          $first: Int!,
          $skip: Int,
          $orderBy: String,
          $orderDirection: String,
          $where: ${entityName}_filter
        ) {
          ${entityName}s(
            first: $first,
            skip: $skip,
            orderBy: $orderBy,
            orderDirection: $orderDirection,
            where: $where
          ) {
            id
            # Add other fields based on entity schema
          }
        }
      `;

      const variables = {
        first,
        skip,
        orderBy,
        orderDirection,
        where,
      };

      const data = await this.query(query, variables);
      return data[`${entityName}s`] || [];
    } catch (error) {
      this.emit('error', { operation: 'getSubgraphEntities', error: error.message });
      throw error;
    }
  }

  public async getSubgraphHealth(): Promise<{
    isHealthy: boolean;
    indexingStatus: any;
    lastBlock: number;
    entityCount: number;
  }> {
    try {
      const indexingStatus = await this.getIndexingStatus();
      const entityCount = await this.getEntityCount('ComplianceEvent'); // Example entity

      const currentVersion = indexingStatus?.versions?.[0];
      const deployment = currentVersion?.deployment;

      return {
        isHealthy: deployment?.synced && !deployment?.fatalError,
        indexingStatus,
        lastBlock: deployment?.latestEthereumBlockNumber || 0,
        entityCount,
      };
    } catch (error) {
      this.emit('error', { operation: 'getSubgraphHealth', error: error.message });
      return {
        isHealthy: false,
        indexingStatus: null,
        lastBlock: 0,
        entityCount: 0,
      };
    }
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createGraphClientManager(config: GraphConfig): GraphClientManager {
  return new GraphClientManager(config);
}
```

### 2. Subgraph Event Monitor
```typescript
// src/blockchain/graph/subgraph-event-monitor.ts
import { GraphClientManager } from './graph-client-manager';
import { gql } from '@apollo/client/core';
import { EventEmitter } from 'events';

export interface SubgraphEventConfig {
  entityName: string;
  subscriptionQuery?: any;
  pollingQuery?: any;
  pollingInterval?: number;
  filter?: any;
  transformFunction?: (data: any) => any;
}

export interface SubgraphProcessedEvent {
  entityName: string;
  entityId: string;
  eventType: 'created' | 'updated' | 'deleted';
  data: any;
  blockNumber: number;
  timestamp: number;
  transactionHash?: string;
  raw: any;
}

export class SubgraphEventMonitor extends EventEmitter {
  private subscriptions: Map<string, ZenObservable.Subscription> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Map<string, SubgraphEventConfig> = new Map();
  private lastProcessedIds: Map<string, Set<string>> = new Map();
  private isMonitoring = false;

  constructor(private clientManager: GraphClientManager) {
    super();
  }

  public async addEventMonitor(id: string, config: SubgraphEventConfig): Promise<void> {
    if (this.listeners.has(id)) {
      throw new Error(`Monitor with id ${id} already exists`);
    }

    this.listeners.set(id, config);
    this.lastProcessedIds.set(id, new Set());

    if (this.isMonitoring) {
      await this.startMonitoringEvents(id);
    }
  }

  public removeEventMonitor(id: string): void {
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(id);
    }

    const interval = this.pollingIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(id);
    }

    this.listeners.delete(id);
    this.lastProcessedIds.delete(id);
  }

  public async startMonitoring(): Promise<void> {
    this.isMonitoring = true;

    for (const [id] of this.listeners) {
      await this.startMonitoringEvents(id);
    }
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;

    for (const [id, subscription] of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();

    for (const [id, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
  }

  private async startMonitoringEvents(id: string): Promise<void> {
    const config = this.listeners.get(id);
    if (!config) return;

    // Try real-time subscription first
    if (config.subscriptionQuery && this.clientManager.getWsClient()) {
      try {
        await this.setupSubscription(id, config);
      } catch (error) {
        this.emit('subscription-failed', { id, error: error.message });
        // Fall back to polling
        this.setupPolling(id, config);
      }
    } else {
      // Use polling
      this.setupPolling(id, config);
    }
  }

  private async setupSubscription(id: string, config: SubgraphEventConfig): Promise<void> {
    const subscription = this.clientManager.subscribe(config.subscriptionQuery);

    this.subscriptions.set(id, subscription);

    // The subscription events are handled by the client manager
    // We listen for the events it emits
    const subscriptionHandler = (data: any) => {
      this.handleSubscriptionData(id, data);
    };

    this.clientManager.on('subscription-data', subscriptionHandler);

    // Store handler for cleanup
    (this as any)[`handler_${id}`] = subscriptionHandler;
  }

  private setupPolling(id: string, config: SubgraphEventConfig): void {
    const pollingInterval = config.pollingInterval || 30000;

    const interval = setInterval(async () => {
      try {
        await this.pollForEvents(id, config);
      } catch (error) {
        this.emit('polling-error', { id, error: error.message });
      }
    }, pollingInterval);

    this.pollingIntervals.set(id, interval);
  }

  private async pollForEvents(id: string, config: SubgraphEventConfig): Promise<void> {
    if (!config.pollingQuery) return;

    try {
      const data = await this.clientManager.query(config.pollingQuery, config.filter);

      if (data && data[config.entityName]) {
        const entities = data[config.entityName];

        for (const entity of entities) {
          const processedIds = this.lastProcessedIds.get(id)!;

          if (!processedIds.has(entity.id)) {
            const processedEvent = await this.transformEntityToEvent(config, entity, 'created');
            this.emit('event', { id, event: processedEvent });
            processedIds.add(entity.id);
          }
        }

        // Keep only recent IDs to prevent memory leaks
        if (processedIds.size > 1000) {
          const idsArray = Array.from(processedIds);
          const keepIds = idsArray.slice(-500);
          this.lastProcessedIds.set(id, new Set(keepIds));
        }
      }
    } catch (error) {
      this.emit('polling-query-error', { id, error: error.message });
    }
  }

  private handleSubscriptionData(id: string, data: any): void {
    const config = this.listeners.get(id);
    if (!config) return;

    // Process subscription data
    if (data[config.entityName]) {
      const entity = data[config.entityName];
      const processedEvent = this.transformEntityToEvent(config, entity, 'created');
      this.emit('event', { id, event: processedEvent });
    }
  }

  private async transformEntityToEvent(
    config: SubgraphEventConfig,
    entity: any,
    eventType: 'created' | 'updated' | 'deleted'
  ): Promise<SubgraphProcessedEvent> {
    let transformedData = entity;

    // Apply custom transformation if provided
    if (config.transformFunction) {
      transformedData = await config.transformFunction(entity);
    }

    return {
      entityName: config.entityName,
      entityId: entity.id,
      eventType,
      data: transformedData,
      blockNumber: entity.blockNumber || 0,
      timestamp: entity.timestamp || Date.now(),
      transactionHash: entity.transactionHash,
      raw: entity,
    };
  }

  public getActiveMonitors(): string[] {
    return Array.from(this.listeners.keys());
  }

  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  public getPollingCount(): number {
    return this.pollingIntervals.size;
  }

  public async getMonitorStats(id: string): Promise<{
    processedEvents: number;
    lastPollTime?: number;
    subscriptionActive: boolean;
  }> {
    const processedIds = this.lastProcessedIds.get(id);
    const subscription = this.subscriptions.get(id);

    return {
      processedEvents: processedIds?.size || 0,
      subscriptionActive: !!subscription,
    };
  }
}
```

### 3. Subgraph Compliance Processor
```typescript
// src/blockchain/graph/subgraph-compliance-processor.ts
import { GraphClientManager } from './graph-client-manager';
import { SubgraphEventMonitor, SubgraphProcessedEvent } from './subgraph-event-monitor';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { gql } from '@apollo/client/core';

export interface SubgraphComplianceEvent {
  id: string;
  entityName: string;
  entityId: string;
  type: 'entity_created' | 'entity_updated' | 'entity_deleted' | 'query_result';
  subgraphId: string;
  blockNumber: number;
  timestamp: number;
  transactionHash?: string;
  processed: boolean;
  riskScore?: number;
  complianceFlags?: string[];
  entityData: any;
  queryMetadata?: {
    queryHash: string;
    responseTime: number;
    dataIntegrity: boolean;
  };
}

export class SubgraphComplianceProcessor {
  private eventQueue: Queue;
  private redis: Redis;
  private queryCache: Map<string, { data: any; timestamp: number; hash: string }> = new Map();

  constructor(
    private eventMonitor: SubgraphEventMonitor,
    private clientManager: GraphClientManager,
    private subgraphId: string,
    redisUrl: string
  ) {
    this.redis = new Redis(redisUrl);
    this.eventQueue = new Queue('subgraph-compliance-events', {
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
    this.eventMonitor.on('event', async ({ id, event }) => {
      await this.processIncomingEvent(id, event);
    });

    this.eventMonitor.on('polling-error', ({ id, error }) => {
      console.error(`Subgraph monitor polling error for ${id}:`, error);
    });

    this.eventMonitor.on('subscription-failed', ({ id, error }) => {
      console.error(`Subgraph subscription failed for ${id}:`, error);
    });
  }

  private async processIncomingEvent(
    monitorId: string,
    event: SubgraphProcessedEvent
  ): Promise<void> {
    try {
      const complianceEvent = await this.transformToComplianceEvent(event);

      // Add to processing queue with priority
      await this.eventQueue.add(
        'process-subgraph-compliance-event',
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
      console.error('Failed to process subgraph incoming event:', error);
    }
  }

  private async transformToComplianceEvent(event: SubgraphProcessedEvent): Promise<SubgraphComplianceEvent> {
    const complianceEvent: SubgraphComplianceEvent = {
      id: `${event.entityId}-${event.timestamp}`,
      entityName: event.entityName,
      entityId: event.entityId,
      type: `entity_${event.eventType}` as any,
      subgraphId: this.subgraphId,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp,
      transactionHash: event.transactionHash,
      processed: false,
      entityData: event.data,
    };

    return complianceEvent;
  }

  private calculateEventPriority(event: SubgraphComplianceEvent): number {
    let priority = 1;

    // High-value entities get higher priority
    if (event.entityData?.value) {
      const value = parseFloat(event.entityData.value);
      if (value > 1000000) priority += 3;
      else if (value > 100000) priority += 2;
    }

    // Recent events get higher priority
    const age = Date.now() - event.timestamp;
    if (age < 300000) priority += 1; // Less than 5 minutes old

    return priority;
  }

  private async cacheComplianceEvent(event: SubgraphComplianceEvent): Promise<void> {
    const key = `subgraph-compliance-event:${event.id}`;
    const data = JSON.stringify(event);

    // Cache for 24 hours
    await this.redis.setex(key, 86400, data);
  }

  private setupQueueProcessor(): void {
    this.eventQueue.process('process-subgraph-compliance-event', async (job) => {
      const event: SubgraphComplianceEvent = job.data;

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

        // Handle entity-specific actions
        await this.handleEntityCompliance(event, complianceResult);

        return { success: true, eventId: event.id };

      } catch (error) {
        console.error(`Failed to process subgraph compliance event ${event.id}:`, error);
        throw error;
      }
    });
  }

  private async performComplianceChecks(event: SubgraphComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
    requiresAlert: boolean;
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Data integrity checks
    const integrityCheck = await this.checkDataIntegrity(event);
    riskScore += integrityCheck.riskScore;
    flags.push(...integrityCheck.flags);

    // Entity validation
    const validationCheck = await this.validateEntityData(event);
    riskScore += validationCheck.riskScore;
    flags.push(...validationCheck.flags);

    // Temporal consistency checks
    const temporalCheck = await this.checkTemporalConsistency(event);
    riskScore += temporalCheck.riskScore;
    flags.push(...temporalCheck.flags);

    // Cross-reference checks
    const crossRefCheck = await this.checkCrossReferences(event);
    riskScore += crossRefCheck.riskScore;
    flags.push(...crossRefCheck.flags);

    const requiresAlert = riskScore >= 70 || flags.includes('data_integrity_breach');

    return { riskScore, flags, requiresAlert };
  }

  private async checkDataIntegrity(event: SubgraphComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Check for required fields
    const requiredFields = ['id', 'timestamp'];
    for (const field of requiredFields) {
      if (!event.entityData[field]) {
        flags.push(`missing_required_field_${field}`);
        riskScore += 20;
      }
    }

    // Check data consistency
    if (event.entityData.timestamp && event.timestamp) {
      const timeDiff = Math.abs(event.entityData.timestamp - event.timestamp);
      if (timeDiff > 300000) { // 5 minutes
        flags.push('timestamp_inconsistency');
        riskScore += 15;
      }
    }

    // Check for suspicious data patterns
    if (event.entityData.value) {
      const value = parseFloat(event.entityData.value);
      if (value < 0) {
        flags.push('negative_value');
        riskScore += 50;
      }
      if (value > 10000000) { // 10M threshold
        flags.push('extremely_high_value');
        riskScore += 30;
      }
    }

    return { riskScore, flags };
  }

  private async validateEntityData(event: SubgraphComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Entity-specific validation based on entity name
    switch (event.entityName) {
      case 'ComplianceEvent':
        riskScore += await this.validateComplianceEvent(event);
        break;
      case 'Transaction':
        riskScore += await this.validateTransaction(event);
        break;
      case 'Account':
        riskScore += await this.validateAccount(event);
        break;
      default:
        flags.push('unknown_entity_type');
        riskScore += 10;
    }

    return { riskScore, flags };
  }

  private async validateComplianceEvent(event: SubgraphComplianceEvent): Promise<number> {
    let riskScore = 0;

    // Validate compliance event structure
    if (!event.entityData.riskScore || event.entityData.riskScore < 0 || event.entityData.riskScore > 100) {
      riskScore += 25;
    }

    return riskScore;
  }

  private async validateTransaction(event: SubgraphComplianceEvent): Promise<number> {
    let riskScore = 0;

    // Validate transaction structure
    if (!event.entityData.from || !event.entityData.to) {
      riskScore += 30;
    }

    if (event.entityData.from === event.entityData.to) {
      riskScore += 40; // Self-transfers might be suspicious
    }

    return riskScore;
  }

  private async validateAccount(event: SubgraphComplianceEvent): Promise<number> {
    let riskScore = 0;

    // Validate account structure
    if (!event.entityData.address) {
      riskScore += 35;
    }

    return riskScore;
  }

  private async checkTemporalConsistency(event: SubgraphComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Check if event timestamp is reasonable
    const now = Date.now();
    const eventTime = event.timestamp;

    if (eventTime > now + 300000) { // 5 minutes in future
      flags.push('future_timestamp');
      riskScore += 40;
    }

    if (eventTime < now - 31536000000) { // More than 1 year ago
      flags.push('ancient_timestamp');
      riskScore += 20;
    }

    return { riskScore, flags };
  }

  private async checkCrossReferences(event: SubgraphComplianceEvent): Promise<{
    riskScore: number;
    flags: string[];
  }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Check references to other entities
    if (event.entityData.transactionHash) {
      const txExists = await this.checkTransactionExists(event.entityData.transactionHash);
      if (!txExists) {
        flags.push('invalid_transaction_reference');
        riskScore += 25;
      }
    }

    if (event.entityData.account) {
      const accountExists = await this.checkAccountExists(event.entityData.account);
      if (!accountExists) {
        flags.push('invalid_account_reference');
        riskScore += 20;
      }
    }

    return { riskScore, flags };
  }

  private async checkTransactionExists(txHash: string): Promise<boolean> {
    // Query subgraph for transaction existence
    try {
      const query = gql`
        query CheckTransaction($hash: ID!) {
          transaction(id: $hash) {
            id
          }
        }
      `;

      const data = await this.clientManager.query(query, { hash: txHash });
      return !!data.transaction;
    } catch (error) {
      return false;
    }
  }

  private async checkAccountExists(accountAddress: string): Promise<boolean> {
    // Query subgraph for account existence
    try {
      const query = gql`
        query CheckAccount($address: ID!) {
          account(id: $address) {
            id
          }
        }
      `;

      const data = await this.clientManager.query(query, { address: accountAddress });
      return !!data.account;
    } catch (error) {
      return false;
    }
  }

  private async storeProcessedEvent(event: SubgraphComplianceEvent): Promise<void> {
    // Store in database
    const query = `
      INSERT INTO subgraph_compliance_events (
        id, entity_name, entity_id, type, subgraph_id,
        block_number, timestamp, transaction_hash, risk_score,
        compliance_flags, entity_data, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO UPDATE SET
        risk_score = EXCLUDED.risk_score,
        compliance_flags = EXCLUDED.compliance_flags,
        processed_at = NOW()
    `;

    const values = [
      event.id,
      event.entityName,
      event.entityId,
      event.type,
      event.subgraphId,
      event.blockNumber,
      new Date(event.timestamp * 1000),
      event.transactionHash,
      event.riskScore,
      JSON.stringify(event.complianceFlags),
      JSON.stringify(event.entityData),
    ];

    // Execute query (would use actual database connection)
    console.log('Storing processed subgraph event:', event.id);
  }

  private async triggerComplianceAlert(
    event: SubgraphComplianceEvent,
    complianceResult: any
  ): Promise<void> {
    // Send alert
    console.log('Triggering subgraph compliance alert for event:', event.id, complianceResult);
  }

  private async handleEntityCompliance(
    event: SubgraphComplianceEvent,
    complianceResult: any
  ): Promise<void> {
    // Handle entity-specific compliance actions
    if (complianceResult.flags.includes('data_integrity_breach')) {
      await this.logDataIntegrityBreach(event);
    }

    if (complianceResult.flags.includes('invalid_transaction_reference')) {
      await this.logInvalidReference(event);
    }
  }

  private async logDataIntegrityBreach(event: SubgraphComplianceEvent): Promise<void> {
    // Log data integrity breach
    console.log('Data integrity breach detected:', event.id);
  }

  private async logInvalidReference(event: SubgraphComplianceEvent): Promise<void> {
    // Log invalid reference
    console.log('Invalid reference detected:', event.id);
  }

  public async executeComplianceQuery(
    query: any,
    variables?: any
  ): Promise<{
    data: any;
    compliance: {
      integrityScore: number;
      flags: string[];
      responseTime: number;
    };
  }> {
    const startTime = Date.now();

    try {
      const data = await this.clientManager.query(query, variables);
      const responseTime = Date.now() - startTime;

      // Perform query result compliance checks
      const compliance = await this.checkQueryCompliance(data, responseTime);

      return { data, compliance };
    } catch (error) {
      throw error;
    }
  }

  private async checkQueryCompliance(data: any, responseTime: number): Promise<{
    integrityScore: number;
    flags: string[];
    responseTime: number;
  }> {
    let integrityScore = 100;
    const flags: string[] = [];

    // Check response time
    if (responseTime > 30000) { // 30 seconds
      flags.push('slow_query_response');
      integrityScore -= 20;
    }

    // Check data consistency
    if (!data || Object.keys(data).length === 0) {
      flags.push('empty_query_result');
      integrityScore -= 50;
    }

    // Check for error indicators in data
    if (data.errors || data.error) {
      flags.push('query_errors_present');
      integrityScore -= 30;
    }

    return { integrityScore, flags, responseTime };
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

### 4. Subgraph Monitoring Service
```typescript
// src/blockchain/graph/subgraph-monitoring-service.ts
import { GraphClientManager, createGraphClientManager } from './graph-client-manager';
import { SubgraphEventMonitor } from './subgraph-event-monitor';
import { SubgraphComplianceProcessor } from './subgraph-compliance-processor';
import { EventEmitter } from 'events';
import { gql } from '@apollo/client/core';

export interface SubgraphMonitoringConfig {
  graphConfig: {
    httpEndpoint: string;
    wsEndpoint?: string;
    apiKey?: string;
    subgraphId: string;
    network?: string;
  };
  redisUrl: string;
  entities: Array<{
    name: string;
    pollingInterval?: number;
    subscriptionEnabled?: boolean;
    filter?: any;
  }>;
  queryMonitoring?: boolean;
}

export class SubgraphMonitoringService extends EventEmitter {
  private clientManager: GraphClientManager;
  private eventMonitor: SubgraphEventMonitor;
  private complianceProcessor: SubgraphComplianceProcessor;
  private isRunning = false;

  constructor(private config: SubgraphMonitoringConfig) {
    super();
    this.clientManager = createGraphClientManager(config.graphConfig);
    this.eventMonitor = new SubgraphEventMonitor(this.clientManager);
    this.complianceProcessor = new SubgraphComplianceProcessor(
      this.eventMonitor,
      this.clientManager,
      config.graphConfig.subgraphId,
      config.redisUrl
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Forward events from components
    this.clientManager.on('query-error', (data) => this.emit('query-error', data));
    this.clientManager.on('network-error', (data) => this.emit('network-error', data));
    this.clientManager.on('subscription-data', (data) => this.emit('subscription-data', data));

    this.eventMonitor.on('event', (data) => this.emit('entity-event', data));
    this.eventMonitor.on('polling-error', (data) => this.emit('polling-error', data));
    this.eventMonitor.on('subscription-failed', (data) => this.emit('subscription-failed', data));

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
      // Setup entity monitors
      for (const entity of this.config.entities) {
        const monitorId = `entity-${entity.name}`;

        // Create polling query
        const pollingQuery = gql`
          query Get${entity.name}Entities($first: Int, $skip: Int, $where: ${entity.name}_filter) {
            ${entity.name.toLowerCase()}s(
              first: $first
              skip: $skip
              where: $where
              orderBy: timestamp
              orderDirection: desc
            ) {
              id
              timestamp
              blockNumber
              transactionHash
              # Add other common fields
            }
          }
        `;

        // Create subscription query if enabled
        let subscriptionQuery;
        if (entity.subscriptionEnabled) {
          subscriptionQuery = gql`
            subscription On${entity.name}Entity {
              ${entity.name.toLowerCase()}s(
                where: ${JSON.stringify(entity.filter || {})}
                orderBy: timestamp
                orderDirection: desc
              ) {
                id
                timestamp
                blockNumber
                transactionHash
              }
            }
          `;
        }

        await this.eventMonitor.addEventMonitor(monitorId, {
          entityName: entity.name.toLowerCase() + 's',
          pollingQuery,
          subscriptionQuery,
          pollingInterval: entity.pollingInterval || 30000,
          filter: {
            first: 10,
            skip: 0,
            where: entity.filter,
          },
        });
      }

      // Start monitoring
      await this.eventMonitor.startMonitoring();

      this.isRunning = true;
      this.emit('started');

    } catch (error) {
      this.emit('start-error', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.eventMonitor.stopMonitoring();
    await this.complianceProcessor.close();

    this.isRunning = false;
    this.emit('stopped');
  }

  public getHealthStatus() {
    return {
      isRunning: this.isRunning,
      subgraphHealth: this.clientManager.getSubgraphHealth(),
      activeMonitors: this.eventMonitor.getActiveMonitors(),
      subscriptionCount: this.eventMonitor.getSubscriptionCount(),
      pollingCount: this.eventMonitor.getPollingCount(),
      queueStats: this.complianceProcessor.getQueueStats(),
    };
  }

  public async getMetrics() {
    const queueStats = await this.complianceProcessor.getQueueStats();
    const subgraphHealth = await this.clientManager.getSubgraphHealth();

    return {
      uptime: this.isRunning ? Date.now() - (this as any).startTime : 0,
      eventsProcessed: queueStats.completed,
      eventsFailed: queueStats.failed,
      eventsQueued: queueStats.waiting + queueStats.active,
      activeMonitors: this.eventMonitor.getActiveMonitors().length,
      subgraphSynced: subgraphHealth.isHealthy,
      lastIndexedBlock: subgraphHealth.lastBlock,
      totalEntities: subgraphHealth.entityCount,
    };
  }

  // Query execution with compliance
  public async executeComplianceQuery(
    query: any,
    variables?: any
  ): Promise<{
    data: any;
    compliance: {
      integrityScore: number;
      flags: string[];
      responseTime: number;
    };
  }> {
    return await this.complianceProcessor.executeComplianceQuery(query, variables);
  }

  // Entity data retrieval
  public async getEntityData(
    entityName: string,
    id?: string,
    filter?: any,
    first: number = 100
  ): Promise<any[]> {
    if (id) {
      // Get single entity
      const query = gql`
        query GetEntity($id: ID!) {
          ${entityName}(id: $id) {
            id
            # Add fields based on schema
          }
        }
      `;

      const data = await this.clientManager.query(query, { id });
      return data[entityName] ? [data[entityName]] : [];
    } else {
      // Get multiple entities
      return await this.clientManager.getSubgraphEntities(
        entityName,
        first,
        0,
        'timestamp',
        'desc',
        filter
      );
    }
  }

  // Subgraph management
  public async getSubgraphInfo() {
    return await this.clientManager.getSubgraphInfo();
  }

  public async getIndexingStatus() {
    return await this.clientManager.getIndexingStatus();
  }

  // Dynamic entity monitoring
  public async addEntityMonitor(
    entityName: string,
    options: {
      pollingInterval?: number;
      subscriptionEnabled?: boolean;
      filter?: any;
    } = {}
  ): Promise<void> {
    const monitorId = `entity-${entityName}`;

    const pollingQuery = gql`
      query Get${entityName}Entities($first: Int, $skip: Int, $where: ${entityName}_filter) {
        ${entityName.toLowerCase()}s(
          first: $first
          skip: $skip
          where: $where
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          timestamp
          blockNumber
          transactionHash
        }
      }
    `;

    let subscriptionQuery;
    if (options.subscriptionEnabled) {
      subscriptionQuery = gql`
        subscription On${entityName}Entity {
          ${entityName.toLowerCase()}s(
            where: ${JSON.stringify(options.filter || {})}
            orderBy: timestamp
            orderDirection: desc
          ) {
            id
            timestamp
            blockNumber
            transactionHash
          }
        }
      `;
    }

    await this.eventMonitor.addEventMonitor(monitorId, {
      entityName: entityName.toLowerCase() + 's',
      pollingQuery,
      subscriptionQuery,
      pollingInterval: options.pollingInterval || 30000,
      filter: {
        first: 10,
        skip: 0,
        where: options.filter,
      },
    });
  }

  public removeEntityMonitor(entityName: string): void {
    const monitorId = `entity-${entityName}`;
    this.eventMonitor.removeEventMonitor(monitorId);
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createSubgraphMonitoringService(config: SubgraphMonitoringConfig): SubgraphMonitoringService {
  return new SubgraphMonitoringService(config);
}
```

### 5. Service Integration
```typescript
// src/services/subgraph-monitoring.service.ts
import { SubgraphMonitoringService, createSubgraphMonitoringService } from '../blockchain/graph/subgraph-monitoring-service';
import { gql } from '@apollo/client/core';

export class SubgraphMonitoringServiceWrapper {
  private monitoringService: SubgraphMonitoringService;

  constructor() {
    const config = {
      graphConfig: {
        httpEndpoint: process.env.GRAPH_HTTP_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/example/subgraph',
        wsEndpoint: process.env.GRAPH_WS_ENDPOINT,
        apiKey: process.env.GRAPH_API_KEY,
        subgraphId: process.env.SUBGRAPH_ID || 'example-subgraph',
        network: process.env.GRAPH_NETWORK || 'mainnet',
      },
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      entities: [
        {
          name: 'ComplianceEvent',
          pollingInterval: 30000,
          subscriptionEnabled: true,
        },
        {
          name: 'Transaction',
          pollingInterval: 15000,
          subscriptionEnabled: false,
        },
        {
          name: 'Account',
          pollingInterval: 60000,
          subscriptionEnabled: true,
        },
      ],
      queryMonitoring: true,
    };

    this.monitoringService = createSubgraphMonitoringService(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.monitoringService.on('started', () => {
      console.log('Subgraph monitoring service started');
    });

    this.monitoringService.on('stopped', () => {
      console.log('Subgraph monitoring service stopped');
    });

    this.monitoringService.on('entity-event', ({ id, event }) => {
      console.log(`Subgraph entity event: ${id}`, event);
    });

    this.monitoringService.on('event-processed', ({ jobId, eventId }) => {
      console.log(`Subgraph event processed: ${eventId} (job: ${jobId})`);
    });

    this.monitoringService.on('query-error', (data) => {
      console.error('Subgraph query error:', data);
    });

    this.monitoringService.on('subscription-data', (data) => {
      console.log('Subgraph subscription data:', data);
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

  // Query execution with compliance monitoring
  public async executeComplianceQuery(
    query: any,
    variables?: any
  ): Promise<{
    data: any;
    compliance: {
      integrityScore: number;
      flags: string[];
      responseTime: number;
    };
  }> {
    return await this.monitoringService.executeComplianceQuery(query, variables);
  }

  // Predefined compliance queries
  public async getHighRiskTransactions(
    minRiskScore: number = 70,
    limit: number = 100
  ): Promise<any[]> {
    const query = gql`
      query GetHighRiskTransactions($minRiskScore: Int!, $first: Int!) {
        complianceEvents(
          where: { riskScore_gte: $minRiskScore }
          first: $first
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          riskScore
          complianceFlags
          transactionHash
          timestamp
          entityData
        }
      }
    `;

    const result = await this.executeComplianceQuery(query, {
      minRiskScore,
      first: limit,
    });

    return result.data.complianceEvents || [];
  }

  public async getSanctionsViolations(
    limit: number = 50
  ): Promise<any[]> {
    const query = gql`
      query GetSanctionsViolations($first: Int!) {
        complianceEvents(
          where: { complianceFlags_contains: "sanctions_violation" }
          first: $first
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          complianceFlags
          transactionHash
          from
          to
          timestamp
          entityData
        }
      }
    `;

    const result = await this.executeComplianceQuery(query, { first: limit });
    return result.data.complianceEvents || [];
  }

  public async getEntityData(
    entityName: string,
    id?: string,
    filter?: any,
    first: number = 100
  ): Promise<any[]> {
    return await this.monitoringService.getEntityData(entityName, id, filter, first);
  }

  // Subgraph management
  public async getSubgraphInfo() {
    return await this.monitoringService.getSubgraphInfo();
  }

  public async getIndexingStatus() {
    return await this.monitoringService.getIndexingStatus();
  }

  // Dynamic entity monitoring
  public async addEntityMonitor(
    entityName: string,
    options: {
      pollingInterval?: number;
      subscriptionEnabled?: boolean;
      filter?: any;
    } = {}
  ): Promise<void> {
    await this.monitoringService.addEntityMonitor(entityName, options);
  }

  public removeEntityMonitor(entityName: string): void {
    this.monitoringService.removeEntityMonitor(entityName);
  }
}

// Export singleton instance
export const subgraphMonitoring = new SubgraphMonitoringServiceWrapper();
```

## Notes
- Comprehensive The Graph protocol integration with GraphQL queries and subscriptions
- Decentralized subgraph monitoring with data integrity validation
- Real-time entity event monitoring with polling and subscription fallbacks
- Query result compliance checking and response time monitoring
- Production-ready error handling and caching mechanisms
- Integration with Redis queuing for scalable subgraph event processing