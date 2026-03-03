-- Migration 004: Schema fixes, secure API key storage, and tenant management support
-- Run after migration 003.

-- ============================================================================
-- 1. Fix column name: users.active → users.is_active
--    (authRoutes.ts references is_active; schema had active)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'active'
  ) THEN
    ALTER TABLE users RENAME COLUMN active TO is_active;
  END IF;
END $$;

-- ============================================================================
-- 2. Add permissions column to users (referenced by authRoutes but missing)
-- ============================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- ============================================================================
-- 3. Secure API key storage: add key_hash (SHA-256) and key_prefix columns
--    The middleware will hash incoming keys and compare against key_hash.
--    key_prefix stores the first 12 chars for masked display (e.g. lmk_live_xxxx…).
-- ============================================================================
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS key_hash   VARCHAR(64),
    ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_keyhash
    ON api_keys(key_hash)
    WHERE key_hash IS NOT NULL;

-- Backfill hash for the existing seed key "test-api-key-tenant-123"
-- (development seed data only – safe to skip on production where no plaintext key exists)
-- SHA-256("test-api-key-tenant-123") = 061865f875777c460fddae0162a05f17b32893fafe7b838e1a7628c38cea3b3f
UPDATE api_keys
   SET key_hash   = '061865f875777c460fddae0162a05f17b32893fafe7b838e1a7628c38cea3b3f',
       key_prefix = 'test-api-key'
 WHERE api_key = 'test-api-key-tenant-123'
   AND key_hash IS NULL;

-- ============================================================================
-- 4. Demo admin user with known password (Password123!) for development login
--    bcrypt(Password123!, cost=10) = $2b$10$k4DTlk.duPL96obMmm5asecxZpIJzmh44XfhAC9s5URrwOLQiE/NW
-- ============================================================================
INSERT INTO users (email, full_name, role, is_active, password_hash, permissions, tenant_id, products)
VALUES (
    'admin@ableka.io',
    'Platform Admin',
    'admin',
    true,
    '$2b$10$k4DTlk.duPL96obMmm5asecxZpIJzmh44XfhAC9s5URrwOLQiE/NW',
    '{"admin:ALL"}',
    NULL,
    '{}'
) ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      permissions   = EXCLUDED.permissions,
      is_active     = true;

-- Fix existing seed users: they were inserted without password_hash (NOT NULL violation)
-- Give them the same demo password so they are usable
UPDATE users
   SET password_hash = '$2b$10$k4DTlk.duPL96obMmm5asecxZpIJzmh44XfhAC9s5URrwOLQiE/NW',
       is_active     = true
 WHERE password_hash = '' OR password_hash IS NULL;
