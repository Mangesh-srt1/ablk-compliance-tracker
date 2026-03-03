-- Migration 003: Tenants, API Keys, and OAuth Clients
-- Purpose: Support B2B partner (API Key + Client Credentials) and
--          first-party web/mobile user flows with tenant+product JWT claims

-- ============================================================================
-- tenants: each direct customer/partner using the platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id          VARCHAR(64) PRIMARY KEY,          -- e.g. "TENANT_123"
    name        VARCHAR(255) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- api_keys: API Key issued per tenant partner application
-- Maps X-API-Key header → tenant_id + allowed products/scopes + rate limits
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key             VARCHAR(128) UNIQUE NOT NULL,
    tenant_id           VARCHAR(64) NOT NULL REFERENCES tenants(id),
    products            TEXT[]  NOT NULL DEFAULT '{}',  -- e.g. {"PE","COMPLIANCE"}
    allowed_scopes      TEXT[]  NOT NULL DEFAULT '{}',  -- e.g. {"pe:read","compliance:read"}
    rate_limit_per_min  INTEGER NOT NULL DEFAULT 60,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key      ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant   ON api_keys(tenant_id);

-- ============================================================================
-- oauth_clients: Client applications for OAuth2 Client Credentials grant
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_clients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id           VARCHAR(128) UNIQUE NOT NULL,
    client_secret_hash  VARCHAR(255) NOT NULL,  -- bcrypt hash of client_secret
    tenant_id           VARCHAR(64) NOT NULL REFERENCES tenants(id),
    products            TEXT[]  NOT NULL DEFAULT '{}',
    allowed_scopes      TEXT[]  NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);

-- ============================================================================
-- Extend users table: tenant + products for web/mobile operators
-- ============================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) REFERENCES tenants(id),
    ADD COLUMN IF NOT EXISTS products  TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- ============================================================================
-- Sample data for development/testing
-- ============================================================================
INSERT INTO tenants (id, name) VALUES
    ('TENANT_123', 'Demo Fund Platform'),
    ('TENANT_456', 'RWA Enterprise')
    ON CONFLICT DO NOTHING;

-- Sample API key (value = "test-api-key-tenant-123")
INSERT INTO api_keys (api_key, tenant_id, products, allowed_scopes, rate_limit_per_min) VALUES
    ('test-api-key-tenant-123', 'TENANT_123', '{"PE","COMPLIANCE"}', '{"pe:read","pe:write","compliance:read"}', 120)
    ON CONFLICT DO NOTHING;

-- Sample OAuth client (secret = "client-secret-123", bcrypt-hashed cost 10)
INSERT INTO oauth_clients (client_id, client_secret_hash, tenant_id, products, allowed_scopes) VALUES
    ('client_TENANT_123',
     '$2a$10$oWi/yf2UkC7USE8M8l/E6eVZcDfXSWlE.MI0YhDSow9Bos71CaEIO',
     'TENANT_123',
     '{"PE","COMPLIANCE"}',
     '{"pe:read","pe:write","compliance:read"}')
    ON CONFLICT DO NOTHING;
