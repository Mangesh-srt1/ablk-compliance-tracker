-- Migration 007: Bootstrap admin flag for one-time-use suspension
-- Created: 2026-03-04
-- Purpose:
--   Mark the platform seed admin (admin@platform.com) as a bootstrap admin.
--   The backend will automatically suspend (is_active = false) the bootstrap
--   admin the first time it approves a self-registered user, ensuring the
--   temporary seed account cannot be used for ongoing access.
-- ============================================================================

-- 1. Add is_bootstrap_admin flag (defaults false so existing non-seed admins
--    are unaffected by the suspension logic).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_bootstrap_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Mark the seed admin that was inserted by migration 006.
UPDATE users
   SET is_bootstrap_admin = true
 WHERE email = 'admin@platform.com'
   AND role  = 'admin';
