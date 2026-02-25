# Day 2: Agent Communication Protocols

## Objective
Implement robust communication protocols for multi-agent systems, including message routing, protocol standardization, and secure inter-agent communication with encryption and authentication.

## Implementation Steps

1. **Define communication protocols**
   - Message formats and schemas
   - Protocol versioning
   - Error handling standards

2. **Implement secure messaging**
   - Message encryption
   - Authentication mechanisms
   - Integrity verification

3. **Create protocol handlers**
   - Request-response patterns
   - Streaming protocols
   - Event-driven messaging

4. **Add monitoring and logging**
   - Message tracing
   - Performance metrics
   - Error tracking

## Code Snippets

### 1. Protocol Definitions
```typescript
// src/agents/communication/protocols.ts
import { z } from 'zod';

// Protocol version management
export const PROTOCOL_VERSIONS = {
  V1: '1.0.0',
  V2: '2.0.0',
  LATEST: '2.0.0',
} as const;

export type ProtocolVersion = typeof PROTOCOL_VERSIONS[keyof typeof PROTOCOL_VERSIONS];

// Base message schema
export const BaseMessageSchema = z.object({
  id: z.string(),
  version: z.string(),
  timestamp: z.number(),
  from: z.string(),
  to: z.string(),
  type: z.enum(['request', 'response', 'notification', 'event', 'error']),
  correlationId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  ttl: z.number().optional(), // Time to live in seconds
  headers: z.record(z.string()).optional(),
  payload: z.any(),
});

export type BaseMessage = z.infer<typeof BaseMessageSchema>;

// Request message schema
export const RequestMessageSchema = BaseMessageSchema.extend({
  type: z.literal('request'),
  method: z.string(),
  params: z.record(z.any()).optional(),
  timeout: z.number().optional(),
});

export type RequestMessage = z.infer<typeof RequestMessageSchema>;

// Response message schema
export const ResponseMessageSchema = BaseMessageSchema.extend({
  type: z.literal('response'),
  status: z.enum(['success', 'error', 'partial']),
  result: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

// Notification message schema
export const NotificationMessageSchema = BaseMessageSchema.extend({
  type: z.literal('notification'),
  event: z.string(),
  data: z.any(),
});

export type NotificationMessage = z.infer<typeof NotificationMessageSchema>;

// Event message schema
export const EventMessageSchema = BaseMessageSchema.extend({
  type: z.literal('event'),
  eventType: z.string(),
  source: z.string(),
  data: z.any(),
  metadata: z.record(z.any()).optional(),
});

export type EventMessage = z.infer<typeof EventMessageSchema>;

// Error message schema
export const ErrorMessageSchema = BaseMessageSchema.extend({
  type: z.literal('error'),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    context: z.any().optional(),
  }),
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

// Union type for all messages
export type AgentMessage =
  | RequestMessage
  | ResponseMessage
  | NotificationMessage
  | EventMessage
  | ErrorMessage;

// Protocol capabilities
export interface ProtocolCapabilities {
  supportedVersions: ProtocolVersion[];
  supportedMessageTypes: AgentMessage['type'][];
  encryption: boolean;
  authentication: boolean;
  compression: boolean;
  maxMessageSize: number;
  rateLimit: {
    requestsPerSecond: number;
    burstLimit: number;
  };
}

// Protocol negotiation
export interface ProtocolNegotiation {
  version: ProtocolVersion;
  capabilities: ProtocolCapabilities;
  sessionId: string;
  encryptionKey?: string;
  authToken?: string;
}

// Message routing
export interface MessageRoute {
  from: string;
  to: string;
  via?: string[];
  priority: AgentMessage['priority'];
  routingStrategy: 'direct' | 'broadcast' | 'round-robin' | 'load-balance';
}

// Protocol errors
export class ProtocolError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export const PROTOCOL_ERRORS = {
  INVALID_VERSION: new ProtocolError('INVALID_VERSION', 'Unsupported protocol version', 400),
  INVALID_MESSAGE: new ProtocolError('INVALID_MESSAGE', 'Invalid message format', 400),
  UNAUTHORIZED: new ProtocolError('UNAUTHORIZED', 'Authentication required', 401),
  FORBIDDEN: new ProtocolError('FORBIDDEN', 'Access denied', 403),
  NOT_FOUND: new ProtocolError('NOT_FOUND', 'Agent not found', 404),
  TIMEOUT: new ProtocolError('TIMEOUT', 'Request timeout', 408),
  RATE_LIMITED: new ProtocolError('RATE_LIMITED', 'Rate limit exceeded', 429),
  INTERNAL_ERROR: new ProtocolError('INTERNAL_ERROR', 'Internal protocol error', 500),
} as const;

// Message validation
export function validateMessage(message: any): AgentMessage {
  try {
    return BaseMessageSchema.parse(message);
  } catch (error) {
    throw PROTOCOL_ERRORS.INVALID_MESSAGE;
  }
}

export function validateMessageType<T extends AgentMessage>(
  message: AgentMessage,
  schema: z.ZodSchema<T>
): T {
  try {
    return schema.parse(message);
  } catch (error) {
    throw PROTOCOL_ERRORS.INVALID_MESSAGE;
  }
}

// Protocol utilities
export class ProtocolUtils {
  static generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static isExpired(message: BaseMessage): boolean {
    if (!message.ttl) return false;
    const now = Date.now();
    const messageTime = message.timestamp;
    return (now - messageTime) > (message.ttl * 1000);
  }

  static getPriorityWeight(priority: AgentMessage['priority']): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[priority];
  }

  static shouldRetry(error: ProtocolError): boolean {
    const retryableCodes = ['TIMEOUT', 'INTERNAL_ERROR', 'RATE_LIMITED'];
    return retryableCodes.includes(error.code);
  }

  static getBackoffDelay(attempt: number, baseDelay: number = 1000): number {
    return baseDelay * Math.pow(2, attempt - 1);
  }
}
```

### 2. Secure Messaging Layer
```typescript
// src/agents/communication/secure-messaging.ts
import crypto from 'crypto';
import { AgentMessage, ProtocolNegotiation, ProtocolError, PROTOCOL_ERRORS } from './protocols';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export interface AuthConfig {
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  secretOrKey: string | Buffer;
  issuer: string;
  audience: string;
  expiresIn: string;
}

export class SecureMessagingLayer {
  private encryptionConfig: EncryptionConfig;
  private authConfig: AuthConfig;
  private sessionKeys: Map<string, Buffer> = new Map();

  constructor(encryptionConfig: EncryptionConfig, authConfig: AuthConfig) {
    this.encryptionConfig = encryptionConfig;
    this.authConfig = authConfig;
  }

  // Encryption methods
  public encryptMessage(message: AgentMessage, sessionId: string): string {
    try {
      const key = this.getSessionKey(sessionId);
      const iv = crypto.randomBytes(this.encryptionConfig.ivLength);

      const cipher = crypto.createCipher(this.encryptionConfig.algorithm, key);
      let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const payload = {
        iv: iv.toString('hex'),
        data: encrypted,
        sessionId,
      };

      return JSON.stringify(payload);
    } catch (error) {
      throw new ProtocolError('ENCRYPTION_FAILED', 'Failed to encrypt message', 500, error);
    }
  }

  public decryptMessage(encryptedPayload: string, sessionId: string): AgentMessage {
    try {
      const payload = JSON.parse(encryptedPayload);
      const key = this.getSessionKey(sessionId);

      const decipher = crypto.createDecipher(this.encryptionConfig.algorithm, key);
      let decrypted = decipher.update(payload.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new ProtocolError('DECRYPTION_FAILED', 'Failed to decrypt message', 500, error);
    }
  }

  // Authentication methods
  public generateAuthToken(agentId: string, permissions: string[]): string {
    try {
      const payload = {
        sub: agentId,
        permissions,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.parseExpiresIn(),
        iss: this.authConfig.issuer,
        aud: this.authConfig.audience,
      };

      const header = {
        alg: this.authConfig.algorithm,
        typ: 'JWT',
      };

      const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
      const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

      const signature = this.signToken(`${encodedHeader}.${encodedPayload}`);

      return `${encodedHeader}.${encodedPayload}.${signature}`;
    } catch (error) {
      throw new ProtocolError('AUTH_TOKEN_GENERATION_FAILED', 'Failed to generate auth token', 500, error);
    }
  }

  public verifyAuthToken(token: string): { agentId: string; permissions: string[] } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw PROTOCOL_ERRORS.UNAUTHORIZED;
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      const header = JSON.parse(this.base64UrlDecode(encodedHeader));
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

      // Verify signature
      const expectedSignature = this.signToken(`${encodedHeader}.${encodedPayload}`);
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        throw PROTOCOL_ERRORS.UNAUTHORIZED;
      }

      // Verify expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new ProtocolError('TOKEN_EXPIRED', 'Authentication token expired', 401);
      }

      // Verify issuer and audience
      if (payload.iss !== this.authConfig.issuer || payload.aud !== this.authConfig.audience) {
        throw PROTOCOL_ERRORS.UNAUTHORIZED;
      }

      return {
        agentId: payload.sub,
        permissions: payload.permissions || [],
      };
    } catch (error) {
      if (error instanceof ProtocolError) throw error;
      throw PROTOCOL_ERRORS.UNAUTHORIZED;
    }
  }

  // Session key management
  public generateSessionKey(sessionId: string): Buffer {
    const key = crypto.randomBytes(this.encryptionConfig.keyLength);
    this.sessionKeys.set(sessionId, key);
    return key;
  }

  public getSessionKey(sessionId: string): Buffer {
    const key = this.sessionKeys.get(sessionId);
    if (!key) {
      throw new ProtocolError('SESSION_NOT_FOUND', 'Session key not found', 404);
    }
    return key;
  }

  public removeSessionKey(sessionId: string): void {
    this.sessionKeys.delete(sessionId);
  }

  // Protocol negotiation
  public negotiateProtocol(
    requestedVersion: string,
    capabilities: any
  ): ProtocolNegotiation {
    const sessionId = this.generateSessionId();
    const sessionKey = this.generateSessionKey(sessionId);

    return {
      version: requestedVersion as any,
      capabilities,
      sessionId,
      encryptionKey: sessionKey.toString('hex'),
    };
  }

  // Message integrity
  public generateMessageHash(message: AgentMessage): string {
    const messageString = JSON.stringify({
      ...message,
      timestamp: message.timestamp, // Include timestamp for uniqueness
    });

    return crypto.createHash('sha256').update(messageString).digest('hex');
  }

  public verifyMessageIntegrity(message: AgentMessage, expectedHash: string): boolean {
    const actualHash = this.generateMessageHash(message);
    return crypto.timingSafeEqual(
      Buffer.from(actualHash),
      Buffer.from(expectedHash)
    );
  }

  // Utility methods
  private signToken(data: string): string {
    if (typeof this.authConfig.secretOrKey === 'string') {
      return crypto.createHmac(this.getAlgorithmHash(), this.authConfig.secretOrKey)
        .update(data)
        .digest('base64url');
    } else {
      // RSA signing would be implemented here
      throw new Error('RSA signing not implemented');
    }
  }

  private getAlgorithmHash(): string {
    const algMap: { [key: string]: string } = {
      HS256: 'sha256',
      HS384: 'sha384',
      HS512: 'sha512',
    };
    return algMap[this.authConfig.algorithm] || 'sha256';
  }

  private parseExpiresIn(): number {
    const match = this.authConfig.expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * multipliers[unit as keyof typeof multipliers];
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str).toString('base64url');
  }

  private base64UrlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString('utf8');
  }

  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export function createSecureMessagingLayer(
  encryptionConfig: EncryptionConfig,
  authConfig: AuthConfig
): SecureMessagingLayer {
  return new SecureMessagingLayer(encryptionConfig, authConfig);
}
```

### 3. Protocol Handler System
```typescript
// src/agents/communication/protocol-handler.ts
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import {
  AgentMessage,
  RequestMessage,
  ResponseMessage,
  NotificationMessage,
  EventMessage,
  ErrorMessage,
  ProtocolNegotiation,
  MessageRoute,
  ProtocolError,
  validateMessage,
  validateMessageType,
  RequestMessageSchema,
  ResponseMessageSchema,
  NotificationMessageSchema,
  EventMessageSchema,
  ErrorMessageSchema,
  ProtocolUtils,
} from './protocols';
import { SecureMessagingLayer } from './secure-messaging';

export interface ProtocolHandlerConfig {
  redisUrl: string;
  secureMessaging: SecureMessagingLayer;
  maxRetries: number;
  requestTimeout: number;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
}

export interface PendingRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
  retries: number;
}

export class ProtocolHandler extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private config: ProtocolHandlerConfig;
  private secureMessaging: SecureMessagingLayer;

  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHandlers: Map<string, (message: AgentMessage) => Promise<void>> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();

  private isRunning = false;

  constructor(config: ProtocolHandlerConfig) {
    super();
    this.config = config;
    this.redis = new Redis(config.redisUrl);
    this.subscriber = new Redis(config.redisUrl);
    this.secureMessaging = config.secureMessaging;

    this.setupRedisHandlers();
  }

  private setupRedisHandlers(): void {
    this.subscriber.on('message', async (channel, encryptedMessage) => {
      try {
        await this.handleIncomingMessage(channel, encryptedMessage);
      } catch (error) {
        this.emit('message-processing-error', { channel, error: error.message });
      }
    });

    this.redis.on('error', (error) => {
      this.emit('redis-error', error);
    });

    this.subscriber.on('error', (error) => {
      this.emit('redis-subscriber-error', error);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Clear all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Protocol handler shutting down'));
    }
    this.pendingRequests.clear();

    this.subscriber.disconnect();
    this.redis.disconnect();

    this.isRunning = false;
    this.emit('stopped');
  }

  // Message sending
  public async sendMessage(
    message: AgentMessage,
    route: MessageRoute,
    sessionId?: string
  ): Promise<void> {
    try {
      // Validate message
      validateMessage(message);

      // Check rate limits
      this.checkRateLimit(message.from);

      // Encrypt message if session provided
      let payloadToSend: string;
      if (sessionId) {
        payloadToSend = this.secureMessaging.encryptMessage(message, sessionId);
      } else {
        payloadToSend = JSON.stringify(message);
      }

      // Route message
      await this.routeMessage(message, route, payloadToSend);

      this.emit('message-sent', { messageId: message.id, to: message.to });

    } catch (error) {
      this.emit('message-send-error', { messageId: message.id, error: error.message });
      throw error;
    }
  }

  // Request-response pattern
  public async sendRequest(
    request: Omit<RequestMessage, 'id' | 'timestamp' | 'version'>,
    route: MessageRoute,
    sessionId?: string
  ): Promise<any> {
    const message: RequestMessage = {
      ...request,
      id: ProtocolUtils.generateMessageId(),
      timestamp: Date.now(),
      version: '2.0.0',
    };

    return new Promise(async (resolve, reject) => {
      const correlationId = message.correlationId || ProtocolUtils.generateCorrelationId();

      // Set up response handler
      const responseHandler = (response: ResponseMessage) => {
        if (response.correlationId === correlationId) {
          this.removeListener(`response-${correlationId}`, responseHandler);
          clearTimeout(timeoutHandle);

          if (response.status === 'success') {
            resolve(response.result);
          } else {
            reject(new ProtocolError(response.error!.code, response.error!.message));
          }
        }
      };

      this.on(`response-${correlationId}`, responseHandler);

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        this.removeListener(`response-${correlationId}`, responseHandler);
        reject(new ProtocolError('TIMEOUT', 'Request timeout'));
      }, request.timeout || this.config.requestTimeout);

      try {
        await this.sendMessage(message, route, sessionId);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.removeListener(`response-${correlationId}`, responseHandler);
        reject(error);
      }
    });
  }

  // Message handling
  public registerMessageHandler(
    messageType: AgentMessage['type'],
    handler: (message: AgentMessage) => Promise<void>
  ): void {
    this.messageHandlers.set(messageType, handler);
  }

  public unregisterMessageHandler(messageType: AgentMessage['type']): void {
    this.messageHandlers.delete(messageType);
  }

  // Protocol negotiation
  public async negotiateProtocol(
    agentId: string,
    requestedVersion: string,
    capabilities: any
  ): Promise<ProtocolNegotiation> {
    const negotiation = this.secureMessaging.negotiateProtocol(requestedVersion, capabilities);

    // Store negotiation in Redis
    await this.redis.setex(
      `protocol:negotiation:${agentId}`,
      3600, // 1 hour
      JSON.stringify(negotiation)
    );

    return negotiation;
  }

  public async getProtocolNegotiation(agentId: string): Promise<ProtocolNegotiation | null> {
    const data = await this.redis.get(`protocol:negotiation:${agentId}`);
    return data ? JSON.parse(data) : null;
  }

  // Message routing
  private async routeMessage(
    message: AgentMessage,
    route: MessageRoute,
    payload: string
  ): Promise<void> {
    switch (route.routingStrategy) {
      case 'direct':
        await this.sendDirect(message.to, payload);
        break;
      case 'broadcast':
        await this.sendBroadcast(payload);
        break;
      case 'round-robin':
        await this.sendRoundRobin(message.to, payload);
        break;
      case 'load-balance':
        await this.sendLoadBalanced(message.to, payload);
        break;
    }
  }

  private async sendDirect(agentId: string, payload: string): Promise<void> {
    const channel = `agent:${agentId}`;
    await this.redis.publish(channel, payload);
  }

  private async sendBroadcast(payload: string): Promise<void> {
    // Get all agent channels
    const pattern = 'agent:*';
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      await this.redis.publish(key, payload);
    }
  }

  private async sendRoundRobin(agentType: string, payload: string): Promise<void> {
    // Get agents of specific type
    const agents = await this.getAgentsByType(agentType);
    if (agents.length === 0) return;

    // Simple round-robin using timestamp
    const index = Date.now() % agents.length;
    const targetAgent = agents[index];

    await this.sendDirect(targetAgent, payload);
  }

  private async sendLoadBalanced(agentType: string, payload: string): Promise<void> {
    // Get agents with their load
    const agentsWithLoad = await this.getAgentsWithLoad(agentType);
    if (agentsWithLoad.length === 0) return;

    // Select agent with lowest load
    const targetAgent = agentsWithLoad.reduce((min, current) =>
      current.load < min.load ? current : min
    );

    await this.sendDirect(targetAgent.id, payload);
  }

  // Message processing
  private async handleIncomingMessage(channel: string, encryptedPayload: string): Promise<void> {
    try {
      const agentId = channel.replace('agent:', '');

      // Get protocol negotiation for decryption
      const negotiation = await this.getProtocolNegotiation(agentId);

      let message: AgentMessage;
      if (negotiation) {
        message = this.secureMessaging.decryptMessage(encryptedPayload, negotiation.sessionId);
      } else {
        message = JSON.parse(encryptedPayload);
      }

      // Validate message
      validateMessage(message);

      // Check if message is expired
      if (ProtocolUtils.isExpired(message)) {
        this.emit('message-expired', { messageId: message.id });
        return;
      }

      // Handle message based on type
      await this.processMessageByType(message);

    } catch (error) {
      this.emit('message-processing-error', { channel, encryptedPayload, error: error.message });
    }
  }

  private async processMessageByType(message: AgentMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.type);

    if (handler) {
      await handler(message);
    } else {
      // Default processing
      switch (message.type) {
        case 'request':
          await this.handleRequest(validateMessageType(message, RequestMessageSchema));
          break;
        case 'response':
          await this.handleResponse(validateMessageType(message, ResponseMessageSchema));
          break;
        case 'notification':
          await this.handleNotification(validateMessageType(message, NotificationMessageSchema));
          break;
        case 'event':
          await this.handleEvent(validateMessageType(message, EventMessageSchema));
          break;
        case 'error':
          await this.handleError(validateMessageType(message, ErrorMessageSchema));
          break;
      }
    }
  }

  private async handleRequest(request: RequestMessage): Promise<void> {
    // Default request handling - can be overridden
    this.emit('request-received', request);
  }

  private async handleResponse(response: ResponseMessage): Promise<void> {
    // Emit response event for waiting requests
    this.emit(`response-${response.correlationId}`, response);
  }

  private async handleNotification(notification: NotificationMessage): Promise<void> {
    this.emit('notification-received', notification);
  }

  private async handleEvent(event: EventMessage): Promise<void> {
    this.emit('event-received', event);
  }

  private async handleError(error: ErrorMessage): Promise<void> {
    this.emit('error-received', error);
  }

  // Rate limiting
  private checkRateLimit(agentId: string): void {
    const now = Date.now();
    const windowKey = `${agentId}:${Math.floor(now / this.config.rateLimitWindow)}`;

    const counter = this.rateLimitCounters.get(windowKey) || { count: 0, resetTime: now + this.config.rateLimitWindow };

    if (now > counter.resetTime) {
      counter.count = 0;
      counter.resetTime = now + this.config.rateLimitWindow;
    }

    counter.count++;
    this.rateLimitCounters.set(windowKey, counter);

    if (counter.count > this.config.rateLimitMaxRequests) {
      throw new ProtocolError('RATE_LIMITED', 'Rate limit exceeded', 429);
    }
  }

  // Utility methods
  private async getAgentsByType(agentType: string): Promise<string[]> {
    const pattern = `agent:info:*`;
    const keys = await this.redis.keys(pattern);
    const agents: string[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const info = JSON.parse(data);
        if (info.type === agentType) {
          agents.push(key.replace('agent:info:', ''));
        }
      }
    }

    return agents;
  }

  private async getAgentsWithLoad(agentType: string): Promise<Array<{ id: string; load: number }>> {
    const agents = await this.getAgentsByType(agentType);
    const agentsWithLoad: Array<{ id: string; load: number }> = [];

    for (const agentId of agents) {
      const statusKey = `agent:status:${agentId}`;
      const statusData = await this.redis.get(statusKey);

      let load = 0;
      if (statusData) {
        const status = JSON.parse(statusData);
        load = status.activeTasks || 0;
      }

      agentsWithLoad.push({ id: agentId, load });
    }

    return agentsWithLoad;
  }

  public getConnectionStatus(): {
    redisConnected: boolean;
    subscriberConnected: boolean;
    activeHandlers: number;
    pendingRequests: number;
  } {
    return {
      redisConnected: this.redis.status === 'ready',
      subscriberConnected: this.subscriber.status === 'ready',
      activeHandlers: this.messageHandlers.size,
      pendingRequests: this.pendingRequests.size,
    };
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createProtocolHandler(config: ProtocolHandlerConfig): ProtocolHandler {
  return new ProtocolHandler(config);
}
```

### 4. Message Tracing and Monitoring
```typescript
// src/agents/communication/message-tracing.ts
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { AgentMessage, MessageRoute } from './protocols';

export interface MessageTrace {
  traceId: string;
  messageId: string;
  from: string;
  to: string;
  route: MessageRoute;
  timestamp: number;
  status: 'sent' | 'received' | 'processed' | 'failed';
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TracingConfig {
  redisUrl: string;
  retentionPeriod: number; // in seconds
  samplingRate: number; // 0.0 to 1.0
  enableDetailedTracing: boolean;
}

export class MessageTracingService extends EventEmitter {
  private redis: Redis;
  private config: TracingConfig;
  private activeTraces: Map<string, MessageTrace> = new Map();

  constructor(config: TracingConfig) {
    super();
    this.config = config;
    this.redis = new Redis(config.redisUrl);

    this.redis.on('error', (error) => {
      this.emit('redis-error', error);
    });
  }

  public async startTrace(
    message: AgentMessage,
    route: MessageRoute
  ): Promise<string> {
    const traceId = this.generateTraceId();
    const shouldTrace = Math.random() < this.config.samplingRate;

    if (!shouldTrace) {
      return traceId; // Return ID but don't actually trace
    }

    const trace: MessageTrace = {
      traceId,
      messageId: message.id,
      from: message.from,
      to: message.to,
      route,
      timestamp: Date.now(),
      status: 'sent',
      metadata: {
        messageType: message.type,
        priority: message.priority,
        correlationId: message.correlationId,
      },
    };

    this.activeTraces.set(traceId, trace);
    await this.storeTrace(trace);

    this.emit('trace-started', trace);
    return traceId;
  }

  public async updateTrace(
    traceId: string,
    status: MessageTrace['status'],
    metadata?: Record<string, any>,
    error?: string
  ): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    trace.status = status;
    trace.duration = Date.now() - trace.timestamp;

    if (metadata) {
      trace.metadata = { ...trace.metadata, ...metadata };
    }

    if (error) {
      trace.error = error;
    }

    await this.storeTrace(trace);

    if (status === 'processed' || status === 'failed') {
      this.activeTraces.delete(traceId);
      this.emit('trace-completed', trace);
    } else {
      this.emit('trace-updated', trace);
    }
  }

  public async getTrace(traceId: string): Promise<MessageTrace | null> {
    // Check active traces first
    const activeTrace = this.activeTraces.get(traceId);
    if (activeTrace) return activeTrace;

    // Check Redis
    const traceData = await this.redis.get(`trace:${traceId}`);
    return traceData ? JSON.parse(traceData) : null;
  }

  public async getMessageTraces(messageId: string): Promise<MessageTrace[]> {
    const pattern = `trace:*`;
    const keys = await this.redis.keys(pattern);
    const traces: MessageTrace[] = [];

    for (const key of keys) {
      const traceData = await this.redis.get(key);
      if (traceData) {
        const trace: MessageTrace = JSON.parse(traceData);
        if (trace.messageId === messageId) {
          traces.push(trace);
        }
      }
    }

    return traces.sort((a, b) => b.timestamp - a.timestamp);
  }

  public async getAgentTraces(agentId: string, limit: number = 100): Promise<MessageTrace[]> {
    const pattern = `trace:*`;
    const keys = await this.redis.keys(pattern);
    const traces: MessageTrace[] = [];

    for (const key of keys.slice(0, limit * 2)) { // Get more to filter
      const traceData = await this.redis.get(key);
      if (traceData) {
        const trace: MessageTrace = JSON.parse(traceData);
        if (trace.from === agentId || trace.to === agentId) {
          traces.push(trace);
        }
      }
    }

    return traces
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  public async getFailedTraces(limit: number = 100): Promise<MessageTrace[]> {
    const pattern = `trace:*`;
    const keys = await this.redis.keys(pattern);
    const failedTraces: MessageTrace[] = [];

    for (const key of keys.slice(0, limit * 3)) { // Get more to filter
      const traceData = await this.redis.get(key);
      if (traceData) {
        const trace: MessageTrace = JSON.parse(traceData);
        if (trace.status === 'failed') {
          failedTraces.push(trace);
        }
      }
    }

    return failedTraces
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  public async getTracingStats(): Promise<{
    activeTraces: number;
    totalTraces: number;
    failedTraces: number;
    averageDuration: number;
    tracesByStatus: Record<string, number>;
  }> {
    const pattern = `trace:*`;
    const keys = await this.redis.keys(pattern);

    let totalTraces = 0;
    let failedTraces = 0;
    let totalDuration = 0;
    let durationCount = 0;
    const tracesByStatus: Record<string, number> = {};

    for (const key of keys.slice(0, 1000)) { // Sample for performance
      const traceData = await this.redis.get(key);
      if (traceData) {
        const trace: MessageTrace = JSON.parse(traceData);
        totalTraces++;

        tracesByStatus[trace.status] = (tracesByStatus[trace.status] || 0) + 1;

        if (trace.status === 'failed') {
          failedTraces++;
        }

        if (trace.duration) {
          totalDuration += trace.duration;
          durationCount++;
        }
      }
    }

    return {
      activeTraces: this.activeTraces.size,
      totalTraces,
      failedTraces,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      tracesByStatus,
    };
  }

  public async cleanupExpiredTraces(): Promise<number> {
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 1000);
    const pattern = `trace:*`;
    const keys = await this.redis.keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      const traceData = await this.redis.get(key);
      if (traceData) {
        const trace: MessageTrace = JSON.parse(traceData);
        if (trace.timestamp < cutoffTime) {
          await this.redis.del(key);
          deletedCount++;
        }
      }
    }

    this.emit('traces-cleaned', { deletedCount });
    return deletedCount;
  }

  private async storeTrace(trace: MessageTrace): Promise<void> {
    const key = `trace:${trace.traceId}`;
    await this.redis.setex(key, this.config.retentionPeriod, JSON.stringify(trace));
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Performance monitoring
export class MessagePerformanceMonitor {
  private redis: Redis;
  private metrics: Map<string, { count: number; totalDuration: number; errors: number }> = new Map();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  public recordMessage(trace: MessageTrace): void {
    const key = `${trace.from}:${trace.to}`;
    const existing = this.metrics.get(key) || { count: 0, totalDuration: 0, errors: 0 };

    existing.count++;
    if (trace.duration) {
      existing.totalDuration += trace.duration;
    }
    if (trace.status === 'failed') {
      existing.errors++;
    }

    this.metrics.set(key, existing);
  }

  public getMetrics(): Array<{
    route: string;
    messageCount: number;
    averageDuration: number;
    errorRate: number;
  }> {
    const result: Array<{
      route: string;
      messageCount: number;
      averageDuration: number;
      errorRate: number;
    }> = [];

    for (const [route, metrics] of this.metrics) {
      result.push({
        route,
        messageCount: metrics.count,
        averageDuration: metrics.count > 0 ? metrics.totalDuration / metrics.count : 0,
        errorRate: metrics.count > 0 ? metrics.errors / metrics.count : 0,
      });
    }

    return result;
  }

  public async persistMetrics(): Promise<void> {
    const metricsKey = 'message:metrics';
    await this.redis.set(metricsKey, JSON.stringify(this.getMetrics()));
  }
}

// Factory functions
export function createMessageTracingService(config: TracingConfig): MessageTracingService {
  return new MessageTracingService(config);
}

export function createMessagePerformanceMonitor(redisUrl: string): MessagePerformanceMonitor {
  return new MessagePerformanceMonitor(redisUrl);
}
```

### 5. Integration Service
```typescript
// src/services/agent-communication.service.ts
import { ProtocolHandler, createProtocolHandler } from '../agents/communication/protocol-handler';
import { SecureMessagingLayer, createSecureMessagingLayer } from '../agents/communication/secure-messaging';
import { MessageTracingService, createMessageTracingService, MessagePerformanceMonitor, createMessagePerformanceMonitor } from '../agents/communication/message-tracing';
import { AgentMessage, MessageRoute, ProtocolNegotiation } from '../agents/communication/protocols';

export interface AgentCommunicationConfig {
  redisUrl: string;
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  authentication: {
    algorithm: 'HS256' | 'HS384' | 'HS512';
    secret: string;
    issuer: string;
    audience: string;
    expiresIn: string;
  };
  protocol: {
    maxRetries: number;
    requestTimeout: number;
    rateLimitWindow: number;
    rateLimitMaxRequests: number;
  };
  tracing: {
    retentionPeriod: number;
    samplingRate: number;
    enableDetailedTracing: boolean;
  };
}

export class AgentCommunicationService {
  private protocolHandler: ProtocolHandler;
  private tracingService: MessageTracingService;
  private performanceMonitor: MessagePerformanceMonitor;
  private secureMessaging: SecureMessagingLayer;

  constructor(private config: AgentCommunicationConfig) {
    this.secureMessaging = createSecureMessagingLayer(
      config.encryption,
      config.authentication
    );

    this.protocolHandler = createProtocolHandler({
      redisUrl: config.redisUrl,
      secureMessaging: this.secureMessaging,
      ...config.protocol,
    });

    this.tracingService = createMessageTracingService({
      redisUrl: config.redisUrl,
      ...config.tracing,
    });

    this.performanceMonitor = createMessagePerformanceMonitor(config.redisUrl);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Message tracing
    this.protocolHandler.on('message-sent', async (data) => {
      const trace = await this.tracingService.getTrace(data.traceId);
      if (trace) {
        await this.tracingService.updateTrace(data.traceId, 'sent');
      }
    });

    this.protocolHandler.on('message-processing-error', async (data) => {
      // Find trace by message ID
      const traces = await this.tracingService.getMessageTraces(data.messageId);
      for (const trace of traces) {
        await this.tracingService.updateTrace(trace.traceId, 'failed', {}, data.error);
        this.performanceMonitor.recordMessage(trace);
      }
    });

    // Performance monitoring
    this.tracingService.on('trace-completed', (trace) => {
      this.performanceMonitor.recordMessage(trace);
    });
  }

  public async start(): Promise<void> {
    await this.protocolHandler.start();
    // Tracing service doesn't need explicit start
  }

  public async stop(): Promise<void> {
    await this.protocolHandler.stop();
  }

  // High-level communication methods
  public async sendMessage(
    message: AgentMessage,
    route: MessageRoute,
    options?: {
      sessionId?: string;
      enableTracing?: boolean;
    }
  ): Promise<void> {
    if (options?.enableTracing !== false) {
      const traceId = await this.tracingService.startTrace(message, route);
      (message as any).traceId = traceId;
    }

    await this.protocolHandler.sendMessage(message, route, options?.sessionId);
  }

  public async sendRequest(
    request: Omit<AgentMessage, 'id' | 'timestamp' | 'version'>,
    route: MessageRoute,
    options?: {
      sessionId?: string;
      enableTracing?: boolean;
    }
  ): Promise<any> {
    if (options?.enableTracing !== false) {
      const traceId = await this.tracingService.startTrace(request as AgentMessage, route);
      (request as any).traceId = traceId;
    }

    return await this.protocolHandler.sendRequest(request, route, options?.sessionId);
  }

  // Protocol negotiation
  public async negotiateProtocol(
    agentId: string,
    requestedVersion: string,
    capabilities: any
  ): Promise<ProtocolNegotiation> {
    return await this.protocolHandler.negotiateProtocol(agentId, requestedVersion, capabilities);
  }

  // Message handlers
  public registerMessageHandler(
    messageType: AgentMessage['type'],
    handler: (message: AgentMessage) => Promise<void>
  ): void {
    this.protocolHandler.registerMessageHandler(messageType, handler);
  }

  // Tracing and monitoring
  public async getMessageTrace(traceId: string): Promise<any> {
    return await this.tracingService.getTrace(traceId);
  }

  public async getMessageTraces(messageId: string): Promise<any[]> {
    return await this.tracingService.getMessageTraces(messageId);
  }

  public async getAgentTraces(agentId: string, limit?: number): Promise<any[]> {
    return await this.tracingService.getAgentTraces(agentId, limit);
  }

  public async getFailedTraces(limit?: number): Promise<any[]> {
    return await this.tracingService.getFailedTraces(limit);
  }

  public async getTracingStats(): Promise<any> {
    return await this.tracingService.getTracingStats();
  }

  public getPerformanceMetrics(): any[] {
    return this.performanceMonitor.getMetrics();
  }

  public async cleanupExpiredTraces(): Promise<number> {
    return await this.tracingService.cleanupExpiredTraces();
  }

  // Status and health checks
  public getConnectionStatus(): any {
    return this.protocolHandler.getConnectionStatus();
  }

  public async persistMetrics(): Promise<void> {
    await this.performanceMonitor.persistMetrics();
  }
}

// Export singleton instance
export const agentCommunication = new AgentCommunicationService({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  encryption: {
    algorithm: 'aes-256-cbc',
    keyLength: 32,
    ivLength: 16,
  },
  authentication: {
    algorithm: 'HS256',
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    issuer: 'ableka-lumina',
    audience: 'agent-communication',
    expiresIn: '1h',
  },
  protocol: {
    maxRetries: 3,
    requestTimeout: 30000,
    rateLimitWindow: 60000, // 1 minute
    rateLimitMaxRequests: 100,
  },
  tracing: {
    retentionPeriod: 86400, // 24 hours
    samplingRate: 0.1, // 10% sampling
    enableDetailedTracing: process.env.NODE_ENV === 'development',
  },
});
```

## Notes
- Comprehensive protocol definitions with Zod validation schemas
- Secure messaging layer with encryption, authentication, and integrity verification
- Advanced protocol handler with request-response patterns and routing strategies
- Message tracing and performance monitoring for observability
- Production-ready error handling, rate limiting, and session management
- Integration service providing high-level communication APIs