/// <reference types="vite/client" />

/**
 * Authentication API Service
 * Handles login, logout, token management, and OAuth2 client_credentials testing.
 * Mirrors the backend authRoutes + oauthRoutes.
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Decode a JWT payload without verifying the signature.
 * ⚠️ UNSAFE: This is intentionally client-side only — for display purposes (showing
 * email, tenant, products in the UI). NEVER use this for authorization decisions;
 * all access control is enforced server-side by the verified JWT middleware.
 */
export function decodeJwtClientSideOnly(token: string): Record<string, any> | null {
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
  return decodeJwtClientSideOnly(token) as TokenClaims | null;
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
    const claims = decodeJwtClientSideOnly(token) as TokenClaims;
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

  // ── Tenant management ───────────────────────────────────────────────────────

  async registerTenant(id: string, name: string): Promise<{ id: string; name: string; is_active: boolean }> {
    const response = await this.client.post('/api/v1/tenants', { id, name });
    return response.data.data;
  }

  async listTenants(): Promise<Array<{ id: string; name: string; is_active: boolean; created_at: string }>> {
    const response = await this.client.get('/api/v1/tenants');
    return response.data.data;
  }

  async onboardTenantUser(
    tenantId: string,
    payload: { email: string; full_name: string; role: string; products: string[]; password?: string }
  ): Promise<TenantUser> {
    const response = await this.client.post(`/api/v1/tenants/${tenantId}/users`, payload);
    return response.data.data;
  }

  async listTenantUsers(tenantId: string): Promise<TenantUser[]> {
    const response = await this.client.get(`/api/v1/tenants/${tenantId}/users`);
    return response.data.data;
  }

  async generateTenantApiKey(
    tenantId: string,
    payload: { products: string[]; allowed_scopes: string[]; rate_limit_per_min?: number }
  ): Promise<ApiKeyCreated> {
    const response = await this.client.post(`/api/v1/tenants/${tenantId}/api-keys`, payload);
    return response.data.data;
  }

  async listTenantApiKeys(tenantId: string): Promise<ApiKey[]> {
    const response = await this.client.get(`/api/v1/tenants/${tenantId}/api-keys`);
    return response.data.data;
  }

  async revokeTenantApiKey(tenantId: string, keyId: string): Promise<void> {
    await this.client.delete(`/api/v1/tenants/${tenantId}/api-keys/${keyId}`);
  }

  async generateOAuthClient(
    tenantId: string,
    payload: { products: string[]; allowed_scopes: string[] }
  ): Promise<OAuthClientCreated> {
    const response = await this.client.post(`/api/v1/tenants/${tenantId}/oauth-clients`, payload);
    return response.data.data;
  }

  async listOAuthClients(tenantId: string): Promise<OAuthClient[]> {
    const response = await this.client.get(`/api/v1/tenants/${tenantId}/oauth-clients`);
    return response.data.data;
  }

  async revokeOAuthClient(tenantId: string, clientDbId: string): Promise<void> {
    await this.client.delete(`/api/v1/tenants/${tenantId}/oauth-clients/${clientDbId}`);
  }
}

export interface ApiKey {
  id: string;
  api_key?: string; // only returned on creation
  key_prefix?: string; // masked display prefix
  tenant_id: string;
  products: string[];
  allowed_scopes: string[];
  rate_limit_per_min: number;
  is_active: boolean;
  created_at: string;
}

/** Full response on key creation – includes the one-time plaintext api_key */
export interface ApiKeyCreated extends ApiKey {
  api_key: string;
}

export interface TenantUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  products: string[];
  permissions: string[];
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  /** Only present when password was auto-generated */
  temporary_password?: string;
}

export interface OAuthClient {
  id: string;
  client_id: string;
  tenant_id: string;
  products: string[];
  allowed_scopes: string[];
  is_active: boolean;
  created_at: string;
}

/** Full response on client creation – includes the one-time client_secret */
export interface OAuthClientCreated extends OAuthClient {
  client_secret: string;
}

export const authAPI = new AuthAPIService();
export default AuthAPIService;
