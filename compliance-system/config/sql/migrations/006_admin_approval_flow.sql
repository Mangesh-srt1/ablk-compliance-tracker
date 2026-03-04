-- Migration 006: Admin approval flow for user registration
-- Created: 2026-03-04
-- Purpose:
--   1. Add `approval_status` column to track whether a platform admin has approved
--      a self-registered user account (pending_approval → approved | rejected).
--   2. Align `verify-otp` semantics: email verification no longer auto-activates
--      accounts — admin approval is required before `is_active` is set to true.
--   3. Seed the platform bootstrap admin user (admin@platform.com) so there is
--      always an account that can approve new registrations.
-- ============================================================================

-- 1. Add approval_status column
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) NOT NULL DEFAULT 'approved';
-- Existing users (created before this migration) keep 'approved' so they are
-- not locked out. New self-registered users start as 'pending_approval'.

-- 2. Create an index for the approval queue (admin dashboard query)
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);

-- ============================================================================
-- Bootstrap platform admin (admin@platform.com)
-- Password: Admin@Platform1  (bcrypt cost 12)
-- ⚠️  Change this password immediately after the first login in production.
-- ============================================================================
INSERT INTO users (
    id,
    email,
    full_name,
    role,
    password_hash,
    is_active,
    is_email_verified,
    approval_status,
    permissions
)
VALUES (
    uuid_generate_v4(),
    'admin@platform.com',
    'Platform Administrator',
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewmc6c5Gy5JkVfmK',  -- Admin@Platform1
    true,
    true,
    'approved',
    ARRAY['*']
)
ON CONFLICT (email) DO NOTHING;
