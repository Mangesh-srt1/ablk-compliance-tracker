<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# there are two flows 1. Onboarding tenants for client id and secret and sharing api key with them 2. Compliance dashboard for tenant users. Can you give me detailed architecture and user \& api journey flow?

Here’s a clear architecture and journey for both flows in your compliance system.

***

## High-level architecture

- **Frontend**
    - Compliance Dashboard (web)
    - Future: Mobile app
- **API Gateway**
    - Terminates TLS, validates JWTs/API keys, routes to services
- **Auth/IdP**
    - OIDC/OAuth2 server (Auth0/Cognito/Keycloak/custom)
- **Core Services**
    - Tenant Management Service (onboarding, client_id/secret, API keys)
    - Compliance API (cases, rules, monitoring, reports)
    - User Management / RBAC Service
- **Shared**
    - Multi-tenant DB (with tenant_id on every row)
    - Logs/audit

Tenants exist in both flows; tenant id travels in tokens and DB filters.[^1][^2][^3]

***

## Flow 1: Onboarding tenants (client_id, secret, API key)

### 1. Tenant admin signs up / is created

- Abeleka ops or a self-serve onboarding portal creates a **Tenant**:
    - `tenant_id`
    - Name, contact, billing info
    - Enabled products (e.g., PE, Compliance, Reporting)
- Store tenant record in Tenant Management DB.[^4][^2]


### 2. Create machine client + API key

Tenant Management Service:

- Creates an **OAuth2 client** for this tenant (machine-to-machine client):
    - `client_id`
    - `client_secret`
    - Allowed scopes (`pe:read`, `pe:write`, `compliance:read`, etc.)
- Generates an **API key** bound to:
    - `tenant_id`
    - List of allowed `product_ids`
    - Rate limits / quotas

Stores (`client_id`, `client_secret`, `api_key`, `tenant_id`, `product_ids`) securely.

### 3. Share credentials securely

You provide to the tenant (out of band):

- `client_id`
- `client_secret`
- `api_key`
- Auth and API endpoints, sample curl, Postman collection

Tenants use this in their own backend systems to call your APIs.

### 4. Tenant system calling your API (server-to-server)

**Step A: Get access token (Client Credentials)**

Tenant backend:

```http
POST https://auth.abeleka.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=CLIENT_ID&
client_secret=CLIENT_SECRET&
scope=pe:read pe:write compliance:read
```

Auth/IdP returns JWT:

```json
{
  "iss": "https://auth.abeleka.com",
  "aud": "https://api.abeleka.com",
  "sub": "client_TENANT_123",
  "tenant": "TENANT_123",
  "product_ids": ["prod_pe_001", "prod_comp_017"],
  "scope": "pe:read pe:write compliance:read",
  "exp": 1710003600
}
```

**Step B: Call your API**

```http
GET /v1/pe/holdings
Host: api.abeleka.com
Authorization: Bearer <jwt_access_token>
X-API-Key: <tenant_api_key>
```

**API Gateway does:**

1. Verify **API key**:
    - Exists, active, matches `tenant_id`, allowed `product_ids`.
2. Verify **JWT**:
    - Signature via JWKS
    - `iss`, `aud`, `exp`
    - `tenant` matches API key’s tenant
    - `scope` is sufficient for endpoint
3. Add tenant context headers for downstream services, e.g.:
    - `X-Tenant-Id: TENANT_123`
    - `X-Products: prod_pe_001,prod_comp_017`

**Compliance / PE services**:

- Always filter DB queries by `tenant_id` from token/header.
- Optionally enforce product-specific logic using `product_ids` and `scope`.

This completes the onboarding and B2B usage loop.[^5][^6]

***

## Flow 2: Compliance dashboard login for tenant users

### 1. User navigates to dashboard

- URL: `https://compliance.abeleka.com`
- Option A: Subdomain per tenant, e.g. `https://tenant123.abeleka.com`
- Option B: Shared domain with tenant selection (or auto-resolved by email domain).

The frontend obtains or infers the **tenant context** (`TENANT_123`).[^3][^7]

### 2. Redirect to IdP (OIDC Authorization Code + PKCE)

Frontend starts OIDC flow with tenant info encoded (e.g. `tenant=TENANT_123` in state/claims):

```http
GET https://auth.abeleka.com/authorize
  ?response_type=code
  &client_id=COMPLIANCE_DASHBOARD_CLIENT_ID
  &redirect_uri=https://compliance.abeleka.com/callback
  &scope=openid profile offline_access compliance:read compliance:write
  &state=xyz_with_tenant_info
  &code_challenge=...
  &code_challenge_method=S256
```

User logs in using Abeleka’s credentials or SSO (if you later support enterprise IdPs).[^8][^9][^5]
NOte- I would prefer implement both.

### 3. Token exchange

Backend or frontend (with PKCE) exchanges `code` for tokens:

```http
POST https://auth.abeleka.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE&
redirect_uri=https://compliance.abeleka.com/callback&
code_verifier=...
```

IdP returns:

- `id_token` – identity info
- `access_token` (JWT) – used for APIs
- `refresh_token` – optional, for silent re-login

Example `access_token`:

```json
{
  "iss": "https://auth.abeleka.com",
  "aud": "https://api.abeleka.com",
  "sub": "user_987",
  "tenant": "TENANT_123",
  "product_ids": ["prod_pe_001", "prod_comp_017"],
  "roles": ["COMPLIANCE_OFFICER"],
  "scope": "compliance:read compliance:write",
  "exp": 1710003600
}
```


### 4. Frontend calling the compliance APIs

Browser SPA:

```http
GET /v1/compliance/cases
Host: api.abeleka.com
Authorization: Bearer <access_token>
```

(No API key here, because this is your **first-party** app.)

### 5. Gateway and services behavior

API Gateway:

1. Verify JWT signature and standard claims.
2. Extract `tenant`, `product_ids`, `roles`, `scope`.
3. Add tenant context headers to downstream calls.

Compliance service:

- Uses `tenant` to filter all queries:
    - `SELECT * FROM cases WHERE tenant_id = :tenant_from_token`
- Uses `roles`/`scope` to check:
    - Only `TENANT_ADMIN` can manage users.
    - `COMPLIANCE_OFFICER` can open/close cases, file reports.
- Uses `product_ids` to:
    - Enable only those product-specific dashboards/modules.

If user is allowed across multiple tenants (future), you can either:

- Issue separate tokens per active tenant, or
- Use a `current_tenant` claim and a mechanism in UI to switch tenant; each switch results in a new token.[^10][^1]

***

## End-to-end view

**Onboarding \& B2B calls**

1. Abeleka creates tenant → client credentials + API key generated.
2. Tenant system calls `/oauth/token` (client_credentials) → gets tenant-scoped JWT.
3. Tenant system calls your APIs with `Bearer + X-API-Key`.
4. Gateway validates, services enforce tenant and product scoping.

**Tenant user dashboard**

1. User opens compliance dashboard (tenant context known).
2. Frontend triggers OIDC login → user authenticates.
3. App receives JWT with `tenant`, `product_ids`, `roles`, `scope`.
4. Dashboard uses `access_token` on each API call.
5. Gateway/services enforce the same multi-tenant rules as in B2B flow.

This gives you a unified, consistent architecture where:

- **Tenants** are first-class everywhere (tokens, DB, routing).
- **B2B APIs** and **dashboard users** share the same core auth model (JWT + tenant/product claims).
- Compliance logic can trust that every request already carries correct tenant and product context.
<span style="display:none">[^11][^12][^13]</span>

<div align="center">⁂</div>

[^1]: https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/identity

[^2]: https://workos.com/blog/developers-guide-saas-multi-tenant-architecture

[^3]: https://www.loginradius.com/blog/engineering/saas-identity-access-management

[^4]: https://oneuptime.com/blog/post/2026-02-12-build-multi-tenant-saas-application-on-aws/view

[^5]: https://www.scalekit.com/blog/oidc-implementation-in-b2b-saas-a-step-by-step-guide-for-developers-atjte

[^6]: https://learn.microsoft.com/en-us/answers/questions/1463127/microsoft-entra-id-multi-tenant-client-credentials

[^7]: https://frontegg.com/blog/saas-multitenancy

[^8]: https://ssojet.com/blog/streamlining-onboarding-multi-tenant-saas

[^9]: https://www.scalekit.com/blog/oidc-implementation-in-b2b-saas-a-step-by-step-guide-for-developers

[^10]: https://damienbod.com/2022/10/31/switch-tenants-in-an-asp-net-core-app-using-azure-ad-with-multi-tenants/

[^11]: https://dev.to/cristiansifuentes/microsoft-entra-id-multi-tenant-saas-net-8-web-api-a-production-grade-playbook-3-tenants-3-53f5

[^12]: https://aws.amazon.com/blogs/messaging-and-targeting/sms-onboarding-for-saas-isv-and-multi-tenant-applications-with-aws-end-user-messaging/

[^13]: https://hoop.dev/blog/why-you-need-a-real-time-oidc-compliance-dashboard/

