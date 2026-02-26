-- Database Verification & Health Check Script
-- Purpose: Validate database setup, table structure, data integrity
-- Created: 2026-02-27 (Monday Mar 3 Implementation)
-- Usage: Run this script after docker-compose up to verify database health

-- ============================================================================
-- SECTION 1: TABLE EXISTENCE VERIFICATION
-- ============================================================================

-- Check that all required tables exist
SELECT 
    table_schema,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'kyc_checks', 'aml_checks', 'compliance_checks', 'compliance_rules', 'decision_vectors', 'audit_logs', 'jurisdictions')
ORDER BY table_name;

-- ============================================================================
-- SECTION 2: DATABASE STRUCTURE VALIDATION
-- ============================================================================

-- Verify critical columns exist in each table
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'kyc_checks'
  AND column_name IN ('id', 'entity_id', 'entity_type', 'jurisdiction', 'status', 'score', 'flags', 'created_at')
ORDER BY table_name, ordinal_position;

-- Verify KYC index exists
SELECT
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'kyc_checks'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- ============================================================================
-- SECTION 3: DATA INTEGRITY CHECKS
-- ============================================================================

-- Count records per table (health check)
SELECT 
    'kyc_checks' as table_name,
    COUNT(*) as record_count,
    COALESCE(MAX(created_at)::text, 'No records') as latest_record
FROM kyc_checks
  
UNION ALL SELECT 
    'aml_checks',
    COUNT(*),
    COALESCE(MAX(created_at)::text, 'No records')
FROM aml_checks

UNION ALL SELECT 
    'compliance_checks',
    COUNT(*),
    COALESCE(MAX(created_at)::text, 'No records')
FROM compliance_checks

UNION ALL SELECT 
    'users',
    COUNT(*),
    COALESCE(MAX(created_at)::text, 'No records')
FROM users

UNION ALL SELECT 
    'compliance_rules',
    COUNT(*),
    COALESCE(MAX(created_at)::text, 'No records')
FROM compliance_rules;

-- ============================================================================
-- SECTION 4: FOREIGN KEY VALIDATION
-- ============================================================================

-- Verify referential integrity: compliance_checks → kyc_checks
SELECT
    COUNT(*) as orphaned_kyc_references
FROM compliance_checks c
WHERE c.kyc_check_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM kyc_checks k WHERE k.id = c.kyc_check_id);

-- Verify referential integrity: compliance_checks → aml_checks
SELECT
    COUNT(*) as orphaned_aml_references
FROM compliance_checks c
WHERE c.aml_check_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM aml_checks a WHERE a.id = c.aml_check_id);

-- ============================================================================
-- SECTION 5: DATA QUALITY CHECKS
-- ============================================================================

-- Check for valid status values
SELECT
    'kyc_checks' as table_name,
    status,
    COUNT(*) as count
FROM kyc_checks
GROUP BY status
UNION ALL SELECT
    'aml_checks',
    status,
    COUNT(*)
FROM aml_checks
GROUP BY status
UNION ALL SELECT
    'compliance_checks',
    overall_status,
    COUNT(*)
FROM compliance_checks
GROUP BY overall_status;

-- Check for missing timestamps (should all have created_at)
SELECT
    'kyc_checks' as table_name,
    COUNT(CASE WHEN created_at IS NULL THEN 1 END) as missing_created_at,
    COUNT(CASE WHEN updated_at IS NULL THEN 1 END) as missing_updated_at
FROM kyc_checks

UNION ALL SELECT
    'aml_checks',
    COUNT(CASE WHEN created_at IS NULL THEN 1 END),
    COUNT(CASE WHEN updated_at IS NULL THEN 1 END)
FROM aml_checks

UNION ALL SELECT
    'compliance_checks',
    COUNT(CASE WHEN created_at IS NULL THEN 1 END),
    COUNT(CASE WHEN updated_at IS NULL THEN 1 END)
FROM compliance_checks;

-- ============================================================================
-- SECTION 6: VIEW VERIFICATION
-- ============================================================================

-- Check that all views exist
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'VIEW'
ORDER BY table_name;

-- Test pending_approvals view
SELECT COUNT(*) as pending_approval_count FROM pending_approvals;

-- Test high_risk_entities view
SELECT COUNT(*) as high_risk_count FROM high_risk_entities;

-- Test compliance_summary view
SELECT * FROM compliance_summary LIMIT 5;

-- ============================================================================
-- SECTION 7: PERFORMANCE CHECKS
-- ============================================================================

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_only_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- SECTION 8: CONNECTION & SESSION INFO
-- ============================================================================

-- Verify current database
SELECT
    current_database() as database,
    current_user as user,
    current_timestamp as timestamp,
    version() as postgres_version;

-- Check active connections
SELECT
    datname,
    usename,
    COUNT(*) as connection_count
FROM pg_stat_activity
WHERE datname IS NOT NULL
GROUP BY datname, usename;

-- ============================================================================
-- SECTION 9: SAMPLE DATA VALIDATION
-- ============================================================================

-- Show sample KYC record with all related data
SELECT
    k.entity_id,
    k.entity_type,
    k.jurisdiction,
    k.status,
    k.score,
    a.risk_level,
    a.pep_match,
    a.sanctions_match,
    c.overall_status as compliance_status
FROM kyc_checks k
LEFT JOIN aml_checks a ON k.entity_id = a.entity_id
LEFT JOIN compliance_checks c ON k.entity_id = c.entity_id
LIMIT 5;

-- Count test data by jurisdiction
SELECT
    jurisdiction,
    COUNT(DISTINCT entity_id) as total_entities,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
    SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated
FROM kyc_checks
GROUP BY jurisdiction
ORDER BY jurisdiction;

-- ============================================================================
-- SECTION 10: COMPLIANCE SUMMARY REPORT
-- ============================================================================

-- Risk distribution across all jurisdictions
SELECT
    CASE 
        WHEN a.risk_score < 30 THEN 'LOW'
        WHEN a.risk_score < 60 THEN 'MEDIUM'
        WHEN a.risk_score < 85 THEN 'HIGH'
        ELSE 'CRITICAL'
    END as risk_level,
    COUNT(*) as entity_count,
    ROUND(AVG(a.risk_score)::numeric, 2) as avg_risk_score,
    MIN(a.risk_score) as min_score,
    MAX(a.risk_score) as max_score
FROM aml_checks a
GROUP BY risk_level
ORDER BY avg_risk_score DESC;

-- Entities requiring action
SELECT
    k.entity_id,
    k.jurisdiction,
    k.status,
    a.risk_level,
    CASE 
        WHEN a.pep_match THEN 'PEP match'
        WHEN a.sanctions_match THEN 'Sanctions match'
        WHEN k.status = 'pending' THEN 'Documentation pending'
        WHEN k.status = 'escalated' THEN 'Escalated for review'
        ELSE 'OK'
    END as action_required
FROM kyc_checks k
LEFT JOIN aml_checks a ON k.entity_id = a.entity_id
WHERE k.status IN ('pending', 'escalated', 'rejected')
   OR a.pep_match = true
   OR a.sanctions_match = true
ORDER BY k.jurisdiction, k.entity_id;

-- ============================================================================
-- EXPECTED RESULTS FOR VERIFICATION
-- ============================================================================
/*
EXPECTED COUNTS AFTER SEEDING:
- 9 kyc_checks records (3 per jurisdiction: AE, IN, US)
- 9 aml_checks records (matched to KYC)
- 4 compliance_checks aggregates
- 6+ audit_log entries
- 10+ jurisdiction rules

EXPECTED STATUS DISTRIBUTION (from seed data):
- APPROVED: 5 records
- PENDING: 3 records  
- ESCALATED: 1 record
- REJECTED: 1 record

EXPECTED RISK DISTRIBUTION:
- LOW: 4 entities (risk < 30)
- MEDIUM: 1 entity (risk 60-85)
- HIGH: 0 entities
- CRITICAL: 2 entities (risk > 85)

VIEW RESULTS:
- pending_approvals: 3+ records (entities with pending KYC)
- high_risk_entities: 2-3 records (risk_score > 60)
- compliance_summary: Daily stats with counts by status
*/
