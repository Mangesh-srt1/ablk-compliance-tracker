# Week 1 Task 1.1: Environment Setup - Detailed Checklist
**Date**: February 25, 2026 (Monday)  
**Owner**: Backend Lead + DevOps Lead  
**Deliverable**: Dev environment ready, all dependencies installed, TypeScript compiles  
**Duration**: 2-3 hours  
**Status**: NOT STARTED

---

## Phase 1: Prerequisite Verification (30 minutes)

### Step 1: Node.js & npm Installation
```bash
# Verify Node.js is installed
node --version
# Expected: v14.0.0 or higher (recommend v18+)

# Verify npm is installed
npm --version
# Expected: 6.0.0 or higher (recommend 8+)

# If missing:
# Windows: https://nodejs.org/en/download/
# Mac: brew install node
# Linux: apt-get install nodejs npm
```

**Status**: ✅ / ❌

---

### Step 2: PostgreSQL Installation Verification
```bash
# Check PostgreSQL is installed
psql --version
# Expected: psql (PostgreSQL) 13.x or higher

# Check PostgreSQL service is running
psql -h localhost -U postgres -c "SELECT version();"
# Expected: Version output

# If missing:
# Windows: https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: apt-get install postgresql postgresql-contrib
```

**Status**: ✅ / ❌

---

### Step 3: Docker & Docker Compose
```bash
# Check Docker is installed
docker --version
# Expected: Docker version 20.x or higher

# Check Docker Compose is installed
docker-compose --version
# Expected: Docker Compose version 1.29.x or docker compose version 2.x

# Verify Docker daemon is running
docker ps
# Expected: List of running containers (empty is OK)

# If missing:
# Windows/Mac: https://www.docker.com/products/docker-desktop
# Linux: apt-get install docker.io docker-compose
```

**Status**: ✅ / ❌

---

### Step 4: Git & SSH Keys
```bash
# Check Git is installed
git --version
# Expected: git version 2.x or higher

# Check Git identity is configured
git config --global user.name
git config --global user.email
# If missing:
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"

# Verify SSH key exists (for GitHub/GitLab)
ls -la ~/.ssh/id_rsa
# If missing:
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
```

**Status**: ✅ / ❌

---

### Step 5: Code Editor & Extensions (VS Code)
```bash
# Verify VS Code is installed
code --version
# Expected: version number

# Install recommended extensions in VS Code:
# 1. ESLint (dbaeumer.vscode-eslint)
# 2. Prettier (esbenp.prettier-vscode)
# 3. Thunder Client or Postman for API testing
# 4. SonarQube (sonarsource.sonarlint-vscode) - REQUIRED for code quality

# Command to install SonarQube extension:
code --install-extension sonarsource.sonarlint-vscode
```

**Status**: ✅ / ❌

---

## Phase 2: Clone & Review Repository (30 minutes)

### Step 6: Clone Compliance Repo
```bash
# Navigate to your workspace
cd c:\Users\Mange\work\ablk-compliance-tracker

# Verify repo structure
ls -la
# Expected directories:
# - compliance-system/
# - docs/
# - logs/ (may be empty)

# List current branch
git branch -a
# Expected: main or master

# Check for uncommitted changes
git status
# Expected: "working tree clean" (nothing uncommitted)
```

**Status**: ✅ / ❌

---

### Step 7: Review Existing Structure
```bash
# Verify directory structure
ls -la compliance-system/src/
# Expected: api/, agents/, dashboard/

ls -la compliance-system/src/api/
# Expected: Dockerfile, package.json, tsconfig.json, src/

ls -la compliance-system/src/agents/
# Expected: Dockerfile, package.json, tsconfig.json, src/
```

**Status**: ✅ / ❌

---

## Phase 3: Environment Setup (45 minutes)

### Step 8: Copy .env.example to .env
```bash
# From workspace root
cd c:\Users\Mange\work\ablk-compliance-tracker

# Copy template
cp .env.example .env

# Verify file created
ls -la .env
# Expected: .env file visible
```

**Status**: ✅ / ❌

---

### Step 9: Configure .env for Local Development
Edit `.env` with these values for local development:

```env
# Application
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000

# Database - Local PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=compliance_db_dubai
DB_USER=compliance_user
DB_PASSWORD=dev_password_local_only

# JWT Secret - Generate with:
# Windows PowerShell:
# [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((1..32 | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 127) }) -join ''))
#
# Mac/Linux:
# openssl rand -base64 32
JWT_SECRET=your_dev_jwt_secret_here_32_chars_minimum

# Blockchain - Local Besu
BESU_RPC_URL=http://localhost:8545
BESU_CHAIN_ID=1337

# Redis (optional for local dev)
REDIS_HOST=localhost
REDIS_PORT=6379

# Jurisdiction Config
CONFIG_PATH=./compliance-system/config
SUPPORTED_JURISDICTIONS=AE

# Logging & Monitoring (disable external services for local dev)
LOG_LEVEL=debug
DATADOG_API_KEY=disabled
GRAFANA_PORT=3001
```

**For macOS/Linux**: Use `nano .env` or `vim .env` to edit

**Status**: ✅ / ❌

---

### Step 10: Add .env to .gitignore (Security)
```bash
# Verify .gitignore exists
cat .gitignore

# Check if .env is ignored
grep "^.env$" .gitignore
# If not present, add it:
echo ".env" >> .gitignore

# Verify
cat .gitignore | grep .env
```

**Status**: ✅ / ❌

---

##Phase 4: Install Dependencies (45 minutes)

### Step 11: Install API Service Dependencies
```bash
# Navigate to API service
cd compliance-system/src/api

# Check package.json exists
ls -la package.json
# Expected: file exists

# Install dependencies
npm install
# Expected: "up to date" or "added X packages"

# Verify installation
npm list | head -20
# Expected: dependency tree output
```

**Status**: ✅ / ❌

**Troubleshooting**:
- If `npm install` fails, try: `npm cache clean --force` then retry
- If specific packages fail, check Node version (must be 14+)

---

### Step 12: Install Agents Service Dependencies
```bash
# Navigate to agents service (from api folder)
cd ../agents

# Install dependencies
npm install
# Expected: "up to date" or "added X packages"

# Verify installation
npm list | head -20
```

**Status**: ✅ / ❌

---

## Phase 5: TypeScript & Compilation (45 minutes)

### Step 13: Check TypeScript Configuration
```bash
# From api service folder
ls -la tsconfig.json
# Expected: file exists

# Check TypeScript version
npx tsc --version
# Expected: Version 5.x or higher
```

**Status**: ✅ / ❌

---

### Step 14: Build API Service
```bash
# From compliance-system/src/api folder
npm run build
# Expected: Compilation successful, no errors

# Check output
ls -la dist/
# Expected: .js files generated from .ts files

# Check for compilation errors
npm run build 2>&1 | grep -i "error"
# Expected: No errors (output is empty)
```

**Status**: ✅ / ❌

**Common Issues**:
- `TS2307: Cannot find module`: Check import paths are correct
- `TS2322: Type 'X' is not assignable to type 'Y'`: Fix type mismatches
- `TS6053: File is not under 'rootDir'`: Check tsconfig.json includes/excludes

---

### Step 15: Build Agents Service
```bash
# From compliance-system/src/agents folder
npm run build
# Expected: Compilation successful, no errors

# Check for errors
npm run build 2>&1 | grep -i "error"
# Expected: No errors
```

**Status**: ✅ / ❌

---

## Phase 6: Lint & Code Quality (30 minutes)

### Step 16: Initialize ESLint (if needed)
```bash
# From api folder
npx eslint --init
# If eslint not configured already

# Or verify existing config
ls -la .eslintrc*
```

**Status**: ✅ / ❌

---

### Step 17: Run Linting on API Service
```bash
# From compliance-system/src/api
npm run lint
# Expected: "0 error(s)" or "All files match linting rules"

# Fix auto-fixable issues
npm run lint -- --fix
```

**Status**: ✅ / ❌

---

### Step 18: Run Linting on Agents Service
```bash
# From compliance-system/src/agents
npm run lint
npm run lint -- --fix
```

**Status**: ✅ / ❌

---

## Phase 7: Database Connection Verification (30 minutes)

### Step 19: Create Database User & Database
```bash
# Open PostgreSQL command line
psql -h localhost -U postgres

# Inside psql:
-- Create user if needed
CREATE USER compliance_user WITH PASSWORD 'dev_password_local_only';

-- Create database
CREATE DATABASE compliance_db_dubai OWNER compliance_user;

-- Grant privileges
GRANT CONNECT ON DATABASE compliance_db_dubai TO compliance_user;
GRANT CREATE ON DATABASE compliance_db_dubai TO compliance_user;

-- Exit psql
\q
```

**Status**: ✅ / ❌

---

### Step 20: Verify Database Connection from Node
```bash
# From compliance-system/src/api folder

# Create test file: test-db-connection.js
cat > test-db-connection.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Database connection successful!');
    console.log('Current time from DB:', res.rows[0]);
    process.exit(0);
  }
});
EOF

# Run test
node test-db-connection.js
# Expected: "✅ Database connection successful!"

# Clean up
rm test-db-connection.js
```

**Status**: ✅ / ❌

---

## Phase 8: Rules Engine - Quick Verification (30 minutes)

### Step 21: Verify jurisdictionRulesEngine.ts
```bash
# From compliance-system/src/agents

# Check file exists
ls -la src/services/jurisdictionRulesEngine.ts
# Expected: file exists

# Check TypeScript compilation without errors
npx tsc --noEmit src/services/jurisdictionRulesEngine.ts
# Expected: No output (success) or compilation errors

# If errors, note them for later fixing
```

**Status**: ✅ / ❌

---

### Step 22: Verify ae.yaml Configuration
```bash
# From compliance-system/

# Check ae.yaml exists
ls -la config/jurisdictions/ae.yaml
# Expected: file exists and is ~350 lines

# Check YAML syntax
cat config/jurisdictions/ae.yaml | head -20
# Expected: Valid YAML structure (no parse errors visible)
```

**Status**: ✅ / ❌

---

## Phase 9: Documentation & Sign-Off (15 minutes)

### Step 23: Create Environment_Setup.md
Create file: `docs/Environment_Setup.md`

```markdown
# Environment Setup Guide

## Prerequisites Installed
- [ ] Node.js v14+ (run: node --version)
- [ ] PostgreSQL 13+ (run: psql --version)
- [ ] Docker & Docker Compose
- [ ] Git
- [ ] VS Code with SonarQube extension

## Setup Steps

1. Clone repo and verify structure
2. Copy .env.example to .env
3. Edit .env with local values (see below)
4. Run npm install in src/api and src/agents
5. Run npm run build in both services
6. Verify database connection

## .env Local Development Values
[Copy from checklist Step 9 above]

## Troubleshooting

### npm install fails
- Run: npm cache clean --force
- Retry: npm install

### TypeScript compilation errors
- Check Node version: node --version (must be 14+)
- Run: npm install -g typescript

### Database connection fails
- Check PostgreSQL is running: psql -U postgres
- Verify .env has correct DB credentials
```

**Status**: ✅ / ❌

---

### Step 24: Document Any Issues Found
```bash
# Create file: docs/Environment_Setup_Issues_Week1.md

# Document any issues encountered:
# - [ ] Issue name
# - [ ] Root cause
# - [ ] Resolution
# - [ ] Time spent
```

**Status**: ✅ / ❌

---

## Final Sign-Off Checklist

✅ **All Prerequisites Verified**:
- [ ] Node.js v14+ installed
- [ ] PostgreSQL 13+ installed and running
- [ ] Docker & Docker Compose installed
- [ ] Git configured
- [ ] VS Code with extensions installed

✅ **Repository Setup**:
- [ ] Repo cloned and verified
- [ ] Directory structure correct
- [ ] Git status clean

✅ **Environment Configuration**:
- [ ] .env file created from .env.example
- [ ] All critical vars set (DB_*, JWT_SECRET, CONFIG_PATH, SUPPORTED_JURISDICTIONS)
- [ ] .env added to .gitignore
- [ ] No secrets visible in any committed files

✅ **Dependencies Installed**:
- [ ] API service npm install successful
- [ ] Agents service npm install successful
- [ ] All required packages present

✅ **Code Quality**:
- [ ] API service builds without errors (npm run build)
- [ ] Agents service builds without errors
- [ ] API service linting passes (npm run lint)
- [ ] Agents service linting passes
- [ ] No TypeScript errors

✅ **Database Ready**:
- [ ] PostgreSQL user created
- [ ] Database created and owned by compliance_user
- [ ] Database connection verified from Node.js
- [ ] Ready for schema migration (Task 1.2)

✅ **Rules Engine Verified**:
- [ ] jurisdictionRulesEngine.ts compiles without errors
- [ ] ae.yaml exists and has valid YAML syntax
- [ ] CONFIG_PATH set in .env

✅ **Documentation**:
- [ ] Environment_Setup.md created
- [ ] Any issues documented
- [ ] This checklist completed

---

## Sign-Off
- **Completed By**: ________________________  
- **Date**: ________________________  
- **Review Comment**: ________________________  
- **Ready for Task 1.2**: ✅ YES / ❌ NO

---

**Next Task**: Week 1 Task 1.2 - Database Migration (Create jurisdiction tables)
