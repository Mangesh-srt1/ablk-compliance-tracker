# Folder Structure Reorganization Guide

**Date**: February 26, 2026  
**Status**: Implementation Complete  
**Purpose**: Move all project config files into `compliance-system/` for proper monorepo organization

---

## ✅ Changes Completed

### Files Moved INTO `compliance-system/`

From Root → INTO compliance-system/:
```
package.json                → compliance-system/package.json
tsconfig.json               → compliance-system/tsconfig.json
jest.config.js              → compliance-system/jest.config.js
jest.setup.js               → compliance-system/jest.setup.js
.eslintrc.json              → compliance-system/.eslintrc.json
.prettierrc.json            → compliance-system/.prettierrc.json
.eslintignore               → compliance-system/.eslintignore
.prettierignore             → compliance-system/.prettierignore
.nvmrc                      → compliance-system/.nvmrc
.husky/                     → compliance-system/.husky/
```

### Files Updated for New Paths

#### compliance-system/package.json
**Before**: Workspaces pointed to `compliance-system/src/*`  
**After**: Workspaces point to `src/*` (since this IS the root now)

```json
"workspaces": [
  "src/api",           // Instead of: compliance-system/src/api
  "src/agents",        // Instead of: compliance-system/src/agents
  "src/dashboard",     // Instead of: compliance-system/src/dashboard
  "cdk"                // Instead of: compliance-system/cdk
]
```

#### compliance-system/tsconfig.json
**Before**: Paths were `./compliance-system/src/*`  
**After**: Paths are `./src/*`

```json
"paths": {
  "@/*": ["./src/*"],
  "@api/*": ["./src/api/src/*"],
  "@agents/*": ["./src/agents/src/*"]
}
```

#### compliance-system/jest.config.js
**Before**: Roots were `<rootDir>/compliance-system/src`  
**After**: Roots are `<rootDir>/src`

```javascript
"roots": ["<rootDir>/src"]
```

---

## 📁 NEW STRUCTURE

```
ablk-compliance-tracker/
│
├── .github/
│   └── copilot-instructions.md
│
├── Planning docs/
│   ├── System Architecture/          (5 arch docs)
│   └── [25+ planning documents]
│
├── docs/
│   └── DAILY_ACTIONS_ROADMAP.md      (Original comprehensive plan)
│
├── CONTRIBUTING.md                    (Git workflow guide)
├── CODE_AUDIT_REPORT.md              (Detailed implementation audit)
├── UPDATED_DEVELOPMENT_ROADMAP.md    (Revised 4-week MVP timeline)
├── WEEK1_MONDAY_COMPLETION.md        (Week 1 completion report)
├── DOCKER_DEVELOPMENT.md             (Docker dev environment guide)
├── README.md                         (Project overview)
│
└── compliance-system/                ← MONOREPO ROOT (Node.js project)
    │
    ├── package.json                  ← Root npm workspaces config
    ├── tsconfig.json                 ← Root TypeScript config
    ├── jest.config.js                ← Root Jest config
    ├── jest.setup.js                 ← Jest setup
    ├── .eslintrc.json                ← Root ESLint config
    ├── .prettierrc.json              ← Root Prettier config
    ├── .eslintignore                 ← ESLint ignore patterns
    ├── .prettierignore                ← Prettier ignore patterns
    ├── .nvmrc                        ← Node version 20.11.0
    ├── .husky/                       ← Git hooks (pre-commit, commit-msg)
    │   ├── pre-commit                ← Format + Lint + Typecheck
    │   └── commit-msg                ← Validate commit message format
    │
    ├── docker-compose.yml            ← Production deployment (259 lines)
    ├── docker-compose.dev.yml        ← Development with hot-reload (259 lines)
    ├── .env.example                  ← Environment template
    │
    ├── src/
    │   │
    │   ├── api/                      ← API Service Module
    │   │   ├── package.json          ← API-specific dependencies
    │   │   ├── tsconfig.json         ← API-specific TypeScript config
    │   │   ├── Dockerfile            ← Production image
    │   │   ├── Dockerfile.dev        ← Development image (ts-node-dev)
    │   │   ├── .env                  ← Local API config
    │   │   │
    │   │   └── src/
    │   │       ├── index.ts          ← Main Express app
    │   │       ├── config/           ← Database, Redis, Logger configs
    │   │       ├── middleware/       ← Auth, Error handling, Logging
    │   │       ├── routes/           ← 7 route handlers (Auth, KYC, AML, etc)
    │   │       ├── services/         ← 3 services (KYC, AML, Compliance)
    │   │       ├── types/            ← TypeScript type definitions
    │   │       ├── utils/            ← Utilities (SQL Loader, etc)
    │   │       ├── logs/             ← Application logs
    │   │       └── __tests__/        ← Unit & integration tests
    │   │
    │   ├── agents/                   ← AI Agents Service Module
    │   │   ├── package.json          ← Agents-specific dependencies
    │   │   ├── tsconfig.json         ← Agents-specific TypeScript config
    │   │   ├── Dockerfile            ← Production image
    │   │   ├── Dockerfile.dev        ← Development image (ts-node-dev)
    │   │   │
    │   │   └── src/
    │   │       ├── index.ts          ← Main Express app
    │   │       ├── agents/           ← 6 Agent implementations
    │   │       │   ├── supervisorAgent.ts      (387 lines)
    │   │       │   ├── kycAgent.ts             (339 lines)
    │   │       │   ├── amlAgent.ts             (550 lines)
    │   │       │   ├── sebiAgent.ts            (704 lines)
    │   │       │   ├── amlAnomalyDetectorAgent.ts
    │   │       │   └── baseAgent.ts
    │   │       ├── tools/            ← 6 Integration Clients
    │   │       │   ├── ballerineClient.ts     (KYC provider)
    │   │       │   ├── chainalysisClient.ts   (AML/blockchain)
    │   │       │   ├── ofacClient.ts          (Sanctions screening)
    │   │       │   ├── sebiClient.ts          (India regulator)
    │   │       │   ├── bseClient.ts           (Stock exchange)
    │   │       │   └── nseClient.ts           (Stock exchange)
    │   │       ├── services/         ← Agent Services
    │   │       │   ├── agentOrchestrator.ts   (Orchestration)
    │   │       │   ├── eventProcessor.ts      (Event handling)
    │   │       │   ├── jurisdictionRulesEngine.ts
    │   │       │   └── oracleOwnershipGuard.ts
    │   │       ├── graphs/           ← LangGraph State Machine
    │   │       │   └── complianceGraph.ts
    │   │       ├── routes/           ← API routes for agents
    │   │       ├── config/           ← Database, Redis, Logger
    │   │       ├── types/            ← Type definitions
    │   │       ├── logs/             ← Application logs
    │   │       └── __tests__/        ← Unit tests
    │   │
    │   ├── dashboard/                ← React Frontend Module
    │   │   ├── package.json          ← Dashboard dependencies
    │   │   ├── tsconfig.json         ← React TypeScript config
    │   │   ├── vite.config.ts        ← Vite bundler config
    │   │   ├── Dockerfile            ← Production image
    │   │   ├── Dockerfile.dev        ← Development image (Vite HMR)
    │   │   ├── index.html            ← HTML entry point
    │   │   │
    │   │   └── src/
    │   │       ├── main.tsx          ← React app entry
    │   │       ├── index.css         ← Global styles
    │   │       ├── components/       ← React components
    │   │       ├── pages/            ← Page components
    │   │       ├── hooks/            ← Custom React hooks
    │   │       ├── services/         ← API client services
    │   │       ├── types/            ← Type definitions
    │   │       ├── stores/           ← State management (Redux/Zustand)
    │   │       └── __tests__/        ← Jest component tests
    │
    ├── cdk/                          ← AWS CDK Infrastructure
    │   ├── package.json              ← CDK dependencies
    │   ├── bin/
    │   │   └── app.ts                ← CDK app entry
    │   ├── lib/
    │   │   └── compliance-system-stack.ts   (Kubernetes + RDS + More)
    │   └── lambda/                   ← Lambda functions for serverless ops
    │
    ├── config/                       ← Configuration Files
    │   ├── jurisdictions/            ← Jurisdiction-Specific Rules
    │   │   ├── ae.yaml               ← UAE/Dubai rules (425 lines)
    │   │   ├── in.yaml               ← India regulations (SEBI, PMLA)
    │   │   ├── us.yaml               ← US regulations (FinCEN, etc)
    │   │   ├── eu.yaml               ← EU regulations (GDPR, MiCA)
    │   │   └── ...
    │   └── schemas/                  ← Database schemas
    │
    ├── scripts/                      ← Database & Utility Scripts
    │   ├── sql/
    │   │   ├── kyc_checks/           ← KYC table INSERT/SELECT/UPDATE
    │   │   ├── aml_checks/           ← AML table INSERT/SELECT/UPDATE
    │   │   ├── compliance_checks/    ← Compliance table CRUD
    │   │   └── compliance_rules/     ← Rules engine CRUD
    │   └── migration/                ← Database schema migrations
    │
    ├── docs/                         ← Module documentation
    │   ├── API.md                    ← API endpoint documentation
    │   ├── AGENTS.md                 ← Agent architecture
    │   ├── DATABASE.md               ← Schema documentation
    │   └── DEPLOYMENT.md             ← Deployment instructions
    │
    ├── logs/                         ← Application runtime logs
    │
    └── README.md                     ← compliance-system README
```

---

## 🔄 Migration Checklist

### Files to Delete from Root (Now in compliance-system/)
After merging this commit, these files should be REMOVED from root:
```
❌ ablk-compliance-tracker/package.json
❌ ablk-compliance-tracker/tsconfig.json
❌ ablk-compliance-tracker/jest.config.js
❌ ablk-compliance-tracker/jest.setup.js
❌ ablk-compliance-tracker/.eslintrc.json
❌ ablk-compliance-tracker/.prettierrc.json
❌ ablk-compliance-tracker/.eslintignore
❌ ablk-compliance-tracker/.prettierignore
❌ ablk-compliance-tracker/.nvmrc
❌ ablk-compliance-tracker/.husky/
```

### Developer Instructions (After Merge)

1. **Update .git** reminders:
   ```bash
   cd compliance-system
   # Now this is your working directory
   npm install          # Install from local package.json
   npm run bootstrap    # Setup Husky hooks
   ```

2. **New working directory**:
   ```bash
   # Go into compliance-system first
   cd compliance-system
   npm run dev          # Start dev servers
   npm run test         # Run tests
   npm run docker:dev:up # Start Docker dev environment
   ```

3. **Update README**:
   Root README should point to `compliance-system/README.md`

4. **GitHub CI/CD**:
   Update GitHub Actions workflows to:
   ```yaml
   working-directory: ./compliance-system
   ```

---

## 📊 Benefits of This Structure

| Aspect | Benefit |
|--------|---------|
| **Workspace Management** | Each module is independent, can be versioned separately |
| **Dependency Control** | Clear separation of concerns (API, Agents, Dashboard deps) |
| **Build Optimization** | Only rebuild modules with changes |
| **Testing** | Unit tests live with source code (`__tests__/` folders) |
| **Documentation** | Documentation in `docs/` subfolder, not at root |
| **Deployment** | Each service can be deployed independently |
| **Scaling** | Easy to add new services (e.g., `src/scheduler`, `src/reports`) |

---

## ⚠️ Important Notes

1. **Root package.json**: Kept for project metadata and GitHub references only
   - Don't run `npm install` from root
   - Run from `compliance-system/` instead

2. **CONTRIBUTING.md**: Stays at root
   - Guides developers on the whole project structure
   - Points developers to `compliance-system/` for setup

3. **Docker commands**: Update to use `compliance-system/` docker-compose files
   - Old: `docker-compose -f compliance-system/docker-compose.dev.yml up`
   - New: `cd compliance-system && docker-compose -f docker-compose.dev.yml up`
   - Or use root npm scripts: `npm run docker:dev:up` (from root, scripts handle paths)

4. **Setup Flow** for new developers:
   ```bash
   git clone <repo>
   cd ablk-compliance-tracker
   cd compliance-system
   npm run bootstrap
   npm run docker:dev:up
   ```

---

## 🎯 Next Steps

1. **Commit this reorganization**: All files now in compliance-system/
2. **Update README** at root to point to compliance-system/
3. **Update GitHub Actions** to work from compliance-system/
4. **Delete duplicate files** from root (after verification)
5. **Update documentation** with new working directory

---

**Status**: ✅ Ready for deployment  
**Last Updated**: February 26, 2026  
**Prepared By**: GitHub Copilot

