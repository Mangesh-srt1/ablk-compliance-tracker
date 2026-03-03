/**
 * TenantOnboardingPage Component
 * 3-step wizard:
 *  Step 1 – Register Tenant (ID + name)
 *  Step 2 – Onboard Users (add multiple users with roles + products)
 *  Step 3 – Generate Credentials (API key or OAuth2 client with secure one-time delivery)
 */

import React, { useState } from 'react';
import {
  authAPI,
  TenantUser,
  ApiKeyCreated,
  OAuthClientCreated,
} from '../services/authAPI';
import CredentialDisplay from './CredentialDisplay';
import '../styles/TenantOnboardingPage.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_PRODUCTS = ['PE', 'COMPLIANCE', 'REPORTING', 'AML', 'KYC'];
const AVAILABLE_SCOPES = [
  'pe:read', 'pe:write',
  'compliance:read', 'compliance:write',
  'aml:read', 'kyc:read',
  'reporting:read',
];
const USER_ROLES = ['admin', 'compliance_officer', 'analyst', 'client'];

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type CredentialTab = 'api-key' | 'oauth-client';

interface UserFormData {
  email: string;
  full_name: string;
  role: string;
  products: string[];
  password: string;
}

const EMPTY_USER_FORM: UserFormData = {
  email: '',
  full_name: '',
  role: 'analyst',
  products: [],
  password: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

const TenantOnboardingPage: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Step 1 state
  const [tenantId, setTenantId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantRegistered, setTenantRegistered] = useState(false);

  // Step 2 state
  const [userForm, setUserForm] = useState<UserFormData>(EMPTY_USER_FORM);
  const [userLoading, setUserLoading] = useState(false);
  const [addedUsers, setAddedUsers] = useState<Array<TenantUser & { temporary_password?: string }>>([]);
  const [showUserForm, setShowUserForm] = useState(true);

  // Step 3 state
  const [credTab, setCredTab] = useState<CredentialTab>('api-key');
  const [keyProducts, setKeyProducts] = useState<string[]>([]);
  const [keyScopes, setKeyScopes] = useState<string[]>([]);
  const [keyRateLimit, setKeyRateLimit] = useState(60);
  const [keyLoading, setKeyLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<ApiKeyCreated | null>(null);

  const [clientProducts, setClientProducts] = useState<string[]>([]);
  const [clientScopes, setClientScopes] = useState<string[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [generatedClient, setGeneratedClient] = useState<OAuthClientCreated | null>(null);

  // ── Step 1: Register Tenant ─────────────────────────────────────────────────

  const handleRegisterTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setTenantLoading(true);
    const normalizedId = tenantId.toUpperCase();
    try {
      await authAPI.registerTenant(normalizedId, tenantName);
      setTenantRegistered(true);
      setTenantId(normalizedId);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to register tenant';
      setGlobalError(msg);
    } finally {
      setTenantLoading(false);
    }
  };

  // ── Step 2: Onboard Users ───────────────────────────────────────────────────

  const toggleProduct = (list: string[], setList: (v: string[]) => void, product: string) =>
    list.includes(product) ? setList(list.filter((x) => x !== product)) : setList([...list, product]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setUserLoading(true);
    try {
      const payload = {
        ...userForm,
        password: userForm.password || undefined,
      };
      const created = await authAPI.onboardTenantUser(tenantId, payload);
      setAddedUsers((prev) => [...prev, created]);
      setUserForm(EMPTY_USER_FORM);
      setShowUserForm(false);
    } catch (err: any) {
      setGlobalError(
        err?.response?.data?.message || err?.message || 'Failed to add user'
      );
    } finally {
      setUserLoading(false);
    }
  };

  // ── Step 3: Generate Credentials ───────────────────────────────────────────

  const handleGenerateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setKeyLoading(true);
    setGeneratedKey(null);
    try {
      const key = await authAPI.generateTenantApiKey(tenantId, {
        products: keyProducts,
        allowed_scopes: keyScopes,
        rate_limit_per_min: keyRateLimit,
      });
      setGeneratedKey(key);
    } catch (err: any) {
      setGlobalError(err?.response?.data?.message || err?.message || 'Failed to generate API key');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleGenerateOAuthClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setClientLoading(true);
    setGeneratedClient(null);
    try {
      const client = await authAPI.generateOAuthClient(tenantId, {
        products: clientProducts,
        allowed_scopes: clientScopes,
      });
      setGeneratedClient(client);
    } catch (err: any) {
      setGlobalError(err?.response?.data?.message || err?.message || 'Failed to generate OAuth client');
    } finally {
      setClientLoading(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const StepIndicator = () => (
    <div className="to-steps">
      {([1, 2, 3] as Step[]).map((s) => (
        <React.Fragment key={s}>
          <div className={`to-step${step === s ? ' to-step--active' : step > s ? ' to-step--done' : ''}`}>
            <span className="to-step-num">{step > s ? '✓' : s}</span>
            <span className="to-step-label">
              {s === 1 ? 'Register Tenant' : s === 2 ? 'Onboard Users' : 'Generate Credentials'}
            </span>
          </div>
          {s < 3 && <div className={`to-step-line${step > s ? ' to-step-line--done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  const MultiSelect = ({
    label,
    options,
    selected,
    onToggle,
    color = 'product',
  }: {
    label: string;
    options: string[];
    selected: string[];
    onToggle: (v: string) => void;
    color?: 'product' | 'scope';
  }) => (
    <div className="to-field">
      <label>{label}</label>
      <div className="to-pills">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`to-pill to-pill--${color}${selected.includes(o) ? ' to-pill--selected' : ''}`}
            onClick={() => onToggle(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="tenant-onboarding">
      <div className="to-header">
        <h1>Tenant Onboarding</h1>
        <p>Register a new tenant, onboard their users, and provision API credentials.</p>
      </div>

      <StepIndicator />

      {globalError && (
        <div className="to-error" role="alert">
          {globalError}
          <button onClick={() => setGlobalError(null)}>×</button>
        </div>
      )}

      {/* ── Step 1: Register Tenant ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="to-card">
          <h2>Step 1: Register Tenant</h2>
          <p className="to-description">
            A <strong>Tenant</strong> is a direct customer using the platform — a fund, enterprise,
            or partner organisation. Each tenant gets their own isolated users, API keys, and OAuth
            clients.
          </p>

          {!tenantRegistered ? (
            <form className="to-form" onSubmit={handleRegisterTenant}>
              <div className="to-form-row">
                <div className="to-field">
                  <label htmlFor="tenant-id">
                    Tenant ID <span className="to-hint">(uppercase, no spaces, e.g. TENANT_ACME)</span>
                  </label>
                  <input
                    id="tenant-id"
                    type="text"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value.toUpperCase())}
                    placeholder="TENANT_ACME"
                    pattern="^[A-Z0-9_-]{3,64}$"
                    required
                    disabled={tenantLoading}
                  />
                </div>

                <div className="to-field">
                  <label htmlFor="tenant-name">Tenant Name</label>
                  <input
                    id="tenant-name"
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Acme Capital Fund"
                    required
                    disabled={tenantLoading}
                    minLength={2}
                    maxLength={255}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="to-btn to-btn--primary"
                disabled={tenantLoading || !tenantId || !tenantName}
              >
                {tenantLoading ? 'Registering…' : 'Register Tenant'}
              </button>
            </form>
          ) : (
            <div className="to-success-block">
              <p>
                ✅ Tenant <strong>{tenantId}</strong> ("{tenantName}") registered successfully.
              </p>
              <button className="to-btn to-btn--primary" onClick={() => setStep(2)}>
                Next: Onboard Users →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Onboard Users ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="to-card">
          <h2>Step 2: Onboard Users</h2>
          <p className="to-description">
            Add operators (admins, compliance officers, analysts, clients) to tenant{' '}
            <strong>{tenantId}</strong>. Leave password blank to auto-generate a secure temporary
            password that will be shown once.
          </p>

          {/* Users added so far */}
          {addedUsers.length > 0 && (
            <div className="to-users-list">
              <h4>Added users ({addedUsers.length})</h4>
              <table className="to-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Products</th>
                    <th>Temp Password</th>
                  </tr>
                </thead>
                <tbody>
                  {addedUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.full_name}</td>
                      <td>
                        <span className={`to-role-badge to-role-badge--${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        <div className="to-mini-chips">
                          {u.products.map((p) => (
                            <span key={p} className="to-mini-chip">{p}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {u.temporary_password ? (
                          <CredentialDisplay
                            label="Temp Password"
                            value={u.temporary_password}
                            description={`Temporary password for ${u.email}`}
                            onAcknowledged={() =>
                              setAddedUsers((prev) =>
                                prev.map((x) =>
                                  x.id === u.id ? { ...x, temporary_password: undefined } : x
                                )
                              )
                            }
                          />
                        ) : (
                          <span className="to-saved">Saved ✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add user form */}
          {showUserForm ? (
            <form className="to-form" onSubmit={handleAddUser}>
              <div className="to-form-row">
                <div className="to-field">
                  <label htmlFor="u-email">Email</label>
                  <input
                    id="u-email"
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="alice@tenant.com"
                    required
                    disabled={userLoading}
                  />
                </div>
                <div className="to-field">
                  <label htmlFor="u-name">Full Name</label>
                  <input
                    id="u-name"
                    type="text"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Alice Smith"
                    required
                    disabled={userLoading}
                  />
                </div>
              </div>

              <div className="to-form-row">
                <div className="to-field">
                  <label htmlFor="u-role">Role</label>
                  <select
                    id="u-role"
                    value={userForm.role}
                    onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                    disabled={userLoading}
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="to-field">
                  <label htmlFor="u-password">
                    Password <span className="to-hint">(leave blank to auto-generate)</span>
                  </label>
                  <input
                    id="u-password"
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Leave blank to auto-generate"
                    minLength={8}
                    disabled={userLoading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <MultiSelect
                label="Products"
                options={AVAILABLE_PRODUCTS}
                selected={userForm.products}
                onToggle={(p) =>
                  setUserForm((f) => ({
                    ...f,
                    products: f.products.includes(p)
                      ? f.products.filter((x) => x !== p)
                      : [...f.products, p],
                  }))
                }
              />

              <div className="to-form-actions">
                <button
                  type="submit"
                  className="to-btn to-btn--primary"
                  disabled={userLoading || !userForm.email || !userForm.full_name}
                >
                  {userLoading ? 'Adding…' : 'Add User'}
                </button>
                {addedUsers.length > 0 && (
                  <button
                    type="button"
                    className="to-btn to-btn--secondary"
                    onClick={() => setShowUserForm(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="to-form-actions">
              <button className="to-btn to-btn--secondary" onClick={() => setShowUserForm(true)}>
                + Add Another User
              </button>
            </div>
          )}

          <div className="to-step-nav">
            <button className="to-btn to-btn--ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button
              className="to-btn to-btn--primary"
              onClick={() => setStep(3)}
            >
              Next: Generate Credentials →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Generate Credentials ─────────────────────────────────── */}
      {step === 3 && (
        <div className="to-card">
          <h2>Step 3: Generate Credentials for {tenantId}</h2>
          <p className="to-description">
            Provision API access for tenant <strong>{tenantId}</strong>. Choose between a static{' '}
            <strong>API Key</strong> (for simple server-to-server calls) or an{' '}
            <strong>OAuth2 Client</strong> (for short-lived, scope-limited tokens via the
            client_credentials grant).
          </p>

          {/* Tab switcher */}
          <div className="to-tabs">
            <button
              className={`to-tab${credTab === 'api-key' ? ' to-tab--active' : ''}`}
              onClick={() => setCredTab('api-key')}
            >
              🔑 API Key
            </button>
            <button
              className={`to-tab${credTab === 'oauth-client' ? ' to-tab--active' : ''}`}
              onClick={() => setCredTab('oauth-client')}
            >
              🛡️ OAuth2 Client
            </button>
          </div>

          {/* API Key tab */}
          {credTab === 'api-key' && (
            <div className="to-cred-panel">
              <p className="to-description">
                A static key included in every request as <code>X-API-Key: &lt;key&gt;</code>.
                Mapped to tenant <strong>{tenantId}</strong>, the selected products, and rate limit.
              </p>

              {!generatedKey ? (
                <form className="to-form" onSubmit={handleGenerateApiKey}>
                  <MultiSelect
                    label="Products (what this key can access)"
                    options={AVAILABLE_PRODUCTS}
                    selected={keyProducts}
                    onToggle={(p) => toggleProduct(keyProducts, setKeyProducts, p)}
                  />
                  <MultiSelect
                    label="Allowed Scopes"
                    options={AVAILABLE_SCOPES}
                    selected={keyScopes}
                    onToggle={(p) => toggleProduct(keyScopes, setKeyScopes, p)}
                    color="scope"
                  />
                  <div className="to-field to-field--narrow">
                    <label htmlFor="key-rate">Rate limit (req / min)</label>
                    <input
                      id="key-rate"
                      type="number"
                      min={1}
                      max={10000}
                      value={keyRateLimit}
                      onChange={(e) => setKeyRateLimit(Number(e.target.value))}
                    />
                  </div>
                  <button
                    type="submit"
                    className="to-btn to-btn--primary"
                    disabled={keyLoading || keyProducts.length === 0 || keyScopes.length === 0}
                  >
                    {keyLoading ? 'Generating…' : 'Generate API Key'}
                  </button>
                </form>
              ) : (
                <div>
                  <div className="to-cred-meta">
                    <span>
                      <strong>Prefix:</strong> <code>{generatedKey.key_prefix}…</code>
                    </span>
                    <span>
                      <strong>Products:</strong> {generatedKey.products.join(', ')}
                    </span>
                    <span>
                      <strong>Rate:</strong> {generatedKey.rate_limit_per_min} req/min
                    </span>
                  </div>

                  <CredentialDisplay
                    label="API Key"
                    value={generatedKey.api_key}
                    description={`Include as X-API-Key header. Products: ${generatedKey.products.join(', ')}. Scopes: ${generatedKey.allowed_scopes.join(', ')}.`}
                    onAcknowledged={() => setGeneratedKey(null)}
                  />

                  <button
                    className="to-btn to-btn--secondary"
                    style={{ marginTop: '1rem' }}
                    onClick={() => { setGeneratedKey(null); setKeyProducts([]); setKeyScopes([]); }}
                  >
                    Generate Another Key
                  </button>
                </div>
              )}
            </div>
          )}

          {/* OAuth2 Client tab */}
          {credTab === 'oauth-client' && (
            <div className="to-cred-panel">
              <p className="to-description">
                An OAuth2 client for the <code>client_credentials</code> grant. Exchange{' '}
                <code>client_id</code> + <code>client_secret</code> for a short-lived JWT at{' '}
                <code>POST /oauth/token</code>.
              </p>

              {!generatedClient ? (
                <form className="to-form" onSubmit={handleGenerateOAuthClient}>
                  <MultiSelect
                    label="Products"
                    options={AVAILABLE_PRODUCTS}
                    selected={clientProducts}
                    onToggle={(p) => toggleProduct(clientProducts, setClientProducts, p)}
                  />
                  <MultiSelect
                    label="Allowed Scopes"
                    options={AVAILABLE_SCOPES}
                    selected={clientScopes}
                    onToggle={(p) => toggleProduct(clientScopes, setClientScopes, p)}
                    color="scope"
                  />
                  <button
                    type="submit"
                    className="to-btn to-btn--primary"
                    disabled={clientLoading || clientProducts.length === 0 || clientScopes.length === 0}
                  >
                    {clientLoading ? 'Generating…' : 'Generate Client Credentials'}
                  </button>
                </form>
              ) : (
                <div>
                  <div className="to-cred-meta">
                    <span>
                      <strong>Client ID:</strong> <code>{generatedClient.client_id}</code>
                    </span>
                    <span>
                      <strong>Products:</strong> {generatedClient.products.join(', ')}
                    </span>
                  </div>

                  {/* client_id is not a secret but we show it in a copy-friendly way */}
                  <div className="to-cred-id">
                    <span className="to-cred-id-label">Client ID (not secret — share with partner)</span>
                    <div className="to-cred-id-field">
                      <code>{generatedClient.client_id}</code>
                      <button
                        type="button"
                        className="to-btn to-btn--ghost to-btn--sm"
                        onClick={() => navigator.clipboard.writeText(generatedClient.client_id)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <CredentialDisplay
                    label="Client Secret"
                    value={generatedClient.client_secret}
                    description={`Use with client_id "${generatedClient.client_id}" in the client_credentials grant. Scopes: ${generatedClient.allowed_scopes.join(', ')}.`}
                    onAcknowledged={() => setGeneratedClient(null)}
                  />

                  <button
                    className="to-btn to-btn--secondary"
                    style={{ marginTop: '1rem' }}
                    onClick={() => { setGeneratedClient(null); setClientProducts([]); setClientScopes([]); }}
                  >
                    Generate Another Client
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="to-step-nav">
            <button className="to-btn to-btn--ghost" onClick={() => setStep(2)}>
              ← Back
            </button>
            <div className="to-done-note">
              🎉 Onboarding complete for tenant <strong>{tenantId}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantOnboardingPage;
