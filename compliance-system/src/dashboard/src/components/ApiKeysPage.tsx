/**
 * ApiKeysPage Component
 * B2B API key management and OAuth2 client_credentials tester.
 *
 * Surfaces the backend changes from the B2B auth PR:
 *  - Displays existing API keys for the authenticated tenant
 *  - Lets compliance officers test the OAuth2 client_credentials flow
 *  - Shows the decoded JWT claims (tenant, products, scope) from the token response
 */

import React, { useState } from 'react';
import { authAPI, TokenClaims, decodeJwt } from '../services/authAPI';
import '../styles/ApiKeysPage.css';

interface ApiKeysPageProps {
  claims: TokenClaims;
}

interface OAuthTestResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  decoded?: Record<string, any>;
  error?: string;
}

const AVAILABLE_PRODUCTS = ['PE', 'COMPLIANCE', 'REPORTING', 'AML', 'KYC'];
const AVAILABLE_SCOPES = [
  'pe:read', 'pe:write',
  'compliance:read', 'compliance:write',
  'aml:read', 'kyc:read',
  'reporting:read',
];

const ApiKeysPage: React.FC<ApiKeysPageProps> = ({ claims }) => {
  // ── OAuth2 tester state ──────────────────────────────────────────────────
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthScope, setOauthScope] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthResult, setOauthResult] = useState<OAuthTestResult | null>(null);

  const handleOAuthTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setOauthLoading(true);
    setOauthResult(null);
    try {
      const result = await authAPI.getClientCredentialsToken(
        oauthClientId,
        oauthClientSecret,
        oauthScope || undefined
      );
      const decoded = decodeJwt(result.access_token) ?? undefined;
      setOauthResult({ ...result, decoded });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Request failed';
      setOauthResult({ access_token: '', token_type: '', expires_in: 0, scope: '', error: msg });
    } finally {
      setOauthLoading(false);
    }
  };

  const tenant = claims.tenant ?? '—';
  const currentProducts = claims.products ?? [];

  return (
    <div className="api-keys-page">
      {/* ── Tenant context ──────────────────────────────────────────────── */}
      <section className="ak-section">
        <h2>Tenant Context</h2>
        <p className="ak-description">
          Every access token encodes <em>who</em>, <em>which tenant</em>, and <em>which products</em>.
          Your current session:
        </p>
        <div className="ak-context-grid">
          <div className="ak-context-item">
            <span className="ak-context-label">User / Sub</span>
            <code>{claims.email || claims.sub || '—'}</code>
          </div>
          <div className="ak-context-item">
            <span className="ak-context-label">Tenant</span>
            <code>{tenant}</code>
          </div>
          <div className="ak-context-item">
            <span className="ak-context-label">Role</span>
            <code>{claims.role}</code>
          </div>
          <div className="ak-context-item">
            <span className="ak-context-label">Products</span>
            <div className="ak-chips">
              {currentProducts.length > 0
                ? currentProducts.map((p) => (
                    <span key={p} className="ak-chip ak-chip--product">{p}</span>
                  ))
                : <span className="ak-empty">none</span>}
            </div>
          </div>
          <div className="ak-context-item">
            <span className="ak-context-label">Scope</span>
            <div className="ak-chips">
              {claims.scope
                ? claims.scope.split(' ').map((s) => (
                    <span key={s} className="ak-chip ak-chip--scope">{s}</span>
                  ))
                : <span className="ak-empty">none (user JWT)</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ── How B2B flows work ──────────────────────────────────────────── */}
      <section className="ak-section">
        <h2>B2B Authentication Flows</h2>
        <div className="ak-flows-grid">
          <div className="ak-flow-card">
            <h3>🔑 API Key (Server-to-Server)</h3>
            <p>
              Each tenant partner app receives a static <code>X-API-Key</code> that maps to a
              <code>tenant_id</code>, list of <code>products</code>, and rate limits.
              Include the key in every request header:
            </p>
            <pre className="ak-code-block">{`GET /v1/pe/holdings
X-API-Key: <your-api-key>`}</pre>
            <p className="ak-note">
              The backend resolves the tenant and injects it into <code>req.user</code> for downstream
              route handlers.
            </p>
          </div>

          <div className="ak-flow-card">
            <h3>🛡️ OAuth2 Client Credentials</h3>
            <p>
              Exchange a <code>client_id</code> + <code>client_secret</code> for a short-lived
              tenant-scoped JWT. The token carries <code>sub</code>, <code>tenant</code>,
              <code>products</code>, and <code>scope</code>.
            </p>
            <pre className="ak-code-block">{`POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id=client_TENANT_123
client_secret=...
scope=pe:read compliance:read`}</pre>
          </div>
        </div>
      </section>

      {/* ── OAuth2 tester ───────────────────────────────────────────────── */}
      <section className="ak-section">
        <h2>OAuth2 Token Tester</h2>
        <p className="ak-description">
          Test the <code>POST /oauth/token</code> client_credentials flow directly from the dashboard.
        </p>

        <form className="ak-oauth-form" onSubmit={handleOAuthTest}>
          <div className="ak-form-row">
            <div className="ak-form-group">
              <label htmlFor="oauth-client-id">Client ID</label>
              <input
                id="oauth-client-id"
                type="text"
                value={oauthClientId}
                onChange={(e) => setOauthClientId(e.target.value)}
                placeholder="client_TENANT_123"
                required
                disabled={oauthLoading}
              />
            </div>
            <div className="ak-form-group">
              <label htmlFor="oauth-client-secret">Client Secret</label>
              <input
                id="oauth-client-secret"
                type="password"
                value={oauthClientSecret}
                onChange={(e) => setOauthClientSecret(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={oauthLoading}
              />
            </div>
          </div>

          <div className="ak-form-group">
            <label htmlFor="oauth-scope">
              Scope <span className="ak-optional">(optional – space-separated)</span>
            </label>
            <input
              id="oauth-scope"
              type="text"
              value={oauthScope}
              onChange={(e) => setOauthScope(e.target.value)}
              placeholder="pe:read pe:write compliance:read"
              disabled={oauthLoading}
            />
            <div className="ak-scope-pills">
              {AVAILABLE_SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ak-scope-pill${oauthScope.split(' ').includes(s) ? ' active' : ''}`}
                  onClick={() => {
                    const current = oauthScope.split(' ').filter(Boolean);
                    if (current.includes(s)) {
                      setOauthScope(current.filter((x) => x !== s).join(' '));
                    } else {
                      setOauthScope([...current, s].join(' '));
                    }
                  }}
                  disabled={oauthLoading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="ak-btn ak-btn--primary"
            disabled={oauthLoading || !oauthClientId || !oauthClientSecret}
          >
            {oauthLoading ? 'Requesting token…' : 'Get Token'}
          </button>
        </form>

        {oauthResult && (
          <div className={`ak-oauth-result ${oauthResult.error ? 'ak-oauth-result--error' : 'ak-oauth-result--success'}`}>
            {oauthResult.error ? (
              <>
                <h4>❌ Error</h4>
                <p>{oauthResult.error}</p>
              </>
            ) : (
              <>
                <h4>✅ Token Issued</h4>
                <div className="ak-result-grid">
                  <div className="ak-result-item">
                    <span className="ak-context-label">token_type</span>
                    <code>{oauthResult.token_type}</code>
                  </div>
                  <div className="ak-result-item">
                    <span className="ak-context-label">expires_in</span>
                    <code>{oauthResult.expires_in}s</code>
                  </div>
                  <div className="ak-result-item">
                    <span className="ak-context-label">scope</span>
                    <code>{oauthResult.scope}</code>
                  </div>
                </div>

                {oauthResult.decoded && (
                  <>
                    <h5>JWT Claims</h5>
                    <div className="ak-context-grid">
                      <div className="ak-context-item">
                        <span className="ak-context-label">sub</span>
                        <code>{oauthResult.decoded.sub}</code>
                      </div>
                      <div className="ak-context-item">
                        <span className="ak-context-label">tenant</span>
                        <code>{oauthResult.decoded.tenant ?? '—'}</code>
                      </div>
                      <div className="ak-context-item">
                        <span className="ak-context-label">products</span>
                        <div className="ak-chips">
                          {(oauthResult.decoded.products ?? []).map((p: string) => (
                            <span key={p} className="ak-chip ak-chip--product">{p}</span>
                          ))}
                        </div>
                      </div>
                      <div className="ak-context-item">
                        <span className="ak-context-label">scope</span>
                        <div className="ak-chips">
                          {(oauthResult.decoded.scope ?? '').split(' ').filter(Boolean).map((s: string) => (
                            <span key={s} className="ak-chip ak-chip--scope">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <details className="ak-raw-token">
                      <summary>Raw access_token</summary>
                      <pre className="ak-code-block ak-code-block--wrap">{oauthResult.access_token}</pre>
                    </details>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Product / scope legend ──────────────────────────────────────── */}
      <section className="ak-section">
        <h2>Products &amp; Scopes Reference</h2>
        <div className="ak-legend-grid">
          <div>
            <h4>Products</h4>
            <ul className="ak-legend-list">
              {AVAILABLE_PRODUCTS.map((p) => (
                <li key={p}>
                  <span className="ak-chip ak-chip--product">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>OAuth2 Scopes</h4>
            <ul className="ak-legend-list">
              {AVAILABLE_SCOPES.map((s) => (
                <li key={s}>
                  <span className="ak-chip ak-chip--scope">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ApiKeysPage;
