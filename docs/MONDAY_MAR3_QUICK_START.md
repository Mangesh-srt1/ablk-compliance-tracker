# Monday (Mar 3) Database Provisioning - Quick Start Script

## TL;DR (Time: 20 minutes)

Run these commands in order:

```bash
cd compliance-system

# 1. Start Docker stack
docker-compose -f docker-compose.dev.yml up -d

# 2. Wait 30 seconds for PostgreSQL to initialize
sleep 30

# 3. Seed test data
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db < config/sql/seed-test-data.sql

# 4. Run database verification (generates detailed report)
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -f config/sql/verify-database.sql | tee verify-report.txt

# 5. Check API health (shows database: connected)
curl -s http://localhost:4000/api/v1/health | jq .

# 6. Run build (confirm 0 TypeScript errors)
npm run build

# 7. Success! Database ready for Tuesday KYC integration
echo "✅ Database provisioning complete"
```

---

## One-Liner Verification

Quick check that database is healthy:

```bash
# All 7 tables exist, test data loaded, views working
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -c "
  SELECT 'TABLES' as check_type, COUNT(*) as count FROM information_schema.tables WHERE table_schema='public'
  UNION ALL SELECT 'KYC_RECORDS', COUNT(*) FROM kyc_checks  
  UNION ALL SELECT 'AML_RECORDS', COUNT(*) FROM aml_checks
  UNION ALL SELECT 'PENDING_APPROVALS_VIEW', COUNT(*) FROM pending_approvals;
"

# Expected output:
# TABLES                  | 7+
# KYC_RECORDS             | 9
# AML_RECORDS             | 9
# PENDING_APPROVALS_VIEW  | 3
```

---

## Container Status Check

```bash
# Verify all 4 services healthy
docker-compose -f docker-compose.dev.yml ps

# Expected:
# postgres  | healthy
# redis     | healthy
# api       | up
# agents    | up
```

---

## Database Connection Test

```bash
# Interactive connection
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db

# Inside psql:
# \dt          - List tables (should show 7)
# \di          - List indexes (should show 15+)
# SELECT COUNT(*) FROM kyc_checks;  - Should return 9
# \q           - Exit
```

---

## Solution: If Data Missing

```bash
# Re-run seed script if data didn't load
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db < config/sql/seed-test-data.sql

# Verify seed ran
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d compliance_db -c "SELECT COUNT(*) FROM kyc_checks;"
```

---

## Files Created for Monday

| File | Purpose | Size |
|------|---------|------|
| `config/sql/seed-test-data.sql` | 25+ test records (AE, IN, US) | 450 lines |
| `config/sql/migrations/001_initial_schema.sql` | Documentation of schema | 20 lines |
| `config/sql/migrations/002_blockchain_monitoring.sql` | Future: blockchain tables | 40 lines |
| `config/sql/verify-database.sql` | 15-point health check script | 300 lines |
| `docs/MONDAY_MAR3_DATABASE_SETUP.md` | Complete setup guide | 800 lines |
| `docs/MONDAY_MAR3_QUICK_START.md` | This file | - |

---

## After Database Ready

Once database provisioning complete ✅:

1. **Tuesday (Mar 4)**: Implement Ballerine KYC integration  
2. **Wednesday (Mar 5)**: Complete AML service  
3. **Thursday (Mar 6)**: Redis caching + rate limiting  
4. **Friday (Mar 7)**: End-to-end integration tests  

---

**Status**: 🟡 Ready for Monday Implementation  
**Time Estimate**: 17-20 minutes for full setup  
**Next Phase**: Tuesday KYC Integration
