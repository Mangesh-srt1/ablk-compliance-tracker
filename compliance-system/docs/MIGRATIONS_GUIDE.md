# Database Migrations Guide

This document describes all SQL migrations in the compliance system and how to apply them.

## Overview

The database is initialized through a two-step process:

1. **Initial Schema** (`init-database.sql`) - Creates base tables, enums, indexes, and sample data
2. **Migrations** (numbered 001-009) - Progressive schema enhancements

## Migration Timeline

### Core Migrations (Always Applied)

#### 001_initial_schema.sql
- **Purpose**: Initial database structure with all core compliance tables
- **Tables Created**:
  - `users` - Platform users with authentication
  - `kyc_checks` - Know-Your-Customer verification records
  - `aml_checks` - Anti-Money Laundering risk assessments
  - `compliance_checks` - Aggregated compliance decisions
  - `compliance_rules` - Jurisdiction-specific compliance rules
  - `decision_vectors` - ML embeddings for pattern learning
  - `audit_logs` - Compliance audit trail
- **Features**: UUID generation, JSONB support, timezone-aware timestamps

#### 002_blockchain_monitoring.sql
- **Purpose**: Add blockchain transaction monitoring infrastructure
- **Tables Created**:
  - `blockchain_monitoring` - Monitor active blockchain addresses
  - `blockchain_transactions` - Cache blockchain transaction data
- **Features**: Real-time blockchain event tracking, webhook support

#### 002_vector_store.sql
- **Purpose**: Vector embeddings for machine learning pattern detection
- **Features**: 
  - BYTEA columns for embedding storage (development)
  - Indexes for fast similarity search
  - Support for pgvector in production

#### 003_tenants_and_oauth.sql
- **Purpose**: Multi-tenancy and OAuth 2.0/OpenID Connect support
- **Tables Created**:
  - `tenants` - Isolated customer accounts
  - `oauth_clients` - OAuth application registrations
- **Features**: OAuth scopes, token generation, client credentials flow

#### 004_api_key_security.sql
- **Purpose**: API key authentication and management
- **Tables Created**:
  - `api_keys` - Hashed API key storage
- **Features**: Key rotation, rate limiting, scope-based permissions

#### 005_user_registration.sql
- **Purpose**: User self-registration and email verification
- **Columns Added to `users`**:
  - `is_email_verified` - Email verification status
  - `otp_code` - One-time password for registration
  - `otp_expires_at` - OTP expiration timestamp
- **Features**: Email verification flow, OTP-based confirmations

#### 006_admin_approval_flow.sql
- **Purpose**: Admin approval workflow for self-registered users
- **Columns Added to `users`**:
  - `approval_status` - APPROVED/PENDING/REJECTED status
  - `jurisdiction` - User's jurisdiction
  - `products` - Approved products for user
  - `permissions` - Role-based permissions array
- **Data**: Seed platform bootstrap admin (admin@platform.com)
- **Features**: Multi-level approval, jurisdiction routing

#### 007_bootstrap_admin_flag.sql
- **Purpose**: Mark system bootstrap admin with special privileges
- **Columns Added to `users`**:
  - `is_bootstrap_admin` - First-run admin flag
- **Features**: Privileged operations for initial platform setup

### Optional Migrations (Applied with Flags)

#### 008_sar_ctr_schema.sql *(Optional: use `-IncludeSARCTR`)*
- **Purpose**: Suspicious Activity Report and Currency Transaction Report infrastructure
- **Tables Created**:
  - `sar_reports` - SAR filing records with status tracking
  - `ctr_reports` - Currency transaction reports
  - `sar_ctr_filing_audit` - Audit trail for filing changes
  - `sar_ctr_configurations` - Jurisdiction-specific thresholds
- **Features**:
  - Auto-timestamping triggers
  - Status change audit logging
  - Multi-jurisdiction threshold configuration
  - Filing deadline tracking
- **Recommended For**: Compliance systems with regulatory filing requirements

#### 009_seed_test_data.sql *(Optional: use `-IncludeTestData`)*
- **Purpose**: Populate database with realistic test scenarios
- **Test Data Includes**:
  - **UAE (AE)**: Clean individual, pending company, sanctioned individual
  - **India (IN)**: Accredited investor, PEP-flagged company, rejected individual
  - **United States (US)**: Accredited company, standard individual, pending fund
  - **Compliance records** with risk scores and audit trails
- **Note**: ⚠️ **Development/QA only** - do NOT apply to production
- **Use Cases**:
  - Testing compliance workflows
  - Validating risk scoring algorithms
  - Testing jurisdiction-specific rules
  - Performance testing with realistic data

## Running Database Reset

### Core Setup (Production-Ready)
```powershell
# Reset with core migrations only (8 tables)
.\scripts\Reset-Database.ps1 -SkipConfirmation
```

**Tables Created**: 15 (core compliance infrastructure)

**Use When**:
- Deploying to production
- Setting up clean development environment
- Initializing new customer accounts

### Development with SAR/CTR Reporting
```powershell
# Add SAR/CTR reporting infrastructure (11 tables)
.\scripts\Reset-Database.ps1 -SkipConfirmation -IncludeSARCTR
```

**Tables Created**: 18 (= 15 core + 3 SAR/CTR-specific)

**Use When**:
- Building SAR/CTR filing features
- Testing regulatory compliance workflows
- Compliance team needs filing infrastructure

### Full Development Setup (All Features)
```powershell
# Include test data for development (11 tables + 18 test records)
.\scripts\Reset-Database.ps1 -SkipConfirmation -IncludeSARCTR -IncludeTestData
```

**Tables Created**: 19 (= 15 core + 3 SAR/CTR + 1 audit)

**Test Records**: 18 compliance checks across 3 jurisdictions

**Use When**:
- Local development and testing
- QA environment validation
- Testing compliance rules and workflows
- Performance benchmarking

## Migration Safety Features

### Automatic Handling
- ✅ NOTICE messages filtered (not treated as errors)
- ✅ Foreign key constraints validated
- ✅ ON CONFLICT clauses prevent duplicates
- ✅ Schema verification after all migrations

### Manual Safety
- Confirmation prompt before destructive operations
- Use `-SkipConfirmation` only for automation
- Docker container verification before execution
- API service restart after migration

### Rollback Strategy
If a migration fails:
1. Script exits with error code 1
2. Run script again after fixing issue
3. Partial migrations are idempotent (safe to re-run)

## Database Sizes

| Config | Tables | Size (Empty) | Test Data |
|--------|--------|-------------|-----------|
| Core Only | 15 | ~2 MB | 1 admin user |
| + SAR/CTR | 18 | ~3 MB | 1 admin user |
| + Test Data | 19 | ~4 MB | 18+ records |

## Connection Details

**Production Connection String**:
```
postgresql://postgres@localhost:4432/compliance_db
```

**Development Connection String**:
```
postgresql://postgres@localhost:4432/compliance_db
```

**Default Admin Credentials** (after migration):
```
Email: admin@platform.com
Password: Admin@Platform1
⚠️ CHANGE IN PRODUCTION IMMEDIATELY!
```

## API Endpoints After Reset

### Health Check
```bash
GET http://localhost:4000/api/health
```

### Authentication
```bash
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{"email":"admin@platform.com","password":"Admin@Platform1"}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "email": "admin@platform.com",
      "role": "admin"
    }
  }
}
```

## Troubleshooting

### Issue: Migration Fails with FK Constraint Error
**Solution**: Ensure migrations are applied in order. The script handles this automatically.

### Issue: Database Already Exists Error
**Solution**: Run with `-SkipConfirmation` flag to force drop/recreate sequence.

### Issue: NOTICE Messages Treated as Errors
**Solution**: Handled automatically by script. NOTICE messages are filtered from error detection.

### Issue: Schema Verification Reports Missing Columns
**Solution**: 
- Check that all migrations completed successfully
- Verify PostgreSQL container is running
- Check file permissions in migrations directory

## Best Practices

1. **Always backup before resetting**: `docker exec compliance-postgres pg_dump -U postgres compliance_db > backup.sql`
2. **Run migrations on clean database**: Use `-SkipConfirmation` for automated resets
3. **Test data in development only**: Never include `009_seed_test_data.sql` in production
4. **Document API changes**: When modifying migrations, update this guide
5. **Version control SQL files**: Keep migrations in Git with commit messages

## Adding New Migrations

When adding a new migration:

1. **Create file**: `010_feature_name.sql`
2. **Add header comment** with purpose and tables
3. **Use ON CONFLICT clauses** for idempotency
4. **Create indexes** for new tables
5. **Test locally**: `.\scripts\Reset-Database.ps1 -SkipConfirmation`
6. **Update this guide** with new migration details
7. **Commit with message**: `migration: add 010_feature_name`

## Related Documentation

- Database Schema: See [init-database.sql](../init-database.sql)
- API Routes: See [authRoutes.ts](../../src/api/src/routes/authRoutes.ts)
- Jurisdiction Rules: See [src/config/jurisdictions/](../../src/config/jurisdictions/)
- Deployment: See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)

---

**Last Updated**: March 4, 2026  
**Migration Version**: 009  
**Total Tables**: 19 (with all optional migrations)
