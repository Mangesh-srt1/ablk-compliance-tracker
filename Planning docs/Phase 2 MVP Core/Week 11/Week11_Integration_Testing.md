# Week 11: Integration Testing

## Overview
Implement comprehensive integration testing across the entire Ableka Lumina platform, covering API integrations, blockchain interactions, AI agent workflows, and end-to-end user journeys.

## Objectives
- Test API integrations between services
- Validate blockchain interactions
- Test AI agent workflows
- Implement end-to-end testing scenarios
- Set up automated testing pipelines

## Day 1: API Integration Testing

### Implementation Steps

1. **Set up Integration Test Framework**
   - Configure test containers
   - Set up test databases
   - Implement API test utilities

2. **Test Service-to-Service Communication**
   - Test compliance service APIs
   - Validate agent service integrations
   - Test blockchain service interactions

3. **Implement Contract Testing**
   - Define API contracts
   - Test contract compliance
   - Implement consumer-driven contracts

### Code Snippets

#### 1. Integration Test Setup
```typescript
// tests/integration/setup.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers';
import { RedisContainer, StartedRedisContainer } from 'testcontainers';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Client } from 'pg';
import { createClient as createRedisClient } from 'redis';

export interface TestEnvironment {
  postgres: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
  api: StartedTestContainer;
  agent: StartedTestContainer;
  blockchain: StartedTestContainer;
  dbClient: Client;
  redisClient: any;
}

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  // Start PostgreSQL
  const postgres = await new PostgreSqlContainer()
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  // Start Redis
  const redis = await new RedisContainer().start();

  // Start API service
  const api = await new GenericContainer('ableka/api:latest')
    .withEnvironment({
      DATABASE_URL: postgres.getConnectionUri(),
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      NODE_ENV: 'test',
    })
    .withExposedPorts(3000)
    .start();

  // Start Agent service
  const agent = await new GenericContainer('ableka/agent:latest')
    .withEnvironment({
      DATABASE_URL: postgres.getConnectionUri(),
      REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      API_URL: `http://${api.getHost()}:${api.getMappedPort(3000)}`,
      NODE_ENV: 'test',
    })
    .withExposedPorts(3001)
    .start();

  // Start Blockchain service
  const blockchain = await new GenericContainer('ableka/blockchain:latest')
    .withEnvironment({
      DATABASE_URL: postgres.getConnectionUri(),
      API_URL: `http://${api.getHost()}:${api.getMappedPort(3000)}`,
      NODE_ENV: 'test',
    })
    .withExposedPorts(3002)
    .start();

  // Create database client
  const dbClient = new Client({
    host: postgres.getHost(),
    port: postgres.getMappedPort(5432),
    database: 'test_db',
    user: 'test_user',
    password: 'test_password',
  });
  await dbClient.connect();

  // Create Redis client
  const redisClient = createRedisClient({
    url: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
  });
  await redisClient.connect();

  return {
    postgres,
    redis,
    api,
    agent,
    blockchain,
    dbClient,
    redisClient,
  };
}

export async function teardownTestEnvironment(env: TestEnvironment): Promise<void> {
  await env.dbClient.end();
  await env.redisClient.disconnect();

  await env.api.stop();
  await env.agent.stop();
  await env.blockchain.stop();
  await env.redis.stop();
  await env.postgres.stop();
}
```

#### 2. API Integration Tests
```typescript
// tests/integration/api/compliance-api.test.ts
import { TestEnvironment, setupTestEnvironment, teardownTestEnvironment } from '../setup';
import { ComplianceServiceClient } from '../../src/services/compliance-api';

describe('Compliance API Integration', () => {
  let env: TestEnvironment;
  let complianceClient: ComplianceServiceClient;

  beforeAll(async () => {
    env = await setupTestEnvironment();
    complianceClient = new ComplianceServiceClient({
      baseUrl: `http://${env.api.getHost()}:${env.api.getMappedPort(3000)}`,
    });
  }, 60000);

  afterAll(async () => {
    await teardownTestEnvironment(env);
  });

  beforeEach(async () => {
    // Reset database state
    await env.dbClient.query('DELETE FROM compliance_checks');
    await env.dbClient.query('DELETE FROM transactions');
  });

  describe('Transaction Compliance Check', () => {
    it('should process compliance check for valid transaction', async () => {
      // Insert test transaction
      const transactionResult = await env.dbClient.query(`
        INSERT INTO transactions (id, amount, sender, receiver, asset, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        'tx-123',
        1000.00,
        'user-1',
        'user-2',
        'ETH',
        new Date(),
      ]);

      // Perform compliance check
      const result = await complianceClient.checkTransaction('tx-123');

      expect(result).toBeDefined();
      expect(result.status).toBe('compliant');
      expect(result.checks).toContainEqual(
        expect.objectToContain({
          type: 'sanctions',
          status: 'passed',
        })
      );
    });

    it('should flag transaction with sanctions violation', async () => {
      // Insert sanctioned entity
      await env.dbClient.query(`
        INSERT INTO sanctioned_entities (name, entity_type, source)
        VALUES ($1, $2, $3)
      `, ['Bad Actor Corp', 'organization', 'OFAC']);

      // Insert transaction with sanctioned receiver
      await env.dbClient.query(`
        INSERT INTO transactions (id, amount, sender, receiver, asset, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'tx-456',
        5000.00,
        'user-1',
        'Bad Actor Corp',
        'BTC',
        new Date(),
      ]);

      const result = await complianceClient.checkTransaction('tx-456');

      expect(result.status).toBe('flagged');
      expect(result.riskScore).toBeGreaterThan(0.8);
      expect(result.violations).toContainEqual(
        expect.objectToContain({
          type: 'sanctions',
          severity: 'high',
        })
      );
    });

    it('should handle bulk compliance checks', async () => {
      // Insert multiple transactions
      const transactions = [];
      for (let i = 0; i < 100; i++) {
        const result = await env.dbClient.query(`
          INSERT INTO transactions (id, amount, sender, receiver, asset, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          `tx-bulk-${i}`,
          Math.random() * 10000,
          `sender-${i}`,
          `receiver-${i}`,
          'ETH',
          new Date(),
        ]);
        transactions.push(`tx-bulk-${i}`);
      }

      const startTime = Date.now();
      const results = await complianceClient.checkTransactionsBulk(transactions);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Jurisdiction Compliance', () => {
    it('should apply jurisdiction-specific rules', async () => {
      // Insert transaction for EU jurisdiction
      await env.dbClient.query(`
        INSERT INTO transactions (id, amount, sender, receiver, asset, timestamp, jurisdiction)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        'tx-eu-001',
        25000.00, // Above EU reporting threshold
        'user-eu-1',
        'user-eu-2',
        'EUR',
        new Date(),
        'EU',
      ]);

      const result = await complianceClient.checkTransaction('tx-eu-001');

      expect(result.status).toBe('requires_reporting');
      expect(result.jurisdictionRules).toContain('EU_AML_2018');
    });
  });
});
```

#### 3. Contract Testing with Pact
```typescript
// tests/contracts/compliance-service.pact.ts
import { Pact } from '@pact-foundation/pact';
import { ComplianceServiceClient } from '../../src/services/compliance-api';

const mockProvider = new Pact({
  consumer: 'Compliance Dashboard',
  provider: 'Compliance Service',
  port: 1234,
  log: './logs/pact.log',
  dir: './pacts',
  logLevel: 'INFO',
});

describe('Compliance Service Contract', () => {
  beforeAll(() => mockProvider.setup());
  afterAll(() => mockProvider.finalize());
  afterEach(() => mockProvider.verify());

  describe('GET /api/compliance/check/:transactionId', () => {
    beforeEach(() => {
      const interaction = {
        state: 'a transaction exists',
        uponReceiving: 'a request for compliance check',
        withRequest: {
          method: 'GET',
          path: '/api/compliance/check/tx-123',
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            transactionId: 'tx-123',
            status: 'compliant',
            riskScore: 0.1,
            checks: [
              {
                type: 'sanctions',
                status: 'passed',
                details: 'No sanctions matches found',
              },
              {
                type: 'pep',
                status: 'passed',
                details: 'No PEP matches found',
              },
            ],
            timestamp: '2024-01-01T00:00:00Z',
          },
        },
      };

      return mockProvider.addInteraction(interaction);
    });

    it('returns compliance check result', async () => {
      const client = new ComplianceServiceClient({
        baseUrl: mockProvider.mockService.baseUrl,
      });

      const result = await client.checkTransaction('tx-123');

      expect(result.transactionId).toBe('tx-123');
      expect(result.status).toBe('compliant');
      expect(result.checks).toHaveLength(2);
    });
  });

  describe('POST /api/compliance/bulk-check', () => {
    beforeEach(() => {
      const interaction = {
        state: 'multiple transactions exist',
        uponReceiving: 'a bulk compliance check request',
        withRequest: {
          method: 'POST',
          path: '/api/compliance/bulk-check',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: {
            transactionIds: ['tx-1', 'tx-2', 'tx-3'],
            options: {
              includeDetails: true,
            },
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            results: [
              {
                transactionId: 'tx-1',
                status: 'compliant',
                riskScore: 0.05,
              },
              {
                transactionId: 'tx-2',
                status: 'flagged',
                riskScore: 0.85,
                violations: [
                  {
                    type: 'sanctions',
                    severity: 'high',
                  },
                ],
              },
              {
                transactionId: 'tx-3',
                status: 'compliant',
                riskScore: 0.12,
              },
            ],
            summary: {
              total: 3,
              compliant: 2,
              flagged: 1,
              failed: 0,
            },
          },
        },
      };

      return mockProvider.addInteraction(interaction);
    });

    it('returns bulk compliance check results', async () => {
      const client = new ComplianceServiceClient({
        baseUrl: mockProvider.mockService.baseUrl,
      });

      const result = await client.checkTransactionsBulk(
        ['tx-1', 'tx-2', 'tx-3'],
        { includeDetails: true }
      );

      expect(result.results).toHaveLength(3);
      expect(result.summary.total).toBe(3);
      expect(result.summary.flagged).toBe(1);
    });
  });
});
```

## Day 2: Blockchain Integration Testing

### Implementation Steps

1. **Set up Blockchain Test Networks**
   - Configure local test networks
   - Set up mock blockchain services
   - Implement blockchain test utilities

2. **Test Smart Contract Interactions**
   - Test compliance contract deployments
   - Validate transaction monitoring
   - Test oracle integrations

3. **Test Multi-Chain Operations**
   - Test cross-chain transactions
   - Validate bridge operations
   - Test chain-specific compliance rules

### Code Snippets

#### 1. Blockchain Test Setup
```typescript
// tests/integration/blockchain/setup.ts
import { ethers } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { ContractFactory } from '@ethersproject/contracts';
import ComplianceContract from '../../src/contracts/ComplianceContract.json';

export interface BlockchainTestEnvironment {
  provider: JsonRpcProvider;
  wallet: Wallet;
  complianceContract: ethers.Contract;
  mockTokens: {
    [symbol: string]: ethers.Contract;
  };
}

export async function setupBlockchainTestEnvironment(): Promise<BlockchainTestEnvironment> {
  // Connect to local Hardhat/Ganache network
  const provider = new JsonRpcProvider('http://localhost:8545');

  // Create test wallet
  const wallet = new Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Default Hardhat private key
    provider
  );

  // Deploy compliance contract
  const complianceFactory = new ContractFactory(
    ComplianceContract.abi,
    ComplianceContract.bytecode,
    wallet
  );

  const complianceContract = await complianceFactory.deploy();
  await complianceContract.deployed();

  // Deploy mock ERC20 tokens
  const mockTokens: { [symbol: string]: ethers.Contract } = {};

  const tokenSymbols = ['ETH', 'USDC', 'WBTC', 'UNI'];
  for (const symbol of tokenSymbols) {
    const tokenFactory = new ContractFactory(
      MockERC20Token.abi,
      MockERC20Token.bytecode,
      wallet
    );

    const token = await tokenFactory.deploy(`${symbol} Token`, symbol, 18);
    await token.deployed();

    mockTokens[symbol] = token;
  }

  return {
    provider,
    wallet,
    complianceContract,
    mockTokens,
  };
}

export async function teardownBlockchainTestEnvironment(env: BlockchainTestEnvironment): Promise<void> {
  // Clean up resources if needed
}
```

#### 2. Smart Contract Integration Tests
```typescript
// tests/integration/blockchain/compliance-contract.test.ts
import { BlockchainTestEnvironment, setupBlockchainTestEnvironment, teardownBlockchainTestEnvironment } from './setup';
import { ComplianceServiceClient } from '../../src/services/compliance-api';
import { BlockchainServiceClient } from '../../src/services/blockchain-api';

describe('Compliance Contract Integration', () => {
  let env: BlockchainTestEnvironment;
  let complianceClient: ComplianceServiceClient;
  let blockchainClient: BlockchainServiceClient;

  beforeAll(async () => {
    env = await setupBlockchainTestEnvironment();
    complianceClient = new ComplianceServiceClient({ baseUrl: 'http://localhost:3000' });
    blockchainClient = new BlockchainServiceClient({ baseUrl: 'http://localhost:3002' });
  }, 60000);

  afterAll(async () => {
    await teardownBlockchainTestEnvironment(env);
  });

  describe('Transaction Monitoring', () => {
    it('should monitor and flag suspicious transactions', async () => {
      // Create a large transaction that should trigger monitoring
      const amount = ethers.utils.parseEther('10000'); // 10,000 ETH
      const receiver = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Random address

      // Execute transaction
      const tx = await env.mockTokens.ETH.connect(env.wallet).transfer(receiver, amount);
      await tx.wait();

      // Wait for monitoring to detect the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if transaction was flagged
      const complianceResult = await complianceClient.checkTransaction(tx.hash);

      expect(complianceResult.status).toBe('flagged');
      expect(complianceResult.riskScore).toBeGreaterThan(0.7);
    });

    it('should integrate with sanctions screening', async () => {
      // Add a sanctioned address to the contract
      const sanctionedAddress = '0x1234567890123456789012345678901234567890';

      await env.complianceContract.addSanctionedAddress(sanctionedAddress);

      // Attempt transaction to sanctioned address
      const amount = ethers.utils.parseEther('1.0');
      const tx = await env.mockTokens.USDC.connect(env.wallet).transfer(sanctionedAddress, amount);
      await tx.wait();

      // Check compliance result
      const result = await complianceClient.checkTransaction(tx.hash);

      expect(result.status).toBe('blocked');
      expect(result.violations).toContainEqual(
        expect.objectToContain({
          type: 'sanctions',
          severity: 'critical',
        })
      );
    });
  });

  describe('Multi-Chain Compliance', () => {
    it('should handle cross-chain transactions', async () => {
      // Simulate a cross-chain transaction
      const sourceChain = 'ethereum';
      const targetChain = 'polygon';
      const amount = '5000';
      const asset = 'USDC';

      // Create transaction record
      const txRecord = await complianceClient.createTransactionRecord({
        id: 'cross-chain-001',
        amount: parseFloat(amount),
        sender: env.wallet.address,
        receiver: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        asset,
        sourceChain,
        targetChain,
        timestamp: new Date(),
      });

      // Check compliance across chains
      const result = await blockchainClient.checkCrossChainCompliance('cross-chain-001');

      expect(result.sourceChain.status).toBeDefined();
      expect(result.targetChain.status).toBeDefined();
      expect(result.bridgeCompliance).toBeDefined();
    });

    it('should validate bridge operations', async () => {
      // Test bridge transaction compliance
      const bridgeTx = {
        bridge: 'polygon-bridge',
        amount: 10000,
        asset: 'ETH',
        fromChain: 'ethereum',
        toChain: 'polygon',
        sender: env.wallet.address,
        receiver: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      };

      const result = await blockchainClient.validateBridgeTransaction(bridgeTx);

      expect(result.bridgeAllowed).toBe(true);
      expect(result.complianceChecks).toContain('bridge_limits');
      expect(result.complianceChecks).toContain('jurisdiction_rules');
    });
  });

  describe('Oracle Integration', () => {
    it('should integrate with price oracles', async () => {
      // Test transaction value calculation using oracle data
      const transaction = {
        id: 'oracle-test-001',
        amount: 1, // 1 BTC
        asset: 'BTC',
        sender: 'user-1',
        receiver: 'user-2',
        timestamp: new Date(),
      };

      // Get current BTC price from oracle
      const priceData = await blockchainClient.getAssetPrice('BTC', 'USD');

      expect(priceData.price).toBeGreaterThan(0);
      expect(priceData.source).toBe('chainlink'); // or other oracle

      // Calculate transaction value
      const usdValue = transaction.amount * priceData.price;

      // Check compliance based on value
      const complianceResult = await complianceClient.checkTransactionValue(usdValue, 'USD');

      expect(complianceResult.valueThresholds).toBeDefined();
    });

    it('should handle oracle failure gracefully', async () => {
      // Simulate oracle failure
      // This would require mocking the oracle service

      const transaction = {
        id: 'oracle-fail-001',
        amount: 1000,
        asset: 'UNKNOWN',
        sender: 'user-1',
        receiver: 'user-2',
        timestamp: new Date(),
      };

      // Should fall back to default compliance checks
      const result = await complianceClient.checkTransaction(transaction.id);

      expect(result.status).toBeDefined();
      expect(result.fallbackUsed).toBe(true);
    });
  });
});
```

## Day 3: AI Agent Integration Testing

### Implementation Steps

1. **Set up AI Agent Test Environment**
   - Configure LangChain test utilities
   - Set up mock LLM responses
   - Implement agent workflow testing

2. **Test Agent Workflows**
   - Test compliance analysis agents
   - Validate risk assessment workflows
   - Test document processing agents

3. **Test Agent Communication**
   - Test agent-to-agent communication
   - Validate agent coordination
   - Test agent persistence

### Code Snippets

#### 1. AI Agent Test Setup
```typescript
// tests/integration/ai/setup.ts
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { ComplianceAgent } from '../../src/agents/compliance-agent';
import { RiskAssessmentAgent } from '../../src/agents/risk-assessment-agent';
import { DocumentAnalysisAgent } from '../../src/agents/document-analysis-agent';

export interface AITestEnvironment {
  llm: ChatOpenAI;
  embeddings: OpenAIEmbeddings;
  vectorStore: MemoryVectorStore;
  complianceAgent: ComplianceAgent;
  riskAgent: RiskAssessmentAgent;
  documentAgent: DocumentAnalysisAgent;
}

export async function setupAITestEnvironment(): Promise<AITestEnvironment> {
  // Mock OpenAI API calls
  const mockLLM = new ChatOpenAI({
    openAIApiKey: 'test-key',
    modelName: 'gpt-3.5-turbo',
    temperature: 0,
  });

  // Mock embeddings
  const mockEmbeddings = new OpenAIEmbeddings({
    openAIApiKey: 'test-key',
  });

  // Create in-memory vector store
  const vectorStore = new MemoryVectorStore(mockEmbeddings);

  // Initialize agents
  const complianceAgent = new ComplianceAgent({
    llm: mockLLM,
    vectorStore,
    tools: [],
  });

  const riskAgent = new RiskAssessmentAgent({
    llm: mockLLM,
    vectorStore,
    riskModels: [],
  });

  const documentAgent = new DocumentAnalysisAgent({
    llm: mockLLM,
    vectorStore,
    documentTypes: ['pdf', 'docx', 'txt'],
  });

  return {
    llm: mockLLM,
    embeddings: mockEmbeddings,
    vectorStore,
    complianceAgent,
    riskAgent,
    documentAgent,
  };
}

export async function teardownAITestEnvironment(env: AITestEnvironment): Promise<void> {
  // Clean up resources
}
```

#### 2. Agent Workflow Integration Tests
```typescript
// tests/integration/ai/agent-workflows.test.ts
import { AITestEnvironment, setupAITestEnvironment, teardownAITestEnvironment } from './setup';

describe('AI Agent Integration', () => {
  let env: AITestEnvironment;

  beforeAll(async () => {
    env = await setupAITestEnvironment();
  }, 60000);

  afterAll(async () => {
    await teardownAITestEnvironment(env);
  });

  describe('Compliance Analysis Workflow', () => {
    it('should analyze transaction compliance with AI agent', async () => {
      const transaction = {
        id: 'ai-test-001',
        amount: 50000,
        sender: 'john.doe@example.com',
        receiver: 'jane.smith@business.com',
        asset: 'BTC',
        description: 'Payment for consulting services',
        timestamp: new Date(),
      };

      // Run compliance analysis
      const analysis = await env.complianceAgent.analyzeTransaction(transaction);

      expect(analysis).toBeDefined();
      expect(analysis.riskLevel).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should integrate with risk assessment agent', async () => {
      const transaction = {
        id: 'risk-test-001',
        amount: 100000,
        sender: 'suspicious@domain.com',
        receiver: 'offshore@bank.com',
        asset: 'ETH',
        description: 'Large transfer to offshore account',
        timestamp: new Date(),
      };

      // First, compliance agent analyzes
      const complianceAnalysis = await env.complianceAgent.analyzeTransaction(transaction);

      // Then risk agent assesses
      const riskAssessment = await env.riskAgent.assessRisk({
        transaction,
        complianceAnalysis,
        historicalData: [],
      });

      expect(riskAssessment.overallRisk).toBeGreaterThan(0.5);
      expect(riskAssessment.factors).toContain('amount');
      expect(riskAssessment.factors).toContain('destination');
    });

    it('should handle document analysis integration', async () => {
      const document = {
        id: 'doc-test-001',
        type: 'pdf',
        content: 'Sample KYC document with personal information...',
        metadata: {
          customerId: 'cust-001',
          documentType: 'passport',
          uploadDate: new Date(),
        },
      };

      // Analyze document
      const analysis = await env.documentAgent.analyzeDocument(document);

      expect(analysis.extractedData).toBeDefined();
      expect(analysis.authenticityScore).toBeGreaterThan(0);
      expect(analysis.complianceFlags).toBeDefined();
    });
  });

  describe('Agent Communication', () => {
    it('should enable agent-to-agent communication', async () => {
      const transaction = {
        id: 'comm-test-001',
        amount: 25000,
        sender: 'user@test.com',
        receiver: 'merchant@test.com',
        asset: 'USDC',
        timestamp: new Date(),
      };

      // Compliance agent requests risk assessment
      const complianceResult = await env.complianceAgent.analyzeWithRiskAssessment(transaction, env.riskAgent);

      expect(complianceResult.complianceStatus).toBeDefined();
      expect(complianceResult.riskAssessment).toBeDefined();
      expect(complianceResult.agentCollaboration).toBe(true);
    });

    it('should handle agent coordination for complex cases', async () => {
      const complexCase = {
        transaction: {
          id: 'complex-001',
          amount: 500000,
          sender: 'corp@business.com',
          receiver: 'foreign@bank.com',
          asset: 'EUR',
          timestamp: new Date(),
        },
        documents: [
          { type: 'invoice', content: 'Large business transaction...' },
          { type: 'contract', content: 'Service agreement...' },
        ],
        jurisdiction: 'EU',
      };

      // Coordinate multiple agents
      const result = await env.complianceAgent.coordinateAnalysis(complexCase, {
        riskAgent: env.riskAgent,
        documentAgent: env.documentAgent,
      });

      expect(result.coordinatedAnalysis).toBeDefined();
      expect(result.agentInputs).toHaveLength(3); // compliance + risk + document
      expect(result.finalRecommendation).toBeDefined();
    });
  });

  describe('Agent Learning and Adaptation', () => {
    it('should learn from feedback', async () => {
      const transaction = {
        id: 'learn-test-001',
        amount: 15000,
        sender: 'new-customer@test.com',
        receiver: 'vendor@test.com',
        asset: 'BTC',
        timestamp: new Date(),
      };

      // Initial analysis
      const initialAnalysis = await env.complianceAgent.analyzeTransaction(transaction);

      // Provide feedback
      await env.complianceAgent.provideFeedback(transaction.id, {
        actualOutcome: 'compliant',
        feedback: 'False positive - legitimate business transaction',
        adjustThreshold: true,
      });

      // Subsequent analysis should be different
      const updatedAnalysis = await env.complianceAgent.analyzeTransaction({
        ...transaction,
        id: 'learn-test-002', // Different ID
        amount: 16000, // Slightly higher amount
      });

      expect(updatedAnalysis.confidence).not.toBe(initialAnalysis.confidence);
    });

    it('should adapt to new compliance patterns', async () => {
      // Simulate emerging risk pattern
      const transactions = [];
      for (let i = 0; i < 10; i++) {
        transactions.push({
          id: `pattern-${i}`,
          amount: 1000 + (i * 100), // Escalating amounts
          sender: `user-${i}@suspicious-domain.com`,
          receiver: 'mixer@service.com', // Known mixer service
          asset: 'ETH',
          timestamp: new Date(),
        });
      }

      // Train agent on pattern
      await env.complianceAgent.trainOnPatterns(transactions, {
        pattern: 'escalating_mixer_transactions',
        risk: 'high',
      });

      // Test pattern recognition
      const newTransaction = {
        id: 'pattern-test',
        amount: 2500,
        sender: 'new-user@suspicious-domain.com',
        receiver: 'mixer@service.com',
        asset: 'ETH',
        timestamp: new Date(),
      };

      const analysis = await env.complianceAgent.analyzeTransaction(newTransaction);

      expect(analysis.detectedPatterns).toContain('escalating_mixer_transactions');
      expect(analysis.riskLevel).toBe('high');
    });
  });
});
```

## Day 4: End-to-End Testing

### Implementation Steps

1. **Set up E2E Test Framework**
   - Configure Playwright/Cypress
   - Set up test data management
   - Implement test utilities

2. **Test Complete User Journeys**
   - Test compliance dashboard workflows
   - Validate end-to-end compliance processes
   - Test multi-user scenarios

3. **Performance and Load Testing**
   - Test system performance under load
   - Validate scalability
   - Test concurrent user scenarios

### Code Snippets

#### 1. E2E Test Setup
```typescript
// e2e/setup/global-setup.ts
import { test as setup } from '@playwright/test';
import { createTestData } from './test-data';

setup('setup test data', async ({}) => {
  // Create test data for E2E tests
  await createTestData();
});
```

```typescript
// e2e/setup/test-data.ts
import { Client } from 'pg';

export async function createTestData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    // Create test users
    await client.query(`
      INSERT INTO users (id, email, name, role, created_at)
      VALUES
        ('user-admin', 'admin@ableka.com', 'Admin User', 'admin', NOW()),
        ('user-compliance', 'compliance@ableka.com', 'Compliance Officer', 'compliance_officer', NOW()),
        ('user-analyst', 'analyst@ableka.com', 'Risk Analyst', 'risk_analyst', NOW())
    `);

    // Create test transactions
    await client.query(`
      INSERT INTO transactions (id, amount, sender, receiver, asset, status, created_at)
      VALUES
        ('tx-001', 1000.00, 'user-1', 'user-2', 'ETH', 'pending', NOW()),
        ('tx-002', 50000.00, 'user-3', 'user-4', 'BTC', 'pending', NOW()),
        ('tx-003', 100000.00, 'user-5', 'user-6', 'USDC', 'flagged', NOW())
    `);

    // Create test compliance rules
    await client.query(`
      INSERT INTO compliance_rules (id, name, type, jurisdiction, threshold, created_at)
      VALUES
        ('rule-001', 'EU AML Reporting', 'reporting', 'EU', 10000, NOW()),
        ('rule-002', 'OFAC Sanctions', 'sanctions', 'US', 0, NOW()),
        ('rule-003', 'PEP Screening', 'pep', 'GLOBAL', 0, NOW())
    `);

  } finally {
    await client.end();
  }
}
```

#### 2. Complete User Journey Tests
```typescript
// e2e/tests/compliance-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Compliance Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as compliance officer
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'compliance@ableka.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('complete transaction compliance review', async ({ page }) => {
    // Navigate to transactions
    await page.click('[data-testid="nav-transactions"]');
    await expect(page).toHaveURL('/transactions');

    // Select pending transaction
    await page.click('[data-testid="transaction-row"]:has-text("tx-001")');
    await expect(page).toHaveURL('/transactions/tx-001');

    // Review transaction details
    await expect(page.locator('[data-testid="transaction-amount"]')).toContainText('1000.00');
    await expect(page.locator('[data-testid="transaction-asset"]')).toContainText('ETH');

    // Run compliance check
    await page.click('[data-testid="run-compliance-check"]');
    await expect(page.locator('[data-testid="compliance-status"]')).toBeVisible();

    // Approve transaction
    await page.click('[data-testid="approve-transaction"]');
    await page.fill('[data-testid="approval-notes"]', 'Approved after manual review');
    await page.click('[data-testid="confirm-approval"]');

    // Verify approval
    await expect(page.locator('[data-testid="transaction-status"]')).toContainText('approved');
  });

  test('handle high-risk transaction', async ({ page }) => {
    // Navigate to flagged transactions
    await page.click('[data-testid="nav-flagged"]');
    await expect(page).toHaveURL('/flagged-transactions');

    // Select high-risk transaction
    await page.click('[data-testid="transaction-row"]:has-text("tx-003")');

    // Review risk factors
    await expect(page.locator('[data-testid="risk-score"]')).toBeGreaterThan(0.8);
    await expect(page.locator('[data-testid="risk-factors"]')).toContainText('amount');

    // Request additional documentation
    await page.click('[data-testid="request-documents"]');
    await page.selectOption('[data-testid="document-type"]', 'proof-of-source');
    await page.fill('[data-testid="request-notes"]', 'High amount requires source verification');
    await page.click('[data-testid="send-request"]');

    // Verify request sent
    await expect(page.locator('[data-testid="document-request-status"]')).toContainText('sent');
  });

  test('generate compliance report', async ({ page }) => {
    // Navigate to reports
    await page.click('[data-testid="nav-reports"]');
    await expect(page).toHaveURL('/reports');

    // Create new report
    await page.click('[data-testid="create-report"]');
    await page.selectOption('[data-testid="report-type"]', 'compliance-summary');
    await page.fill('[data-testid="report-name"]', 'Monthly Compliance Report');
    await page.fill('[data-testid="date-range-start"]', '2024-01-01');
    await page.fill('[data-testid="date-range-end"]', '2024-01-31');
    await page.click('[data-testid="generate-report"]');

    // Wait for report generation
    await expect(page.locator('[data-testid="report-status"]')).toContainText('completed');

    // Download report
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-report"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('compliance-report');
  });
});
```

#### 3. Multi-User Scenario Tests
```typescript
// e2e/tests/multi-user-scenarios.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Multi-User Scenarios', () => {
  test('compliance officer and risk analyst collaboration', async ({ browser }) => {
    // Create two browser contexts
    const complianceContext = await browser.newContext();
    const analystContext = await browser.newContext();

    const compliancePage = await complianceContext.newPage();
    const analystPage = await analystContext.newPage();

    // Login as compliance officer
    await compliancePage.goto('/login');
    await compliancePage.fill('[data-testid="email"]', 'compliance@ableka.com');
    await compliancePage.fill('[data-testid="password"]', 'password123');
    await compliancePage.click('[data-testid="login-button"]');

    // Login as risk analyst
    await analystPage.goto('/login');
    await analystPage.fill('[data-testid="email"]', 'analyst@ableka.com');
    await analystPage.fill('[data-testid="password"]', 'password123');
    await analystPage.click('[data-testid="login-button"]');

    // Compliance officer flags transaction for review
    await compliancePage.click('[data-testid="nav-transactions"]');
    await compliancePage.click('[data-testid="transaction-row"]:has-text("tx-002")');
    await compliancePage.click('[data-testid="flag-for-review"]');
    await compliancePage.selectOption('[data-testid="assign-analyst"]', 'analyst@ableka.com');
    await compliancePage.fill('[data-testid="review-notes"]', 'High amount requires risk analysis');
    await compliancePage.click('[data-testid="assign-review"]');

    // Risk analyst receives notification
    await expect(analystPage.locator('[data-testid="notification-badge"]')).toBeVisible();
    await analystPage.click('[data-testid="notification-badge"]');
    await analystPage.click('[data-testid="review-request"]:has-text("tx-002")');

    // Analyst performs risk analysis
    await analystPage.click('[data-testid="run-risk-analysis"]');
    await expect(analystPage.locator('[data-testid="analysis-results"]')).toBeVisible();

    // Analyst provides recommendation
    await analystPage.selectOption('[data-testid="recommendation"]', 'approve_with_monitoring');
    await analystPage.fill('[data-testid="analyst-notes"]', 'Approved with enhanced monitoring due to amount');
    await analystPage.click('[data-testid="submit-recommendation"]');

    // Compliance officer receives recommendation
    await expect(compliancePage.locator('[data-testid="notification-badge"]')).toBeVisible();
    await compliancePage.click('[data-testid="notification-badge"]');
    await compliancePage.click('[data-testid="review-complete"]:has-text("tx-002")');

    // Verify final decision
    await expect(compliancePage.locator('[data-testid="transaction-status"]')).toContainText('approved');
    await expect(compliancePage.locator('[data-testid="monitoring-status"]')).toContainText('active');

    // Cleanup
    await complianceContext.close();
    await analystContext.close();
  });
});
```

#### 4. Performance and Load Testing
```typescript
// e2e/tests/performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('dashboard loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard');

    // Wait for critical content
    await page.waitForSelector('[data-testid="dashboard-content"]');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });

  test('transaction list renders efficiently', async ({ page, browser }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@ableka.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    await page.click('[data-testid="nav-transactions"]');

    const startTime = Date.now();

    // Wait for transaction list to load
    await page.waitForSelector('[data-testid="transaction-table"]');

    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds

    // Check virtual scrolling for large lists
    const visibleRows = await page.locator('[data-testid="transaction-row"]').count();
    expect(visibleRows).toBeLessThanOrEqual(50); // Should use virtual scrolling
  });

  test('handles concurrent users', async ({ browser }) => {
    const userCount = 10;
    const pages = [];

    // Create multiple user sessions
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      pages.push({ page, context });

      // Login each user
      await page.goto('/login');
      await page.fill('[data-testid="email"]', `user${i}@test.com`);
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="login-button"]');
    }

    // Perform concurrent operations
    const operations = pages.map(async ({ page }, index) => {
      await page.click('[data-testid="nav-transactions"]');
      await page.click(`[data-testid="transaction-row"]:nth-of-type(${index + 1})`);
      await page.click('[data-testid="run-compliance-check"]');

      // Wait for result
      await page.waitForSelector('[data-testid="compliance-result"]');
    });

    const startTime = Date.now();
    await Promise.all(operations);
    const totalTime = Date.now() - startTime;

    // Should handle concurrent operations efficiently
    expect(totalTime).toBeLessThan(10000); // Within 10 seconds for 10 users

    // Cleanup
    for (const { context } of pages) {
      await context.close();
    }
  });

  test('memory usage remains stable', async ({ page }) => {
    await page.goto('/dashboard');

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      // @ts-ignore
      return performance.memory.usedJSHeapSize;
    });

    // Perform memory-intensive operations
    for (let i = 0; i < 20; i++) {
      await page.click('[data-testid="nav-transactions"]');
      await page.click('[data-testid="nav-dashboard"]');
    }

    // Check memory usage after operations
    const finalMemory = await page.evaluate(() => {
      // @ts-ignore
      return performance.memory.usedJSHeapSize;
    });

    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncreaseMB).toBeLessThan(50);
  });
});
```

## Day 5: Testing Infrastructure and CI/CD

### Implementation Steps

1. **Set up Testing Infrastructure**
   - Configure test databases and services
   - Implement test data management
   - Set up automated test execution

2. **Implement CI/CD Pipeline**
   - Configure automated testing in CI
   - Set up test reporting and notifications
   - Implement test result analysis

3. **Test Monitoring and Analytics**
   - Set up test metrics collection
   - Implement test failure analysis
   - Configure alerting for test failures

### Code Snippets

#### 1. CI/CD Pipeline Configuration
```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:6-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start test database
        run: |
          createdb test_db
          psql -d test_db -f scripts/setup-test-db.sql

      - name: Run API integration tests
        run: npm run test:integration:api
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Run blockchain integration tests
        run: npm run test:integration:blockchain
        env:
          ETH_RPC_URL: http://localhost:8545

      - name: Run AI agent integration tests
        run: npm run test:integration:ai
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            test-results/
            coverage/

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Build application
        run: npm run build

      - name: Start application
        run: npm run start:test &
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload E2E results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-results
          path: test-results/e2e/

  performance-tests:
    runs-on: ubuntu-latest
    needs: e2e-tests

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install k6
        run: |
          sudo apt update
          sudo apt install -y k6

      - name: Run performance tests
        run: k6 run tests/performance/load-test.js
        env:
          K6_PROMETHEUS_RW_SERVER_URL: ${{ secrets.PROMETHEUS_URL }}

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: performance-results
          path: performance-results/
```

#### 2. Test Metrics and Reporting
```typescript
// scripts/test-reporting.ts
import { TestResult, TestRun } from '@playwright/test/reporter';
import { Client } from 'pg';

export class TestReporter {
  private db: Client;

  constructor() {
    this.db = new Client({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async connect() {
    await this.db.connect();
  }

  async disconnect() {
    await this.db.end();
  }

  async reportTestRun(testRun: TestRun) {
    const runId = await this.insertTestRun(testRun);

    for (const result of testRun.results) {
      await this.insertTestResult(runId, result);
    }

    await this.updateTestMetrics(runId, testRun);
  }

  private async insertTestRun(testRun: TestRun): Promise<number> {
    const query = `
      INSERT INTO test_runs (
        branch, commit_sha, start_time, end_time,
        total_tests, passed_tests, failed_tests, skipped_tests
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    const values = [
      process.env.GITHUB_REF_NAME || 'unknown',
      process.env.GITHUB_SHA || 'unknown',
      testRun.startTime,
      new Date(),
      testRun.results.length,
      testRun.results.filter(r => r.status === 'passed').length,
      testRun.results.filter(r => r.status === 'failed').length,
      testRun.results.filter(r => r.status === 'skipped').length,
    ];

    const result = await this.db.query(query, values);
    return result.rows[0].id;
  }

  private async insertTestResult(runId: number, result: TestResult) {
    const query = `
      INSERT INTO test_results (
        run_id, test_name, status, duration, error_message
      )
      VALUES ($1, $2, $3, $4, $5)
    `;

    const values = [
      runId,
      result.title,
      result.status,
      result.duration,
      result.error?.message || null,
    ];

    await this.db.query(query, values);
  }

  private async updateTestMetrics(runId: number, testRun: TestRun) {
    // Calculate metrics
    const totalDuration = testRun.results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / testRun.results.length;
    const passRate = (testRun.results.filter(r => r.status === 'passed').length / testRun.results.length) * 100;

    const query = `
      UPDATE test_runs
      SET avg_duration = $2, pass_rate = $3
      WHERE id = $1
    `;

    await this.db.query(query, [runId, avgDuration, passRate]);
  }

  async getTestTrends(days: number = 30) {
    const query = `
      SELECT
        DATE(start_time) as date,
        AVG(pass_rate) as avg_pass_rate,
        AVG(avg_duration) as avg_duration,
        COUNT(*) as total_runs
      FROM test_runs
      WHERE start_time >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(start_time)
      ORDER BY date
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  async getFailingTests() {
    const query = `
      SELECT
        test_name,
        COUNT(*) as failure_count,
        MAX(start_time) as last_failure
      FROM test_results
      WHERE status = 'failed'
        AND start_time >= NOW() - INTERVAL '7 days'
      GROUP BY test_name
      ORDER BY failure_count DESC
      LIMIT 10
    `;

    const result = await this.db.query(query);
    return result.rows;
  }
}
```

#### 3. Automated Test Failure Analysis
```typescript
// scripts/test-analysis.ts
import { TestReporter } from './test-reporting';
import { ChatOpenAI } from 'langchain/chat_models/openai';

export class TestFailureAnalyzer {
  private reporter: TestReporter;
  private llm: ChatOpenAI;

  constructor() {
    this.reporter = new TestReporter();
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4',
      temperature: 0.1,
    });
  }

  async analyzeRecentFailures() {
    await this.reporter.connect();

    try {
      // Get failing tests from last 24 hours
      const failingTests = await this.reporter.getFailingTests();

      for (const test of failingTests) {
        await this.analyzeTestFailure(test);
      }
    } finally {
      await this.reporter.disconnect();
    }
  }

  private async analyzeTestFailure(testFailure: any) {
    const analysisPrompt = `
      Analyze this test failure and provide insights:

      Test Name: ${testFailure.test_name}
      Failure Count (last 7 days): ${testFailure.failure_count}
      Last Failure: ${testFailure.last_failure}

      Please provide:
      1. Likely root cause
      2. Potential fixes
      3. Prevention measures
      4. Priority level (Critical/High/Medium/Low)
    `;

    const analysis = await this.llm.call([
      { role: 'system', content: 'You are an expert test failure analyzer for a compliance platform.' },
      { role: 'user', content: analysisPrompt },
    ]);

    // Store analysis results
    await this.storeAnalysis(testFailure.test_name, analysis.content);

    // Send notifications for critical failures
    if (this.isCriticalFailure(testFailure)) {
      await this.sendCriticalFailureAlert(testFailure, analysis.content);
    }
  }

  private async storeAnalysis(testName: string, analysis: string) {
    // Store in database or send to monitoring system
    console.log(`Analysis for ${testName}:`, analysis);
  }

  private isCriticalFailure(testFailure: any): boolean {
    return testFailure.failure_count > 5 ||
           testFailure.test_name.includes('security') ||
           testFailure.test_name.includes('compliance');
  }

  private async sendCriticalFailureAlert(testFailure: any, analysis: string) {
    // Send alert to Slack, email, or monitoring system
    const alertMessage = {
      title: 'Critical Test Failure Alert',
      test: testFailure.test_name,
      failureCount: testFailure.failure_count,
      analysis: analysis,
      priority: 'high',
    };

    console.log('Sending critical alert:', alertMessage);
    // Integration with alerting system would go here
  }

  async generateTestHealthReport() {
    await this.reporter.connect();

    try {
      const trends = await this.reporter.getTestTrends(30);
      const failingTests = await this.reporter.getFailingTests();

      const report = {
        period: 'Last 30 days',
        overallHealth: this.calculateHealthScore(trends),
        trends: trends,
        topFailingTests: failingTests.slice(0, 5),
        recommendations: await this.generateRecommendations(trends, failingTests),
      };

      return report;
    } finally {
      await this.reporter.disconnect();
    }
  }

  private calculateHealthScore(trends: any[]): number {
    if (trends.length === 0) return 100;

    const avgPassRate = trends.reduce((sum, t) => sum + t.avg_pass_rate, 0) / trends.length;
    return Math.round(avgPassRate);
  }

  private async generateRecommendations(trends: any[], failingTests: any[]): Promise<string[]> {
    const recommendations = [];

    if (trends.length > 0) {
      const recentTrend = trends[trends.length - 1];
      if (recentTrend.avg_pass_rate < 90) {
        recommendations.push('Test pass rate has declined. Review recent changes for potential regressions.');
      }
    }

    if (failingTests.length > 0) {
      recommendations.push(`Address ${failingTests.length} frequently failing tests.`);
    }

    return recommendations;
  }
}
```

This comprehensive integration testing documentation covers all aspects of testing the Ableka Lumina platform, from unit tests to full CI/CD integration with automated analysis and reporting.