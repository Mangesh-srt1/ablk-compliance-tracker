# ComplianceShield - AI Compliance Engine Instructions

## Project Overview

A 100% **AI-driven RegTech SaaS platform** using LangChain.js agents for automated KYC/AML/fraud detection across blockchains and jurisdictions. Designed for PE tokenization, real estate RWA compliance, and multi-chain regulatory enforcement.

**Architecture:** Node.js + LangChain.js with:
- **Frontend:** React.js dashboard (Vite, TypeScript, Recharts, Tailwind CSS)
- **Backend:** Express.js API + LangChain.js agents (TypeScript, PostgreSQL + PGVector, Redis)
- **AI Engine:** Grok 4.1 LLM reasoning loop with multi-tool orchestration
- **Blockchains:** Hyperledger Besu (permissioned - default) + Ethereum/Solana (public - optional)
- **Compliance:** Multi-jurisdiction rules engine (YAML-based), jurisdiction-specific flow routing
- **Integrations:** Ballerine (KYC), Marble (AML), Chainalysis (blockchain sanctions), The Graph (subgraph queries)

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

**IMPORTANT:** ComplianceShield does NOT set up, deploy, or manage blockchain infrastructure. It only **monitors and interacts** with existing blockchains that clients provide and approve for monitoring.

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

// ComplianceShield: Monitors only, does NOT manage validators
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

// ComplianceShield: Read-only monitoring of transactions
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

### Build & Development
```bash
npm run bootstrap          # Install all dependencies
npm run dev              # Start API + agents service in watch mode
npm run build            # Compile TypeScript
npm run test             # Run all tests
npm run lint             # ESLint everything
docker-compose up        # Docker: start DB, Redis, API, agents service
docker-compose logs -f   # View logs

# NOTE: Blockchain RPC endpoints are CLIENT-PROVIDED in .env
# ComplianceShield does NOT set up blockchain infrastructure
```

### Service Entry Points
- **API Service:** `src/api/src/index.ts` (Express, port 3000)
- **Agents Service:** `src/agents/src/index.ts` (LangChain orchestration, no port)
- **Database:** PostgreSQL + PGVector (setup via migration)

### Database Migrations

```bash
cd src/api
npm run migrate          # Run SQL migrations (Knex-style)
npm run migrate:latest   # Run all pending migrations

# Connection: postgresql://user:password@localhost:5432/compliance_db
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
# ComplianceShield does NOT set up blockchain infrastructure
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
- ComplianceShield does **NOT** deploy, manage, or provision any blockchain infrastructure
- Clients enable monitoring only for blockchains they already control/use
- No blockchain setup or initialization required for ComplianceShield operation

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

**ComplianceShield does NOT:**
- Set up, deploy, or manage blockchain nodes/validators
- Create blockchain infrastructure of any kind
- Manage blockchain accounts, wallets, or private keys
- Host blockchain data or services
- Initialize any blockchain networks

**ComplianceShield DOES (when client explicitly approves):**
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
ComplianceShield: "Please provide:"
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
ethers.js Listener → ComplianceShield ingests TX
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

1. **NO Blockchain Setup:** ComplianceShield never sets up, deploys, or initializes blockchain infrastructure. All blockchain RPC endpoints must be client-provided and pre-approved.
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
   - ComplianceShield_Option_B_Architecture.md (blockchain + AI architecture)
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
