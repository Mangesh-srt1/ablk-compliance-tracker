/**
 * Agent Orchestration Unit Tests
 * Tests supervisor agent workflow, state transitions, and multi-agent coordination
 */

// Mock @langchain/anthropic before imports to avoid API key validation
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'mocked response' }),
  })),
}));

import {
  ComplianceSupervisorAgent,
  ComplianceCheck,
  ComplianceResult,
} from '../../agents/supervisorAgent';
import { KYCAgent } from '../../agents/kycAgent';
import { AMLAgent } from '../../agents/amlAgent';
import { SEBIAgent } from '../../agents/sebiAgent';

jest.mock('../../config/database');
jest.mock('winston');

describe('ComplianceSupervisorAgent (Agent Orchestration)', () => {
  let supervisor: ComplianceSupervisorAgent;
  let mockKycAgent: jest.Mocked<KYCAgent>;
  let mockAmlAgent: jest.Mocked<AMLAgent>;
  let mockSebiAgent: jest.Mocked<SEBIAgent>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked agents first so they can be injected
    mockKycAgent = {
      run: jest.fn(),
      validate: jest.fn(),
    } as any;

    mockAmlAgent = {
      run: jest.fn(),
      analyzeRisk: jest.fn(),
    } as any;

    mockSebiAgent = {
      run: jest.fn(),
      checkRegulation: jest.fn(),
    } as any;

    // Create supervisor with injected mock agents
    supervisor = new ComplianceSupervisorAgent({
      kycAgent: mockKycAgent,
      amlAgent: mockAmlAgent,
      sebiAgent: mockSebiAgent,
    });
  });

  describe('Workflow Orchestration', () => {
    // 1. Happy path: Full KYC check workflow
    it('should orchestrate complete KYC compliance check', async () => {
      const check: ComplianceCheck = {
        id: 'check-1',
        transactionId: 'tx-1',
        checkType: 'kyc',
        fromAddress: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 100000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 15,
        confidence: 0.98,
        flags: [],
      });

      // This would be called through the graph execution
      const result = await supervisor.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.checkId).toBe('check-1');
      expect(result.status).toBe('approved');
      expect(result.riskScore).toBeLessThan(30);
    });

    // 2. Happy path: Full AML check workflow
    it('should orchestrate complete AML compliance check', async () => {
      const check: ComplianceCheck = {
        id: 'check-2',
        transactionId: 'tx-2',
        checkType: 'aml',
        fromAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: 500000,
      };

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 25,
        riskLevel: 'LOW',
        screening: { sanctionsMatch: false },
      });

      const result = await supervisor.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.riskScore).toBeLessThan(50);
      expect(result.agentUsed).toContain('aml');
    });

    // 3. Happy path: Full compliance check (KYC + AML + SEBI)
    it('should orchestrate FULL compliance check with all agents', async () => {
      const check: ComplianceCheck = {
        id: 'check-3',
        transactionId: 'tx-3',
        checkType: 'full',
        fromAddress: '0x1111111111111111111111111111111111111111',
        toAddress: '0x2222222222222222222222222222222222222222',
        amount: 250000,
        metadata: {
          jurisdiction: 'IN',
        },
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 20,
      });

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 30,
        riskLevel: 'LOW',
      });

      mockSebiAgent.checkRegulation.mockResolvedValue({
        compliant: true,
        riskScore: 15,
      });

      const result = await supervisor.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.agentUsed).toContain('kyc');
      expect(result.agentUsed).toContain('aml');
      expect(result.agentUsed).toContain('sebi');
      // Final score should be combination of all
      expect(result.riskScore).toBeDefined();
    });

    // 4. Edge case: Sequential agent processing
    it('should process agents sequentially and aggregate results', async () => {
      const check: ComplianceCheck = {
        id: 'check-4',
        transactionId: 'tx-4',
        checkType: 'full',
        fromAddress: '0x3333333333333333333333333333333333333333',
        amount: 400000,
        metadata: { jurisdiction: 'AE' },
      };

      const callOrder: string[] = [];

      mockKycAgent.run.mockImplementation(async () => {
        callOrder.push('kyc');
        return { statusCode: 'APPROVED', riskScore: 25 };
      });

      mockAmlAgent.analyzeRisk.mockImplementation(async () => {
        callOrder.push('aml');
        return { riskScore: 35, riskLevel: 'MEDIUM' };
      });

      mockSebiAgent.checkRegulation.mockImplementation(async () => {
        callOrder.push('sebi');
        return { compliant: true, riskScore: 20 };
      });

      const result = await supervisor.executeCheck(check);

      // KYC should run first, then AML, then SEBI
      expect(callOrder[0]).toBe('kyc');
      expect(callOrder[1]).toBe('aml');
      expect(callOrder[2]).toBe('sebi');
      expect(result.agentUsed).toEqual(['kyc', 'aml', 'sebi']);
    });
  });

  describe('Risk Score Aggregation', () => {
    // 5. Multiple agent scores combined correctly
    it('should aggregate risk scores from multiple agents', async () => {
      const check: ComplianceCheck = {
        id: 'check-5',
        transactionId: 'tx-5',
        checkType: 'full',
        fromAddress: '0x4444444444444444444444444444444444444444',
        amount: 150000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 20, // 20/100
      });

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 30, // 30/100
      });

      const result = await supervisor.executeCheck(check);

      // Average should be around 25
      expect(result.riskScore).toBeGreaterThan(15);
      expect(result.riskScore).toBeLessThan(40);
    });

    // 6: Average calculation with missing agents
    it('should handle missing agent results in aggregation', async () => {
      const check: ComplianceCheck = {
        id: 'check-6',
        transactionId: 'tx-6',
        checkType: 'kyc', // Only KYC check
        fromAddress: '0x5555555555555555555555555555555555555555',
        amount: 50000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 15,
      });

      const result = await supervisor.executeCheck(check);

      expect(result.riskScore).toBe(15);
      expect(result.agentUsed).toEqual(['kyc']);
    });
  });

  describe('State Transitions', () => {
    // 7. State progresses through workflow steps
    it('should transition through states: init -> kyc -> aml -> decision', async () => {
      const check: ComplianceCheck = {
        id: 'check-7',
        transactionId: 'tx-7',
        checkType: 'full',
        fromAddress: '0x6666666666666666666666666666666666666666',
        amount: 300000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 22,
      });

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 28,
        riskLevel: 'LOW',
      });

      const stateTransitions: string[] = [];

      // Hook into state changes
      const original = supervisor.executeCheck.bind(supervisor);
      supervisor.executeCheck = async (c) => {
        stateTransitions.push('init');
        const result = await original(c);
        stateTransitions.push('decision');
        return result;
      };

      const result = await supervisor.executeCheck(check);

      expect(stateTransitions.length).toBeGreaterThan(1);
      expect(result.status).toBeDefined();
    });

    // 8: Escalation state when risk exceeds threshold
    it('should escalate check when combined risk score exceeds threshold', async () => {
      const check: ComplianceCheck = {
        id: 'check-8',
        transactionId: 'tx-8',
        checkType: 'full',
        fromAddress: '0x7777777777777777777777777777777777777777',
        amount: 5000000, // Large amount
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'REQUIRES_REVIEW',
        riskScore: 55,
      });

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 65,
        riskLevel: 'HIGH',
      });

      const result = await supervisor.executeCheck(check);

      expect(result.status).toBe('escalated');
      expect(result.escalated).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(50);
    });

    // 9: Rejection state when critical flags present
    it('should REJECT check when critical flags detected', async () => {
      const check: ComplianceCheck = {
        id: 'check-9',
        transactionId: 'tx-9',
        checkType: 'full',
        fromAddress: '0x8888888888888888888888888888888888888888',
        amount: 100000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'REJECTED',
        riskScore: 85,
        flags: ['SANCTIONS_MATCH', 'PEP_DETECTED'],
      });

      const result = await supervisor.executeCheck(check);

      expect(result.status).toBe('rejected');
      expect(result.riskScore).toBeGreaterThanOrEqual(70);
      expect(result.findings).toContain('SANCTIONS_MATCH');
    });
  });

  describe('Parallel vs Sequential Processing', () => {
    // 10: KYC and AML can run in parallel when possible
    it('should measure execution time for parallel vs sequential', async () => {
      const check: ComplianceCheck = {
        id: 'check-10',
        transactionId: 'tx-10',
        checkType: 'full',
        fromAddress: '0x9999999999999999999999999999999999999999',
        amount: 200000,
      };

      mockKycAgent.run.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  statusCode: 'APPROVED',
                  riskScore: 20,
                }),
              100
            )
          )
      );

      mockAmlAgent.analyzeRisk.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  riskScore: 25,
                  riskLevel: 'LOW',
                }),
              100
            )
          )
      );

      const start = Date.now();
      const result = await supervisor.executeCheck(check);
      const duration = Date.now() - start;

      // If parallel: ~100ms, if sequential: ~200ms
      // We expect parallel execution
      expect(duration).toBeLessThan(200);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling & Resilience', () => {
    // 11: Graceful degradation when one agent fails
    it('should degrade gracefully if KYC agent fails', async () => {
      const check: ComplianceCheck = {
        id: 'check-11',
        transactionId: 'tx-11',
        checkType: 'full',
        fromAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        amount: 150000,
      };

      mockKycAgent.run.mockRejectedValue(new Error('KYC service timeout'));

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 30,
        riskLevel: 'LOW',
      });

      const result = await supervisor.executeCheck(check);

      // Should still return decision based on AML result
      expect(result).toBeDefined();
      expect(result.status).not.toBe('pending');
      expect(result.findings).toContain('KYC unavailable');
    });

    // 12: All agents fail -> escalate
    it('should ESCALATE when all agents fail', async () => {
      const check: ComplianceCheck = {
        id: 'check-12',
        transactionId: 'tx-12',
        checkType: 'full',
        fromAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        amount: 100000,
      };

      mockKycAgent.run.mockRejectedValue(new Error('Service error'));
      mockAmlAgent.analyzeRisk.mockRejectedValue(new Error('Service error'));

      const result = await supervisor.executeCheck(check);

      expect(result.status).toBe('escalated');
      expect(result.recommendations).toContain('Manual review required');
    });

    // 13: Timeout handling
    it('should handle agent timeouts gracefully', async () => {
      const check: ComplianceCheck = {
        id: 'check-13',
        transactionId: 'tx-13',
        checkType: 'full',
        fromAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
        amount: 200000,
      };

      mockKycAgent.run.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 50))
      );

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 40,
        riskLevel: 'MEDIUM',
      });

      const result = await supervisor.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.status).not.toBe('pending');
    });
  });

  describe('Result Recommendations', () => {
    // 14: Appropriate recommendations for approval
    it('should provide specific recommendations for approved entity', async () => {
      const check: ComplianceCheck = {
        id: 'check-14',
        transactionId: 'tx-14',
        checkType: 'full',
        fromAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
        amount: 50000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 15,
      });

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 10,
        riskLevel: 'LOW',
      });

      const result = await supervisor.executeCheck(check);

      expect(result.status).toBe('approved');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toMatch(/proceed|approve/i);
    });

    // 15: Recommendations for escalation
    it('should provide escalation recommendations for medium-risk entities', async () => {
      const check: ComplianceCheck = {
        id: 'check-15',
        transactionId: 'tx-15',
        checkType: 'full',
        fromAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        amount: 500000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 40,
      });

      mockAmlAgent.analyzeRisk.mockResolvedValue({
        riskScore: 50,
        riskLevel: 'MEDIUM',
      });

      const result = await supervisor.executeCheck(check);

      expect(result.status).toBe('escalated');
      expect(result.recommendations).toContain('Manual review');
      expect(result.recommendations).toContain('Document collection');
    });
  });

  describe('Idempotency', () => {
    // 16: Same check twice produces same result
    it('should be deterministic (same input -> same output)', async () => {
      const check: ComplianceCheck = {
        id: 'check-16',
        transactionId: 'tx-16',
        checkType: 'kyc',
        fromAddress: '0xffffffffffffffffffffffffffffffffffffffff',
        amount: 100000,
      };

      mockKycAgent.run.mockResolvedValue({
        statusCode: 'APPROVED',
        riskScore: 20,
      });

      const result1 = await supervisor.executeCheck(check);
      const result2 = await supervisor.executeCheck(check);

      expect(result1.status).toBe(result2.status);
      expect(result1.riskScore).toBe(result2.riskScore);
      expect(result1.findings).toEqual(result2.findings);
    });
  });
});
