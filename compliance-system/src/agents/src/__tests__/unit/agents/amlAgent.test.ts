/**
 * AML Agent Unit Tests
 * Tests AML risk scoring with Marble and Chainalysis integration
 *
 * File: src/__tests__/unit/agents/amlAgent.test.ts
 */

import { AMLAgent as AmlAgent } from '../../../agents/amlAgent';

describe('AmlAgent', () => {
  let agent: AmlAgent;
  let mockMarbleTool: any;
  let mockChainalysisTool: any;
  let mockVelocityTool: any;

  beforeEach(() => {
    mockMarbleTool = {
      call: jest.fn().mockResolvedValue({
        riskScore: 25,
        riskLevel: 'LOW',
        flags: [],
      }),
    };
    mockChainalysisTool = {
      call: jest.fn().mockResolvedValue({
        sanctioned: false,
        pep: false,
        matches: [],
      }),
    };
    mockVelocityTool = {
      call: jest.fn().mockResolvedValue({
        transactions30day: 5,
        anomalyScore: 0.1,
        normal: true,
      }),
    };

    agent = new AmlAgent({
      marbleTool: mockMarbleTool,
      chainalysisTool: mockChainalysisTool,
      velocityTool: mockVelocityTool,
    });
  });

  describe('Risk Scoring - Happy Path', () => {
    it('should assign LOW risk for verified users', async () => {
      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });

      expect(result.riskLevel).toBe('LOW');
      expect(result.riskScore).toBeLessThan(30);
    });

    it('should assess MEDIUM risk for moderately suspicious activity', async () => {
      mockMarbleTool.call.mockResolvedValue({
        riskScore: 50,
        riskLevel: 'MEDIUM',
        flags: ['unusual_velocity'],
      });

      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 50000,
        jurisdiction: 'US',
      });

      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
      expect(result.riskScore).toBeLessThan(70);
    });

    it('should assign HIGH risk for serious flags', async () => {
      mockChainalysisTool.call.mockResolvedValue({
        sanctioned: true,
        pep: true,
        matches: ['OFAC_SDN', 'UK_SANCTIONS'],
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xSanctionedWallet',
        transactionAmount: 100000,
        jurisdiction: 'US',
      });

      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.riskScore).toBeGreaterThanOrEqual(70);
    });

    it('should call all risk assessment tools in parallel', async () => {
      const startTime = Date.now();
      await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });
      const duration = Date.now() - startTime;

      expect(mockMarbleTool.call).toHaveBeenCalled();
      expect(mockChainalysisTool.call).toHaveBeenCalled();
      expect(mockVelocityTool.call).toHaveBeenCalled();
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Sanctions & PEP Detection', () => {
    it('should detect OFAC-sanctioned wallets', async () => {
      mockChainalysisTool.call.mockResolvedValue({
        sanctioned: true,
        sanctions_list: 'OFAC_SDN',
        confidence: 0.98,
        pep: false,
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xSanctionedWallet',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(70);
      expect(result.reasoning).toMatch(/sanction/i);
    });

    it('should detect PEP (Politically Exposed Persons)', async () => {
      mockChainalysisTool.call.mockResolvedValue({
        sanctioned: false,
        pep: true,
        pepLevel: 'HIGH',
        confidence: 0.95,
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xPepWallet',
        transactionAmount: 100000,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(50);
      expect(result.reasoning).toMatch(/pep/i);
    });

    it('should flag UN Security Council sanctions', async () => {
      mockChainalysisTool.call.mockResolvedValue({
        sanctioned: true,
        sanctions_list: 'UN_SECURITY_COUNCIL',
        confidence: 0.99,
        pep: false,
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xUnSanctionedWallet',
        transactionAmount: 50000,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(80);
    });

    it('should handle multiple sanctions list matches', async () => {
      mockChainalysisTool.call.mockResolvedValue({
        sanctioned: true,
        sanctions_lists: ['OFAC_SDN', 'UK_SANCTIONS', 'EU_SANCTIONS'],
        pep: true,
        confidence: 0.99,
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xHighRiskWallet',
        transactionAmount: 100000,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBe(100);
      expect(result.riskLevel).toBe('CRITICAL');
    });
  });

  describe('Velocity & Pattern Analysis', () => {
    it('should detect unusual transaction velocity', async () => {
      mockVelocityTool.call.mockResolvedValue({
        transactions30day: 150, // Unusually high
        avgTransactionsPerDay: 5,
        anomalyScore: 0.85,
        normal: false,
        pattern: 'SPIKE',
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xHighVelocityWallet',
        transactionAmount: 100000,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThan(40);
      expect(result.reasoning).toMatch(/velocity|unusual/i);
    });

    it('should detect burst patterns', async () => {
      mockVelocityTool.call.mockResolvedValue({
        transactions30day: 100,
        lastHourTransactions: 50, // Burst
        anomalyScore: 0.9,
        pattern: 'BURST',
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xBurstWallet',
        transactionAmount: 50000,
        jurisdiction: 'US',
      });

      expect(result.reasoning).toMatch(/burst|spike/i);
    });

    it('should detect round-trip transactions', async () => {
      mockVelocityTool.call.mockResolvedValue({
        pattern: 'ROUND_TRIP',
        anomalyScore: 0.7,
        description: 'Funds sent and returned within 24h',
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xRoundTripWallet',
        transactionAmount: 75000,
        jurisdiction: 'US',
      });

      expect(result.reasoning).toMatch(/round.trip|circular/i);
    });

    it('should detect structuring patterns', async () => {
      mockVelocityTool.call.mockResolvedValue({
        pattern: 'STRUCTURING',
        transactionSizes: [9999, 9999, 9999, 9999], // Just under $10k threshold
        anomalyScore: 0.95,
        description: 'Multiple transactions below reporting threshold',
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xStructuringWallet',
        transactionAmount: 9999,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThan(60);
      expect(result.reasoning).toMatch(/structur/i);
    });

    it('should identify normal transaction patterns', async () => {
      mockVelocityTool.call.mockResolvedValue({
        transactions30day: 3,
        pattern: 'NORMAL',
        anomalyScore: 0.05,
        normal: true,
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xNormalWallet',
        transactionAmount: 5000,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeLessThan(30);
    });
  });

  describe('Transaction Amount Analysis', () => {
    it('should flag unusually large transactions', async () => {
      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 1000000, // $1M
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThan(40);
    });

    it('should apply jurisdiction-specific thresholds', async () => {
      // High amount in US might be threshold; same in India might be normal
      const amount = 50000;
      const jurisdictions = ['US', 'IN', 'AE'];

      for (const jurisdiction of jurisdictions) {
        const result = await agent.assessAmlRisk({
          wallet: '0x1234567890abcdef',
          transactionAmount: amount,
          jurisdiction,
        });

        expect(result).toBeDefined();
      }
    });

    it('should combine amount analysis with velocity', async () => {
      mockVelocityTool.call.mockResolvedValue({
        transactions30day: 100,
        avgAmount: 50000,
        anomalyScore: 0.8,
      });

      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 100000,
        jurisdiction: 'US',
      });

      expect(result.riskScore).toBeGreaterThan(50);
    });
  });

  describe('Error Handling & Graceful Degradation', () => {
    it('should handle Marble API timeout', async () => {
      mockMarbleTool.call.mockRejectedValue(
        new Error('Marble API timeout after 30s')
      );

      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });

      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.reasoning).toContain('unavailable');
    });

    it('should handle Chainalysis API failure', async () => {
      mockChainalysisTool.call.mockRejectedValue(
        new Error('Chainalysis rate limit exceeded')
      );

      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 50000,
        jurisdiction: 'US',
      });

      expect(result).toBeDefined();
      expect([
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL',
      ]).toContain(result.riskLevel);
    });

    it('should gracefully degrade with partial tool failures', async () => {
      mockMarbleTool.call.mockRejectedValue(new Error('Timeout'));
      mockChainalysisTool.call.mockResolvedValue({
        sanctioned: false,
        pep: false,
      });
      mockVelocityTool.call.mockResolvedValue({
        anomalyScore: 0.2,
        normal: true,
      });

      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });

      expect(result).toBeDefined();
      expect(result.status).not.toBe('ERROR');
    });

    it('should use cached risk data on tool failure', async () => {
      // First call succeeds
      await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });

      // Second call with all tools failing should use cache
      mockMarbleTool.call.mockRejectedValue(new Error('Failed'));
      mockChainalysisTool.call.mockRejectedValue(new Error('Failed'));
      mockVelocityTool.call.mockRejectedValue(new Error('Failed'));

      const result = await agent.assessAmlRisk(
        {
          wallet: '0x1234567890abcdef',
          transactionAmount: 10000,
          jurisdiction: 'US',
        },
        { useCache: true }
      );

      expect(result).toBeDefined();
      expect(result.fromCache).toBe(true);
    });
  });

  describe('Jurisdiction-Specific Rules', () => {
    it('should apply stricter thresholds for high-risk jurisdictions', async () => {
      const highRiskJurisdictions = ['IR', 'SY', 'NK']; // Iran, Syria, North Korea

      for (const jurisdiction of highRiskJurisdictions) {
        const result = await agent.assessAmlRisk({
          wallet: '0x1234567890abcdef',
          transactionAmount: 5000, // Low amount
          jurisdiction,
        });

        // Should be higher risk due to jurisdiction
        expect(result.riskScore).toBeGreaterThan(50);
      }
    });

    it('should enforce FATF high-risk country rules', async () => {
      const fatfCountries = ['AZ', 'BA', 'BY', 'MM', 'IR'];

      for (const jurisdiction of fatfCountries) {
        const result = await agent.assessAmlRisk({
          wallet: '0x1234567890abcdef',
          transactionAmount: 10000,
          jurisdiction,
        });

        expect(result).toBeDefined();
      }
    });
  });

  describe('Compliance & Reporting', () => {
    it('should generate SAR-ready report for HIGH risk', async () => {
      mockChainalysisTool.call.mockResolvedValue({
        sanctioned: false,
        pep: true,
        confidence: 0.9,
      });
      mockMarbleTool.call.mockResolvedValue({
        riskScore: 75,
        riskLevel: 'HIGH',
      });

      const result = await agent.assessAmlRisk({
        wallet: '0xHighRiskWallet',
        transactionAmount: 100000,
        jurisdiction: 'US',
      });

      expect(result.sarReady).toBe(true);
      expect(result.suggestedAction).toBe('REPORT_SAR');
    });

    it('should generate audit trail for all assessments', async () => {
      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });

      expect(result.auditTrail).toBeDefined();
      expect(result.auditTrail.timestamp).toBeDefined();
      expect(result.auditTrail.assessor).toBeDefined();
      expect(result.auditTrail.toolsUsed).toContain('Marble');
      expect(result.auditTrail.toolsUsed).toContain('Chainalysis');
    });

    it('should provide remediation recommendations', async () => {
      mockMarbleTool.call.mockResolvedValue({
        riskScore: 45,
        riskLevel: 'MEDIUM',
        recommendation: 'Enhanced due diligence required',
      });

      const result = await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 50000,
        jurisdiction: 'US',
      });

      expect(result.suggestedAction).toBeDefined();
      expect(result.remediation).toBeDefined();
    });
  });

  describe('Caching & Performance', () => {
    it('should cache assessment results', async () => {
      const request = {
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      };

      const result1 = await agent.assessAmlRisk(request);
      const result2 = await agent.assessAmlRisk(request);

      expect(result1).toEqual(result2);
      expect(mockMarbleTool.call.mock.calls.length).toBeLessThan(3);
    });

    it('should complete assessment within SLA', async () => {
      const startTime = Date.now();
      await agent.assessAmlRisk({
        wallet: '0x1234567890abcdef',
        transactionAmount: 10000,
        jurisdiction: 'US',
      });
      const duration = Date.now() - startTime;

      // Should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });
});
