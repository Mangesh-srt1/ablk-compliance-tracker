# 🚀 Tuesday (Feb 27) Development Environment Setup

**Status**: ⏳ IN PROGRESS  
**Checklist**: Docker ✅ | npm Workspaces ✅ | GitHub Actions ✅ | Husky 🔧

---

## 1. ✅ Docker Compose Verification

The `docker-compose.dev.yml` is properly configured with:

### Services Configured:
- **PostgreSQL 16**: Internal only (port 5432), data persistence via volumes
- **Redis 7**: Port 6380 (external) → 6379 (internal) - avoids conflicts
- **API Service**: Port 4000 (external) → 3000 (internal) with hot-reload
- **Agents Service**: Port 4002 (external) → 3002 (internal) with hot-reload

### Key Features:
✅ Health checks configured for all services  
✅ Hot-reload via volume mounts (ts-node-dev)  
✅ Debug ports: 9229 (API), 9230 (Agents)  
✅ Environment variables from .env and .env.local  
✅ Network isolation: `lumina-network-dev`  
✅ Data persistence: Named volumes for postgres/redis  

### Verification Steps:
```bash
# Navigate to compliance-system
cd compliance-system

# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Expected output (after ~30-45 seconds):
# ✅ postgres: healthy
# ✅ redis: healthy
# ✅ api: Listening on port 3000
# ✅ agents: Listening on port 3002

# Verify services
docker ps --filter "name=lumina" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test health endpoints
curl http://localhost:4000/api/health
curl http://localhost:4002/health
```

---

## 2. ✅ npm Workspace Setup

The monorepo uses npm workspaces for shared dependencies across services:

### Workspace Structure:
```json
{
  "workspaces": [
    "src/api",        // Express.js API service
    "src/agents",     // LangChain.js agents service
    "src/dashboard",  // React + Vite dashboard (future)
    "cdk"             // AWS CDK for infrastructure
  ]
}
```

### Key Benefits:
✅ Shared `node_modules` at root level  
✅ Single `package-lock.json` for dependency consistency  
✅ Hoisting of common dependencies  
✅ Easy cross-workspace commands with `--workspace` flag  

### Workspace Commands:

```bash
# Install all workspace dependencies
npm ci

# Run scripts in specific workspace
npm run build --workspace=src/api
npm run dev --workspace=src/agents
npm run test --workspace=src/api

# Run script in all workspaces
npm run build --workspaces

# Add package to specific workspace
npm install axios --workspace=src/api

# Install dev dependency in all workspaces
npm install --save-dev jest @types/jest ts-jest --workspaces
```

### Verification Steps:
```bash
# Check workspace structure
npm ls -a --depth=0

# Expected output:
# ableka-lumina (root workspace)
# ├── src/api
# ├── src/agents
# ├── src/dashboard
# └── cdk

# Verify all dependencies installed correctly
npm ls --all --depth=0

# Bootstrap (install all deps + setup husky)
npm run bootstrap
```

---

## 3. ✅ GitHub Actions CI/CD Pipeline

### Workflows Configured:

#### A. **ci.yml** - Main CI Pipeline
Triggers on: Push to `main`/`develop`, Pull Requests  
Runs on: `ubuntu-latest` (30-min timeout)  

**Jobs Executed:**
1. **test** - Lint, type-check, run tests for each service
2. **coverage-check** - Verify 75% coverage threshold
3. **security-scan** - npm audit + Trivy vulnerability scanner
4. **build** - Compile TypeScript + check bundle size
5. **docker-build** - Build Docker images (on main push)
6. **status-check** - Final status aggregation
7. **notify** - GitHub PR comments

**Key Features:**
✅ Matrix strategy for parallel testing (api + agents)  
✅ Caching: npm dependencies via GitHub Actions cache  
✅ Coverage threshold enforcement (75% minimum)  
✅ Trivy security scanning with SARIF output  
✅ Bundle size warnings (>10MB)  
✅ Docker image push to registry (if credentials configured)  

#### B. **sonarqube.yml** - Code Quality Analysis
Triggers on: Push to `main`/`develop`, Pull Requests  
Runs on: `ubuntu-latest` (30-min timeout)  

**Jobs Executed:**
1. **sonarqube** - SonarQube analysis with coverage
2. **code-quality** - ESLint + TypeScript + Prettier
3. **dependency-check** - npm outdated + npm audit

**Key Features:**
✅ Full depth checkout for SonarQube analysis  
✅ Optional remote SonarQube integration  
✅ Code quality checks (lint, type, format)  
✅ Dependency and security audits  

### Configuration:

#### Environment Variables in Workflows:
```yaml
# Set these as GitHub Secrets for enhanced functionality:
DOCKER_USERNAME      # Docker Hub username
DOCKER_PASSWORD      # Docker Hub password
SONAR_HOST_URL       # Remote SonarQube server URL
SONAR_LOGIN          # SonarQube login (deprecated)
SONAR_TOKEN          # SonarQube API token (recommended)
```

#### Verification Steps:
```bash
# View workflow status
gh workflow list

# Expected output:
# CI - Compliance System Tests    active
# SonarQube Analysis              active

# Trigger a test run (make a commit to main/develop)
git add .
git commit -m "chore: test CI/CD pipeline"
git push origin develop

# Monitor workflow execution
gh run list --workflow=ci.yml

# View detailed logs
gh run view <run-id> --log
```

---

## 4. 🔧 Husky Pre-commit Hooks Setup

### Hooks Installed:

#### **pre-commit** (`commit-msg`)
Validates commit message follows conventional commit format.  
**Syntax**: `type(scope): message`  
**Examples**:
- ✅ `feat(api): add new KYC endpoint`
- ✅ `fix(db): resolve connection pooling issue`
- ✅ `docs(readme): update installation steps`
- ✅ `test(agents): add unit tests for supervisor agent`
- ❌ `update code` (too vague)
- ❌ `API changes` (missing type)

#### **pre-commit** (`pre-commit`)
Runs before committing - validates code quality.  
**Checks**:
- ESLint: Code style and best practices
- TypeScript: Type checking (no compilation)

**Skips files**: node_modules, dist, coverage  
**Only checks**: Staged TypeScript/JavaScript files  

#### **pre-push** (`pre-push`)
Runs before pushing to remote - validates tests.  
**Behavior**:
- **Main branch**: Full test suite (`npm run test:ci`)
- **Feature branches**: Quick unit tests only (`npm run test:unit`)

---

## 5. 🔧 Husky Installation Steps

### Step 1: Install Husky via npm
```bash
cd compliance-system

# Install husky package
npm install husky --save-dev

# Initialize husky (creates .husky directory with hooks)
npx husky install

# Expected output:
# husky - Git hooks installed
```

### Step 2: Verify Hook Files
```bash
# Check hooks were created
ls -la ../.husky/

# Expected files:
# pre-commit      (ESLint + TypeScript checks)
# pre-push        (Test execution)
# commit-msg      (Message validation)
# _/husky.sh      (Husky core)
```

### Step 3: Test Hooks Manually (Optional)
```bash
# Test pre-commit hook
sh ../.husky/pre-commit

# Expected: ESLint + TypeScript checks pass

# Test pre-push hook
sh ../.husky/pre-push

# Expected: Tests complete successfully
```

### Step 4: Disable Hooks Temporarily (if needed)
```bash
# Bypass all hooks (use with caution!)
git commit --no-verify -m "chore: emergency fix"
git push --no-verify

# Or disable specific hook
HUSKY=0 git commit -m "chore: skip hooks"
```

### Step 5: Update .gitignore
Ensure .husky is NOT in .gitignore so hooks are tracked:
```bash
# Check .gitignore
cat ../.gitignore | grep -i husky

# Should be EMPTY - husky hooks must be committed!
# If present, remove it:
# sed -i '/.husky/d' ../.gitignore
```

---

## 6. 📋 Full Tuesday Checklist

### Pre-requisites
- [x] Node.js 20+ installed
- [x] Docker & Docker Compose installed
- [x] Git configured with SSH keys (optional, HTTPS OK)

### Tasks
- [x] **Docker Verification**
  - [x] docker-compose.dev.yml reviewed
  - [x] All services configured correctly
  - [x] Health checks in place
  - [ ] **ACTION**: Run `docker-compose -f docker-compose.dev.yml up` to verify

- [x] **npm Workspace Setup**
  - [x] package.json configured with workspaces
  - [x] All 4 workspaces documented
  - [ ] **ACTION**: Run `npm bootstrap` to install all dependencies

- [x] **GitHub Actions CI/CD**
  - [x] ci.yml workflow configured (7 jobs)
  - [x] sonarqube.yml workflow created (3 jobs)
  - [x] Security scanning enabled
  - [x] Coverage threshold enforcement
  - [ ] **ACTION**: Push branch to trigger workflow execution

- [ ] **Husky Pre-commit Hooks**
  - [x] Hook files created (.pre-commit, pre-push, commit-msg)
  - [x] Hook scripts configured with proper checks
  - [ ] **ACTION**: Run `npm install husky --save-dev && npx husky install`
  - [ ] **ACTION**: Verify hooks work with test commit

---

## 7. 🚀 Next Steps (For Wednesday)

Once Tuesday is complete:

1. **Verify Integration**
   ```bash
   # From compliance-system directory
   docker-compose -f docker-compose.dev.yml up --build
   
   # In another terminal:
   curl http://localhost:4000/api/health
   curl http://localhost:4002/health
   ```

2. **Test Git Workflow**
   ```bash
   # Make a test commit
   git add .github .husky
   git commit -m "ci: setup GitHub Actions and Husky hooks"
   git push origin develop
   
   # Watch workflow execute:
   gh run list --workflow=ci.yml
   ```

3. **Wednesday: Fix TypeScript Errors**
   - Fix compilation errors in API & Agents modules
   - Remove generated .js/.d.ts files from src/
   - Update environment variables

---

## 📞 Troubleshooting

### Issue: Husky hooks not executing
```bash
# Solution: Ensure .husky is tracked in git
git add .husky
git commit -m "chore: add husky Git hooks"

# Verify hooks have executable permissions
ls -la .husky/pre-commit  # Should show x permission
```

### Issue: Pre-commit hook fails (ESLint errors)
```bash
# Solution: Auto-fix ESLint issues
npm run lint:fix

# Then stage and commit:
git add .
git commit -m "style: auto-fix ESLint errors"
```

### Issue: Pre-push hook fails (Test failures)
```bash
# Solution: Debug tests locally
npm run test:watch

# Fix failures, then try push again
git push origin feature-branch
```

### Issue: Docker containers won't start
```bash
# Clean up conflicting containers
docker system prune -f

# Retry docker-compose
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build
```

---

## ✅ Success Criteria for Tuesday

- [x] Docker compose.dev.yml verified (all services configured)
- [x] npm workspaces properly configured (4 workspaces)
- [x] GitHub Actions CI pipeline set up (ci.yml + sonarqube.yml)
- [ ] Husky hooks installed and tested
- [ ] Test commit pushed to develop branch with all checks passing

**Estimated Time**: 45-60 minutes  
**Owner**: DevOps + Backend Lead  
**Dependencies**: Node.js, Docker, Git  

---

**Last Updated**: February 26, 2026  
**Next Phase**: Wednesday, Feb 28 - Fix TypeScript Errors & Database Setup
