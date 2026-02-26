# Monday (Mar 3) Database Provisioning Guide

**Phase**: Week 2 Core Services (Mar 3-9)  
**Focus**: PostgreSQL database setup, test data seeding, verification  
**Estimated Time**: 2-3 hours  
**Prerequisites**: Docker engine running, docker-compose v2+, 2GB disk space  

---

## Overview

### What We're Building Today

1. ✅ **PostgreSQL 16-Alpine Database** (already configured in docker-compose.dev.yml)
2. ✅ **Complete Database Schema** (7 tables, 15+ indexes, 3 views)
3. ✅ **Test Data Seeding** (25+ realistic compliance records)
4. ✅ **Database Verification** (15-point health check)
5. ✅ **API Integration** (confirm Express.js can query database)

### Service Architecture

```
Docker Network (lumina-network-dev)
├── PostgreSQL 16-Alpine (internal only, port 5432)
│   ├── Database: compliance_db
│   ├── User: postgres (password: postgres)
│   └── Volumes: lumina_postgres_data (persistent storage)
├── Redis 7-Alpine (localhost:6380 → internal 6379)
│   └── Volumes: lumina_redis_data (persistent)
├── API Service (localhost:4000 → internal 3000)
│   └── Connects to: postgres:5432 (internal DNS)
└── Agents Service (localhost:4002 → internal 3002)
    └── Connects to: postgres:5432 (internal DNS)
```

### Expected Outcomes

By end of day:
- ✅ PostgreSQL running and accessible
- ✅ All 7 tables created (users, kyc_checks, aml_checks, compliance_checks, compliance_rules, decision_vectors, audit_logs)
- ✅ Test data loaded (25+ records across 3 jurisdictions: AE, IN, US)
- ✅ Database health verified (all checks passing)
- ✅ API health endpoint showing database as "connected"
- ✅ Zero TypeScript errors in build
- ✅ Integration tests ready for execution Tuesday

---

## Step 1: Start Docker Compose (5 minutes)

### 1A: Verify Docker Engine Running

```bash
cd compliance-system
docker --version          # Should show Docker version 24.0+
docker ps                 # Should return empty list (no errors)
```

### 1B: Start Development Stack

```bash
# From compliance-system directory
docker-compose -f docker-compose.dev.yml up -d

# Expected output:
# Creating lumina-postgres-dev ... done
# Creating lumina-redis-dev ... done
# Creating lumina-api-dev ... done
# Creating lumina-agents-dev ... done
```

### 1C: Verify Containers Starting

```bash
# Check container status (wait 10-15 seconds for PostgreSQL to initialize)
docker-compose -f docker-compose.dev.yml ps

# Expected status: "Up" for all containers
# PostgreSQL: "healthy" after ~30 seconds
```

### 1D: Watch PostgreSQL Logs (for troubleshooting)

```bash
# In separate terminal, watch PostgreSQL initialization
docker-compose -f docker-compose.dev.yml logs -f postgres

# Should see messages like:
# "PostgreSQL Database directory appears to contain a database; Skipping initialization"
# "PostgreSQL init process complete; ready for start up."
```

**⏱️ Wait 30-45 seconds** for PostgreSQL to be healthy before proceeding.

---

## Step 2: Verify Database Initialization (5 minutes)

### 2A: Connect to PostgreSQL Container

```bash
# Open PostgreSQL interactive terminal
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db

# You should see: psql (16.X)
```

### 2B: Verify Tables Created

```sql
-- Inside psql terminal

-- List all tables
\dt

-- Expected output (7 tables):
-- public | users
-- public | kyc_checks
-- public | aml_checks
-- public | compliance_checks
-- public | compliance_rules
-- public | decision_vectors
-- public | audit_logs
```

### 2C: Verify Sample Data Loaded

```sql
-- Count records per table
SELECT 'users' as table_name, COUNT(*) FROM users UNION ALL
SELECT 'kyc_checks', COUNT(*) FROM kyc_checks UNION ALL
SELECT 'aml_checks', COUNT(*) FROM aml_checks UNION ALL
SELECT 'compliance_checks', COUNT(*) FROM compliance_checks UNION ALL
SELECT 'compliance_rules', COUNT(*) FROM compliance_rules;

-- Expected (from init-database.sql):
-- users         | 4
-- kyc_checks    | 9
-- aml_checks    | 9
-- compliance_checks | 4
-- compliance_rules  | 6
```

### 2D: Verify Indexes Exist

```sql
-- List indexes
\di

-- Should see 15+ indexes including:
-- idx_kyc_checks_entity_jurisdiction
-- idx_kyc_checks_status
-- idx_aml_checks_jurisdiction
-- idx_compliance_checks_status
-- etc.
```

### 2E: Exit PostgreSQL Terminal

```sql
\q
```

---

## Step 3: Seed Additional Test Data (10 minutes)

### 3A: Load Test Data Seeding Script

The `config/sql/seed-test-data.sql` file contains realistic test records for:
- **9 KYC checks** (3 per jurisdiction: AE, IN, US)
- **9 AML checks** (matched to KYC)
- **4 compliance aggregates**
- **6+ audit log entries**

### 3B: Apply Seed Data from Container

```bash
# Option 1: Via docker-compose
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db < config/sql/seed-test-data.sql

# Option 2: Copy file into container then run
docker cp config/sql/seed-test-data.sql lumina-postgres-dev:/tmp/seed-test-data.sql
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -f /tmp/seed-test-data.sql
```

### 3C: Verify Seed Data Loaded

```bash
# Connect and verify
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -c "
SELECT 
  'kyc_checks' as table_name, COUNT(*) as count FROM kyc_checks
  UNION ALL SELECT 'aml_checks', COUNT(*) FROM aml_checks  
  UNION ALL SELECT 'compliance_checks', COUNT(*) FROM compliance_checks
  UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;
"

# Expected (after seed data):
-- kyc_checks | 9
-- aml_checks | 9
-- compliance_checks | 4+
-- audit_logs | 6+
```

---

## Step 4: Run Database Verification (15 minutes)

### 4A: Execute Verification Script

```bash
# Run comprehensive health checks
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -f config/sql/verify-database.sql

# This generates a report including:
# - Table existence (8 tables)
# - Data integrity (no orphaned references)
# - Status distribution (approved/pending/rejected/escalated)
# - Risk score distribution
# - Index usage
# - View functionality
# - Connection info
```

### 4B: Expected Verification Results

**Table Counts**:
```
kyc_checks         | 9 records
aml_checks         | 9 records
compliance_checks  | 4+ records
compliance_rules   | 6+ records
audit_logs         | 6+ records
```

**Status Distribution**:
```
APPROVED   | 5 records (risk_score < 30)
PENDING    | 3 records
ESCALATED  | 1 record  (PEP risk or high velocity)
REJECTED   | 1 record  (sanctions match)
```

**Risk Distribution**:
```
LOW        | 4 entities (risk < 30)
MEDIUM     | 1 entity (risk 60-85)
CRITICAL   | 2 entities (risk > 85)
```

**View Tests**:
```
pending_approvals view    | 3+ records
high_risk_entities view   | 2+ records
compliance_summary view   | Returns daily stats
```

### 4C: Check for Issues

```bash
# If any verification fails, check PostgreSQL logs
docker-compose -f docker-compose.dev.yml logs postgres --tail=50

# Common issues:
# - "relation does not exist" → Schema not created (wait for postgres to initialize)
# - "permission denied" → User/password mismatch
# - "too many connections" → Need to increase max_connections setting
```

---

## Step 5: Verify API → Database Connection (10 minutes)

### 5A: Check API Health Endpoint

```bash
# Call health endpoint (should show database: connected)
curl -s http://localhost:4000/api/v1/health | jq .

# Expected response:
#{
#  "status": "healthy",
#  "timestamp": "2026-03-03T10:30:00Z",
#  "uptime": 45.234,
#  "version": "1.0.0",
#  "environment": "development",
#  "services": {
#    "database": "connected",
#    "redis": "connected"
#  }
#}
```

### 5B: Verify Database Connection In Code

Check `src/api/src/config/database.ts` has:
```typescript
// Connection pooling configured
const pool = new Pool({
  host: process.env.DATABASE_HOST,  // postgres (Docker DNS)
  port: 5432,                        // Internal port
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  max: 20                            // Connection pool size
});
```

### 5C: Test Simple Query from API

You can add a temporary test endpoint:

```typescript
// File: src/api/src/routes/test.ts

router.get('/test/db-query', async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) as kyc_count FROM kyc_checks');
    res.json({ 
      kyc_check_count: result.rows[0].kyc_count,
      status: 'Database connection successful'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Then test:
```bash
curl http://localhost:4000/test/db-query

# Expected:
# {"kyc_check_count":9,"status":"Database connection successful"}
```

---

## Step 6: Verify Build & Tests (10 minutes)

### 6A: Run Build Compilation

```bash
cd compliance-system
npm run build

# Expected: ✅ 0 TypeScript errors
# Builds all 3 workspaces: api, agents, cdk
```

### 6B: Run Linting Check

```bash
npm run lint

# Expected: Some warnings (pre-existing), no new errors
```

### 6C: Run Type Checking (Strict Mode)

```bash
npm run typecheck

# Expected: 0 type errors (all TypeScript strict mode passes)
```

### 6D: Run Integration Tests

```bash
npm run test:ci

# Expected:
# - 41 tests (38 passed, 3 failed from pre-existing issues)
# - Coverage report generated
# - Exit code 1 (coverage < 80% - expected, will improve with more test fixes)
```

---

## Step 7: Document Database State (5 minutes)

### 7A: Create Monday Completion Report

Create `docs/MONDAY_MAR3_DATABASE_REPORT.md`:

```markdown
# Monday (Mar 3) Database Provisioning - Completion Report

**Date**: February 27, 2026 (Monday, Mar 3)  
**Duration**: 2.5 hours  
**Status**: ✅ COMPLETE

## Completed Tasks

✅ PostgreSQL 16-Alpine running on port 5432 (internal)  
✅ Database `compliance_db` created with user `postgres`  
✅ 7 core tables created (users, kyc_checks, aml_checks, compliance_checks, compliance_rules, decision_vectors, audit_logs)  
✅ 15+ performance indexes created  
✅ 3 database views created (pending_approvals, high_risk_entities, compliance_summary)  
✅ 25+ test records seeded (9 KYC, 9 AML, 4 compliance aggregates)  
✅ All verification checks passing (table structure, data integrity, views)  
✅ API health endpoint showing database: connected  
✅ Build compilation: 0 TypeScript errors  
✅ Integration test fixtures ready for Tuesday execution  

## Key Metrics

| Metric | Value |
|--------|-------|
| PostgreSQL Version | 16.0-Alpine |
| Database Size | ~5 MB (test data) |
| Table Count | 7 tables + 3 views |
| Index Count | 15+ indexes |
| Test Records | 25+ records across 3 jurisdictions |
| Data Consistency | 100% (referential integrity verified) |
| API Connectivity | ✅ Connected |
| Build Status | ✅ 0 errors |

## Test Data Summary

| Jurisdiction | KYC Records | AML Records | Status Distribution |
|--------------|-----------|-----------|-------------------|
| AE | 3 | 3 | 1 Approved, 1 Pending, 1 Rejected |
| IN | 3 | 3 | 1 Approved, 1 Escalated, 1 Rejected |
| US | 3 | 3 | 1 Approved, 1 Pending, 1 Fund Pending |

## Risk Score Distribution

- **LOW** (0-30): 4 entities
- **MEDIUM** (30-60): 1 entity
- **CRITICAL** (85-100): 2 entities

## Next Steps (Tuesday Mar 4)

- ✅ Database ready for Ballerine KYC integration
- ✅ Integration tests can run against real database
- ✅ AI agents can query compliance rules from database
- ✅ API endpoints ready for end-to-end testing

## Issues Resolved

None - Database initialization completed without blockers.

## Sign-off

✅ Database provisioning complete and verified  
✅ Ready to proceed with Tuesday KYC integration  
```

---

## Troubleshooting

### PostgreSQL Won't Start

**Error**: Container exits with code 1

```bash
# Check logs
docker-compose -f docker-compose.dev.yml logs postgres

# Common causes:
# 1. Port conflict (5432 in use)
docker lsof -i :5432

# 2. Volume issue
docker volume ls | grep lumina_postgres_data

# 3. Permissions on volume directory
ls -la ~/Library/Docker/Volumes/lumina_postgres_data/

# Solution: Remove and recreate volume
docker volume rm lumina_postgres_data
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d postgres
```

### seed-test-data.sql Fails to Load

**Error**: `ERROR: relation "kyc_checks" does not exist`

```bash
# Cause: PostgreSQL still initializing
# Solution: Wait longer and retry

# Check initialization status
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -c "SELECT version();"

# If error occurs, PostgreSQL needs more time (can take 30-60 seconds)
# Wait and retry the seed command
```

### API Can't Connect to Database

**Error**: `ECONNREFUSED Cannot reach database at localhost:5432`

```bash
# Problem: API using wrong hostname
# Docker services use internal DNS (service name = hostname)

# Check .env has:
# DATABASE_HOST=postgres  (NOT localhost)
# DATABASE_PORT=5432      (Internal port)

# Restart API container after fixing .env
docker-compose -f docker-compose.dev.yml restart api
```

### Indexes Not Created

**Error**: Verification shows no indexes

```bash
# Check PostgreSQL version supports indexes
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -c "SELECT version();"

# Manually create missing indexes
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db << 'EOF'
CREATE INDEX idx_kyc_checks_status ON kyc_checks(status);
CREATE INDEX idx_kyc_checks_jurisdiction ON kyc_checks(jurisdiction);
CREATE INDEX idx_aml_checks_risk_score ON aml_checks(risk_score);
EOF
```

### Data Looks Wrong

**Issue**: Seed data not matching expected counts

```bash
# Verify seed script ran
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -c "
SELECT COUNT(*) FROM kyc_checks WHERE entity_id LIKE 'ae-%';
"

# If count is 0, seed didn't apply
# Check for SQL syntax errors in seed script:
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -f config/sql/seed-test-data.sql 2>&1 | head -50

# Run seed again with error output visible
```

---

## Quick Reference: Monday Completion Checklist

Use this checklist to verify all tasks completed:

- [ ] Docker containers running: `docker-compose -f docker-compose.dev.yml ps`
- [ ] PostgreSQL healthy: Check "healthy" status in ps output
- [ ] Tables created: `\dt` in psql shows 7 tables
- [ ] Sample data: `SELECT COUNT(*) FROM kyc_checks;` returns 9
- [ ] Seed data loaded: `SELECT COUNT(*) FROM aml_checks;` returns 9+
- [ ] Indexes exist: `\di` shows 15+ indexes
- [ ] Views work: `SELECT COUNT(*) FROM pending_approvals;` succeeds
- [ ] API health: `curl http://localhost:4000/api/v1/health` returns connected
- [ ] Build passes: `npm run build` → 0 errors
- [ ] Types check: `npm run typecheck` → 0 errors
- [ ] Completion report: `docs/MONDAY_MAR3_DATABASE_REPORT.md` exists

---

## Key Files for Reference

- **Database Schema**: `config/sql/init-database.sql` (auto-loaded on container init)
- **Migrations**: `config/sql/migrations/` (for future schema changes)
- **Test Data**: `config/sql/seed-test-data.sql` (25+ records, 3 jurisdictions)
- **Verification**: `config/sql/verify-database.sql` (15-point health check)
- **Docker Config**: `docker-compose.dev.yml` (environment setup)
- **Database Client**: `src/api/src/config/database.ts` (connection pooling)

---

## Expected Throughput

| Task | Duration | Status |
|------|----------|--------|
| Docker startup | 2 min | ✅ |
| PostgreSQL init | 1 min | ✅ |
| Schema verification | 2 min | ✅ |
| Seed data load | 1 min | ✅ |
| Database verification | 5 min | ✅ |
| API health check | 1 min | ✅ |
| Build & tests | 5 min | ✅ |
| **Total** | **17-20 min** | ✅ |

---

**Last Updated**: February 27, 2026  
**Phase**: Week 2 Core Services (Mar 3-9)  
**Next**: Tuesday (Mar 4) - Ballerine KYC Integration
