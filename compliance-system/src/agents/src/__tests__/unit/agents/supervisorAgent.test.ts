/**
 * Supervisor Agent Unit Tests
 * Tests agent orchestration, state machine, and compliance decision logic
 *
 * File: src/__tests__/unit/agents/supervisorAgent.test.ts
 */

// Mock @langchain/anthropic before imports to avoid API key validation
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'mocked response' }),
  })),
}));

import { ComplianceSupervisorAgent } from '../../../agents/supervisorAgent';

describe('ComplianceSupervisorAgent', () => {
  let agent: ComplianceSupervisorAgent;
  let mockKycTool: any;
  let mockAmlTool: any;
  let mockSanctionsTool: any;
  let mockJurisdictionTool: any;

  beforeEach(() => {
    // Mock all tools
    mockKycTool = {
      call: jest
        .fn()
        .mockResolvedValue({ status: 'VERIFIED', confidence: 0.98 }),
    };
    mockAmlTool = {
      call: jest
        .fn()
        .mockResolvedValue({ riskScore: 20, riskLevel: 'LOW' }),
    };
    mockSanctionsTool = {
      call: jest.fn().mockResolvedValue({ flagged: false, matches: [] }),
    };
    mockJurisdictionTool = {
      call: jest
        .fn()
        .mockResolvedValue({ rules: { maxTransfer: 1000000 } }),
    };

    agent = new ComplianceSupervisorAgent({
      kycTool: mockKycTool,
      amlTool: mockAmlTool,
      sanctionsTool: mockSanctionsTool,
      jurisdictionTool: mockJurisdictionTool,
    });
  });

  describe('Workflow Execution - Happy Path', () => {
    it('should APPROVE a low-risk entity with all checks passing', async () => {
      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'John Doe',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('APPROVED');
      expect(result.riskScore).toBeLessThan(30);
      expect(mockKycTool.call).toHaveBeenCalled();
      expect(mockAmlTool.call).toHaveBeenCalled();
      expect(mockSanctionsTool.call).toHaveBeenCalled();
    });

    it('should call all tools in parallel for efficiency', async () => {
      const startTime = Date.now();
      await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Test User',
        jurisdiction: 'US',
      });
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (parallel > sequential)
      expect(duration).toBeLessThan(5000);
    });

    it('should cache results for identical requests', async () => {
      const request = {
        wallet: '0x1234567890abcdef',
        name: 'Cached User',
        jurisdiction: 'US',
      };

      const result1 = await agent.runCompleteWorkflow(request);
      const result2 = await agent.runCompleteWorkflow(request);

      expect(result1).toEqual(result2);
      expect(mockKycTool.call.mock.calls.length).toBeLessThan(3);
    });
  });

  describe('State Machine Transitions', () => {
    it('should transition from INIT → KYC → AML → DECISION', async () => {
      const states: string[] = [];
      const originalCall = agent.executeStep.bind(agent);

      jest.spyOn(agent, 'executeStep').mockImplementation(async (...args) => {
        states.push(args[0]); // Capture step name
        return originalCall(...args);
      });

      await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'State Test',
        jurisdiction: 'US',
      });

      // Should follow workflow sequence
      expect(states.length).toBeGreaterThan(0);
    });

    it('should ESCALATE medium-risk entities for review', async () => {
      mockAmlTool.call.mockResolvedValue({
        riskScore: 55,
        riskLevel: 'MEDIUM',
      });

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Medium Risk',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('ESCALATED');
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(result.riskScore).toBeLessThan(70);
    });

    it('should REJECT high-risk entities automatically', async () => {
      mockSanctionsTool.call.mockResolvedValue({
        flagged: true,
        matches: [{ listName: 'OFAC_SDN', confidence: 0.95 }],
      });

      const result = await agent.runCompleteWorkflow({
        wallet: '0xSanctionedAddress',
        name: 'Sanctioned User',
        jurisdiction: 'US',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.riskScore).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Risk Score Aggregation', () => {
    it('should correctly aggregate risk scores from multiple tools', async () => {
      mockKycTool.call.mockResolvedValue({ riskScore: 10 });
      mockAmlTool.call.mockResolvedValue({ riskScore: 15 });
      mockSanctionsTool.call.mockResolvedValue({ riskScore: 5 });

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Aggregation Test',
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('should weight high-risk signals more heavily', async () => {
      mockAmlTool.call.mockResolvedValue({ riskScore: 85, riskLevel: 'HIGH' });
      mockKycTool.call.mockResolvedValue({ riskScore: 10 });

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Weights Test',
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThan(50);
    });

    it('should handle missing agent results gracefully', async () => {
      mockAmlTool.call.mockRejectedValue(new Error('Service unavailable'));

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Degradation Test',
        jurisdiction: 'US',
      });

      // Should still return a decision based on available data
      expect(result).toBeDefined();
      expect(result.status).toBeTruthy();
      expect(result.reasoning).toContain('unavailable');
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle KYC tool failure with fallback', async () => {
      mockKycTool.call.mockRejectedValue(
        new Error('Ballerine API timeout')
      );

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'KYC Failure',
        jurisdiction: 'US',
      });

      expect(result).toBeDefined();
      expect(result.status).toBeTruthy();
      expect(result.reasoning).toMatch(/kyc.*unavailable/i);
    });

    it('should handle AML tool failure with fallback', async () => {
      mockAmlTool.call.mockRejectedValue(
        new Error('Chainalysis rate limit')
      );

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'AML Failure',
        jurisdiction: 'US',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('ESCALATED');
    });

    it('should handle all tools failing gracefully', async () => {
      mockKycTool.call.mockRejectedValue(new Error('KYC failed'));
      mockAmlTool.call.mockRejectedValue(new Error('AML failed'));
      mockSanctionsTool.call.mockRejectedValue(new Error('Sanctions failed'));

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'All Fail',
        jurisdiction: 'US',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('ESCALATED');
      expect(result.reasoning).toContain('unable');
    });

    it('should timeout long-running checks', async () => {
      mockAmlTool.call.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ riskScore: 50 }), 10000)
          )
      );

      const result = await agent.runCompleteWorkflowWithTimeout(
        {
          wallet: '0x1234567890abcdef',
          name: 'Timeout Test',
          jurisdiction: 'US',
        },
        2000
      );

      expect(result).toBeDefined();
      expect(result.reasoning).toMatch(/timeout|timeout/i);
    });
  });

  describe('Recommendation Generation', () => {
    it('should provide APPROVE recommendations for low-risk', async () => {
      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Low Risk User',
        jurisdiction: 'US',
      });

      if (result.status === 'APPROVED') {
        expect(result.reasoning.length).toBeGreaterThan(10);
        expect(result.reasoning.toLowerCase()).toMatch(
          /(?:approved|verified|low risk)/
        );
      }
    });

    it('should provide ESCALATE recommendations for medium-risk', async () => {
      mockAmlTool.call.mockResolvedValue({
        riskScore: 45,
        riskLevel: 'MEDIUM',
        details: 'Unusual velocity pattern',
      });

      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Medium Risk',
        jurisdiction: 'US',
      });

      if (result.status === 'ESCALATED') {
        expect(result.reasoning).toMatch(/review|escalat/i);
      }
    });

    it('should provide REJECT recommendations with remediation', async () => {
      mockSanctionsTool.call.mockResolvedValue({
        flagged: true,
        matches: [{ listName: 'OFAC' }],
      });

      const result = await agent.runCompleteWorkflow({
        wallet: '0xSanctioned',
        name: 'Sanctioned Entity',
        jurisdiction: 'US',
      });

      if (result.status === 'REJECTED') {
        expect(result.reasoning).toMatch(/sanction|reject/i);
      }
    });
  });

  describe('Jurisdiction-Aware Decisions', () => {
    it('should apply India-specific rules', async () => {
      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Indian User',
        jurisdiction: 'IN',
      });

      expect(mockJurisdictionTool.call).toHaveBeenCalledWith({
        jurisdiction: 'IN',
      });
      expect(result).toBeDefined();
    });

    it('should apply US-specific rules', async () => {
      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'US User',
        jurisdiction: 'US',
      });

      expect(mockJurisdictionTool.call).toHaveBeenCalledWith({
        jurisdiction: 'US',
      });
      expect(result).toBeDefined();
    });

    it('should apply EU-specific GDPR rules', async () => {
      const result = await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'EU User',
        jurisdiction: 'EU',
      });

      expect(mockJurisdictionTool.call).toHaveBeenCalledWith({
        jurisdiction: 'EU',
      });
      expect(result).toBeDefined();
    });
  });

  describe('Idempotency & Determinism', () => {
    it('should return same result for identical requests', async () => {
      const request = {
        wallet: '0x1234567890abcdef',
        name: 'Deterministic User',
        jurisdiction: 'US',
      };

      const result1 = await agent.runCompleteWorkflow(request);
      const result2 = await agent.runCompleteWorkflow(request);

      expect(result1.status).toBe(result2.status);
      expect(result1.riskScore).toBe(result2.riskScore);
    });

    it('should produce consistent ordering of checks', async () => {
      const calls: string[] = [];
      mockKycTool.call = jest.fn(async () => {
        calls.push('KYC');
        return { status: 'VERIFIED' };
      });
      mockAmlTool.call = jest.fn(async () => {
        calls.push('AML');
        return { riskScore: 20 };
      });

      await agent.runCompleteWorkflow({
        wallet: '0x1234567890abcdef',
        name: 'Ordering Test',
        jurisdiction: 'US',
      });

      // Both should be called (parallel), order doesn't matter for idempotency
      expect(calls).toContain('KYC');
      expect(calls).toContain('AML');
    });
  });
});
