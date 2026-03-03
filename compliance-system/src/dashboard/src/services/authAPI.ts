/**
 * Authentication API Service
 * Handles login, logout, token management, and OAuth2 client_credentials testing.
 * Mirrors the backend authRoutes + oauthRoutes.
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Decode a JWT payload without verifying the signature. */
export function decodeJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // atob works for both browser and Vite's jsdom test env
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export interface TokenClaims {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  tenant?: string;
  products?: string[];
  scope?: string;
  sub?: string;
  exp: number;
  iat: number;
}

export function getStoredToken(): string | null {
  return localStorage.getItem('authToken');
}

export function getStoredClaims(): TokenClaims | null {
  const token = getStoredToken();
  if (!token) return null;
  return decodeJwt(token) as TokenClaims | null;
}

export function isTokenExpired(): boolean {
  const claims = getStoredClaims();
  if (!claims) return true;
  return claims.exp < Math.floor(Date.now() / 1000);
}

function storeToken(token: string): void {
  localStorage.setItem('authToken', token);
}

function clearToken(): void {
  localStorage.removeItem('authToken');
}

// ─── API client ───────────────────────────────────────────────────────────────

class AuthAPIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = getStoredToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  // ── User / web-mobile login ─────────────────────────────────────────────────

  async login(email: string, password: string): Promise<TokenClaims> {
    const response = await this.client.post('/api/auth/login', { email, password });
    const { token } = response.data.data;
    storeToken(token);
    const claims = decodeJwt(token) as TokenClaims;
    return claims;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } finally {
      clearToken();
    }
  }

  async refreshToken(refreshToken: string): Promise<void> {
    const response = await this.client.post('/api/auth/refresh', { refreshToken });
    storeToken(response.data.data.token);
  }

  // ── B2B / OAuth2 client_credentials ────────────────────────────────────────

  /**
   * Fetch a tenant-scoped JWT using the OAuth2 client_credentials grant.
   * This is primarily used from the "API Keys" page for testing / demonstration.
   */
  async getClientCredentialsToken(
    clientId: string,
    clientSecret: string,
    scope?: string
  ): Promise<{ access_token: string; token_type: string; expires_in: number; scope: string }> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      ...(scope ? { scope } : {}),
    });

    const response = await this.client.post('/oauth/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Don't send the user Bearer token for this request
      transformRequest: [(data) => data],
    });

    return response.data;
  }

  // ── API Key management (backend proxy) ─────────────────────────────────────

  async listApiKeys(): Promise<ApiKey[]> {
    const response = await this.client.get('/api/v1/api-keys');
    return response.data.data ?? response.data;
  }

  async createApiKey(payload: { name: string; products: string[]; scopes: string[] }): Promise<ApiKey> {
    const response = await this.client.post('/api/v1/api-keys', payload);
    return response.data.data ?? response.data;
  }

  async revokeApiKey(keyId: string): Promise<void> {
    await this.client.delete(`/api/v1/api-keys/${keyId}`);
  }
}

export interface ApiKey {
  id: string;
  api_key?: string; // only returned on creation
  tenant_id: string;
  products: string[];
  allowed_scopes: string[];
  rate_limit_per_min: number;
  is_active: boolean;
  created_at: string;
}

export const authAPI = new AuthAPIService();
export default AuthAPIService;
