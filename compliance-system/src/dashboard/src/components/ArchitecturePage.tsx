/**
 * ArchitecturePage
 * Visual documentation of the two compliance platform flows:
 *   Flow 1 – Tenant onboarding: client_id / secret / API key provisioning
 *   Flow 2 – Tenant user compliance dashboard journey
 *
 * Domain/URL placeholders in code examples use ${AUTH_DOMAIN} and ${API_DOMAIN}
 * to avoid confusion when the real domain differs between dev/staging/prod.
 * Configure VITE_AUTH_DOMAIN and VITE_API_DOMAIN in your .env to customise.
 */

import React, { useState } from 'react';
import '../styles/ArchitecturePage.css';

// ─── Domain placeholders (resolved from env, fallback to example values) ──────
const AUTH_DOMAIN = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AUTH_DOMAIN) || 'auth.ableka.com';
const API_DOMAIN  = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_DOMAIN)  || 'api.ableka.com';
import '../styles/ArchitecturePage.css';

// ─── Shared UI primitives ─────────────────────────────────────────────────────

interface StepProps {
  number: number | string;
  title: string;
  children: React.ReactNode;
  color?: string;
}

const Step: React.FC<StepProps> = ({ number, title, children, color = '#667eea' }) => (
  <div className="arch-step">
    <div className="arch-step-num" style={{ background: color }}>{number}</div>
    <div className="arch-step-body">
      <div className="arch-step-title">{title}</div>
      <div className="arch-step-content">{children}</div>
    </div>
  </div>
);

interface CodeBlockProps {
  children: string;
  lang?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, lang = '' }) => (
  <div className="arch-code-wrap">
    {lang && <span className="arch-code-lang">{lang}</span>}
    <pre className="arch-code"><code>{children.trim()}</code></pre>
  </div>
);

interface LayerProps {
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
}

const ArchLayer: React.FC<LayerProps> = ({ icon, label, sublabel, color = '#667eea' }) => (
  <div className="arch-layer" style={{ borderColor: color }}>
    <span className="arch-layer-icon">{icon}</span>
    <div>
      <div className="arch-layer-label" style={{ color }}>{label}</div>
      {sublabel && <div className="arch-layer-sub">{sublabel}</div>}
    </div>
  </div>
);

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'flow1' | 'flow2' | 'jwt';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '🏗 Architecture Overview' },
  { id: 'flow1',    label: '🔑 Flow 1: Tenant Onboarding' },
  { id: 'flow2',    label: '📊 Flow 2: Compliance Dashboard' },
  { id: 'jwt',      label: '🔐 JWT & Token Reference' },
];

// ─── Overview tab ─────────────────────────────────────────────────────────────

const OverviewTab: React.FC = () => (
  <div className="arch-section">
    <h2 className="arch-h2">High-Level Architecture</h2>
    <p className="arch-lead">
      Ableka Lumina is a multi-tenant AI compliance platform. Every request carries a tenant identity
      encoded in either a <strong>Bearer JWT</strong> (human users) or an <strong>API Key / OAuth2
      client token</strong> (B2B machine-to-machine).
    </p>

    <div className="arch-layers">
      <ArchLayer icon="🌐" label="Frontend (React)" sublabel="Compliance Dashboard · Tenant Onboarding · Workflow Builder · API Keys" color="#667eea" />
      <div className="arch-arrow">↓</div>
      <ArchLayer icon="🛡" label="API Gateway" sublabel="TLS termination · JWT/API-Key validation · Rate limiting · Route dispatch" color="#7c3aed" />
      <div className="arch-arrow">↓</div>
      <div className="arch-row">
        <ArchLayer icon="🔑" label="Auth / IdP" sublabel="OIDC · OAuth2 client_credentials · JWT signing" color="#0e7490" />
        <ArchLayer icon="🏢" label="Tenant Management" sublabel="Registration · Users · API Keys · OAuth Clients" color="#059669" />
        <ArchLayer icon="⚖️" label="Compliance API" sublabel="KYC · AML · Cases · Analytics · Alerts" color="#d97706" />
        <ArchLayer icon="📋" label="Rules Engine" sublabel="Jurisdiction YAML configs · Workflow builder" color="#dc2626" />
      </div>
      <div className="arch-arrow">↓</div>
      <div className="arch-row">
        <ArchLayer icon="🗄" label="PostgreSQL + PGVector" sublabel="Multi-tenant rows · Vector embeddings" color="#4a5568" />
        <ArchLayer icon="⚡" label="Redis" sublabel="Session cache · Decision cache · Rate limits" color="#c05621" />
        <ArchLayer icon="⛓" label="Blockchain Listener" sublabel="Hyperledger Besu / Ethereum (optional, client-provided)" color="#2d3748" />
      </div>
    </div>

    <h2 className="arch-h2" style={{ marginTop: '2.5rem' }}>Two Primary Flows</h2>
    <div className="arch-flow-cards">
      <div className="arch-flow-card arch-flow-card-1">
        <div className="arch-flow-card-num">1</div>
        <h3>Tenant Onboarding</h3>
        <p>
          Ableka ops (or self-serve) registers a tenant, provisions users with roles + product access,
          generates a machine-to-machine API Key and/or OAuth2 Client Credentials, and delivers them
          securely (shown once, hash-stored at rest).
        </p>
        <ul>
          <li>Tenant registration (ID, name, products)</li>
          <li>User onboarding (role, permissions, temp password)</li>
          <li>API key generation (SHA-256 stored, prefix-indexed)</li>
          <li>OAuth2 client (bcrypt secret, client_credentials grant)</li>
        </ul>
      </div>

      <div className="arch-flow-card arch-flow-card-2">
        <div className="arch-flow-card-num">2</div>
        <h3>Compliance Dashboard</h3>
        <p>
          Tenant users (compliance officers, analysts) log in with email + password, receive a
          tenant-scoped JWT, and operate the live compliance dashboard: metrics, risk trends, KYC/AML
          cases, alerts, and workflow automation.
        </p>
        <ul>
          <li>JWT login → tenant + role + products in token</li>
          <li>KPI cards: total checks, approved, rejected, escalated</li>
          <li>Risk trend sparklines + risk factor bars</li>
          <li>Case management: open, investigate, resolve</li>
        </ul>
      </div>
    </div>
  </div>
);

// ─── Flow 1 tab ───────────────────────────────────────────────────────────────

const Flow1Tab: React.FC = () => (
  <div className="arch-section">
    <h2 className="arch-h2">Flow 1 — Tenant Onboarding &amp; Credential Provisioning</h2>
    <p className="arch-lead">
      This flow is performed by <strong>Ableka admins</strong> (or via a self-serve portal). The result
      is a set of machine credentials the tenant embeds in their backend systems.
    </p>

    <div className="arch-steps">
      <Step number={1} title="Register the Tenant" color="#667eea">
        <p>Ableka admin navigates to <strong>Tenant Onboarding → Step 1</strong>.</p>
        <CodeBlock lang="POST">{`
POST /api/v1/tenants
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "id": "TENANT_ACME",
  "name": "Acme Capital Fund"
}

→ 201 Created
{
  "id": "TENANT_ACME",
  "name": "Acme Capital Fund",
  "is_active": true,
  "created_at": "2026-03-03T09:00:00Z"
}
        `}</CodeBlock>
      </Step>

      <Step number={2} title="Onboard Tenant Users" color="#7c3aed">
        <p>Add one or more users with <strong>role</strong> (admin / compliance_officer / analyst / client)
        and <strong>product access</strong> (PE, COMPLIANCE, AML, …). Leave password blank to auto-generate.</p>
        <CodeBlock lang="POST">{`
POST /api/v1/tenants/TENANT_ACME/users
Authorization: Bearer <admin-jwt>

{
  "email": "alice@acme.com",
  "full_name": "Alice Smith",
  "role": "compliance_officer",
  "products": ["PE", "COMPLIANCE"],
  "password": ""        // blank → auto-generated 128-bit temp password
}

→ 201 Created
{
  "id": "usr-uuid",
  "email": "alice@acme.com",
  "role": "compliance_officer",
  "temporary_password": "Kx9!mN2…"   // shown once via CredentialDisplay
}
        `}</CodeBlock>
      </Step>

      <Step number={3} title="Generate API Key (Machine-to-Machine)" color="#059669">
        <p>The API key is returned <strong>once</strong> in plain text. The backend stores only the
        SHA-256 hash + a 15-char prefix for masked display.</p>
        <CodeBlock lang="POST">{`
POST /api/v1/tenants/TENANT_ACME/api-keys
Authorization: Bearer <admin-jwt>

{
  "products": ["PE", "COMPLIANCE"],
  "allowed_scopes": ["pe:read", "compliance:read"],
  "rate_limit_per_min": 60
}

→ 201 Created
{
  "api_key": "lmk_live_a1b2c3d4…",   // plaintext — shown once
  "key_prefix": "lmk_live_a1b2c",
  "tenant_id": "TENANT_ACME",
  "notice": "Copy this API key now. It will not be shown again."
}
        `}</CodeBlock>
        <p style={{ marginTop: '0.75rem' }}>Tenant backend uses the key in every request:</p>
        <CodeBlock lang="HTTP">{`GET /api/v1/pe/holdings\nHost: ${API_DOMAIN}\nX-API-Key: lmk_live_a1b2c3d4…`}</CodeBlock>
      </Step>

      <Step number={4} title="Generate OAuth2 Client (Client Credentials)" color="#d97706">
        <p>For short-lived scoped tokens. The <code>client_secret</code> is bcrypt-hashed at rest,
        returned once.</p>
        <CodeBlock lang="POST">{`
POST /api/v1/tenants/TENANT_ACME/oauth-clients
Authorization: Bearer <admin-jwt>

{
  "products": ["PE"],
  "allowed_scopes": ["pe:read", "pe:write"]
}

→ 201 Created
{
  "client_id": "client_TENANT_ACME_a1b2c3",
  "client_secret": "cs_live_…",      // shown once
  "tenant_id": "TENANT_ACME"
}
        `}</CodeBlock>
      </Step>

      <Step number={5} title="Tenant Backend Gets an Access Token" color="#dc2626">
        <p>The tenant exchanges credentials for a short-lived JWT using the OAuth2
        <strong> client_credentials</strong> grant.</p>
        <CodeBlock lang="POST">{`
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=client_TENANT_ACME_a1b2c3
&client_secret=cs_live_…
&scope=pe:read compliance:read

→ 200 OK
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "pe:read compliance:read"
}
        `}</CodeBlock>
        <p style={{ marginTop: '0.75rem' }}>The JWT payload encodes tenant + product context:</p>
        <CodeBlock lang="JWT payload">{`{\n  "iss": "https://${AUTH_DOMAIN}",\n  "sub": "client_TENANT_ACME_a1b2c3",\n  "tenant": "TENANT_ACME",\n  "products": ["PE", "COMPLIANCE"],\n  "scope": "pe:read compliance:read",\n  "exp": 1741003600\n}`}</CodeBlock>
      </Step>

      <Step number={6} title="Tenant Calls the Compliance API" color="#0e7490">
        <CodeBlock lang="HTTP">{`GET /v1/pe/holdings\nHost: ${API_DOMAIN}\nAuthorization: Bearer <access_token>\n\n→ 200 OK  (filtered to TENANT_ACME data only)`}</CodeBlock>
        <p style={{ marginTop: '0.75rem' }}>
          The API Gateway validates the JWT, extracts <code>tenant</code> + <code>products</code>,
          and injects them into <code>req.user</code>. Every DB query appends
          <code> WHERE tenant_id = $1</code>.
        </p>
      </Step>
    </div>
  </div>
);

// ─── Flow 2 tab ───────────────────────────────────────────────────────────────

const Flow2Tab: React.FC = () => (
  <div className="arch-section">
    <h2 className="arch-h2">Flow 2 — Tenant User Compliance Dashboard</h2>
    <p className="arch-lead">
      Human users (compliance officers, analysts) log in with email + password and operate the live
      compliance dashboard. Their JWT encodes <em>who they are, which tenant they belong to, and which
      products they may access</em>.
    </p>

    <div className="arch-steps">
      <Step number={1} title="User Logs In" color="#667eea">
        <p>From the <strong>Login page</strong>: enter email + password → JWT stored in
        <code> localStorage</code>.</p>
        <CodeBlock lang="POST">{`
POST /api/auth/login
{
  "email": "alice@acme.com",
  "password": "••••••••"
}

→ 200 OK
{
  "data": {
    "token": "<signed-jwt>",
    "user": { "id": "...", "email": "alice@acme.com", "role": "compliance_officer" }
  }
}
        `}</CodeBlock>
        <p style={{ marginTop: '0.75rem' }}>
          The UI decodes the JWT client-side (display only) to populate <strong>TenantBadge</strong>
          (email, 🏢 tenant, role, product chips).
        </p>
      </Step>

      <Step number={2} title="Dashboard Loads Live Metrics" color="#059669">
        <p>On mount, <code>ComplianceDashboard</code> fires two parallel requests:</p>
        <CodeBlock lang="GET">{`
GET /api/analytics/dashboard
Authorization: Bearer <user-jwt>

→ {
    "metrics": {
      "totalChecks": 1240,
      "approved": 1150,
      "rejected": 42,
      "escalated": 31,
      "pendingReview": 17,
      "averageRiskScore": 18.4,
      "highRiskEntities": 6
    },
    "topRiskFactors": [...],
    "recentTrends": [...]
  }

GET /api/v1/cases?limit=10
Authorization: Bearer <user-jwt>

→ [ { caseId, caseType, status, entityId, riskScore, ... }, ... ]
        `}</CodeBlock>
      </Step>

      <Step number={3} title="Compliance Officer Opens a Case" color="#d97706">
        <p>Roles <strong>admin</strong> and <strong>compliance_officer</strong> see the
        <em> + New Case</em> button. Submitting the form calls:</p>
        <CodeBlock lang="POST">{`
POST /api/v1/cases
Authorization: Bearer <user-jwt>
{
  "caseType": "SUSPICIOUS_ACTIVITY",
  "entityId": "0xABCD…",
  "jurisdiction": "AE",
  "summary": "Anomalous transfer pattern detected",
  "riskScore": 82
}

→ 201 Created
{ "caseId": "case-uuid", "status": "OPEN", ... }
        `}</CodeBlock>
      </Step>

      <Step number={4} title="Risk Trends & Factor Analysis" color="#7c3aed">
        <p>The dashboard renders a 7-day <strong>risk trend sparkline</strong> and a
        <strong> top risk factors bar chart</strong> pulled from analytics routes.</p>
        <CodeBlock lang="GET">{`
GET /api/analytics/risk-factors?limit=5
GET /api/analytics/trends?days=7
        `}</CodeBlock>
        <p style={{ marginTop: '0.75rem' }}>All responses are scoped to the authenticated tenant —
        the backend enforces <code>WHERE tenant_id = req.user.tenant</code>.</p>
      </Step>

      <Step number={5} title="Tenant Context Isolation" color="#dc2626">
        <p>Every API call carries the user JWT. The middleware layer:</p>
        <ol className="arch-ol">
          <li>Verifies the JWT signature</li>
          <li>Extracts <code>tenant</code>, <code>role</code>, <code>products</code></li>
          <li>Injects into <code>req.user</code></li>
          <li>DB queries append <code>AND tenant_id = $1</code> automatically</li>
        </ol>
        <p style={{ marginTop: '0.75rem' }}>
          Alice at TENANT_ACME can never see TENANT_BETA data — even if she guesses a URL.
        </p>
      </Step>

      <Step number={6} title="Session Refresh & Sign-Out" color="#0e7490">
        <CodeBlock lang="POST">{`
POST /api/auth/refresh      // extend session before JWT expires
POST /api/auth/logout       // server-side token blacklist + clear localStorage
        `}</CodeBlock>
      </Step>
    </div>
  </div>
);

// ─── JWT reference tab ────────────────────────────────────────────────────────

const JwtTab: React.FC = () => (
  <div className="arch-section">
    <h2 className="arch-h2">JWT &amp; Token Reference</h2>
    <p className="arch-lead">
      All tokens issued by Ableka Lumina carry a standard set of claims.
      The <strong>tenant</strong> claim is the multi-tenancy isolation key.
    </p>

    <div className="arch-token-grid">
      {/* User JWT */}
      <div className="arch-token-card">
        <h3>👤 User JWT (email/password login)</h3>
        <CodeBlock lang="JWT payload">{`
{
  "id": "usr-uuid",
  "sub": "alice@acme.com",
  "email": "alice@acme.com",
  "role": "compliance_officer",
  "permissions": ["compliance:READ", "pe:READ"],
  "tenant": "TENANT_ACME",
  "products": ["PE", "COMPLIANCE"],
  "iat": 1741000000,
  "exp": 1741003600    // 1-hour expiry
}
        `}</CodeBlock>
        <div className="arch-claim-table">
          <div className="arch-claim-row"><code>tenant</code><span>Multi-tenancy isolation key — DB filter</span></div>
          <div className="arch-claim-row"><code>role</code><span>RBAC gate: admin / compliance_officer / analyst / client</span></div>
          <div className="arch-claim-row"><code>products</code><span>Which product modules are accessible</span></div>
          <div className="arch-claim-row"><code>permissions</code><span>Fine-grained resource:ACTION strings</span></div>
        </div>
      </div>

      {/* Machine JWT */}
      <div className="arch-token-card">
        <h3>🤖 Machine JWT (OAuth2 client_credentials)</h3>
        <CodeBlock lang="JWT payload">{`{\n  "iss": "https://${AUTH_DOMAIN}",\n  "aud": "https://${API_DOMAIN}",\n  "sub": "client_TENANT_ACME_a1b2c3",\n  "tenant": "TENANT_ACME",\n  "products": ["PE", "COMPLIANCE"],\n  "scope": "pe:read compliance:read",\n  "iat": 1741000000,\n  "exp": 1741003600\n}`}</CodeBlock>
        <div className="arch-claim-table">
          <div className="arch-claim-row"><code>sub</code><span>OAuth2 client_id — machine identity</span></div>
          <div className="arch-claim-row"><code>scope</code><span>Space-separated OAuth2 scopes granted</span></div>
          <div className="arch-claim-row"><code>tenant</code><span>Same isolation key as user tokens</span></div>
        </div>
      </div>
    </div>

    <h2 className="arch-h2" style={{ marginTop: '2rem' }}>API Key vs OAuth2 — When to Use Each</h2>
    <div className="arch-compare-table">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>🔑 API Key</th>
            <th>🛡 OAuth2 Client Credentials</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Storage</td><td>SHA-256 hash in DB</td><td>bcrypt hash in DB</td></tr>
          <tr><td>Token lifetime</td><td>Long-lived (until revoked)</td><td>Short-lived JWT (1 h)</td></tr>
          <tr><td>Transport</td><td><code>X-API-Key</code> header</td><td><code>Authorization: Bearer</code></td></tr>
          <tr><td>Scope control</td><td>Products + allowed_scopes at creation</td><td>Scopes negotiated at token request</td></tr>
          <tr><td>Best for</td><td>Simple server-to-server, webhooks</td><td>Fine-grained scope + token rotation</td></tr>
          <tr><td>Rotation</td><td>Revoke + generate new</td><td>Secret rotation or re-issue</td></tr>
        </tbody>
      </table>
    </div>

    <h2 className="arch-h2" style={{ marginTop: '2rem' }}>Available OAuth2 Scopes</h2>
    <div className="arch-scope-grid">
      {[
        { scope: 'pe:read',          desc: 'Read PE holdings, transactions, reports' },
        { scope: 'pe:write',         desc: 'Create / update PE records' },
        { scope: 'compliance:read',  desc: 'View compliance checks, cases, alerts' },
        { scope: 'compliance:write', desc: 'Create cases, trigger compliance checks' },
        { scope: 'aml:read',         desc: 'View AML risk scores and flags' },
        { scope: 'kyc:read',         desc: 'View KYC verification results' },
        { scope: 'reporting:read',   desc: 'Access SAR/CTR reports and analytics' },
      ].map(({ scope, desc }) => (
        <div key={scope} className="arch-scope-row">
          <code className="arch-scope-code">{scope}</code>
          <span>{desc}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Root component ───────────────────────────────────────────────────────────

const ArchitecturePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="arch-root">
      <div className="arch-header">
        <h1 className="arch-page-title">Architecture &amp; API Journey</h1>
        <p className="arch-page-subtitle">
          Complete reference for both platform flows — tenant onboarding and compliance dashboard.
        </p>
      </div>

      <div className="arch-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`arch-tab-btn ${activeTab === t.id ? 'arch-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="arch-tab-content">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'flow1'    && <Flow1Tab />}
        {activeTab === 'flow2'    && <Flow2Tab />}
        {activeTab === 'jwt'      && <JwtTab />}
      </div>
    </div>
  );
};

export default ArchitecturePage;
