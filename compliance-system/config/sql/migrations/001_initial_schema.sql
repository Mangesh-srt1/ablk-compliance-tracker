-- Migration 001: Initial database schema setup
-- Created: 2026-02-27 (Friday)
-- Purpose: Create foundational database schema for compliance system
-- Status: Applied during initial docker-compose up (via init-database.sql)

-- This migration documents the initial schema created in init-database.sql
-- All tables, indexes, views, and functions are defined there

-- Key Tables Created:
-- 1. users - Compliance officers, analysts, admins
-- 2. kyc_checks - KYC verification records per entity/jurisdiction
-- 3. aml_checks - AML risk assessments (Marble/Chainalysis integration)
-- 4. compliance_checks - Aggregated compliance decisions
-- 5. compliance_rules - Jurisdiction-specific rules (loaded from YAML)
-- 6. decision_vectors - ML embeddings for pattern learning (BYTEA format for Alpine)
-- 7. audit_logs - Compliance audit trail

-- Indexes on:
-- - Entity ID + Jurisdiction (primary lookup)
-- - Status + Created timestamp (for dashboards)
-- - Wallet address (blockchain monitoring)
-- - Risk score ranges (for escalation)

-- Views Created:
-- - pending_approvals: All pending KYC/AML needing review
-- - high_risk_entities: Entities with risk_score > 60
-- - compliance_summary: Daily compliance stats

-- All data is persisted in named volume: lumina_postgres_data
