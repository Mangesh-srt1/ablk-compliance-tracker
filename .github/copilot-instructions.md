# Ableka Lumina - AI Compliance Engine Instructions

## Project Overview

A 100% **AI-driven RegTech SaaS platform** (Ableka Lumina) using LangChain.js agents for automated KYC/AML/fraud detection across blockchains and jurisdictions. Designed for PE tokenization, real estate RWA compliance, and multi-chain regulatory enforcement.

**Architecture:** Node.js + LangChain.js with:
- **Frontend:** React.js dashboard (Vite, TypeScript, Recharts, Tailwind CSS)
- **Backend:** Express.js API + LangChain.js agents (TypeScript, PostgreSQL + PGVector, Redis)
- **AI Engine:** Grok 4.1 LLM reasoning loop with multi-tool orchestration
- **Blockchains:** Hyperledger Besu (permissioned - default) + Ethereum/Solana (public - optional)
- **Compliance:** Multi-jurisdiction rules engine (YAML-based), jurisdiction-specific flow routing
- **Integrations:** Ballerine (KYC), Marble (AML), Chainalysis (blockchain sanctions), The Graph (subgraph queries)

---

## 🔄 Recent Updates (February 26, 2026 - Week 1 Tuesday)

**Docker & Development Environment Finalized:**
✅ Container naming standardized: `lumina-*` prefix (vs old `ableka-*`)
✅ Unique port mappings to prevent Docker daemon conflicts:
  - API: External 4000 → Internal 3000
  - Agents: External 4002 → Internal 3002  
  - Redis: External 6380 → Internal 6379 (avoids system Redis on 6379)
  - PostgreSQL: Internal only (no external port)
✅ Database initialization SQL fixed (pgvector → BYTEA for Alpine PostgreSQL)
✅ Environment strategy clarified: 3 files (.env, .env.local, .env.example) for flexibility
✅ Docker Compose strategy: 2 files (production + dev) for safety & configuration isolation

**Why Keep 2 Docker Compose + 3 Env Files?**
- Prevents accidental production deployment with development settings
- Development file includes debug ports (9229, 9230), hot-reload volumes, and loose resource limits
- Production file optimized for security, performance, and monitoring
- Multi-file env strategy allows per-developer customization without git conflicts

**Blockers Resolved:**
✅ Port conflicts (6379 already in use) → Changed Redis external port to 6380
✅ PostgreSQL pgvector not available in Alpine → Switched to BYTEA for development
✅ Missing password_hash in users table → Commented out sample admin user
✅ TypeScript deprecation warnings about importsNotUsedAsValues → Config updated

**Git Commits This Session:**
- 8d719e5: cleanup: Remove duplicate config files from root
- e1a3df5: refactor: Update Docker naming prefix to lumina and use unique ports

## 📚 System Architecture Documentation References

**All comprehensive system architecture documentation is located in:**
```
Planning docs/System Architecture/
├── AbekeLumina_RWA_Enterprise_Implementation.md (CORE - 700+ lines)
│   └─ Complete system design, ERD, API specs, workflows, K8s manifests, AWS CDK
├── AbekeLumina_Enterprise_Architecture_Diagram.md
│   └─ 10-layer system architecture, all components & data flows
├── AbekeLumina_Open_Source_Tech_Stack.md
│   └─ 100% open source stack, global platform (multi-region, i18n, currencies)
├── AbekeLumina_Option_B_Architecture.md
│   └─ Real-time monitoring architecture, AI/LLM integration
└── architecture-overview.md
    └─ High-level architecture overview
```

**Every Agent Task Should Reference:**
1. **AbekeLumina_RWA_Enterprise_Implementation.md** - For system design & data models
2. **AbekeLumina_Enterprise_Architecture_Diagram.md** - For component relationships
3. **AbekeLumina_Open_Source_Tech_Stack.md** - For technology choices & global platform details
4. **MASTER_IMPLEMENTATION_PLAN.md** - For project phases & timelines

**Before implementing any feature:**
- Review relevant section in AbekeLumina_RWA_Enterprise_Implementation.md
- Verify alignment with architecture diagrams
- Check open source tech stack for approved libraries
- Ensure compliance requirements met (see SEBI checklist in implementation guide)

---

## Critical Architecture Knowledge

### AI Agent Architecture (LangChain.js ReAct Pattern)

```
User Input (Entity Data / Blockchain TX)
  ↓
SupervisorAgent (LangChain ReAct Loop)
  ├─ Perception: Parse request, extract jurisdiction, blockchain type
  ├─ Thought: "What compliance checks are needed?"
  ├─ Action: Call appropriate tool(s)
  │   ├─ KYCTool (Ballerine integration)
  │   ├─ AMLTool (Marble risk scoring)
  │   ├─ BlockchainTool (ethers.js for TX verification)
  │   ├─ ChainalysisTool (sanctions screening)
  │   ├─ JurisdictionRulesTool (load ae.yaml, us.yaml, etc)
  │   └─ SanctionsTool (OFAC/UN data)
  ├─ Observation: Interpret tool results
  ├─ Thought: "Risk score + reasoning"
  └─ Final Answer: { status: APPROVED/REJECTED/ESCALATED, riskScore, reasoning }
  ↓
Store Decision in PGVector (for pattern learning)
  ↓
Return to User via REST API or WebSocket
```

**Key Distinction from Microservices:**
- No per-service queues; orchestration via LangChain ReAct loop
- Single agent coordinates multiple tools in one thinking session
- Memory (PGVector + Redis) preserves context across sessions
- Grok LLM provides explainable reasoning (output rationale for every decision)

### Multi-Blockchain Support (Client-Initiated, No Infrastructure Setup)

**IMPORTANT:** Ableka Lumina does NOT set up, deploy, or manage blockchain infrastructure. It only **monitors and interacts** with existing blockchains that clients provide and approve for monitoring.

**Permissioned Blockchain (Hyperledger Besu) - When Client Provides Access:**
```typescript
// Client must provide existing Besu RPC endpoints
blockchainType: "permissioned"
networkConfig: {
  rpc_endpoints: [
    "https://validator-1.client-besu.internal:8545",  // CLIENT-PROVIDED
    "https://validator-2.client-besu.internal:8545"   // CLIENT-PROVIDED
  ],
  chain_id: 1337,  // Client specifies
  internalCounterparties: {
    // Client provides known addresses and risk profiles
    "0xClientFundMgr": { risk_profile: "low", role: "GP" }
  }
}

// Ableka Lumina: Monitors only, does NOT manage validators
```

**Public Blockchain (Ethereum/Solana) - When Client Enables Monitoring:**
```typescript
// Client approves monitoring on public chains
blockchainType: "public"
networkConfig: {
  rpc_endpoint: "https://mainnet.infura.io/v3/CLIENT_PROJECT_ID",  // CLIENT-PROVIDED
  // or "https://api.mainnet-beta.solana.com"
  chain_id: 1,  // Ethereum mainnet
  requireChainalysis: true,
  requireOFAC: true
}

// Ableka Lumina: Read-only monitoring of transactions
```

### Jurisdiction Rules Engine (Pluggable YAML)

Instead of hardcoding rules:
```typescript
// WRONG (hardcoded)
if (jurisdiction === 'AE') {
  const threshold = 150000; // Dubai fund min
} else if (jurisdiction === 'IN') {
  const threshold = 100000; // India fund min
}

// RIGHT (from YAML config)
const rules = jurisdictionConfig.load('AE'); // Loads ae-dubai.yaml
const threshold = rules.fundStructure.minFundSize;
```

**Config Path:** `src/config/jurisdictions/{jurisdiction-code}.yaml`
- Example: `ae-dubai.yaml` (DFSA rules), `in-sebi.yaml` (SEBI rules), `us-reg-d.yaml` (US Reg D)
- Each file contains: KYC requirements, fund min size, investor caps, governance rules, sanctions lists, AML thresholds

### Database Layer

- **PostgreSQL** (5432): Relational compliance data (KYC records, AML scores, audit logs)
- **PGVector** (pgvector extension): Vector embeddings for pattern learning and anomaly detection
- **Redis** (6379): Caching, session management, rate limiting, decision cache
- **S3/IPFS**: Compliance documents, audit trails (optional)

### Integration Points

**KYC Provider Integration (Ballerine):**
```typescript
// Agent calls KYCTool, which wraps Ballerine API
const kycResult = await kycTool.call({
  name: "Ahmed Al Maktoum",
  jurisdiction: "AE",
  documentType: "PASSPORT",
  liveness: true
});
// Returns { status: "VERIFIED", confidence: 0.98, matched_rules: [...] }
```

**AML Risk Integration (Marble):**
```typescript
const amlResult = await amlTool.call({
  wallet: "0x1234...",
  transactionHistory: [...],
  jurisdiction: "AE"
});
// Returns { riskScore: 45, flags: ["PEP_MATCH"], confidence: 0.92 }
```

**Blockchain Monitoring (ethers.js):**
```typescript
// Agent monitors blockchain in real-time
const blockchainListener = new BlockchainListener({
  blockchain: "ethereum",
  contract: "0xTokenContract",
  eventName: "Transfer"
});

listener.on('transfer', async (tx) => {
  // Trigger compliance check on detected TX
  const result = await agent.runKYCCheck({
    from: tx.from,
    to: tx.to,
    amount: tx.value,
    txHash: tx.hash
  });
});
```

## Developer Workflows

### Docker & Environment Configuration (Updated Feb 26, 2026)

**Container Naming & Ports (Unique per project to avoid conflicts):**
- All containers prefixed with `lumina-` (vs old `ableka-`)
- **API Service:** Port 4000 → Internal 3000 (unique external port)
- **Agents Service:** Port 4002 → Internal 3002 (unique external port) 
- **Redis Cache:** Port 6380 → Internal 6379 (unique external port, avoids collision with system Redis on 6379)
- **PostgreSQL:** Internal only (port 5432, no external binding to avoid conflicts)

**Container Naming Convention:**
- Development: `lumina-api-dev`, `lumina-agents-dev`, `lumina-postgres-dev`, `lumina-redis-dev`
- Image names: `lumina-api:latest`, `lumina-agents:latest`
- Network: `lumina-network-dev`
- Volumes: `lumina_postgres_data`, `lumina_redis_data`

Rationale: Docker daemon may run multiple projects. Unique naming/ports prevent conflicts and allow parallel development.

**Environment Files (Standard .env workflow):**
```
compliance-system/
├── .env                  ← Base configuration (development defaults)
├── .env.local            ← Local overrides (Git-ignored, for CI/CD secrets)
└── .env.example          ← Template for new developers (root level backup)
```
Why 3 files?
- `.env`: Tracked in Git, shared defaults for all developers
- `.env.local`: Git-ignored, per-developer customizations (API keys, local ports)
- `.env.example`: Root-level template (backup reference for setup)

**Docker Compose Files (Keep both for production safety):**
```
compliance-system/
├── docker-compose.yml           ← Production deployment (no hot-reload, no debug ports)
└── docker-compose.dev.yml       ← Development (hot-reload via ts-node-dev, debug ports, volume mounts)
```
Why 2 files?
- Production safety: Can't accidentally run dev config in production
- Different container configurations: Debug ports (9229, 9230), volume mounts for hot-reload
- Different resource limits and logging levels

**Database Initialization (Feb 26 Notes):**
- PostgreSQL: Alpine image (no pgvector preload) → Use BYTEA columns instead of vector type
- Migration file: `compliance-system/config/sql/init-database.sql`
- pgvector support: Disabled by default (requires special PostgreSQL build)
  - For production: Use `pgvector/pgvector:latest` Docker image
  - Development: Falls back to BYTEA for embeddings

### Build & Development
```bash
npm run bootstrap          # Install all dependencies
npm run dev              # Start API + agents service in watch mode
npm run build            # Compile TypeScript
npm run test             # Run all tests
npm run lint             # ESLint everything

# Docker Development (with hot-reload, debug ports, unique ports)
npm run docker:dev:up    # Start all services (PostgreSQL, Redis, API:4000, Agents:4002)
npm run docker:dev:logs  # View logs in real-time
npm run docker:dev:down  # Stop all services

# Docker Production (use external docker-compose.yml)
docker-compose -f docker-compose.yml up -d  # Start with production config

# NOTE: Blockchain RPC endpoints are CLIENT-PROVIDED in .env
# Ableka Lumina does NOT set up blockchain infrastructure
```

### Service Entry Points (Port Mappings for Development)
- **API Service:** 
  - External: http://localhost:4000 (dev mode)
  - Internal: port 3000 (within container, env: API_PORT=3000)
  - Entry: `src/api/src/index.ts` (Express.js)
  - Debug: localhost:9229 (Node debugger)

- **Agents Service:** 
  - External: http://localhost:4002 (dev mode) 
  - Internal: port 3002 (within container, env: AGENTS_PORT=3002)
  - Entry: `src/agents/src/index.ts` (LangChain.js orchestration)
  - Debug: localhost:9230 (Node debugger)

- **Database:** 
  - PostgreSQL 16 (internal only, no external port for development safety)
  - Connection: `postgresql://postgres:postgres@postgres:5432/compliance_db`
  - Initialized by: `config/sql/init-database.sql`
  - Tables: kyc_checks, aml_checks, compliance_checks, users, audit_logs, decision_vectors

- **Cache:**
  - Redis 7 on port 6380 (external) → 6379 (internal)
  - Connection: `redis://redis:6380` (from outside Docker)
  - Used for: Session caching, decision caching, rate limiting

### Database Migrations & Initialization

**Database Setup Steps (First Time):**
```bash
cd compliance-system
docker-compose -f docker-compose.dev.yml up -d postgres redis
# Wait for postgres to be healthy (check logs)
docker-compose -f docker-compose.dev.yml up api agents  # Will run init script
```

**Database Features (Storage Layer):**
- **pgvector Support (Production Only):**
  - Development: Uses BYTEA columns (store embeddings as binary blobs)
  - Production: Replace with `pgvector/pgvector:latest` image for vector similarity
  - Embeddings can be migrated later without schema changes

- **Tables Created:**
  - `kyc_checks` - KYC verification records
  - `aml_checks` - AML risk assessments
  - `compliance_checks` - Aggregated compliance decisions
  - `compliance_rules` - Jurisdiction-specific rules (loaded from YAML)
  - `users` - Compliance officers & admins
  - `audit_logs` - Compliance audit trail
  - `decision_vectors` - Embeddings for pattern learning (BYTEA in dev, vector in prod)

**Run Migrations:**
```bash
npm run db:migrate       # Apply pending migrations
npm run db:seed          # Seed with sample jurisdiction rules
```

### Environment Configuration

**Development (.env):**
```
# API
API_PORT=3000
API_HOST=localhost

# Database (case-sensitive!)
DATABASE_URL=postgresql://user:password@localhost:5432/compliance_db
DB_POOL_MAX=20

# Blockchain - CLIENT-PROVIDED RPC ENDPOINTS ONLY
# Ableka Lumina does NOT set up blockchain infrastructure
# Client approves and provides these endpoints
BLOCKCHAIN_TYPE=permissioned
BESU_RPC_URL=https://client-validator-1.internal:8545  # CLIENT PROVIDES
BESU_BACKUP_RPC_URL=https://client-validator-2.internal:8545  # CLIENT PROVIDES

# Or PUBLIC blockchain (if client approves)
# BLOCKCHAIN_TYPE=public
# ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/PROJECT_ID  # CLIENT PROJECT/CREDENTIALS
# SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# External APIs
BALLERINE_API_KEY=<your-key>
MARBLE_API_KEY=<your-key>
CHAINALYSIS_API_KEY=<your-key>  # Only queried when client enables public blockchain monitoring
GROK_API_KEY=<your-key>

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Jurisdiction Rules
JURISDICTION_RULES_PATH=./src/config/jurisdictions
```

**Important Note:**
- All blockchain RPC endpoints are **CLIENT-PROVIDED** in their `.env` files
- Ableka Lumina does **NOT** deploy, manage, or provision any blockchain infrastructure
- Clients enable monitoring only for blockchains they already control/use
- No blockchain setup or initialization required for Ableka Lumina operation

**Production:** Use `.env.production` with encrypted secrets (never commit)

### Testing

```bash
# Unit tests (mocked APIs)
npm run test:unit

# Integration tests (real DB, mocked external APIs)
npm run test:integration

# Watch mode (rapid iteration)
npm run test:watch

# Coverage target: 80%+ for agent logic
npm run test:coverage
```

---

## 🎯 UNIT TESTING: CRITICAL PRIORITY

**Unit Testing is a FIRST-CLASS REQUIREMENT** for all compliance code. Do NOT commit code without comprehensive unit test coverage.

### Testing Strategy (Test-Driven Development)

1. **Write Tests FIRST** (before implementing features)
2. **Test-Driven Development Flow:**
   - Write failing test
   - Implement minimum code to pass test
   - Refactor for clarity
   - Commit with tests

### Unit Test Coverage Requirements

**Mandatory (80%+ coverage):**
- ✅ All compliance decision logic (KYC, AML, risk scoring)
- ✅ All API endpoint handlers
- ✅ All data transformations
- ✅ All error handling paths
- ✅ All validation logic
- ✅ All agent orchestration flows

**Critical Business Logic Tests:**
```typescript
// Example: Transfer Compliance Service (MUST test all paths)

describe('TransferComplianceService', () => {
  // 1. Happy path: Approved transfer
  it('should APPROVE low-risk KYC-verified transfer', async () => {
    const input = { from: user1, to: user2, amount: 10000 };
    const result = await service.checkTransferCompliance(input);
    expect(result.status).toBe('APPROVED');
    expect(result.riskScore).toBeLessThan(30);
  });

  // 2. Edge case: Escalated transfer (medium risk)
  it('should ESCALATE medium-risk transfer pending review', async () => {
    const input = { from: user2, to: user3, amount: 500000 }; // Large amount
    const result = await service.checkTransferCompliance(input);
    expect(result.status).toBe('ESCALATED');
    expect(result.riskScore).toBeGreaterThanOrEqual(30);
    expect(result.riskScore).toBeLessThan(70);
  });

  // 3. Rejection case: Sanctions match
  it('should REJECT transfer from sanctioned wallet', async () => {
    const input = { from: sanctionedUser, to: user2, amount: 100000 };
    const result = await service.checkTransferCompliance(input);
    expect(result.status).toBe('REJECTED');
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
    expect(result.reasoning).toContain('Sanctions');
  });

  // 4. Idempotency: Same request twice returns same result
  it('should return cached result for idempotent request', async () => {
    const input = { from: user1, to: user2, amount: 10000 };
    const result1 = await service.checkTransferCompliance(input);
    const result2 = await service.checkTransferCompliance(input);
    expect(result1).toEqual(result2);
    expect(service.getCacheHits()).toBeGreaterThan(0);
  });

  // 5. Parallel processing: Multiple checks run simultaneously
  it('should run KYC, AML, sanctions in parallel', async () => {
    const input = { from: user1, to: user2, amount: 10000 };
    const startTime = Date.now();
    const result = await service.checkTransferCompliance(input);
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(100); // Should complete in <100ms (parallel)
    expect(result).toBeDefined();
  });

  // 6. Error handling: Gracefully handle external API failures
  it('should handle Ballerine API timeout with degradation', async () => {
    // Mock Ballerine to timeout
    mockBallerine.verify.mockRejectedValue(new TimeoutError());
    
    const input = { from: user1, to: user2, amount: 10000 };
    const result = await service.checkTransferCompliance(input);
    
    // Should still return decision based on available data
    expect(result).toBeDefined();
    expect(result.status).toBeTruthy();
    expect(result.reasoning).toContain('KYC unavailable');
  });
});
```

### Test Classification

**Unit Tests (Mocked):**
- Pure function tests (risk calculation, decision logic)
- Service methods (with mocked databases, APIs, external services)
- No I/O, no network calls, <100ms execution
- Run hundreds per test suite

**Integration Tests (Real DB, Mocked APIs):**
- API endpoint tests (with real PostgreSQL, Redis)
- Database transaction tests
- Workflow orchestration tests
- Can take 1-10 seconds per test

**E2E Tests (Optional, full stack):**
- Real external APIs (Ballerine, Marble) - only with test credentials
- Real blockchain interactions (testnet)
- Full user journeys
- Run nightly, not on every commit

### Testing Tools & Frameworks

**Test Framework:**
- **Jest** (Apache 2.0) - Fast, parallel test execution, great TypeScript support
  ```bash
  npm install --save-dev jest @types/jest ts-jest @jest/globals
  npm install --save-dev jest-extended  # Additional matchers
  ```

**Mocking Libraries:**
- **jest.mock()** - Built-in mocking
- **sinon** (BSD) - Advanced mocking/stubbing
- **nock** (MIT) - HTTP mocking
  ```bash
  npm install --save-dev nock
  ```

**Coverage Tools:**
- **nyc** (ISC) - Code coverage reports
  ```bash
  npm install --save-dev nyc
  npm run test:coverage  # Generate HTML coverage report in coverage/
  ```

### Jest Configuration Example

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
};
```

### Package.json Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

### Test File Organization

```
src/
├── services/
│   ├── transferComplianceService.ts
│   └── __tests__/
│       ├── transferComplianceService.test.ts
│       ├── transferComplianceService.integration.test.ts
│       └── fixtures/
│           ├── mockUsers.ts
│           └── mockTransactions.ts
│
├── agents/
│   ├── supervisorAgent.ts
│   └── __tests__/
│       ├── supervisorAgent.test.ts
│       └── fixtures/
│           └── mockTools.ts
│
└── routes/
    ├── complianceRoutes.ts
    └── __tests__/
        └── complianceRoutes.test.ts
```

### Testing Compliance Logic (Real Examples)

**Example 1: Risk Score Calculation**
```typescript
// services/__tests__/riskScoringEngine.test.ts
describe('RiskScoringEngine', () => {
  const engine = new RiskScoringEngine();

  // Test that weights sum to 100%
  it('should have weights that sum to 100', () => {
    const weights = engine.getWeights();
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  // Test specific scenarios
  it('should calculate KYC-verified user as low risk', () => {
    const score = engine.calculateRiskScore({
      kyc_verified: true,
      kyc_risk: 10,
      aml_score: 20,
      sanctions_match: false,
      velocity_normal: true,
      pep_match: false,
    });
    expect(score).toBeLessThan(30); // APPROVED threshold
  });

  // Test failure modes
  it('should calculate maximum risk for unverified + sanctions match', () => {
    const score = engine.calculateRiskScore({
      kyc_verified: false,
      kyc_risk: 100,
      aml_score: 100,
      sanctions_match: true,
      velocity_normal: false,
      pep_match: true,
    });
    expect(score).toBeGreaterThanOrEqual(90);
  });
});
```

**Example 2: API Error Handling**
```typescript
// routes/__tests__/complianceRoutes.test.ts
describe('POST /v1/compliance/transfer-check', () => {
  // Test successful flow
  it('should return APPROVED decision for valid request', async () => {
    const response = await request(app)
      .post('/v1/compliance/transfer-check')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        from_address: validUser.wallet,
        to_address: validUser2.wallet,
        amount: 10000,
        currency: 'USD'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('riskScore');
  });

  // Test input validation
  it('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/v1/compliance/transfer-check')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ from_address: validUser.wallet }); // Missing to_address, amount

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  // Test authentication
  it('should return 401 for missing JWT token', async () => {
    const response = await request(app)
      .post('/v1/compliance/transfer-check')
      .send({
        from_address: validUser.wallet,
        to_address: validUser2.wallet,
        amount: 10000
      });

    expect(response.status).toBe(401);
  });

  // Test external API failure recovery
  it('should handle Ballerine API failure gracefully', async () => {
    // Mock Ballerine to return error
    jest.spyOn(ballerineService, 'verify').mockRejectedValue(
      new Error('Ballerine API timeout')
    );

    const response = await request(app)
      .post('/v1/compliance/transfer-check')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        from_address: validUser.wallet,
        to_address: validUser2.wallet,
        amount: 10000
      });

    expect(response.status).toBe(200); // Should still respond
    expect(response.body.status).toBeTruthy();
  });
});
```

### Continuous Integration (CI) Requirements

**Before Merge to Main:**
```bash
✅ npm run lint        # ESLint check
✅ npm run typecheck   # TypeScript compilation
✅ npm run test:ci     # All tests with coverage
✅ Coverage ≥ 80%      # Enforcement
✅ No type errors      # Strict mode
```

**GitHub Actions Example:**
```yaml
name: CI Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:ci
      - name: Coverage Check
        run: |
          if [ $(cat coverage/coverage-summary.json | jq '.total.lines.pct') -lt 80 ]; then
            echo "Coverage below 80%"
            exit 1
          fi
```

### Unit Testing Compliance Agents

**Critical: Agent Test Must Verify:**
1. ✅ Tool selection (right tools for the job)
2. ✅ Tool orchestration (correct order, parallel vs sequential)
3. ✅ Decision logic (risk scoring unchanged)
4. ✅ Reasoning explanation (LLM output is coherent)
5. ✅ Error resilience (handles tool failures)

```typescript
// agents/__tests__/supervisorAgent.test.ts
describe('SupervisorAgent', () => {
  let agent: SupervisorAgent;
  let mockTools: any;

  beforeEach(() => {
    mockTools = {
      kycTool: {
        call: jest.fn().mockResolvedValue({ status: 'VERIFIED', confidence: 0.98 })
      },
      amlTool: {
        call: jest.fn().mockResolvedValue({ riskScore: 20 })
      },
      sanctionsTool: {
        call: jest.fn().mockResolvedValue({ flags: [] })
      },
      jurisdictionRulesTool: {
        call: jest.fn().mockResolvedValue({ maxTransfer: 1000000 })
      }
    };
    agent = new SupervisorAgent(mockTools);
  });

  // Test 1: All tools called
  it('should call all compliance tools', async () => {
    await agent.runKYCCheck({
      name: 'John Doe',
      jurisdiction: 'AE'
    });

    expect(mockTools.kycTool.call).toHaveBeenCalled();
    expect(mockTools.amlTool.call).toHaveBeenCalled();
    expect(mockTools.sanctionsTool.call).toHaveBeenCalled();
    expect(mockTools.jurisdictionRulesTool.call).toHaveBeenCalled();
  });

  // Test 2: Correct decision made
  it('should APPROVE when all checks pass', async () => {
    const result = await agent.runKYCCheck({
      name: 'John Doe',
      jurisdiction: 'AE'
    });

    expect(result.status).toBe('APPROVED');
    expect(result.riskScore).toBeLessThan(30);
  });

  // Test 3: Tool failure handling
  it('should ESCALATE when KYC tool unavailable', async () => {
    mockTools.kycTool.call.mockRejectedValue(new Error('Service timeout'));

    const result = await agent.runKYCCheck({
      name: 'John Doe',
      jurisdiction: 'AE'
    });

    expect(result.status).toBe('ESCALATED');
    expect(result.reasoning).toContain('KYC unavailable');
  });

  // Test 4: Explainability
  it('should provide human-readable reasoning', async () => {
    const result = await agent.runKYCCheck({
      name: 'John Doe',
      jurisdiction: 'AE'
    });

    expect(result.reasoning).toMatch(/\w+/); // Has text explanation
    expect(result.reasoning.length).toBeGreaterThan(10);
  });
});
```

## Code Patterns & Conventions

### Jurisdiction-Aware Request Handling

**Pattern: Always extract jurisdiction first**
```typescript
// Route handler
router.post('/api/v1/kyc-check', async (req, res) => {
  const jurisdiction = req.body.jurisdiction || extractFromWallet(req.body.wallet);
  
  // Load jurisdiction-specific rules
  const rules = await jurisdictionConfig.load(jurisdiction);
  
  // Route to appropriate agent flow
  const result = await supervisorAgent.runKYCCheck({
    ...req.body,
    jurisdiction,
    rules // Pass rules to agent
  });
  
  res.json(result);
});
```

### Blockchain-Type Aware Monitoring

**Pattern: Define blockchain context upfront**
```typescript
// Enable monitoring endpoint
router.post('/api/v1/monitor/enable', async (req, res) => {
  const { wallet, blockchainType, jurisdiction } = req.body;
  
  // Validate blockchain type
  if (!['permissioned', 'public'].includes(blockchainType)) {
    return res.status(400).json({ error: 'Invalid blockchainType' });
  }
  
  // Load blockchain-specific config
  const blockchainConfig = await config.getBlockchainConfig(blockchainType);
  
  // Start listening with appropriate settings
  const monitoring = await startMonitoring({
    wallet,
    blockchainType,
    jurisdiction,
    rpcEndpoint: blockchainConfig.rpc_endpoints[0],
    costPerTx: blockchainType === 'permissioned' ? 0.01 : 0.50
  });
  
  res.json(monitoring);
});
```

### Error Handling & Logging

**Standard Response Format:**
```json
{
  "error": "KYCVerificationFailed",
  "message": "Entity failed sanctions screening",
  "code": 403,
  "riskScore": 87,
  "reasoning": "Chainalysis flagged wallet as high-risk",
  "timestamp": "2026-02-26T10:00:00Z"
}
```

**Never expose:**
- Full API keys in logs
- Internal stack traces (return generic error in production)
- Raw LLM reasoning if contains sensitive data
- Unredacted wallet addresses in non-compliance logs

### Security & JWT

**Authentication Middleware:**
```typescript
// All compliance endpoints require JWT
app.use('/api/v1', requireAuth, requirePermission('compliance:READ'));

// Tokens: 15-minute expiration, refresh via /auth/refresh-token
// Implement token blacklist in Redis on logout
```

**RBAC Roles:**
- `admin` - Full platform access
- `compliance_officer` - View/approve/reject compliance decisions
- `analyst` - Read-only access to decisions
- `client` - Submit entities for checking, view own results only

### Database Query Pattern (SqlQueryLoader)

**Load SQL from files, never concatenate:**
```typescript
// services/kycService.ts
import SqlQueryLoader from '../services/sqlQueryLoader';

const query = SqlQueryLoader.load('kyc/get-kyc-record.sql');
const result = await db.query(query, [address]); // Parameterized only!

// File: src/sql/kyc/get-kyc-record.sql
/*
SELECT id, wallet_address, status, risk_score, created_at
FROM kyc_records
WHERE wallet_address = $1  -- Use $1, $2, etc for params
*/
```

**Why:** Prevents SQL injection, keeps queries debatable/reviewable, easy to optimize later

### LangChain Agent Pattern

**ReAct Loop Structure:**
```typescript
// agents/supervisorAgent.ts
import { ReActAgent } from 'langchain/agents';

export class SupervisorAgent {
  private agent: ReActAgent;
  
  constructor(private llm: Grok41LLM, private tools: Tool[]) {
    // Initialize ReAct agent with Grok LLM + tool registry
    this.agent = new ReActAgent({
      llm: this.llm,
      tools: this.tools,
      maxIterations: 10,
      verbose: true // Set false in production
    });
  }
  
  async runKYCCheck(input: KYCCheckInput): Promise<KYCCheckResult> {
    const result = await this.agent.call({
      input: `
        Perform KYC check for entity: ${input.name}
        Jurisdiction: ${input.jurisdiction}
        Jurisdiction Rules: ${JSON.stringify(input.rules)}
        
        Use tools to:
        1. Verify identity via KYC provider
        2. Screen against sanctions lists
        3. Apply jurisdiction-specific rules
        4. Calculate final risk score
        
        Provide reasoning for every decision.
      `
    });
    
    return parseAgentOutput(result);
  }
}

// Tool Registry (provide to agent)
[
  new KYCTool(ballerineService),
  new AMLTool(marbleService),
  new ChainalysisTool(chainalysisService),
  new JurisdictionRulesTool(jurisdictionConfig),
  new BlockchainTool(ethersProvider)
]
```

### Vector Database Pattern (PGVector for Pattern Learning)

**Store decisions as embeddings for anomaly detection:**
```typescript
// After agent makes a decision, store it
const embedding = await generateEmbedding({
  wallet: decision.wallet,
  riskScore: decision.riskScore,
  flags: decision.flags,
  timestamp: new Date()
});

await pgVectorDb.insertDecisionVector(embedding);

// Later: Use for anomaly detection
const similarCases = await pgVectorDb.findNearestNeighbors(
  currentDecision, 
  k: 10
);

if (currentDecision.riskScore >> average(similarCases.riskScores)) {
  console.warn('Anomalous case detected');
}
```

## Blockchain Integration Policy

### Critical Principle: No Infrastructure Setup

**Ableka Lumina does NOT:**
- Set up, deploy, or manage blockchain nodes/validators
- Create blockchain infrastructure of any kind
- Manage blockchain accounts, wallets, or private keys
- Host blockchain data or services
- Initialize any blockchain networks

**Ableka Lumina DOES (when client explicitly approves):**
- Monitor transactions on client-provided blockchain networks
- Query blockchain data via client-provided RPC endpoints
- Perform compliance checks on blockchain transactions
- Store compliance decisions in PostgreSQL + PGVector
- Return monitoring alerts to client systems

### Client Approval Requirement

All blockchain monitoring MUST be:
1. **Explicitly requested** by the client
2. **Approved in writing** (compliance/legal review)
3. **Client-provided** (RPC endpoints, credentials, network access)
4. **Non-mandatory** for core compliance checking (API-only operation possible)

```
User Request: "Monitor my blockchain transactions"
  ↓
Ableka Lumina: "Please provide:"
  1. Blockchain type (permissioned/public)
  2. RPC endpoint URLs (must be client-provided)
  3. Approved wallet addresses to monitor
  4. Compliance rules per jurisdiction
  ↓
No deployment, setup, or infrastructure provisioning happens
```

### Implementation Constraint

In any code changes or features:
- **Never assume** a blockchain is available or configured
- **Always request** blockchain details from configuration/environment
- **Gracefully degrade** if blockchain monitoring is not enabled
- **Never provision** blockchain infrastructure as part of application startup
- **Only interact** with blockchains when explicitly configured by client

---

## Integration Points & Data Flows

### Flow 1: Initial KYC Check (Synchronous)

```
Client: POST /api/v1/kyc-check
  {
    "wallet": "0x1234567890abcdef",
    "name": "Ahmed Al Maktoum",
    "jurisdiction": "AE",
    "entityType": "individual"
  }
  ↓
API Gateway (JWT validation, rate limiting)
  ↓
SupervisorAgent receives check request
  ├─ Tool 1: KYCTool.call({ name, jurisdiction })
  │   → Ballerine API → Returns { status: VERIFIED, confidence: 0.98 }
  │
  ├─ Tool 2: AMLTool.call({ wallet, jurisdiction })
  │   → Marble AI + Chainalysis → Returns { riskScore: 18 }
  │
  ├─ Tool 3: JurisdictionRulesTool.call({ jurisdiction })
  │   → Load ae-dubai.yaml → Returns rules object
  │
  ├─ Thought: Combine results + apply jurisdiction rules
  │
  └─ Decision: APPROVED, riskScore 18, confidence 92%
  ↓
Store Decision in PostgreSQL + PGVector
  ↓
Return: { status: APPROVED, riskScore: 18, confidence: 0.92, reasoning: "..." }
  ↓
Client receives response (~2 seconds)
```

### Flow 2: Enable Real-Time Monitoring

```
Client: POST /api/v1/monitor/enable
  {
    "wallet": "0x1234567890abcdef",
    "blockchainType": "permissioned",
    "alertLevel": "high",
    "cacheMinutes": 1440
  }
  ↓
Start ethers.js Listener (blockchainType-specific RPC)
  ├─ Permissioned: Connect to private Besu nodes
  ├─ Public: Connect to public RPC (Infura/Alchemy)
  └─ Listen for: Transfer, Approval, Mint, Burn events
  ↓
Initialize ML Pattern Baselines
  ├─ Store in Redis for fast lookups
  └─ Store in PGVector for learning
  ↓
Register WebSocket connection at /stream/monitoring/{wallet}
  ↓
Return: { status: "monitoring_enabled", listeningOn: [...], connectedAt: "..." }
```

### Flow 3: Real-Time Alert Generation (<1 second)

```
Blockchain: Detected TX from monitored wallet
  { from: 0x1234..., to: 0xXYZ, amount: 100 ETH, hash: 0xabc... }
  ↓
ethers.js Listener → Ableka Lumina ingests TX
  ↓
SupervisorAgent analyzes in parallel:
  ├─ ML Pattern Engine: 200x baseline = ANOMALOUS (87/100)
  ├─ LLM Reasoning: "Why is this suspicious?"
  │   → Queries Chainalysis (if public) or internal DB (if permissioned)
  │   → Risk Score: 85/100
  │
  ├─ Jurisdiction Rules: Apply ae-dubai.yaml
  │   → Rule: IF flagged_counterparty AND amount_anomalous → ESCALATE
  │
  └─ Decision: ESCALATE, riskScore 85
  ↓
Create Alert: { riskScore: 85, action: "PAUSE_MINTING", reason: "..." }
  ↓
Send Alert:
  ├─ WebSocket: /stream/monitoring/{wallet} (real-time)
  ├─ Email: compliance@yourpe.ae
  └─ SMS: +971-xx-xxxx
  ↓
Client receives alert + auto-pauses minting
  ↓
Total latency: <1 second (Permissioned) or <1 second (Public + Chainalysis)
```

## Testing Conventions

**Unit Tests (mocked agents/tools):**
```typescript
// agents/__tests__/supervisorAgent.test.ts
describe('SupervisorAgent', () => {
  it('should approve lowrisk KYC', async () => {
    const mockKYCTool = { call: jest.fn().mockResolvedValue({ status: 'VERIFIED' }) };
    const mockAMLTool = { call: jest.fn().mockResolvedValue({ riskScore: 15 }) };
    
    const agent = new SupervisorAgent(mockKYC, mockAML);
    const result = await agent.runKYCCheck({
      name: 'John',
      jurisdiction: 'AE',
      rules: mockRules
    });
    
    expect(result.status).toBe('APPROVED');
    expect(result.riskScore).toBeLessThan(30);
  });
});
```

**Integration Tests:**
```typescript
// api/__tests__/kyc.integration.test.ts
describe('POST /api/v1/kyc-check', () => {
  it('should submit KYC and return decision', async () => {
    const response = await request(app)
      .post('/api/v1/kyc-check')
      .set('Authorization', 'Bearer ' + testToken)
      .send({
        wallet: '0x...',
        name: 'Ahmed',
        jurisdiction: 'AE'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('riskScore');
    expect(response.body).toHaveProperty('reasoning');
  });
});
```

## File Organization Rules

- **Keep agent implementations under 400 lines:** Split tool orchestration into focused agents
- **Database queries in repositories + SqlQueryLoader:** No raw SQL in service files
- **Jurisdiction configs in YAML:** One file per jurisdiction (ae-dubai.yaml, in-sebi.yaml, etc)
- **Tool implementations modular:** Each tool in its own file under `src/agents/src/tools/`
- **Test alongside code:** `KYCService.ts` → `__tests__/KYCService.test.ts`
- **Environment vars in `config/`:** Centralize all dotenv usage

```
src/
├── api/
│   ├── src/
│   │   ├── index.ts               # Express app startup
│   │   ├── routes/                # API endpoints
│   │   ├── middleware/            # Auth, validation, error handling
│   │   ├── db/                    # Database connection
│   │   ├── migrations/            # SQL migrations
│   │   └── __tests__/
│   └── package.json
│
├── agents/
│   ├── src/
│   │   ├── index.ts               # Agent initialization
│   │   ├── agents/                # ReAct agents (supervisorAgent.ts, etc)
│   │   ├── tools/                 # Tool implementations (KYCTool, AMLTool, etc)
│   │   ├── config/
│   │   │   └── jurisdictions/     # YAML configs (ae-dubai.yaml, us-reg-d.yaml)
│   │   ├── services/              # Support services (pattern learning, etc)
│   │   └── __tests__/
│   └── package.json
│
└── config/
    ├── jurisdictions/             # Jurisdiction YAML files
    └── blockchain/                # Blockchain network configs
```

## Gotchas & Non-Obvious Patterns

1. **NO Blockchain Setup:** Ableka Lumina never sets up, deploys, or initializes blockchain infrastructure. All blockchain RPC endpoints must be client-provided and pre-approved.
2. **Jurisdiction Routes:** Always extract jurisdiction first; never hardcode rules in code
3. **Blockchain Type Checking:** Validate `blockchainType` ('permissioned' or 'public') at every entry point; also verify client approval
4. **Cost Differences:** Permissioned = $0.01/TX, Public = $0.50-1.00/TX; warn clients on public deploys
5. **LLM Output Parsing:** Grok may hallucinate; always validate LLM reasoning against tool results
6. **Rate Limiting:** Public blockchain clients need higher limits (TX monitoring = high volume)
7. **Redis Cache TTL:** Decisions cached for 24h; invalidate on rule updates via `/admin/invalidate-cache`
8. **PGVector Embeddings:** Store decision vectors for pattern learning; monthly pruning of old vectors
9. **Token Refresh:** JWT expiry 15 min; frontend must call `/auth/refresh-token` before timeout
10. **Chainalysis Costs:** Only query on public deployments; permissioned uses internal counterparty DB
11. **WebSocket Connections:** Persistent `/stream/monitoring` connections; implement heartbeat (30s) to detect stale clients
12. **Client Approval Database:** Maintain table of approved blockchain monitoring per wallet/client for audit trail
13. **Graceful Degradation:** Core API (KYC/AML) works without blockchain. Blockchain monitoring is optional enhancement

## Implementation Guidelines

### Before Coding Any Feature:

1. **Audit Existing Implementation** — Review:
   - Existing agent implementations (supervisorAgent.ts patterns)
   - Tool integrations (how KYCTool wraps Ballerine)
   - Jurisdiction rules YAML (what's already configured)
   - Blockchain integration (what RPC patterns are used)
   - Database schema (what tables exist, column names)

2. **Verify Prerequisites** — Confirm:
   - Development environment functional (docker-compose up works)
   - Database credentials valid
   - Jurisdiction-specific rules documented
   - Blockchain type (permissioned or public) clearly specified

3. **Study Codebase** — Read:
   - MASTER_IMPLEMENTATION_PLAN.md (overall project scope)
   - AbekeLumina_Option_B_Architecture.md (blockchain + AI architecture)
   - Multi-Jurisdiction Implementation Guide (rules engine patterns)
   - PE Tokenization Quick Start (domain-specific guidance if PE focus)

### Patterns, Config, and Constants

**Configuration Management:**
- Always use environment variables; never hardcode URLs, API keys, or blockchain endpoints
- Jurisdiction-specific config lives in `src/config/jurisdictions/{code}.yaml`
- Blockchain-specific config lives in `src/config/blockchain/{type}.yaml`
- Follow existing naming: camelCase for code, snake_case for YAML/database

**Jurisdiction Config Example (ae-dubai.yaml):**
```yaml
jurisdiction:
  code: AE
  name: "United Arab Emirates - Dubai"
  
kyc:
  providers: [ballerine]
  docRequirements: [PASSPORT, PROOF_OF_ADDRESS, UAE_ID_COPY]
  
aml:
  sanctionsList: [OFAC_SDN, UN_SECURITY_COUNCIL, DFSA_PERSONS_LIST]
  
governance:
  majorChangesRequireVote: true
  votingThreshold: 66
```

**Blockchain Config Example (permissioned.yaml):**
```yaml
blockchainType: permissioned
network:
  name: hyperledger-besu
  rpc_endpoints:
    - "https://validator-1.internal:8545"
    - "https://validator-2.internal:8545"
  chainId: 1337
```

### Blockchain Type Handling

**Pattern: Validate blockchain type AND client approval**
```typescript
const validateBlockchainMonitoring = async (req: Request) => {
  const { wallet, blockchainType } = req.body;
  
  // Only proceed if client explicitly enabled monitoring
  const isMonitoringEnabled = await db.query(
    'SELECT * FROM client_approved_monitoring WHERE wallet = $1',
    [wallet]
  );
  
  if (!isMonitoringEnabled) {
    throw new Error('Blockchain monitoring not approved for this wallet');
  }
  
  // Validate blockchain type
  if (!['permissioned', 'public'].includes(blockchainType)) {
    throw new Error(`Invalid blockchainType: ${blockchainType}`);
  }
  
  // Load client-provided RPC endpoint (from .env or database)
  const config = await getBlockchainConfig(blockchainType);
  if (!config.rpc_endpoint) {
    throw new Error(`No RPC endpoint configured for ${blockchainType} blockchain`);
  }
  
  return config;
};

// Usage:
const blockchainConfig = await validateBlockchainMonitoring(req);
const monitoring = await startMonitoring(blockchainConfig);
```

This ensures:
- ✅ Client approval is checked before ANY blockchain interaction
- ✅ No infrastructure is set up (only configuration used)
- ✅ Blockchain monitoring is optional (core API works without it)
- ✅ Client can enable/disable monitoring anytime

---

## 🚀 CRITICAL CHECKLIST: Before Implementing Any Feature

### Step 1: Architecture Review
- [ ] Read relevant section in `Planning docs/System Architecture/AbekeLumina_RWA_Enterprise_Implementation.md`
- [ ] Review system diagram in `AbekeLumina_Enterprise_Architecture_Diagram.md`
- [ ] Check open source tech stack in `AbekeLumina_Open_Source_Tech_Stack.md`
- [ ] Verify deployment approach in `AbekeLumina_Deployment_Operations.md`
- [ ] Understand data model from ERD (12 tables, relationships, indices)
- [ ] Confirm API endpoint specification and latency SLOs
- [ ] Verify jurisdiction-specific compliance rules apply

### Step 2: Unit Testing Plan
- [ ] Design unit tests BEFORE writing code
- [ ] Plan test cases for:
  - Happy path (everything succeeds)
  - Edge cases (boundary conditions)
  - Error cases (failures, timeouts, missing data)
  - Idempotency (same request = same result)
  - Parallel processing (concurrent executions)
  - Graceful degradation (external API failures)
- [ ] Target 80%+ code coverage minimum
- [ ] Use Jest + mocking for isolated tests
- [ ] Create test fixtures in `__tests__/fixtures/`

### Step 3: Implementation with TDD
1. **Write failing test** (red)
   ```bash
   npm run test:watch  # Watch for changes
   ```
   - Test should be specific and testable
   - Mock all external dependencies
   - Include assertions for all logic paths

2. **Implement minimum code to pass** (green)
   - Write just enough code to make test pass
   - Don't optimize prematurely
   - Focus on correctness first

3. **Refactor for clarity** (blue)
   - Improve code readability
   - Remove duplication
   - Optimize performance if needed
   - Re-run tests to ensure no breakage

4. **Commit with tests**
   ```bash
   git commit -m "feature: implement X with comprehensive unit tests"
   ```
   - Always commit tests alongside code
   - Never commit code without tests

### Step 4: Before Merge to Main
```bash
✅ npm run lint              # ESLint check
✅ npm run typecheck        # TypeScript strict mode
✅ npm run test:ci          # All tests + coverage
✅ Coverage ≥ 80%           # Explicit check
✅ No type errors           # Zero tolerance
✅ Architecture alignment   # Reviewed by architect
```

---

## 📋 Reference Architecture Documents

When implementing features, always reference the appropriate architecture document:

| Feature Type | Primary Reference | Secondary References |
|---|---|---|
| **KYC/AML Logic** | RWA Enterprise Implementation (Identity & Access Layer) | Open Source Tech Stack (KYC integration), SEBI checklist |
| **Transfer Compliance** | RWA Enterprise Implementation (Compliance Engine) + API Specs | Architecture Diagram (Compliance layer), Option B (Real-time) |
| **Blockchain Integration** | Option B Architecture (Real-time monitoring) | RWA Implementation (Blockchain Integration), Open Source (blockchain-agnostic) |
| **Database Schema** | RWA Enterprise Implementation (ERD + DDL) | Deployment Operations (migration strategy) |
| **API Endpoints** | RWA Enterprise Implementation (API Specifications) | Enterprise Architecture Diagram (API Gateway) |
| **Deployment** | Deployment Operations guide | CDK code in RWA Implementation |
| **Global Support** | Open Source Tech Stack (Global platform) | RWA Implementation (Data residency) |
| **Compliance** | SEBI Checklist in RWA Implementation | MASTER_IMPLEMENTATION_PLAN (roadmap) |

---

## 🎓 Learning Path for New Developers

1. **Week 1: Foundation**
   - Read: `Planning docs/System Architecture/architecture-overview.md`
   - Read: `Planning docs/System Architecture/ComplianceShield_Enterprise_Architecture_Diagram.md`
   - Understanding: System layers, component relationships, data flows

2. **Week 2: Technical Depth**
   - Read: `Planning docs/System Architecture/AbekeLumina_RWA_Enterprise_Implementation.md`
   - Focus: Database schema, API specifications, integration flows
   - Task: Map existing code to architecture components

3. **Week 3: Technology Stack**
   - Read: `Planning docs/System Architecture/AbekeLumina_Open_Source_Tech_Stack.md`
   - Understanding: Open source components, global platform features, deployment options

4. **Week 4: Advanced Patterns**
   - Read: `Planning docs/System Architecture/AbekeLumina_Option_B_Architecture.md`
   - Understanding: Real-time monitoring, AI/ML patterns, LangChain agent orchestration

5. **Week 5+: Implementation**
   - Start with small features
   - Follow TDD pattern (test first)
   - Reference architecture docs continuously
   - Maintain 80%+ test coverage

---

## ⚡ Quick Reference: Architecture vs Code

When you need to implement something:

**1. What to build?**
→ Check: `AbekeLumina_RWA_Enterprise_Implementation.md` (ERD section)

**2. How does it fit in the system?**
→ Check: `AbekeLumina_Enterprise_Architecture_Diagram.md` (10 layers)

**3. What are the API specs?**
→ Check: `AbekeLumina_RWA_Enterprise_Implementation.md` (API Specifications section)

**4. How to test it?**
→ Check: This document (Unit Testing section)

**5. How to deploy it?**
→ Check: `Planning docs/Deployment_Operations.md` (Kubernetes/AWS CDK)

**6. What tech should I use?**
→ Check: `AbekeLumina_Open_Source_Tech_Stack.md` (approved libraries)

**7. What about global/compliance?**
→ Check: `AbekeLumina_Open_Source_Tech_Stack.md` (global platform & SEBI checklist in RWA Implementation)

---

## Summary: Architecture + Testing = Quality

```
Every Feature Implementation = Architecture Understanding + TDD + CI/CD

Architecture Documentation
  ↓
Understand system design requirements
  ↓
Write failing unit tests
  ↓
Implement with green tests
  ↓
Refactor for clarity
  ↓
Achieve 80%+ coverage
  ↓
Pass CI/CD (lint, typecheck, tests)
  ↓
Merge to main with confidence
```

**Golden Rule:** Never implement features without:
1. ✅ Reading relevant architecture documentation
2. ✅ Writing unit tests first (TDD)
3. ✅ Achieving 80%+ code coverage
4. ✅ Passing all CI/CD checks
5. ✅ Getting architecture review approval

---

**Last Updated**: February 26, 2026  
**Document Version**: 3.0  
**Architecture Docs Location**: `Planning docs/System Architecture/`  
**Unit Testing Priority**: MANDATORY (80%+ coverage, test-first development)  
**SonarQube Guide**: See `.github/SONARQUBE_GUIDE.md` for comprehensive troubleshooting

### Database and SQL Queries

**SqlQueryLoader Pattern (prevents SQL injection):**
```typescript
// src/services/sqlQueryLoader.ts
import fs from 'fs';
import path from 'path';

export class SqlQueryLoader {
  static load(relativePath: string): string {
    const resolvedPath = path.resolve(__dirname, '../sql', relativePath);
    // Security: Ensure path stays within sql/ directory
    if (!resolvedPath.startsWith(path.resolve(__dirname, '../sql'))) {
      throw new Error(`Invalid SQL path: ${relativePath}`);
    }
    return fs.readFileSync(resolvedPath, 'utf-8').trim();
  }
}

// Usage in repository:
const query = SqlQueryLoader.load('kyc/get-approvals-by-wallet.sql');
const result = await db.query(query, [walletAddress]); // Parameterized
```

**SQL File Example (src/sql/kyc/get-approvals-by-wallet.sql):**
```sql
-- Get all KYC approvals for a wallet across all jurisdictions
SELECT 
  id, 
  wallet_address, 
  jurisdiction_code, 
  status, 
  risk_score, 
  approved_at
FROM kyc_records
WHERE wallet_address = $1  -- Use $1, $2 for parameters
  AND status = 'APPROVED'
ORDER BY approved_at DESC
```

### Auth, JWT, and RBAC

**Authentication Required on All Compliance Endpoints:**
```typescript
// routes/kycRoutes.ts
import { requireAuth, requirePermission } from '../middleware/auth';

const router = express.Router();

// JWT validation required
router.post('/check', 
  requireAuth,
  requirePermission('compliance:WRITE'),
  asyncHandler(async (req, res) => {
    // Handler
  })
);

// Public (no auth required)
router.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});
```

**RBAC Middleware Pattern:**
```typescript
// middleware/rbac.ts
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.user.roles; // From JWT payload
    const allowed = userRoles.some(role => 
      ROLE_PERMISSIONS[role]?.includes(permission)
    );
    
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

### LangChain Agent Implementation

**ReAct Agent Pattern (supervisor coordinates tools):**
```typescript
// agents/supervisorAgent.ts
import { Grok41LLM } from 'langchain/llms/grok';
import { ReActAgent } from 'langchain/agents';

export class SupervisorAgent {
  private agent: ReActAgent;
  
  constructor(
    private tools: {
      kycTool: KYCTool,
      amlTool: AMLTool,
      chainalysisTool: ChainalysisTool,
      jurisdictionRulesTool: JurisdictionRulesTool,
      blockchainTool: BlockchainTool
    }
  ) {
    const llm = new Grok41LLM({ apiKey: process.env.GROK_API_KEY });
    
    this.agent = new ReActAgent({
      llm,
      tools: Object.values(this.tools),
      maxIterations: 15,
      returnIntermediateSteps: true,
      verbose: process.env.NODE_ENV === 'development'
    });
  }
  
  async runKYCCheck(input: any): Promise<KYCCheckResult> {
    const result = await this.agent.call({
      input: `
        Perform KYC check: ${JSON.stringify(input)}
        
        Steps:
        1. Verify identity using KYC tool
        2. Score AML risk using AML tool
        3. Load jurisdiction rules
        4. Check blockchain status if needed
        5. Calculate final risk score and decision
        
        Be thorough and explain your reasoning.
      `
    });
    
    return this.parseAgentResponse(result);
  }
  
  private parseAgentResponse(agentOutput: any): KYCCheckResult {
    // Parse LLM output, handle hallucinations
    return {
      status: agentOutput.status,
      riskScore: agentOutput.riskScore,
      reasoning: agentOutput.reasoning,
      timestamp: new Date()
    };
  }
}
```

### Monitoring & Logging

**Never Log Sensitive Data:**
```typescript
// config/logger.ts
export const logSanitizer = (data: any): any => {
  const sensitiveKeys = [
    'apiKey', 'apiSecret', 'password', 'token',
    'walletAddress', 'privateKey', 'mnemonic',
    'creditCard', 'ssn'
  ];
  
  const sanitized = JSON.parse(JSON.stringify(data));
  sensitiveKeys.forEach(key => {
    if (sanitized[key]) sanitized[key] = '[REDACTED]';
  });
  return sanitized;
};

// Usage:
logger.info('KYC check', logSanitizer(input));
```

**Standard Logging Pattern:**
```typescript
// Log at key decision points
logger.info('KYC check initiated', { 
  wallet: req.body.wallet, 
  jurisdiction: req.body.jurisdiction 
});

logger.warn('High-risk entity detected', { 
  wallet, 
  riskScore: 85,
  reason: 'Sanctions match'
});

logger.error('Chainalysis API failed', {
  error: error.message,
  wallet,
  timestamp: new Date()
});
```
  error: error.message,
  wallet,
  timestamp: new Date()
});
```

## SonarQube Integration & Code Quality

**Comprehensive Guide:** See .github/SONARQUBE_GUIDE.md

### Critical Issues & Automatic Fixes

**Issue 1: Authentication Error**
- Error: "Not authorized"
- Fix: Add to sonar-project.properties: sonar.token=YOUR_TOKEN
- Get token: http://localhost:9000/admin/credentials

**Issue 2: Language Pattern Conflict**
- Error: "Language cannot be decided for file"
- Fix: Add SEPARATE patterns to sonar-project.properties:
  - sonar.lang.patterns.ts=**/*.ts,**/*.tsx
  - sonar.lang.patterns.js=**/*.js,**/*.jsx,**/*.mjs

**Issue 3: Deprecated Credentials**
- Warning: "sonar.login and sonar.password are deprecated"
- Fix: Use sonar.token instead

**Issue 4: TypeScript verbatimModuleSyntax Errors**
- Error: "ECMAScript imports cannot be written in CommonJS"
- Fix: Set "verbatimModuleSyntax": false in tsconfig.json

### SonarQube Configuration Template

Create sonar-project.properties in compliance-system root:

sonar.projectKey=ablk-compliance-system
sonar.projectName=Ableka Lumina - Compliance System
sonar.host.url=http://localhost:9000
sonar.token=YOUR_TOKEN_HERE
sonar.sources=src
sonar.tests=src
sonar.lang.patterns.ts=**/*.ts,**/*.tsx
sonar.lang.patterns.js=**/*.js,**/*.jsx,**/*.mjs
sonar.test.inclusions=**/__tests__/**/*.test.ts,**/*.spec.ts
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**

### Running Analysis

From compliance-system root:
- npm run sonar (tests + coverage + analysis)
- npx sonarqube-scanner (direct)

View: http://localhost:9000/projects/ablk-compliance-system

### Copilot Automatic Checklist

Before running SonarQube:
- SonarQube server running (localhost:9000)
- sonar-project.properties exists in root
- sonar.token set and valid
- sonar.lang.patterns.ts and js separated
- tsconfig.json has verbatimModuleSyntax: false
- Coverage report: coverage/lcov-report/ exists

### Full Documentation

For detailed troubleshooting, decision trees, and GitHub Actions integration:
See .github/SONARQUBE_GUIDE.md

``
