/**
 * Type Definitions
 * Common types used across the compliance agents service
 */

export interface Transaction {
  id: string;
  type: 'transfer' | 'trade' | 'withdrawal' | 'deposit' | 'security';
  amount: number;
  fromAddress?: string;
  toAddress?: string;
  userId?: string;
  symbol?: string;
  quantity?: number;
  assetType?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ComplianceCheck {
  id: string;
  transactionId: string;
  checkType: 'kyc' | 'aml' | 'sebi' | 'full';
  amount: number;
  fromAddress?: string;
  toAddress?: string;
  userId?: string;
  metadata?: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceResult {
  transactionId: string;
  status: 'approved' | 'escalated' | 'rejected' | 'pending';
  riskScore: number;
  findings: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
  }>;
  recommendations: string[];
  metadata: Record<string, any>;
  processingTime: number;
  timestamp: string;
  agentsUsed: string[];
  errors?: string[];
}

export interface AgentConfig {
  name: string;
  enabled: boolean;
  priority: number;
  timeout: number;
  retryAttempts: number;
  riskThreshold: number;
}

export interface WorkflowState {
  transaction: Transaction;
  currentStep: string;
  riskScore: number;
  processingTime: number;
  errors: string[];
  [key: string]: any;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
  metadata?: Record<string, any>;
}

export interface EventMessage {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    latency?: number;
  }>;
  uptime: number;
  version: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: number;
}

export interface APIConfig {
  port: number;
  corsOrigin: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export interface ExternalAPIConfig {
  ballerine: {
    apiKey: string;
    baseUrl: string;
  };
  chainalysis: {
    apiKey: string;
    baseUrl: string;
  };
  ofac: {
    apiKey: string;
    baseUrl: string;
  };
  sebi: {
    apiKey: string;
    baseUrl: string;
  };
  bse: {
    apiKey: string;
    baseUrl: string;
  };
  nse: {
    apiKey: string;
    baseUrl: string;
  };
}