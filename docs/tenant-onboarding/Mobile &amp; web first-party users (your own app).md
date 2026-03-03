

For your case: **B2B partners** + **first‑party web/mobile tenants** (each tenant can have multiple products), use **API keys for partner apps** and **JWTs with tenant + product claims** for users.

***

## 1. Concepts

- **Tenant** = your direct customer (e.g., a fund, platform, enterprise) using your APIs.
- **Product** = a specific solution/module (e.g., compliance tracking, reporting) they consume from you.
- **User** (web/mobile) = an operator inside that tenant (e.g., admin, analyst, compliance officer) viewing/managing data for one or more products.

So your tokens should always encode: **who** (user or client), **which tenant**, **which products/scopes**.

***

## 2. B2B flows (partner / tenant backends → your APIs)

Use **API Key + OAuth2 Client Credentials**.

### Onboarding

- For each tenant/partner app, create a **client application** in your auth system and issue:
    - `client_id`, `client_secret`
    - `api_key` (mapped to `tenant_id`, allowed products, rate limits)

Example mapping:

- `api_key` → `{ tenant_id: "TENANT_123", products: ["PE", "COMPLIANCE"] }`.


### Getting an access token (server-to-server)

Partner backend obtains a **tenant-scoped JWT**:

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&
client_id=...&
client_secret=...&
scope=pe:read pe:write compliance:read
```

Auth server returns a **JWT access token**, e.g.:

```json
{
  "iss": "https://auth.abeleka.com",
  "aud": "https://api.abeleka.com",
  "sub": "client_TENANT_123",
  "tenant": "TENANT_123",
  "products": ["PE", "COMPLIANCE"],
  "scope": "pe:read pe:write compliance:read",
  "exp": 1710003600
}
```


### Calling your APIs

```http
GET /v1/pe/holdings
Authorization: Bearer <jwt_access_token>
X-API-Key: <partner_api_key>
```

**Gateway / backend responsibilities**:

- Validate `X-API-Key`:
    - Exists, active, mapped to `tenant_id`, products.
- Validate JWT:
    - Signature, `iss`, `aud`, `exp`.
    - `tenant` matches API key tenant.
    - `scope` includes required permission for the endpoint.
- Enforce that the call can only access data for `TENANT_123` and only for the requested products.

***

## 3. First-party web users (your own web app, tenant operators)

Use **OAuth2 Authorization Code + OIDC**.

### Login \& token

1. User goes to your web app and selects or is mapped to a **tenant**.
2. Redirect to IdP login (Auth0, Cognito, Keycloak, etc.).
3. On success, your app exchanges `code` for tokens:
    - `id_token` (identity)
    - `access_token` (JWT with tenant, products, roles)
    - optional `refresh_token`.

Example `access_token` claims:

```json
{
  "iss": "https://auth.abeleka.com",
  "aud": "https://api.abeleka.com",
  "sub": "user_987",
  "tenant": "TENANT_123",
  "products": ["PE", "COMPLIANCE"],
  "roles": ["TENANT_ADMIN", "COMPLIANCE_OFFICER"],
  "scope": "pe:read compliance:read compliance:write",
  "exp": 1710003600
}
```


### API calls

```http
GET /v1/compliance/cases
Authorization: Bearer <access_token>
```

Gateway/backends:

- Validate JWT (signature, `iss`, `aud`, `exp`).
- Use `tenant` to restrict all queries to that tenant’s data.
- Use `products`/`roles`/`scope` to allow only relevant modules and operations.

No API key here, because this is your own first‑party app.

***

## 4. First-party mobile users (your own mobile app, tenant operators)

Use **Authorization Code + PKCE + OIDC**.

Flow is the same as web, but with PKCE and secure storage:

1. Mobile app initiates login with PKCE → user authenticates.
2. App exchanges code for `access_token` (and optional refresh token).
3. Store tokens in **OS secure storage** (Keychain/Keystore).
4. Every request:
```http
Authorization: Bearer <access_token>
```

- Token includes `tenant`, `products`, `roles`, `scope` same as web.
- Backend enforces tenant/product scoping.

***

## 5. JWT verification \& multi-tenant enforcement

For **all** JWTs (B2B and first‑party):

1. Verify signature using JWKS (RS256/ES256).
2. Check:
    - `iss` = `https://auth.abeleka.com`
    - `aud` = `https://api.abeleka.com`
    - `exp` and optionally `nbf`
3. Extract key claims:
    - `tenant` → use for **row-level / index-level scoping** in DB queries.
    - `products` → enforce product/module access.
    - `roles` / `scope` → enforce fine-grained permissions.

Microservices do **local** JWT validation; no per‑request call to IdP.

***

## 6. Security \& best practices for this multi-tenant model

- **Strict tenant isolation**:
    - Every query must filter by `tenant` from token, not from client input.
- **Product isolation**:
    - Endpoints/products should check `products` claim (e.g., deny if PE module is not enabled for that tenant).
- **Short-lived tokens**:
    - Access tokens 15–60 minutes; refresh tokens only from first‑party apps, never B2B client-credentials flows.
- **API keys**:
    - Only for B2B server-to-server.
    - Rotate and revoke; tie to `tenant` and allowed `products`.
    - Optionally mTLS/IP allow‑listing for high‑risk tenants.
- **Auditing**:
    - Log `tenant`, `sub`, `products`, endpoint, action, result; mandatory for your compliance engine.

***


Including product context in auth is a good idea, but **don’t overload `scope` with product IDs.** Use separate, structured claims.

### Recommended pattern

- Keep **`scope`** for *capabilities* (verbs/permissions), e.g.:
    - `pe:read`, `pe:write`, `compliance:read`, `compliance:write`.
- Add **dedicated claims** for product info:
    - `tenant`: `"TENANT_123"`
    - `products`: `["PE", "COMPLIANCE"]` or objects with ids:
        - `product_ids`: `["prod_pe_001", "prod_comp_017"]`
    - Optionally per‑product roles/limits in a nested claim.

Example:

```json
{
  "sub": "user_987",
  "tenant": "TENANT_123",
  "product_ids": ["prod_pe_001", "prod_comp_017"],
  "scope": "pe:read compliance:read"
}
```

Your services then:

- Use `scope` to decide *what* actions are allowed.
- Use `tenant` + `product_ids` to decide *which* products/resources this token can touch.


