/// <reference types="vite/client" />

/**
 * Compliance API Service
 * Typed wrappers for the analytics, case-management, KYC, AML, and monitoring
 * endpoints that power the tenant-user Compliance Dashboard (Flow 2).
 */

import axios, { AxiosInstance } from 'axios';
import { getStoredToken } from './authAPI';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 10_000;

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ComplianceMetrics {
  totalChecks: number;
  approved: number;
  rejected: number;
  escalated: number;
  pendingReview: number;
  averageRiskScore: number;
  highRiskEntities: number;
}

export interface RiskFactor {
  factor: string;
  count: number;
  percentage: number;
}

export interface RiskTrend {
  date: string;
  averageRiskScore: number;
  totalChecks: number;
  flaggedCount: number;
}

export interface JurisdictionDistribution {
  jurisdiction: string;
  count: number;
  percentage: number;
}

export interface RecentAlert {
  id: string;
  riskScore: number;
  status: string;
  entityId: string;
  jurisdiction: string;
  flags: string[];
  createdAt: string;
}

export interface DashboardData {
  metrics: ComplianceMetrics;
  topRiskFactors: RiskFactor[];
  recentTrends: RiskTrend[];
  jurisdictionDistribution: JurisdictionDistribution[];
  recentAlerts: RecentAlert[];
  generatedAt: string;
}

export type CaseStatus = 'OPEN' | 'INVESTIGATING' | 'PENDING_INFO' | 'RESOLVED' | 'REPORTED';
export type CaseType =
  | 'SUSPICIOUS_ACTIVITY'
  | 'FAILED_KYC'
  | 'SANCTIONS_HIT'
  | 'CORPORATE_ACTION_DISPUTE'
  | 'DATA_BREACH';

export interface ComplianceCase {
  caseId: string;
  caseType: CaseType;
  status: CaseStatus;
  entityId: string;
  jurisdiction: string;
  assignedTo?: string;
  riskScore?: number;
  summary: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KycCheck {
  id: string;
  entityId: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
  riskScore: number;
  jurisdiction: string;
  createdAt: string;
}

export interface AmlCheck {
  id: string;
  entityId: string;
  riskScore: number;
  flags: string[];
  jurisdiction: string;
  createdAt: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

class ComplianceAPIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({ baseURL: API_BASE_URL, timeout: API_TIMEOUT_MS });

    // Inject Bearer token on every request
    this.client.interceptors.request.use((config) => {
      const token = getStoredToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  // ── Analytics / Dashboard ──────────────────────────────────────────────────

  /** GET /api/analytics/dashboard – aggregated metrics + trends */
  async getDashboard(): Promise<DashboardData> {
    const res = await this.client.get('/api/analytics/dashboard');
    return res.data.data as DashboardData;
  }

  /** GET /api/analytics/metrics */
  async getMetrics(params?: {
    startDate?: string;
    endDate?: string;
    jurisdiction?: string;
  }): Promise<ComplianceMetrics> {
    const res = await this.client.get('/api/analytics/metrics', { params });
    return res.data.data as ComplianceMetrics;
  }

  /** GET /api/analytics/trends */
  async getTrends(days = 7): Promise<RiskTrend[]> {
    const res = await this.client.get('/api/analytics/trends', { params: { days } });
    return (res.data.data ?? []) as RiskTrend[];
  }

  /** GET /api/analytics/risk-factors */
  async getRiskFactors(limit = 5): Promise<RiskFactor[]> {
    const res = await this.client.get('/api/analytics/risk-factors', { params: { limit } });
    return (res.data.data ?? []) as RiskFactor[];
  }

  // ── Case Management ────────────────────────────────────────────────────────

  /** GET /api/v1/cases */
  async listCases(params?: {
    status?: CaseStatus;
    caseType?: CaseType;
    limit?: number;
  }): Promise<ComplianceCase[]> {
    const res = await this.client.get('/api/v1/cases', { params });
    return (res.data.cases ?? res.data.data ?? []) as ComplianceCase[];
  }

  /** POST /api/v1/cases */
  async createCase(payload: {
    caseType: CaseType;
    entityId: string;
    jurisdiction: string;
    summary: string;
    riskScore?: number;
  }): Promise<ComplianceCase> {
    const res = await this.client.post('/api/v1/cases', payload);
    return (res.data.case ?? res.data.data) as ComplianceCase;
  }

  /** POST /api/v1/compliance/transfer-check */
  async submitTransferCheck(payload: {
    from_address: string;
    to_address: string;
    amount: number;
    currency: string;
    jurisdiction: string;
    from_name: string;
    to_name: string;
    notes?: string;
  }): Promise<{
    check_id: string;
    status: string;
    risk_score: number;
    confidence: number;
    reasoning: string;
    flags?: string[];
    timestamp: string;
  }> {
    const res = await this.client.post('/api/v1/compliance/transfer-check', payload);
    return res.data as {
      check_id: string;
      status: string;
      risk_score: number;
      confidence: number;
      reasoning: string;
      flags?: string[];
      timestamp: string;
    };
  }
}

export const complianceAPI = new ComplianceAPIClient();
