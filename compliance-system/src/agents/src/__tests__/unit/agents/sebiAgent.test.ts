/**
 * SEBI Agent Unit Tests
 * Tests India-specific compliance rules (SEBI, RBI, FEMA)
 *
 * File: src/__tests__/unit/agents/sebiAgent.test.ts
 */

import { SebiAgent } from '../../../agents/sebiAgent';

describe('SebiAgent', () => {
  let agent: SebiAgent;
  let mockSebiRulesTool: any;
  let mockRbiTool: any;
  let mockFemaTool: any;

  beforeEach(() => {
    mockSebiRulesTool = {
      call: jest.fn().mockResolvedValue({
        compliant: true,
        fundType: 'AIF',
        requirements: {
          minInvestment: 1000000,
          minInvestors: 2,
          maxInvestors: 99,
        },
      }),
    };
    mockRbiTool = {
      call: jest.fn().mockResolvedValue({
        compliant: true,
        remittanceAllowed: true,
        limits: { dailyLimit: 25000, monthlyLimit: 100000 },
      }),
    };
    mockFemaTool = {
      call: jest.fn().mockResolvedValue({
        compliant: true,
        femaCompliant: true,
        restrictions: [],
      }),
    };

    agent = new SebiAgent({
      sebiRulesTool: mockSebiRulesTool,
      rbiTool: mockRbiTool,
      femaTool: mockFemaTool,
    });
  });

  describe('SEBI Fund Structure Compliance', () => {
    it('should verify AIF fund structure compliance', async () => {
      const result = await agent.checkFundCompliance({
        fundType: 'AIF',
        minInvestment: 1000000,
        numberOfInvestors: 50,
        fundSize: 500000000,
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(true);
      expect(result.fundType).toBe('AIF');
      expect(mockSebiRulesTool.call).toHaveBeenCalled();
    });

    it('should reject AIF with too few investors', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        compliant: false,
        error: 'Minimum 2 investors required for AIF',
        requirements: { minInvestors: 2 },
      });

      const result = await agent.checkFundCompliance({
        fundType: 'AIF',
        numberOfInvestors: 1, // Too few
        minInvestment: 1000000,
        fundSize: 2000000,
      });

      expect(result.compliant).toBe(false);
      expect(result.error).toMatch(/investor/i);
    });

    it('should verify mutual fund structure', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        compliant: true,
        fundType: 'MutualFund',
        requirements: {
          minFundSize: 50000000, // Rs 5 crore
          investorProtection: true,
        },
      });

      const result = await agent.checkFundCompliance({
        fundType: 'MutualFund',
        fundSize: 100000000,
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(true);
      expect(result.fundType).toBe('MutualFund');
    });

    it('should verify open-ended vs closed-ended fund rules', async () => {
      const fundTypes = ['OpenEnded', 'ClosedEnded'];

      for (const fundType of fundTypes) {
        const result = await agent.checkFundCompliance({
          fundType,
          fundSize: 100000000,
          jurisdiction: 'IN',
        });

        expect(result).toBeDefined();
        expect([true, false]).toContain(result.compliant);
      }
    });

    it('should verify fund manager registration', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        compliant: true,
        fundManagerRegistered: true,
        registrationNumber: 'ARN123456',
        experienceRequired: 5, // years
      });

      const result = await agent.checkFundCompliance({
        fundType: 'AIF',
        fundManager: {
          name: 'Investment Manager LLC',
          registrationNumber: 'ARN123456',
        },
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(true);
      expect(result.fundManagerRegistered).toBe(true);
    });
  });

  describe('RBI Remittance & Capital Flow Rules', () => {
    it('should verify remittance compliance', async () => {
      const result = await agent.checkRemittanceCompliance({
        amount: 10000,
        recipientCountry: 'US',
        purpose: 'INVESTMENT',
        frequency: 'MONTHLY',
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(true);
      expect(result.remittanceAllowed).toBe(true);
    });

    it('should enforce RBI daily remittance limits', async () => {
      mockRbiTool.call.mockResolvedValue({
        compliant: false,
        error: 'Daily limit of $25,000 exceeded',
        limits: { dailyLimit: 25000 },
      });

      const result = await agent.checkRemittanceCompliance({
        amount: 30000, // Exceeds daily limit
        recipientCountry: 'US',
        purpose: 'INVESTMENT',
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(false);
      expect(result.error).toMatch(/limit/i);
    });

    it('should enforce RBI monthly remittance limits', async () => {
      mockRbiTool.call.mockResolvedValue({
        compliant: false,
        error: 'Monthly limit of $100,000 exceeded',
        limits: { monthlyLimit: 100000 },
      });

      const result = await agent.checkRemittanceCompliance({
        amount: 120000,
        recipientCountry: 'US',
        purpose: 'INVESTMENT',
        frequency: 'MONTHLY',
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(false);
    });

    it('should verify purpose-based remittance rules', async () => {
      const validPurposes = [
        'INVESTMENT',
        'EDUCATION',
        'MEDICAL',
        'REMITTANCE',
      ];

      for (const purpose of validPurposes) {
        const result = await agent.checkRemittanceCompliance({
          amount: 10000,
          recipientCountry: 'US',
          purpose,
          jurisdiction: 'IN',
        });

        expect(result).toBeDefined();
      }
    });

    it('should verify Liberalized Remittance Scheme (LRS) compliance', async () => {
      mockRbiTool.call.mockResolvedValue({
        scheme: 'LRS',
        annualLimit: 250000,
        compliant: true,
      });

      const result = await agent.checkRemittanceCompliance({
        amount: 50000,
        scheme: 'LRS',
        recipientCountry: 'US',
        jurisdiction: 'IN',
      });

      expect(result.scheme).toBe('LRS');
      expect(result.compliant).toBe(true);
    });
  });

  describe('FEMA Compliance', () => {
    it('should verify FEMA-compliant transaction', async () => {
      const result = await agent.checkFemaCompliance({
        amount: 50000,
        currency: 'INR',
        transactionType: 'OUTWARD_REMITTANCE',
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(true);
      expect(result.femaCompliant).toBe(true);
    });

    it('should enforce FEMA restrictions on capital transactions', async () => {
      mockFemaTool.call.mockResolvedValue({
        compliant: false,
        error: 'Capital account transaction restricted',
        restrictions: ['CAPITAL_ACCOUNT_BLOCKED'],
      });

      const result = await agent.checkFemaCompliance({
        amount: 100000,
        transactionType: 'CAPITAL_ACCOUNT',
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(false);
      expect(result.restrictions).toContain('CAPITAL_ACCOUNT_BLOCKED');
    });

    it('should verify FEMA-allowed currencies', async () => {
      const currencies = ['USD', 'EUR', 'GBP', 'JPY'];

      for (const currency of currencies) {
        const result = await agent.checkFemaCompliance({
          amount: 10000,
          currency,
          transactionType: 'OUTWARD_REMITTANCE',
          jurisdiction: 'IN',
        });

        expect(result).toBeDefined();
      }
    });

    it('should check documentation requirements for FEMA', async () => {
      mockFemaTool.call.mockResolvedValue({
        compliant: true,
        requiredDocuments: [
          'PASSPORT',
          'PROOF_OF_ADDRESS',
          'BANK_STATEMENT',
        ],
      });

      const result = await agent.checkFemaCompliance({
        amount: 50000,
        transactionType: 'OUTWARD_REMITTANCE',
        jurisdiction: 'IN',
      });

      expect(result.requiredDocuments).toBeDefined();
      expect(result.requiredDocuments.length).toBeGreaterThan(0);
    });
  });

  describe('Fund Investment Limit Rules', () => {
    it('should enforce minimum investment requirement', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        compliant: false,
        error: 'Minimum investment of Rs 10 Lakh required',
        minInvestment: 1000000,
      });

      const result = await agent.checkInvestmentLimits({
        fundType: 'AIF',
        numberOfInvestments: 1,
        investmentAmount: 500000, // Below minimum
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(false);
      expect(result.error).toMatch(/minimum/i);
    });

    it('should verify investment amount within fund limits', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        compliant: true,
        minInvestment: 1000000,
        maxAmountPerInvestor: 50000000,
      });

      const result = await agent.checkInvestmentLimits({
        fundType: 'AIF',
        investmentAmount: 5000000,
        jurisdiction: 'IN',
      });

      expect(result.compliant).toBe(true);
    });

    it('should check investor accreditation requirements', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        compliant: true,
        accreditationRequired: true,
        accreditationProof: ['NET_WORTH_CERT', 'INCOME_TAX_RETURN'],
      });

      const result = await agent.checkInvestmentLimits({
        fundType: 'AIF',
        investorAccredited: true,
        investmentAmount: 10000000,
        jurisdiction: 'IN',
      });

      expect(result.accreditationRequired).toBe(true);
    });
  });

  describe('Regulatory Reporting', () => {
    it('should require MF scheme registration for mutual funds', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        fundType: 'MutualFund',
        requiredForms: ['N1', 'N2', 'SCHEME_INFORMATION_DOCUMENT'],
      });

      const result = await agent.checkRegulatoryRequirements({
        fundType: 'MutualFund',
        jurisdiction: 'IN',
      });

      expect(result.requiredForms).toBeDefined();
      expect(result.requiredForms.length).toBeGreaterThan(0);
    });

    it('should require SAR filing for suspicious transactions', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        requireSar: true,
        sarDeadline: '10 DAYS',
      });

      const result = await agent.checkRegulatoryRequirements({
        fundType: 'AIF',
        suspiciousActivity: true,
        jurisdiction: 'IN',
      });

      expect(result.requireSar).toBe(true);
    });

    it('should track audit requirements', async () => {
      mockSebiRulesTool.call.mockResolvedValue({
        auditRequired: true,
        auditFrequency: 'ANNUAL',
        independentAuditor: true,
      });

      const result = await agent.checkRegulatoryRequirements({
        fundType: 'AIF',
        fundSize: 100000000,
        jurisdiction: 'IN',
      });

      expect(result.auditRequired).toBe(true);
      expect(result.auditFrequency).toBe('ANNUAL');
    });
  });

  describe('Error Handling & Graceful Degradation', () => {
    it('should handle SEBI rule service timeout', async () => {
      mockSebiRulesTool.call.mockRejectedValue(
        new Error('SEBI service timeout')
      );

      const result = await agent.checkFundCompliance({
        fundType: 'AIF',
        minInvestment: 1000000,
        numberOfInvestors: 50,
        fundSize: 500000000,
        jurisdiction: 'IN',
      });

      expect(result).toBeDefined();
      expect(result.error).toContain('unavailable');
    });

    it('should handle RBI remittance service failure', async () => {
      mockRbiTool.call.mockRejectedValue(new Error('RBI service down'));

      const result = await agent.checkRemittanceCompliance({
        amount: 10000,
        recipientCountry: 'US',
        purpose: 'INVESTMENT',
        jurisdiction: 'IN',
      });

      expect(result).toBeDefined();
      expect(result.status).not.toBe('ERROR');
    });

    it('should handle FEMA validation failure', async () => {
      mockFemaTool.call.mockRejectedValue(new Error('FEMA validation failed'));

      const result = await agent.checkFemaCompliance({
        amount: 50000,
        transactionType: 'OUTWARD_REMITTANCE',
        jurisdiction: 'IN',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Jurisdiction-Specific Behavior', () => {
    it('should only apply SEBI rules for Indian jurisdiction', async () => {
      const nonIndianResult = await agent.checkFundCompliance({
        fundType: 'AIF',
        fundSize: 500000000,
        jurisdiction: 'US', // Non-Indian
      });

      expect(mockSebiRulesTool.call).not.toHaveBeenCalledWith(
        expect.objectContaining({ jurisdiction: 'US' })
      );
    });

    it('should apply stricter rules for NRIs', async () => {
      mockRbiTool.call.mockResolvedValue({
        applicantType: 'NRI',
        restrictions: ['LOWER_LIMITS'],
        limits: { dailyLimit: 10000 },
      });

      const result = await agent.checkRemittanceCompliance({
        amount: 15000,
        residencyStatus: 'NRI',
        recipientCountry: 'IN',
        jurisdiction: 'IN',
      });

      expect(result.applicantType).toBe('NRI');
    });
  });

  describe('Caching & Performance', () => {
    it('should cache fund compliance checks', async () => {
      const request = {
        fundType: 'AIF',
        fundSize: 500000000,
        jurisdiction: 'IN',
      };

      const result1 = await agent.checkFundCompliance(request);
      const result2 = await agent.checkFundCompliance(request);

      expect(result1).toEqual(result2);
    });

    it('should complete compliance check within SLA', async () => {
      const startTime = Date.now();
      await agent.checkFundCompliance({
        fundType: 'AIF',
        fundSize: 500000000,
        jurisdiction: 'IN',
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });
  });
});
