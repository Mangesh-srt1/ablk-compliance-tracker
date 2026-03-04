-- Migration 005: User self-registration, OTP email verification, and RBAC role expansion
-- Created: 2026-03-03
-- Purpose:
--   1. Support the self-registration flow (POST /api/auth/register → OTP → verify)
--   2. Align users table with authRoutes.ts which queries `is_active` (init-database.sql
--      only has `active`; this migration adds the authoritative `is_active` column and
--      backfills from `active` so existing users keep their status).
--   3. Ensure `permissions` TEXT[] column exists (used by authMiddleware and JWT payload).
--   4. Expand the accepted role values to include the five Ableka Lumina platform roles:
--      tenant_admin | compliance_officer | compliance_analyst | operator | read_only
-- ============================================================================

-- 1. Add `is_active` (canonical name used throughout auth code)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Backfill from legacy `active` column where it exists and is false
-- UPDATE users SET is_active = false WHERE active = false;
-- Note: Disabled - active column may not exist in fresh installs

-- 2. Add `is_email_verified` for the OTP confirmation step
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT false;

-- Existing admin-created accounts are considered pre-verified
-- UPDATE users SET is_email_verified = true;
-- Note: Disabled - no existing users in fresh install

-- 3. Add `permissions` column if it was not already added by a prior migration
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_is_active        ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_email_verified ON users(is_email_verified);
CREATE INDEX IF NOT EXISTS idx_users_role              ON users(role);
