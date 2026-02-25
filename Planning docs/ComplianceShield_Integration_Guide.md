# ComplianceShield Integration Guide

**Date**: February 26, 2026  
**Version**: 1.1  
**Target**: AI Compliance System (Phase 3)  
**Blockchain Support**: Both Public (Ethereum/Solana) & Permissioned (Hyperledger Besu)

---

## Blockchain Selection & Setup

### Choose Your Path

**Path A: Permissioned Blockchain (Hyperledger Besu) - RECOMMENDED for PE Funds**
```
Best for: Institutional PE funds, known LPs only, governance control required
Cost: $0.01-0.05 per TX, <300ms monitoring latency
Setup: Connect to private Besu nodes (your validators)
See: Section 1.1A below
```

**Path B: Public Blockchain (Ethereum/Solana)**
```
Best for: Retail-accessible assets, DEX trading, permissionless
Cost: $50-500+ per TX (variable gas), <1 sec monitoring latency
Setup: Connect to public RPC endpoints (Infura, Alchemy)
See: Section 1.1B below
```

---

## Overview

This guide provides step-by-step instructions for integrating the ComplianceShield RWA module into your existing AI Compliance System. ComplianceShield consists of three core components:

1. **Oracle Verified Ownership Guard** - Prevents double-dipping through real-time off-chain asset verification
2. **AML Anomaly Detector** - Detects hawala, money laundering, and illicit P2P patterns
3. **Compliance Gateway** - Enforces KYC and AML checks on all token-to-fiat conversions

---

## Part 1: Prerequisites & Setup

### 1.1A System Requirements (PERMISSIONED - BESU PATH)

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14+ with pgvector extension (`CREATE EXTENSION vector;`)
- **Hyperledger Besu**: v24.1+ (your private network nodes)
- **Validator Nodes**: 2-4 Besu validators (in your control)
- **AWS**: ECS/Fargate for microservice deployment (optional for local dev)
- **External APIs**:
  - Ballerine API (KYC verification for LPs)
  - Internal counterparty database (no Chainalysis per-TX needed)
  - Quarterly regulatory data feeds (OFAC updates)

**Environment Variables for Permissioned Network**:
```bash
# Hyperledger Besu (Private Network)
BESU_RPC_URL=https://your-besu-validator-1.internal:8545
BESU_BACKUP_RPC_URL=https://your-besu-validator-2.internal:8545
BLOCKCHAIN_TYPE=permissioned
BLOCKCHAIN_NETWORK=hyperledger-besu

# Internal Counterparty DB (instead of Chainalysis)
INTERNAL_COUNTERPARTY_DB_URL=postgresql://user:password@localhost:5432/counterparties
REGULATORY_DATA_UPDATE_FREQUENCY=quarterly

# Reduced API calls
CHAINALYSIS_ENABLED=false
CHAINALYSIS_API_KEY=<optional-for-quarterly-updates-only>
```

### 1.1B System Requirements (PUBLIC - ETHEREUM/SOLANA PATH)

- **Node.js**: 18.x or higher
- **PostgreSQL**: 14+ with pgvector extension (`CREATE EXTENSION vector;`)
- **Blockchain RPC**: Public RPC providers (Infura, Alchemy, or self-hosted)
- **AWS**: ECS/Fargate for microservice deployment (optional for local dev)
- **External APIs**:
  - Chainlink Proof of Reserve feeds (optional but recommended)
  - Chainalysis AML screening API (required for every TX)
  - Ballerine API (existing integration)
  - Land registry APIs (jurisdiction-specific)

**Environment Variables for Public Blockchain**:
```bash
# Public Blockchain (Ethereum or Solana)
BLOCKCHAIN_TYPE=public
BLOCKCHAIN_NETWORK=ethereum
# or: BLOCKCHAIN_NETWORK=solana

# Ethereum RPC (example: Infura)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/<PROJECT_ID>
# or Solana RPC
# SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Required: External compliance APIs
CHAINALYSIS_API_KEY=<your-api-key>
CHAINALYSIS_ENABLED=true
ENTITY_NAME=your-company-name

# Optional
CHAINLINK_ORACLE_ENABLED=true
LAND_REGISTRY_API_KEY=<your-api-key>
```

### 1.2 Install Dependencies (Both Paths)

Add to existing `compliance-system/src/agents/package.json`:

```json
{
  "dependencies": {
    "ethers": "^6.7.1",
    "axios": "^1.6.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0",
    "lodash": "^4.17.21"
  }
}
```

Add to existing `compliance-system/src/api/package.json`:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "uuid": "^9.0.0",
    "winston": "^3.11.0"
  }
}
```

Run: `npm install` in both directories

### 1.3 Environment Variables (Base - Both Paths)

Add to `.env`:

```bash
# Database (Same for both paths)
PGVECTOR_URL=postgresql://user:password@localhost:5432/compliance_db
DB_POOL_MAX=20

# Feature Flags (Same for both paths)
ENABLE_ORACLE_VERIFICATION=true
ENABLE_P2P_ANOMALY_DETECTION=true
ENABLE_COMPLIANCE_GATEWAY=true

# THEN add path-specific vars from 1.1A or 1.1B above
```

---

## Part 2: Database Extension (Both Paths)

Run migration in your existing database migration system (e.g., `db/migrations/2026-02-25-rwa-tables.sql`):

```sql
-- Create RWA Assets table
CREATE TABLE IF NOT EXISTS rwa_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    registry_reference VARCHAR(255),
    spv_contract_address VARCHAR(42),
    spv_legal_entity_id VARCHAR(255),
    owner_wallet_address VARCHAR(42),
    jurisdiction VARCHAR(2),
    registration_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create P2P Transfer Log
CREATE TABLE IF NOT EXISTS p2p_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    token_amount NUMERIC NOT NULL,
    asset_id UUID REFERENCES rwa_assets(id),
    kyc_verified_from BOOLEAN,
    kyc_verified_to BOOLEAN,
    aml_screening_from VARCHAR(50),
    aml_screening_to VARCHAR(50),
    transaction_hash VARCHAR(255),
    besu_block_number BIGINT,
    transfer_status VARCHAR(50),
    hawala_risk_score NUMERIC(3,2),
    anomaly_flags TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Create Fiat Ramp Access Log
CREATE TABLE IF NOT EXISTS fiat_ramp_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    rwa_token_amount NUMERIC,
    requested_fiat_amount NUMERIC,
    fiat_currency VARCHAR(3),
    aml_check_result VARCHAR(50),
    aml_risk_score NUMERIC(3,2),
    screening_timestamp TIMESTAMP,
    original_p2p_transfer_id UUID REFERENCES p2p_transfers(id),
    request_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Anomaly Pattern Tracking
CREATE TABLE IF NOT EXISTS p2p_anomaly_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_wallet VARCHAR(42),
    transfers_24h_count INT,
    transfers_24h_volume NUMERIC,
    avg_transfer_size NUMERIC,
    rapid_buy_sell_cycle BOOLEAN,
    circular_transfers BOOLEAN,
    fiat_conversion_speed_minutes INT,
    risk_score_aggregate NUMERIC(3,2),
    detected_at TIMESTAMP DEFAULT NOW()
);

-- Create RWA Compliance Audit Trail
CREATE TABLE IF NOT EXISTS rwa_compliance_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_type VARCHAR(50),
    asset_id UUID REFERENCES rwa_assets(id),
    transfer_id UUID REFERENCES p2p_transfers(id),
    decision VARCHAR(20),
    risk_score NUMERIC(3,2),
    agent_reasoning TEXT,
    shape_values JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Settlement Records
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiat_ramp_request_id UUID,
    wallet_address VARCHAR(42),
    token_amount NUMERIC,
    asset_id UUID REFERENCES rwa_assets(id),
    fiat_currency VARCHAR(3),
    bank_account VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Gateway Audit Log
CREATE TABLE IF NOT EXISTS gateway_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    decision VARCHAR(50),
    risk_score NUMERIC(3,2),
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Compliance Escalation Tickets
CREATE TABLE IF NOT EXISTS compliance_escalation_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(50),
    fiat_ramp_request_id UUID,
    wallet_address VARCHAR(42),
    reason VARCHAR(50),
    risk_score NUMERIC(3,2),
    patterns JSONB,
    assignee VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX idx_rwa_assets_owner ON rwa_assets(owner_wallet_address);
CREATE INDEX idx_rwa_assets_spv ON rwa_assets(spv_contract_address);
CREATE INDEX idx_p2p_transfers_from ON p2p_transfers(from_address);
CREATE INDEX idx_p2p_transfers_to ON p2p_transfers(to_address);
CREATE INDEX idx_p2p_transfers_status ON p2p_transfers(transfer_status);
CREATE INDEX idx_p2p_transfers_asset ON p2p_transfers(asset_id);
CREATE INDEX idx_anomaly_patterns_wallet ON p2p_anomaly_patterns(user_wallet);
CREATE INDEX idx_rwa_audit_decision ON rwa_compliance_audit(decision_type);
CREATE INDEX idx_gateway_audit_request ON gateway_audit_log(request_id);
```

---

## Part 3: Integrate Services into Existing System

### 3.1 Update Agents Service Initialization

In `compliance-system/src/agents/src/index.ts`, add the new services:

```typescript
// Add imports at the top
import OracleVerifiedOwnershipGuard from './services/oracleOwnershipGuard';
import { AMLAnomalyDetectorAgent } from './agents/amlAnomalyDetectorAgent';

// In initializeAgents() function, after existing tool initialization:
async function initializeAgents() {
  logger.info('Initializing AI agents...');

  // ... existing code ...

  // Initialize ComplianceShield components
  const oracleOwnershipGuard = new OracleVerifiedOwnershipGuard(
    {
      besuRpcUrl: process.env.BESU_RPC_URL || 'http://localhost:8545',
      pollingIntervalSeconds: 3600 // Poll hourly
      // Configure land registry APIs per jurisdiction
      // landRegistryConfigs: new Map([
      //   ['IN', { apiEndpoint: '...', apiKey: '...', jurisdiction: 'IN' }],
      //   ['EU', { apiEndpoint: '...', apiKey: '...', jurisdiction: 'EU' }]
      // ])
    },
    dbClient
  );

  const amlAnomalyDetector = new AMLAnomalyDetectorAgent(dbClient, besuProvider);

  // Subscribe to oracle verification alerts
  oracleOwnershipGuard.on('ownershipVerificationAlert', async (alert) => {
    logger.warn('Ownership verification alert', alert);
    // Trigger automatic actions via supervisor agent
    // e.g., pause trading, burn tokens, escalate
  });

  // ... existing code for supervisorAgent, kycAgent, etc...

  return {
    supervisorAgent,
    kycAgent,
    amlAgent,
    sebiAgent,
    oracleOwnershipGuard,       // NEW
    amlAnomalyDetector,         // NEW
    // ... other exports
  };
}

// Export for use in routes
export { oracleOwnershipGuard, amlAnomalyDetector };
```

### 3.2 Update API Service

In `compliance-system/src/api/src/routes/`, add the new routes:

```typescript
// In compliance-system/src/api/src/index.ts (main API file)

import { createComplianceGatewayRouter, ComplianceGatewayService } from './routes/complianceGatewayRoutes';

// ... existing imports ...

const app: Express = express();

// ... existing middleware setup ...

// Initialize ComplianceShield services
const gatewayService = new ComplianceGatewayService(
  dbClient,
  kycService,
  besuProvider
);

const gatewayRouter = createComplianceGatewayRouter(gatewayService);

// Register new routes
app.use('/api/compliance-shield', gatewayRouter);

// Existing routes continue...
app.use('/api/kyc', kycRoutes(kycService));
app.use('/api/aml', amlRoutes(amlService));
// ... etc
```

---

## Part 4: Integrate LangGraph Agents

### 4.1 Create RWA Shield Agent

Create `compliance-system/src/agents/src/graphs/rwaShieldGraph.ts`:

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { OracleVerifiedOwnershipGuard } from "../services/oracleOwnershipGuard";

interface RWAShieldState {
  messages: BaseMessage[];
  assetId?: string;
  spvAddress?: string;
  ownershipStatus?: string;
  riskDecision?: string;
}

export function createRWAShieldGraph(
  llm: ChatOpenAI,
  oracleGuard: OracleVerifiedOwnershipGuard
) {
  // Define tools
  const tools = [
    {
      name: "verify_ownership",
      description: "Verify real-time asset ownership via oracle",
      func: async (assetId: string, spvAddress: string) => {
        const result = await oracleGuard.verifyOwnership(assetId, spvAddress);
        return JSON.stringify(result);
      }
    },
    {
      name: "get_oracle_history",
      description: "Get historical oracle verification results",
      func: async (assetId: string) => {
        // Query audit trail
        return "Oracle history retrieved";
      }
    },
    {
      name: "trigger_token_pause",
      description: "Pause token trading if ownership compromised",
      func: async (assetId: string, reason: string) => {
        // Call smart contract to pause trading
        return `Tokens paused for asset ${assetId}: ${reason}`;
      }
    }
  ];

  const toolNode = new ToolNode(tools);

  async function rwaShieldAgent(state: RWAShieldState) {
    const prompt = `You are the RWA Shield Agent, specialized in preventing double-dipping fraud in tokenized assets.
    
    Your responsibilities:
    1. Verify that tokenized assets are held in Special Purpose Vehicles (SPVs)
    2. Monitor for off-chain sales via oracle integration
    3. Recommend automatic safeguards (token pause/burn) if ownership is compromised
    
    Current Task:
    Asset ID: ${state.assetId}
    SPV Address: ${state.spvAddress}
    
    Please assess the ownership status and recommend action.`;

    const response = await llm.invoke([
      ...state.messages,
      new HumanMessage(prompt)
    ]);

    return {
      messages: [...state.messages, response]
    };
  }

  const graph = new StateGraph<RWAShieldState>()
    .addNode("rwa_agent", rwaShieldAgent)
    .addNode("rwa_tools", toolNode)
    .addNode("decision", async (state: RWAShieldState) => {
      // Final decision node
      return state;
    })
    .addEdge(START, "rwa_agent")
    .addConditionalEdges(
      "rwa_agent",
      (state) => state.messages[-1].content.includes("tool") ? "rwa_tools" : "decision"
    )
    .addEdge("rwa_tools", "rwa_agent")
    .addEdge("decision", END);

  return graph.compile();
}
```

### 4.2 Create P2P Anomaly Agent

Create `compliance-system/src/agents/src/graphs/p2pAnomalyGraph.ts`:

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AMLAnomalyDetectorAgent, P2PTransfer } from "../agents/amlAnomalyDetectorAgent";

interface P2PAnomalyState {
  messages: HumanMessage[];
  transfer?: P2PTransfer;
  riskAssessment?: any;
  decision?: string;
}

export function createP2PAnomalyGraph(
  llm: ChatOpenAI,
  amlDetector: AMLAnomalyDetectorAgent
) {
  const tools = [
    {
      name: "assess_p2p_risk",
      description: "Assess hawala and money laundering risk for P2P transfer",
      func: async (fromAddress: string, toAddress: string, amount: number) => {
        const result = await amlDetector.assessHawalaRisk({
          fromAddress,
          toAddress,
          amount,
          timestamp: new Date()
        });
        return JSON.stringify(result);
      }
    },
    {
      name: "check_transaction_patterns",
      description: "Analyze transaction patterns for anomalies",
      func: async (walletAddress: string) => {
        // Query DB for pattern analysis
        return "Pattern analysis complete";
      }
    }
  ];

  const toolNode = new ToolNode(tools);

  async function p2pAnomalyAgent(state: P2PAnomalyState) {
    const prompt = `You are the P2P Anomaly Detection Agent.
    
    Your role: Detect hawala, money laundering, and illicit trading patterns in peer-to-peer token transfers.
    
    Transfer Details:
    From: ${state.transfer?.fromAddress}
    To: ${state.transfer?.toAddress}
    Amount: ${state.transfer?.amount}
    
    Please assess the risk and recommend action.`;

    const response = await llm.invoke([...state.messages, new HumanMessage(prompt)]);
    return { messages: [...state.messages, response] };
  }

  const graph = new StateGraph<P2PAnomalyState>()
    .addNode("p2p_agent", p2pAnomalyAgent)
    .addNode("p2p_tools", toolNode)
    .addEdge(START, "p2p_agent")
    .addConditionalEdges(
      "p2p_agent",
      (state) => state.messages[-1].content.includes("tool") ? "p2p_tools" : END
    )
    .addEdge("p2p_tools", "p2p_agent")
    .addEdge(["p2p_agent"], END);

  return graph.compile();
}
```

---

## Part 5: Integration with Supervisor Agent

### 5.1 Update Supervisor Agent Workflow

In `compliance-system/src/agents/src/agents/supervisorAgent.ts`, add routing for RWA transactions:

```typescript
async executeCompliance(transaction: any): Promise<ComplianceDecision> {
  // ... existing code ...

  // NEW: Check if transaction involves RWA asset
  const isRWATransaction = await this.isRWAAsset(transaction.assetId);
  
  if (isRWATransaction) {
    // Route to RWA Shield Agent for double-dipping prevention
    const rwaResult = await this.rwaShieldGraph.invoke({
      messages: [],
      assetId: transaction.assetId,
      spvAddress: transaction.spvAddress
    });

    if (rwaResult.riskDecision === 'BLOCK') {
      return {
        status: 'blocked',
        reason: 'RWA ownership verification failed',
        riskScore: 0.9
      };
    }
  }

  // NEW: Check for P2P transfer anomalies
  if (transaction.type === 'P2P_TRANSFER') {
    const p2pResult = await this.amlAnomalyDetector.assessHawalaRisk({
      fromAddress: transaction.from,
      toAddress: transaction.to,
      amount: transaction.amount,
      timestamp: new Date()
    });

    if (p2pResult.shouldBlock) {
      return {
        status: 'blocked',
        reason: 'AML check failed: potential hawala/money laundering',
        riskScore: p2pResult.overallRiskScore
      };
    }

    if (p2pResult.escalationLevel === 'manual_review') {
      // Escalate to compliance team
      await this.escalateToManualReview(transaction, p2pResult);
    }
  }

  // Continue with existing KYC/AML checks...
  // ...

  return decision;
}
```

---

## Part 6: Testing

### 6.1 Unit Tests for Oracle Guard

Create `compliance-system/src/agents/test/oracleOwnershipGuard.test.ts`:

```typescript
import { OracleVerifiedOwnershipGuard } from "../src/services/oracleOwnershipGuard";
import { describe, it, expect, beforeEach, mock } from "node:test";

describe("OracleVerifiedOwnershipGuard", () => {
  let guard: OracleVerifiedOwnershipGuard;
  let mockDbClient: any;

  beforeEach(() => {
    mockDbClient = {
      query: mock.fn().mockResolvedValue({ rows: [] })
    };

    guard = new OracleVerifiedOwnershipGuard(
      {
        besuRpcUrl: "http://localhost:8545"
      },
      mockDbClient
    );
  });

  it("should detect off-chain asset sale", async () => {
    // Mock asset with land registry showing ownership change
    mockDbClient.query.mockResolvedValueOnce({
      rows: [{ id: "asset1", spv_legal_entity_id: "SPV Corp" }]
    });

    const result = await guard.verifyOwnership("asset1", "0xspv123");
    expect(result.isOwned).toBe(false);
  });

  it("should calculate correct oracle score", async () => {
    // Test various risk scenarios
    const result = await guard.verifyOwnership("asset2", "0xspv456");
    expect(result.oracleScore).toBeGreaterThanOrEqual(0);
    expect(result.oracleScore).toBeLessThanOrEqual(1);
  });
});
```

### 6.2 Integration Tests

```bash
# Run existing test suite
cd compliance-system
npm run test

# Run ComplianceShield specific tests
npm run test -- --testNamePattern="ComplianceShield"
```

---

## Part 7: Deployment

### 7.1 Docker Updates

Update `compliance-system/docker-compose.yml`:

```yaml
services:
  compliance-agents:
    build:
      context: ./src/agents
      dockerfile: Dockerfile
    environment:
      - BESU_RPC_URL=http://besu:8545
      - CHAINALYSIS_API_KEY=${CHAINALYSIS_API_KEY}
      - ENABLE_ORACLE_VERIFICATION=true
      - ENABLE_P2P_ANOMALY_DETECTION=true
    depends_on:
      - postgres
      - besu
    volumes:
      - ./logs:/app/logs

  compliance-api:
    build:
      context: ./src/api
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${PGVECTOR_URL}
      - ENABLE_COMPLIANCE_GATEWAY=true
    depends_on:
      - postgres
    volumes:
      - ./logs:/app/logs

  besu:
    image: hyperledger/besu:latest
    command: --network=dev --rpc-http-enabled --rpc-http-host=0.0.0.0
    ports:
      - "8545:8545"
```

### 7.2 Fargate Deployment (AWS CDK)

Update `compliance-system/cdk/lib/compliance-system-stack.ts`:

```typescript
// Add ComplianceShield tasks
const oracleGuardTask = new ecs.FargateTaskDefinition(this, 'OracleGuardTask', {
  memoryLimitMiB: 1024,
  cpu: 512
});

oracleGuardTask.addContainer('oracle-guard', {
  image: ecs.ContainerImage.fromAsset('../src/agents'),
  environment: {
    BESU_RPC_URL: `http://${besuLoadBalancer.loadBalancerDnsName}:8545`,
    CHAINALYSIS_API_KEY: process.env.CHAINALYSIS_API_KEY || '',
    ENABLE_ORACLE_VERIFICATION: 'true'
  },
  logging: ecs.LogDriver.awsLogs({
    streamPrefix: 'oracle-guard',
    logRetention: logs.RetentionDays.ONE_WEEK
  })
});

new ecs.FargateService(this, 'OracleGuardService', {
  cluster,
  taskDefinition: oracleGuardTask,
  desiredCount: 2,
  circuitBreaker: { rollback: true }
});
```

---

## Part 8: Monitoring & Observability

### 8.1 CloudWatch Metrics

Add custom metrics to your services:

```typescript
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

// Log oracle verification metrics
await cloudwatch.putMetricData({
  Namespace: 'ComplianceShield',
  MetricData: [
    {
      MetricName: 'OracleVerificationsCompleted',
      Value: 42,
      Unit: 'Count'
    },
    {
      MetricName: 'AMLRiskScoreAverage',
      Value: 0.35,
      Unit: 'None'
    }
  ]
}).promise();
```

### 8.2 Dashboard

Create Grafana dashboard importing from existing Prometheus setup:

```yaml
# grafana/dashboards/compliance-shield.json
{
  "dashboard": {
    "title": "ComplianceShield Monitoring",
    "panels": [
      {
        "title": "Oracle Verifications Status",
        "targets": [{"expr": "oracle_verifications_completed"}]
      },
      {
        "title": "P2P Transfer Risk Distribution",
        "targets": [{"expr": "p2p_transfer_risk_score"}]
      },
      {
        "title": "Gateway Request Status",
        "targets": [{"expr": "gateway_request_status"}]
      }
    ]
  }
}
```

---

## Part 9: Go-Live Checklist

- [ ] All database migrations applied
- [ ] APIs tested with postman collection
- [ ] Load test: 1000 concurrent P2P transfers
- [ ] Security audit completed (OWASP Top 10)
- [ ] Chainalysis/External API credentials configured
- [ ] Land registry integrations verified
- [ ] Besu smart contracts audited
- [ ] Compliance runbook documented
- [ ] Team trained on escalation procedures
- [ ] Monitoring dashboards deployed
- [ ] 24/7 on-call rotation established
- [ ] Regulatory notification (SEBI) submitted

---

## Part 10: Support & Resources

### API Documentation
- Swagger UI: `http://localhost:3001/api-docs`
- Postman Collection: `docs/ComplianceShield.postman_collection.json`

### Team Resources
- Architecture Slack Channel: `#compliance-shield-arch`
- Deployment Guide: `README-deployment.md`
- Compliance Runbook: `docs/compliance-runbook.md`

### Escalation
- **Critical Bugs**: `#compliance-critical` Slack
- **Compliance Questions**: `compliance-team@abeleka.com`
- **Oracle API Issues**: `engineering@chainlink.com`

---

**Next Review Date**: March 25, 2026 (monthly)

