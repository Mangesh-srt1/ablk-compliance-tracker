/**
 * Compliance Graph Agent Unit Tests
 * Tests compliance decision graph, state transitions, and blockchain monitoring
 *
 * File: src/__tests__/unit/agents/complianceGraphAgent.test.ts
 */

import { ComplianceGraphAgent } from '../../../agents/complianceGraphAgent';

describe('ComplianceGraphAgent', () => {
  let agent: ComplianceGraphAgent;
  let mockGraphDb: any;
  let mockBlockchainListener: any;
  let mockVectorDb: any;

  beforeEach(() => {
    mockGraphDb = {
      addNode: jest.fn().mockResolvedValue({ id: 'node-123' }),
      addEdge: jest.fn().mockResolvedValue({ id: 'edge-456' }),
      queryPath: jest.fn().mockResolvedValue({
        path: ['ENTITY', 'KYC_CHECK', 'APPROVED'],
        length: 3,
      }),
      findRelated: jest.fn().mockResolvedValue({
        nodes: [{ id: 'related-1', type: 'Entity' }],
      }),
    };

    mockBlockchainListener = {
      on: jest.fn(),
      start: jest.fn().mockResolvedValue({ status: 'listening' }),
      stop: jest.fn().mockResolvedValue({ status: 'stopped' }),
    };

    mockVectorDb = {
      insertVector: jest.fn().mockResolvedValue({ id: 'vec-123' }),
      searchSimilar: jest.fn().mockResolvedValue({
        results: [{ score: 0.95, id: 'similar-1' }],
      }),
    };

    agent = new ComplianceGraphAgent({
      graphDb: mockGraphDb,
      blockchainListener: mockBlockchainListener,
      vectorDb: mockVectorDb,
    });
  });

  describe('Compliance Decision Graph - Basic Operations', () => {
    it('should create entity node in compliance graph', async () => {
      const result = await agent.createEntityNode({
        wallet: '0x1234567890abcdef',
        name: 'John Doe',
        jurisdiction: 'US',
      });

      expect(mockGraphDb.addNode).toHaveBeenCalledWith({
        type: 'Entity',
        data: expect.objectContaining({
          wallet: '0x1234567890abcdef',
          jurisdiction: 'US',
        }),
      });
      expect(result.id).toBeDefined();
    });

    it('should create compliance check node', async () => {
      const result = await agent.createCheckNode({
        type: 'KYC',
        status: 'APPROVED',
        riskScore: 15,
        timestamp: new Date(),
      });

      expect(mockGraphDb.addNode).toHaveBeenCalledWith({
        type: 'ComplianceCheck',
        data: expect.objectContaining({
          status: 'APPROVED',
          riskScore: 15,
        }),
      });
      expect(result).toBeDefined();
    });

    it('should link entity to compliance check', async () => {
      const entityId = 'entity-123';
      const checkId = 'check-456';

      const result = await agent.linkEntityToCheck(entityId, checkId, {
        checkType: 'KYC',
        timestamp: new Date(),
      });

      expect(mockGraphDb.addEdge).toHaveBeenCalledWith({
        from: entityId,
        to: checkId,
        type: 'UNDERWENT_CHECK',
      });
      expect(result).toBeDefined();
    });

    it('should track decision history in graph', async () => {
      const decisions = ['PENDING', 'APPROVED', 'ESCALATED'];
      const nodes = [];

      for (const status of decisions) {
        const result = await agent.createCheckNode({
          type: 'COMPLIANCE',
          status,
          riskScore: 30,
          timestamp: new Date(),
        });
        nodes.push(result);
      }

      expect(nodes.length).toBe(3);
      expect(mockGraphDb.addNode).toHaveBeenCalledTimes(3);
    });
  });

  describe('Compliance State Machine', () => {
    it('should transition from INIT → KYC_PENDING → KYC_APPROVED', async () => {
      const entityId = 'entity-123';
      const states = [];

      // Initial state
      const state1 = await agent.createCheckNode({
        type: 'INITIALIZATION',
        status: 'INIT',
      });
      states.push(state1);

      // KYC pending
      const state2 = await agent.createCheckNode({
        type: 'KYC',
        status: 'PENDING',
      });
      states.push(state2);

      // KYC approved
      const state3 = await agent.createCheckNode({
        type: 'KYC',
        status: 'APPROVED',
      });
      states.push(state3);

      expect(states.length).toBe(3);
    });

    it('should handle ESCALATED state transitions', async () => {
      const escalationPath = await agent.queryCompliancePath({
        entityId: 'entity-123',
        includeStates: ['PENDING', 'ESCALATED', 'APPROVED'],
      });

      expect(mockGraphDb.queryPath).toHaveBeenCalled();
      expect(escalationPath).toBeDefined();
    });

    it('should handle REJECTED state as terminal', async () => {
      const result = await agent.createCheckNode({
        type: 'COMPLIANCE',
        status: 'REJECTED',
        isTerminal: true,
        reason: 'High-risk sanctions match',
      });

      expect(result.isTerminal).toBe(true);
    });

    it('should track state transitions with timestamps', async () => {
      const node = await agent.createCheckNode({
        type: 'COMPLIANCE',
        status: 'APPROVED',
        timestamp: new Date(),
        previousStatus: 'PENDING',
      });

      expect(node.timestamp).toBeDefined();
      expect(node.previousStatus).toBe('PENDING');
    });
  });

  describe('Related Entity Detection', () => {
    it('should find related entities in compliance graph', async () => {
      mockGraphDb.findRelated.mockResolvedValue({
        nodes: [
          { id: 'entity-1', type: 'Entity', relationship: 'SAME_WALLET_CONTROL' },
          { id: 'entity-2', type: 'Entity', relationship: 'SHARED_BENEFICIARY' },
        ],
        count: 2,
      });

      const result = await agent.findRelatedEntities('entity-123');

      expect(mockGraphDb.findRelated).toHaveBeenCalledWith({
        nodeId: 'entity-123',
        relationshipTypes: ['SAME_WALLET_CONTROL', 'SHARED_BENEFICIARY'],
      });
      expect(result.nodes.length).toBe(2);
    });

    it('should detect suspicious relationship patterns', async () => {
      mockGraphDb.findRelated.mockResolvedValue({
        nodes: [
          { relationship: 'RAPID_KYC_SEQUENCE' },
          { relationship: 'SAME_PAYMENT_METHOD' },
          { relationship: 'FREQUENT_TRANSFERS' },
        ],
      });

      const result = await agent.findRelatedEntities('entity-123');

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.riskIndicators).toBeDefined();
    });

    it('should compute relationship strength scores', async () => {
      mockGraphDb.findRelated.mockResolvedValue({
        nodes: [
          { id: 'entity-1', strength: 0.95 },
          { id: 'entity-2', strength: 0.60 },
          { id: 'entity-3', strength: 0.30 },
        ],
      });

      const result = await agent.findRelatedEntities('entity-123');

      const strongRelations = result.nodes.filter(n => n.strength > 0.8);
      expect(strongRelations.length).toBeGreaterThan(0);
    });
  });

  describe('Blockchain Monitoring Integration', () => {
    it('should start blockchain listener for wallet', async () => {
      const result = await agent.startMonitoring({
        wallet: '0x1234567890abcdef',
        blockchainType: 'ethereum',
        eventNames: ['Transfer', 'Approval'],
      });

      expect(mockBlockchainListener.start).toHaveBeenCalled();
      expect(result.status).toBe('listening');
    });

    it('should register Transfer event listener', async () => {
      await agent.startMonitoring({
        wallet: '0x1234567890abcdef',
        blockchainType: 'ethereum',
      });

      expect(mockBlockchainListener.on).toHaveBeenCalledWith(
        'Transfer',
        expect.any(Function)
      );
    });

    it('should register Approval event listener', async () => {
      await agent.startMonitoring({
        wallet: '0x1234567890abcdef',
        blockchainType: 'ethereum',
      });

      expect(mockBlockchainListener.on).toHaveBeenCalledWith(
        'Approval',
        expect.any(Function)
      );
    });

    it('should trigger compliance check on detected transfer', async () => {
      const checkSpy = jest.spyOn(agent, 'triggerComplianceCheck');

      await agent.startMonitoring({
        wallet: '0x1234567890abcdef',
        blockchainType: 'ethereum',
      });

      // Simulate transfer event
      const transferHandler = mockBlockchainListener.on.mock.calls.find(
        call => call[0] === 'Transfer'
      )[1];
      await transferHandler({
        from: '0x1234567890abcdef',
        to: '0xrecipient',
        value: '1000000000000000000',
      });

      expect(checkSpy).toHaveBeenCalled();
    });

    it('should stop monitoring', async () => {
      await agent.stopMonitoring('0x1234567890abcdef');

      expect(mockBlockchainListener.stop).toHaveBeenCalled();
    });
  });

  describe('Anomaly Detection via Vector Similarity', () => {
    it('should store compliance decision as vector', async () => {
      const decision = {
        wallet: '0x1234567890abcdef',
        riskScore: 25,
        status: 'APPROVED',
        kycRisk: 10,
        amlScore: 20,
      };

      await agent.storeDecisionVector(decision);

      expect(mockVectorDb.insertVector).toHaveBeenCalledWith({
        type: 'ComplianceDecision',
        data: expect.objectContaining(decision),
      });
    });

    it('should find similar historical decisions', async () => {
      const currentDecision = {
        riskScore: 25,
        kycRisk: 10,
        amlScore: 20,
      };

      const result = await agent.findSimilarDecisions(currentDecision);

      expect(mockVectorDb.searchSimilar).toHaveBeenCalled();
      expect(result.results).toBeDefined();
    });

    it('should detect anomalous decisions vs historical patterns', async () => {
      mockVectorDb.searchSimilar.mockResolvedValue({
        results: [], // No similar decisions
        anomalyScore: 0.92,
      });

      const result = await agent.findSimilarDecisions({
        riskScore: 95,
        kycRisk: 90,
        amlScore: 90, // Very high, unusual
      });

      expect(result.anomalyScore).toBeGreaterThan(0.8);
    });

    it('should use vector similarity for pattern learning', async () => {
      mockVectorDb.searchSimilar.mockResolvedValue({
        results: [
          {
            id: 'similar-1',
            score: 0.98,
            outcome: 'APPROVED',
          },
          {
            id: 'similar-2',
            score: 0.96,
            outcome: 'APPROVED',
          },
        ],
      });

      const result = await agent.findSimilarDecisions({
        riskScore: 20,
        kycRisk: 10,
      });

      const similarOutcomes = result.results.map(r => r.outcome);
      expect(similarOutcomes).toContain('APPROVED');
    });
  });

  describe('Compliance Path Analysis', () => {
    it('should retrieve full compliance path for entity', async () => {
      mockGraphDb.queryPath.mockResolvedValue({
        path: ['ENTITY_CREATED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'APPROVED'],
        length: 4,
        checks: [
          { type: 'KYC', status: 'APPROVED' },
          { type: 'AML', status: 'APPROVED' },
        ],
      });

      const result = await agent.queryCompliancePath({
        entityId: 'entity-123',
      });

      expect(result.path.length).toBeGreaterThan(0);
      expect(mockGraphDb.queryPath).toHaveBeenCalled();
    });

    it('should identify bottlenecks in compliance path', async () => {
      mockGraphDb.queryPath.mockResolvedValue({
        path: ['PENDING', 'PENDING', 'PENDING', 'APPROVED'],
        bottleneck: 'KYC_VERIFICATION',
        duration: '30 DAYS',
      });

      const result = await agent.queryCompliancePath({
        entityId: 'entity-123',
      });

      expect(result.bottleneck).toBe('KYC_VERIFICATION');
    });

    it('should compute earliest decision date from path', async () => {
      mockGraphDb.queryPath.mockResolvedValue({
        path: ['INIT', 'KYC', 'AML', 'APPROVED'],
        timeline: [
          { date: '2024-01-01', status: 'INIT' },
          { date: '2024-01-05', status: 'KYC' },
          { date: '2024-01-10', status: 'APPROVED' },
        ],
      });

      const result = await agent.queryCompliancePath({
        entityId: 'entity-123',
      });

      expect(result.timeline).toBeDefined();
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle graph database failure', async () => {
      mockGraphDb.addNode.mockRejectedValue(
        new Error('Graph DB connection failed')
      );

      const result = await agent.createEntityNode({
        wallet: '0x1234567890abcdef',
        name: 'Test',
        jurisdiction: 'US',
      });

      expect(result).toBeDefined();
      expect(result.fallback).toBe(true);
    });

    it('should handle blockchain listener timeout', async () => {
      mockBlockchainListener.start.mockRejectedValue(
        new Error('RPC timeout')
      );

      const result = await agent.startMonitoring({
        wallet: '0x1234567890abcdef',
        blockchainType: 'ethereum',
      });

      expect(result).toBeDefined();
    });

    it('should handle vector DB insertion failure', async () => {
      mockVectorDb.insertVector.mockRejectedValue(
        new Error('Vector DB full')
      );

      const result = await agent.storeDecisionVector({
        wallet: '0x1234567890abcdef',
        riskScore: 25,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle large relationship graphs', async () => {
      mockGraphDb.findRelated.mockResolvedValue({
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: `entity-${i}`,
          strength: Math.random(),
        })),
      });

      const startTime = Date.now();
      const result = await agent.findRelatedEntities('entity-123');
      const duration = Date.now() - startTime;

      expect(result.nodes.length).toBe(1000);
      expect(duration).toBeLessThan(5000);
    });

    it('should batch graph insertions for efficiency', async () => {
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        type: 'ComplianceCheck',
        id: `check-${i}`,
      }));

      await agent.batchCreateNodes(nodes);

      expect(mockGraphDb.addNode.mock.calls.length).toBeGreaterThan(0);
    });

    it('should complete graph queries within SLA', async () => {
      const startTime = Date.now();
      await agent.queryCompliancePath({ entityId: 'entity-123' });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Compliance Audit Trail', () => {
    it('should maintain immutable audit trail in graph', async () => {
      const decision = {
        wallet: '0x1234567890abcdef',
        status: 'APPROVED',
        timestamp: new Date(),
        decidedBy: 'system',
      };

      await agent.createCheckNode(decision);

      expect(mockGraphDb.addNode).toHaveBeenCalledWith({
        type: 'ComplianceCheck',
        data: expect.objectContaining(decision),
        immutable: true,
      });
    });

    it('should generate compliance report from graph', async () => {
      mockGraphDb.queryPath.mockResolvedValue({
        path: ['INIT', 'KYC', 'AML', 'APPROVED'],
        checks: [
          { type: 'KYC', status: 'APPROVED', result: 'VERIFIED' },
          { type: 'AML', status: 'APPROVED', riskScore: 20 },
        ],
      });

      const result = await agent.generateComplianceReport('entity-123');

      expect(result.checks).toBeDefined();
      expect(result.totalChecks).toBeGreaterThan(0);
    });
  });
});
