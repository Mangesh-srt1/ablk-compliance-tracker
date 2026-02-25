# Implementation Standards & Guidelines Document
**Date**: February 25, 2026  
**Project**: ComplianceShield Multi-Jurisdiction + pe-tokenization-pi-hub Integration  
**Duration**: 5 weeks (Feb 25 - Mar 19, 2026)

---

## Executive Summary

This document establishes the **code standards, architectural principles, and technical guidelines** for the Dubai PE Tokenization launch. All implementation work from Week 1 onwards must follow these principles to ensure consistency, security, testability, and regulatory compliance.

**Key Principle**: Follow existing patterns in the codebase. Do not introduce new patterns or frameworks.

---

## 1. Code Organization & Project Structure

### 1.1 Folder Structure Must Be Respected

**API Service** (`compliance-system/src/api/src/`):
```
config/          → Database, logger, Redis, constants (NEW for Week 1)
middleware/      → Auth, error handling, request logging (extends existing)
routes/          → HTTP API endpoints (extends existing)
services/        → Business logic (extends existing)
types/           → TypeScript interfaces & enums (extends existing)
utils/           → Helper functions (extends existing)
```

**Agents Service** (`compliance-system/src/agents/src/`):
```
agents/          → LangGraph agent definitions (extends existing)
config/          → Agent configurations (extends existing)
graphs/          → LangGraph workflow definitions (extends existing)
routes/          → Agent API endpoints (extends existing)
services/        → Jurisdiction rules engine service (NEW for Week 1)
tools/           → LangGraph tools (extends existing)
types/           → Agent-specific types (extends existing)
```

**Database Scripts** (`compliance-system/scripts/`):
```
jurisdictions/   → Jurisdiction-specific DDL & DML (NEW for Week 1)
  ├── 001_create_jurisdiction_tables.sql
  ├── 002_insert_dubai_jurisdiction.sql
  └── README.md
aml_checks/      → AML check queries (existing)
kyc_checks/      → KYC check queries (existing)
compliance_checks/ → Compliance check queries (existing)
compliance_rules/  → Rule definitions (existing)
```

**PowerShell Scripts** (`compliance-system/powershell-scripts/`):
```
Run-DatabaseMigrations.ps1  → Load and execute .sql files from scripts/
Deploy-ComplianceSystem.ps1 → Docker build + deployment
```

**Shell Scripts** (`compliance-system/shell-scripts/`):
```
[Currently empty - add as needed, follow PowerShell patterns]
```

**Documentation** (`docs/`):
```
Dubai_Launch_Daily_Goals.md                → 5-week roadmap
Implementation_Audit.md                    → Pre-implementation audit
Week1_Task1.1_Environment_Setup_Checklist.md
Week1_Task1.2_Database_Migration.md        → (To be created)
Environment_Setup.md                       → How to set up dev environment
Database_Migrations.md                     → How to run migrations
Jurisdiction_Rules_Engine.md              → How to use rules engine
Error_Handling.md                         → Compliance-specific error codes
...additional docs per feature
```

### 1.2 File Naming Conventions

**TypeScript Files**:
- Services: `[domain][Service].ts` (e.g., `jurisdictionRulesEngine.ts`, `peGovernanceOracle.ts`)
- Middleware: `[functionality]Middleware.ts` (e.g., `authMiddleware.ts`, `errorHandler.ts`)
- Routes: `[domain]Routes.ts` (e.g., `complianceRoutes.ts`)
- Types: `[domain].ts` (e.g., `errors.ts`, `jurisdiction.ts`)
- Tests: `[filename].test.ts` (e.g., `jurisdictionRulesEngine.test.ts`)

**SQL Files**:
- Naming format: `[sequence]_[description].sql` (e.g., `001_create_jurisdiction_tables.sql`)
- Descriptive names: `[domain]_[operation].sql` (e.g., `jurisdiction_insert_dubai.sql`)

**PowerShell Files**:
- Naming format: `[Verb]-[Noun].ps1` (PowerShell standard) (e.g., `Run-DatabaseMigrations.ps1`)
- NO underscores, use PascalCase

**Markdown Files**:
- Naming format: `[Feature_or_Operation_Name].md` (e.g., `Environment_Setup.md`, `Database_Migrations.md`)
- Keep names short and descriptive

---

## 2. Configuration & Constants

### 2.1 No Hardcoded Values

**❌ WRONG**:
```typescript
const votingThreshold = 66;  // Hardcoded value
const apiUrl = "http://localhost:8545";  // Hardcoded URL
```

**✅ CORRECT**:
```typescript
import config from '../config/constants';

const votingThreshold = config.jurisdiction.AE.governance.votingThreshold;
const apiUrl = process.env.BESU_RPC_URL;
```

### 2.2 Environment Variables (.env)

**All configuration must come from .env**:
- Database credentials: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- API secrets: `JWT_SECRET`, `JWT_EXPIRY`
- External services: `BALLERINE_API_KEY`, `CHAINALYSIS_API_KEY`, `BESU_RPC_URL`
- Jurisdiction config: `CONFIG_PATH`, `SUPPORTED_JURISDICTIONS`

**❌ WRONG - Hardcoded URL in code**:
```typescript
const besuRpc = "http://localhost:8545";
```

**✅ CORRECT - Read from .env**:
```typescript
const besuRpc = process.env.BESU_RPC_URL;
if (!besuRpc) throw new Error('BESU_RPC_URL not configured');
```

### 2.3 Create config/constants.ts (Week 1)

**New file**: `compliance-system/src/api/src/config/constants.ts`

Purpose: Centralize all jurisdiction-related constants.

```typescript
/**
 * Application Constants
 */

export const JURISDICTION_CODES = {
  DUBAI: 'AE',
  INDIA: 'IN',
  EU: 'EU',
  US: 'US',
  SINGAPORE: 'SG'
};

export const ERROR_CODES = {
  JURISDICTION: {
    NOT_FOUND: 'JURISDICTION_NOT_FOUND',
    CONFIG_INVALID: 'JURISDICTION_CONFIG_INVALID',
    RULE_NOT_FOUND: 'JURISDICTION_RULE_NOT_FOUND'
  },
  GOVERNANCE: {
    VOTE_REQUIRED: 'GOVERNANCE_VOTE_REQUIRED',
    VOTE_FAILED: 'GOVERNANCE_VOTE_FAILED',
    VOTE_PENDING: 'GOVERNANCE_VOTE_PENDING'
  },
  INSIDER_TRADING: {
    BLOCKED: 'INSIDER_TRADING_BLOCKED',
    FLAGGED: 'INSIDER_TRADING_FLAGGED',
    ESCALATED: 'INSIDER_TRADING_ESCALATED'
  }
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};
```

---

## 3. Database & SQL Queries

### 3.1 All Queries External to Code

**❌ WRONG - Query embedded in code**:
```typescript
const result = await db.query(
  'SELECT * FROM compliance_decision_audit WHERE fund_id = $1'
);
```

**✅ CORRECT - Query loaded from .sql file**:
```typescript
import fs from 'fs';
import path from 'path';

const auditLogQuery = fs.readFileSync(
  path.join(__dirname, '../../scripts/jurisdiction/get_audit_log.sql'),
  'utf-8'
);

const result = await db.query(auditLogQuery, [fundId]);
```

### 3.2 SQL File Organization

**Scripts folder structure**:
```
scripts/
├── jurisdictions/
│   ├── 001_create_jurisdiction_tables.sql
│   ├── 002_insert_dubai_jurisdiction.sql
│   ├── get_jurisdiction.sql
│   ├── get_audit_log.sql
│   ├── insert_compliance_decision.sql
│   └── README.md
├── compliance_checks/
├── kyc_checks/
└── aml_checks/
```

### 3.3 SQL Best Practices

**Schema & Table Naming**:
- Use lowercase with underscores: `compliance_decision_audit`, `jurisdiction_code`
- Prefix with schema: `compliance.compliance_decision_audit`
- Foreign keys: `[table]_id` (e.g., `fund_id`, `jurisdiction_id`)

**Indexes**:
- Index frequently queried columns: `jurisdiction_code`, `timestamp`, `fund_id`
- Naming format: `idx_[table]_[columns]` (e.g., `idx_compliance_decision_audit_jurisdiction_timestamp`)

**Queries**:
- Use parameterized queries: `$1`, `$2` (PostgreSQL)
- Return meaningful column names (use AS for aliases)
- Example:
  ```sql
  SELECT 
    id AS compliance_decision_id,
    fund_id,
    jurisdiction_code,
    decision_type,
    decision,
    rule_reference,
    created_at AS decided_at
  FROM compliance.compliance_decision_audit
  WHERE fund_id = $1 AND jurisdiction_code = $2
  ORDER BY created_at DESC
  LIMIT $3;
  ```

### 3.4 Database Naming Conventions

**Match TypeScript camelCase where possible**:
- API returns: `{ fundId, jurisdictionCode, decisionType, ruleReference }` (camelCase)
- Database stores: `fund_id`, `jurisdiction_code`, `decision_type`, `rule_reference` (snake_case)
- Mapper converts between them automatically

**❌ WRONG - Column name case mismatch**:
```sql
-- Database: FundId (pascal)
CREATE TABLE compliance.compliance_decision_audit (FundId INT);

-- Code: fundId (camel)
const decision = { fundId: 123 };

-- Results in case-mismatch bugs!
```

**✅ CORRECT - Consistent snake_case in DB, mapper handles conversion**:
```sql
-- Database: fund_id (snake)
CREATE TABLE compliance.compliance_decision_audit (fund_id INT);

-- Node.js mapper (automatic):
const decision = dbResult[0];  // { fund_id: 123 }
const apiResponse = {
  fundId: decision.fund_id  // Converted to camelCase
};
```

---

## 4. Authentication & Authorization (JWT + RBAC)

### 4.1 JWT Token Structure

**Token payload includes**:
```typescript
{
  id: string;                    // User ID (UUID)
  email: string;                 // User email
  role: string;                  // Role: admin, compliance_officer, fund_gp, fund_lp
  permissions: string[];         // Specific permissions
  jurisdiction_code?: string;    // NEW: For jurisdiction-scoped roles
  iat: number;                   // Issued at
  exp: number;                   // Expiration
}
```

### 4.2 Middleware Usage

**Protect all API endpoints** (except login/signup):

```typescript
import { authenticateToken, requireRole } from './middleware/authMiddleware';

// Public endpoint (no auth required)
app.post('/api/auth/login', loginController);

// Protected endpoint (auth required)
app.get('/api/compliance/audit', authenticateToken, getAuditLog);

// Role-restricted endpoint
app.post(
  '/api/compliance/decision',
  authenticateToken,
  requireRole('compliance_officer'),
  createComplianceDecision
);

// Permission-restricted endpoint
app.patch(
  '/api/jurisdiction/:code/config',
  authenticateToken,
  requirePermission('jurisdiction.config.update'),
  updateJurisdictionConfig
);
```

### 4.3 Service-to-Service Communication

**All service calls must include JWT token**:

```typescript
// In pe-tokenization-pi-hub calling ComplianceShield:
const response = await fetch('http://compliance-gateway:3000/api/compliance/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`  // ← Must include token
  },
  body: JSON.stringify(fundData)
});
```

### 4.4 Token Validation Errors

**All failures logged**:
```typescript
// authMiddleware.ts logs:
logger.warn('Invalid token', { error: error.message, ip: req.ip });
logger.warn('Expired token used', { userId: decoded.id, ip: req.ip });
logger.warn('Insufficient role access', { userRole, requiredRole, path: req.path });
```

---

## 5. Error Handling & Standardization

### 5.1 Error Response Structure

**All API responses follow this format**:
```json
{
  "code": "ERROR_CODE",
  "category": "ERROR_CATEGORY",
  "message": "Human-readable error message",
  "details": { /* optional details */ },
  "httpStatus": 400,
  "timestamp": "2026-02-25T10:00:00Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 5.2 Error Categories & Codes (Existing - Extend in Week 2)

**Existing categories** (from `types/errors.ts`):
- VALIDATION
- AUTHENTICATION
- AUTHORIZATION
- NOT_FOUND
- CONFLICT
- INTERNAL
- EXTERNAL_SERVICE
- RATE_LIMIT

**New categories to add (Week 2)** when refactoring PE services:
- COMPLIANCE_VIOLATION
- REGULATORY_BREACH
- JURISDICTION_ERROR

**Example compliance-specific errors**:
```typescript
export enum ErrorCode {
  // Existing (use these)
  INVALID_INPUT = 'INVALID_INPUT',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // NEW - To add in Week 2
  JURISDICTION_NOT_FOUND = 'JURISDICTION_NOT_FOUND',
  JURISDICTION_CONFIG_INVALID = 'JURISDICTION_CONFIG_INVALID',
  RULE_VALIDATION_FAILED = 'RULE_VALIDATION_FAILED',
  INSIDER_TRADING_BLOCKED = 'INSIDER_TRADING_BLOCKED',
  GOVERNANCE_VOTE_REQUIRED = 'GOVERNANCE_VOTE_REQUIRED',
  GOVERNANCE_VOTE_FAILED = 'GOVERNANCE_VOTE_FAILED'
}
```

### 5.3 Throwing Errors in Code

**✅ CORRECT - Use AppError with specific codes**:
```typescript
import { AppError, ErrorCode, ErrorCategory } from '../types/errors';

// In jurisdictionRulesEngine.ts
if (!rules) {
  throw new AppError(
    ErrorCode.JURISDICTION_NOT_FOUND,
    ErrorCategory.NOT_FOUND,
    `Jurisdiction '${code}' not configured`,
    404
  );
}

// In PEFundGovernanceOracle.ts (Week 2)
if (riskScore > threshold) {
  throw new AppError(
    ErrorCode.INSIDER_TRADING_BLOCKED,
    ErrorCategory.COMPLIANCE_VIOLATION,
    'Trade blocked: insider trading risk detected',
    403,
    { riskScore, threshold, signals: [...] }  // Include context
  );
}
```

### 5.4 Centralized Error Middleware

**All errors automatically standardized** by `errorHandler.ts` middleware:

```typescript
// In any route/service:
throw new Error('Something went wrong');  // Generic error

// Automatically converted to:
{
  "code": "INTERNAL",
  "category": "INTERNAL",
  "message": "Something went wrong",
  "httpStatus": 500,
  "timestamp": "...",
  "requestId": "..."
}
```

---

## 6. Code Quality Standards

### 6.1 TypeScript Compilation

**All code must compile without errors**:
```bash
npm run build
# Expected output: "Build successful" with 0 errors
```

**Common TypeScript issues to avoid**:
- Implicit `any` types: Always define types explicitly
- Missing return types: Specify return type for all functions
- Type mismatches: Ensure argument types match function signatures

### 6.2 Linting (ESLint)

**All code must pass linting**:
```bash
npm run lint
# Expected output: "0 error(s)" or "All files pass linting"

# Auto-fix issues:
npm run lint -- --fix
```

### 6.3 SonarQube Analysis

**Critical requirement for all changes**:
- Install SonarQube extension in VS Code
- Run analysis on all new files
- Fix all critical and major issues before committing
- Target: Zero blocker/critical issues in new code

**Command**:
```bash
# In VS Code: Ctrl+Shift+P → "SonarLint: Analyze Current File"
# Or review Problems tab (Ctrl+Shift+M)
```

### 6.4 Unit Testing

**Minimum coverage standards**:
- Service logic: >90% coverage
- Middleware: >85% coverage
- Routes: >80% coverage

**Example test**:
```typescript
// jurisdictionRulesEngine.test.ts
describe('JurisdictionRulesEngine', () => {
  test('loadJurisdiction returns rules for AE', async () => {
    const rules = await engine.loadJurisdiction('AE');
    expect(rules.governance.votingThreshold).toBe(66);
    expect(rules.amlCft.sarFilingDeadline).toBe(3);
  });

  test('throws error for unknown jurisdiction', async () => {
    await expect(engine.loadJurisdiction('XX')).rejects.toThrow(
      AppError
    );
  });
});
```

---

## 7. Containers, Network & Deployment

### 7.1 Docker Network & Ports - DO NOT CHANGE

**Current configuration (PRESERVE)**:
```yaml
services:
  besu-validator-1:         # Port 8545 (RPC)
  postgres-db:              # Port 5432 (Database)
  compliance-gateway:       # Port 3000 (API)
  compliance-agents:        # Port 3001 (Agents)
  grafana:                  # Port 3001 (Monitoring)
  redis:                    # Port 6379 (Cache)

networks:
  compliance-network:       # Internal network
```

**❌ DO NOT CHANGE PORT MAPPINGS**

### 7.2 Environment Variables in Docker

**All configuration via .env or service .env files**:

```dockerfile
# Dockerfile - DON'T hardcode values
FROM node:18

# ❌ WRONG:
ENV BESU_RPC_URL=http://localhost:8545
ENV DATABASE_URL=postgres://user:pass@localhost:5432/db

# ✅ CORRECT:
WORKDIR /app
COPY . .
CMD ["node", "dist/index.js"]
# Environment variables come from docker-compose env_file or -e flags
```

```yaml
# docker-compose.yml - CORRECT pattern
services:
  compliance-gateway:
    build:
      context: ./src/api
      dockerfile: Dockerfile
    env_file:
      - .env                     # Load from .env
    environment:
      NODE_ENV: ${NODE_ENV}      # Override specific vars
      LOG_LEVEL: ${LOG_LEVEL}
```

### 7.3 Rebuild Without Cache

**After any code changes**:
```bash
# Stop container
docker-compose down

# Remove old image
docker rmi [image-name]

# Rebuild without cache
docker-compose build --no-cache

# Start services
docker-compose up -d
```

---

## 8. Security Checklist

### 8.1 Secrets Management

**❌ NEVER commit to Git**:
- .env (actual values)
- Private keys
- API keys
- Database passwords

**✅ DO commit to Git**:
- .env.example (template only, no secrets)
- All source code
- Configuration schemas

**Verification**:
```bash
# Check nothing sensitive is in last commit
git diff HEAD~1 | grep -i "password\|secret\|key"
# Should return nothing
```

### 8.2 Database Security

**Permissions**:
```sql
-- User for compliance app (least privilege)
CREATE ROLE compliance_user WITH LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE compliance_db_dubai TO compliance_user;
GRANT USAGE ON SCHEMA compliance TO compliance_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA compliance TO compliance_user;
```

**No root/admin accounts for app connections**:
```typescript
// ✅ CORRECT - Non-admin user
const pool = new Pool({
  user: 'compliance_user',  // ← Limited permissions
  password: process.env.DB_PASSWORD
});
```

### 8.3 JWT Secret Strength

**Requirements**:
- Minimum 32 characters
- Mix of upper/lowercase, numbers, symbols
- Generate securely:
  ```bash
  # Linux/Mac
  openssl rand -base64 32
  
  # PowerShell
  [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((1..32 | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 127) }) -join ''))
  ```

---

## 9. PowerShell Scripts Best Practices

### 9.1 Structure & Naming

**File naming**:
```powershell
# ❌ WRONG - Lowercase
run-databasemigrations.ps1
deploy_system.ps1

# ✅ CORRECT - PascalCase (PowerShell standard)
Run-DatabaseMigrations.ps1
Deploy-ComplianceSystem.ps1
```

### 9.2 Script Template

```powershell
<#
.SYNOPSIS
    Brief description of what this script does

.DESCRIPTION
    Detailed description including prerequisites, example usage

.PARAMETER Environment
    The environment to deploy to (development, staging, production)

.EXAMPLE
    .\Run-DatabaseMigrations.ps1 -Environment development
#>

param(
    [string]$Environment = "development",
    [switch]$Force = $false
)

# Load environment variables from .env
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# Validate prerequisites
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "Error: psql not found. Install PostgreSQL." -ForegroundColor Red
    exit 1
}

# Log execution
Write-Host "Starting database migration for environment: $Environment" -ForegroundColor Green

# Main logic here
try {
    # Execute migration...
    Write-Host "Migration completed successfully" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
```

---

## 10. Documentation Standards

### 10.1 File Naming

**Clear, descriptive names**:
```
✅ Environment_Setup.md
✅ Database_Migrations.md
✅ Jurisdiction_Rules_Engine.md
✅ Week1_Task1.1_Environment_Setup_Checklist.md

❌ setup.md
❌ db.md
❌ rules.md
❌ checklist.txt
```

### 10.2 Markdown Structure

**Consistent formatting**:
```markdown
# Main Title

## Section 1
### Subsection 1.1
- Bullet point
- Another point

## Section 2
Table | Format | Example
------|--------|--------
Good  | Works  | ✅
Bad   | Fails  | ❌
```

### 10.3 Code Examples in Docs

**Include both good and bad examples**:
```markdown
**✅ CORRECT**:
[show correct code]

**❌ WRONG**:
[show incorrect code]

**Explanation**: Why the correct approach is better
```

---

## 11. Weekly Implementation Checklist

### Before Starting Each Week
- [ ] Review daily goals for the week
- [ ] Update todo list with specific tasks
- [ ] Identify dependencies (what must be done first)
- [ ] Assign tasks to team members

### During Development
- [ ] Follow all patterns in this document
- [ ] Commit frequently with clear messages
- [ ] Run linting & tests before commits
- [ ] No SonarQube critical issues
- [ ] Update documentation as features are added

### End of Week Sign-Off
- [ ] All code compiles (npm run build)
- [ ] All tests pass (npm run test, >90% coverage)
- [ ] No linting errors (npm run lint)
- [ ] No SonarQube critical/major issues
- [ ] Database migrations applied cleanly
- [ ] Documentation updated
- [ ] Team review completed
- [ ] Ready for next week

---

## 12. Key Files to Know

**Critical Files (Don't modify without approval)**:
- `docker-compose.yml` - Network & service configuration
- `docker-compose.yml` - Port mappings
- `src/api/src/middleware/authMiddleware.ts` - JWT auth (understand before extending)
- `src/api/src/middleware/errorHandler.ts` - Error handling (must use for new errors)
- `src/api/src/types/errors.ts` - Error codes (extend as needed)

**Files to Create/Extend**:
- `config/constants.ts` - Application constants (NEW Week 1)
- `config/database.ts` - Database configuration (extend if needed)
- `src/agents/src/services/jurisdictionRulesEngine.ts` - Already created
- `scripts/jurisdictions/*.sql` - Database migrations (NEW Week 1)

---

## 13. Communication & Coordination

### Daily Standups
- 15 minutes
- Blockers, progress, EOD status
- Identify risks early

### Weekly Architecture Review
- 1 hour
- Any design changes needed?
- Integration challenges?
- Scope creep discussion

### Code Review Standards
- At least 2 reviewers for critical code (auth, database, rules engine)
- Check: Security, error handling, test coverage, documentation
- Approve only if: No SonarQube issues, tests pass, follows standards

---

## 14. Regulatory Compliance Requirements

### 4.1 Audit Trail (DFSA/SCA Requirement)

**Every compliance decision must log**:
```json
{
  "fund_id": "550e8400-e29b-41d4-a716-...",
  "jurisdiction_code": "AE",
  "decision_type": "GOVERNANCE_CHANGE",
  "decision": "APPROVED",
  "rule_reference": "AE.governance.majorChangesRequireVote",
  "details": {
    "changeType": "SIGNATORY_CHANGE",
    "lpVoteResult": 72,
    "votingThreshold": 66
  },
  "decided_by": "system-compliance-engine",
  "decided_at": "2026-02-25T10:00:00Z"
}
```

**Must be queryable for audit**:
- By fund_id (show all decisions for a fund)
- By jurisdiction_code (show all decisions for a jurisdiction)
- By rule_reference (show all applications of a specific rule)
- By timestamp (show decisions in a date range)

### 14.2 Data Retention

**Minimum 10 years** for audit trail (compliance_decision_audit table)

**Backup strategy**:
- Daily database backups
- Monthly snapshots to long-term storage (S3/Cloud)
- Test backup restoration quarterly

---

## Final Checklist Before Implementation Starts

✅ **Read & Understand**:
- [ ] This entire standards document (critical for Week 1)
- [ ] ComplianceShield_Multi_Jurisdiction_Architecture.md (design reference)
- [ ] Dubai_Launch_Daily_Goals.md (project timeline)
- [ ] Implementation_Audit.md (current state assessment)
- [ ] Week1_Task1.1_Environment_Setup_Checklist.md (hands-on guide)

✅ **Set Up Tools**:
- [ ] VS Code + SonarQube extension
- [ ] ESLint + Prettier configured
- [ ] Jest configured for testing
- [ ] All npm dependencies installed

✅ **Understand Existing Code**:
- [ ] Review authMiddleware.ts (JWT pattern)
- [ ] Review errorHandler.ts (error handling pattern)
- [ ] Review database.ts (DB connection pattern)
- [ ] Review existing route files (API pattern)

✅ **Team Alignment**:
- [ ] All developers read this document
- [ ] Discuss any questions or clarifications
- [ ] Agree on standards & conventions
- [ ] Schedule weekly architecture reviews

**You're ready to start Week 1 Task 1.1 ✅**

---

**Questions?**
- Refer back to the relevant section in this document
- Ask in daily standup if unclear
- Escalate architectural decisions to tech lead
