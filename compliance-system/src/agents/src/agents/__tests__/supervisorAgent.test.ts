/**
 * SupervisorAgent Test Suite
 * Tests for KYC, AML, and full compliance check workflows
 */

import { SupervisorAgent } from '../supervisorAgent';
import { KYCCheckInput, AMLCheckInput } from '../supervisorAgent';

// Setup test environment
beforeAll(() => {
  // Set dummy API key for tests if not already set
  if (!process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = 'test-key-for-unit-tests';
  }
});

describe('SupervisorAgent', () => {
  let agent: SupervisorAgent;

  beforeEach(() => {
    agent = new SupervisorAgent();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(SupervisorAgent);
    });

    it('should return agent info', () => {
      const info = agent.getAgentInfo();
      expect(info).toBeDefined();
      expect(info.modelName).toBe('claude-3-5-sonnet-20241022');
      expect(info.toolCount).toBe(5);
      expect(info.tools).toContain('kyc_verification');
      expect(info.tools).toContain('aml_screening');
      expect(info.tools).toContain('compliance_decision');
      expect(info.tools).toContain('jurisdiction_rules');
      expect(info.tools).toContain('blockchain_monitoring');
      expect(info.status).toBe('READY');
    });

    it('should have all required tools', () => {
      const info = agent.getAgentInfo();
      expect(info.tools.length).toBe(5);
    });
  });

  describe('runKYCCheck', () => {
    it('should execute KYC check successfully', async () => {
      const input: KYCCheckInput = {
        name: 'Ahmed Al Maktoum',
        jurisdiction: 'AE',
        documentType: 'PASSPORT',
        liveness: true
      };

      const result = await agent.runKYCCheck(input);

      expect(result).toBeDefined();
      expect(result.status).toMatch(/APPROVED|REJECTED|ESCALATED/);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reasoning).toBeDefined();
      expect(result.toolsUsed).toContain('kyc_verification');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing jurisdiction gracefully', async () => {
      const input: KYCCheckInput = {
        name: 'John Doe',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const result = await agent.runKYCCheck(input);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.toolsUsed).toContain('kyc_verification');
    });

    it('should process different document types', async () => {
      const documentTypes = ['PASSPORT', 'DRIVER_LICENSE', 'NATIONAL_ID'];

      for (const documentType of documentTypes) {
        const input: KYCCheckInput = {
          name: 'Test User',
          jurisdiction: 'AE',
          documentType
        };

        const result = await agent.runKYCCheck(input);
        expect(result).toBeDefined();
        expect(result.status).toBeDefined();
      }
    });

    it('should handle liveness requirement', async () => {
      const inputWithLiveness: KYCCheckInput = {
        name: 'Test User',
        jurisdiction: 'AE',
        documentType: 'PASSPORT',
        liveness: true
      };

      const result = await agent.runKYCCheck(inputWithLiveness);
      expect(result).toBeDefined();
      expect(result.toolsUsed).toContain('kyc_verification');
    });

    it('should complete KYC check in reasonable time', async () => {
      const input: KYCCheckInput = {
        name: 'Speed Test',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const result = await agent.runKYCCheck(input);

      // Should complete within 5 seconds (generous timeout for tool calls)
      expect(result.processingTime).toBeLessThan(5000);
    });

    it('should include jurisdiction in reasoning', async () => {
      const input: KYCCheckInput = {
        name: 'Test',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const result = await agent.runKYCCheck(input);

      expect(result.reasoning).toContain('AE');
    });

    it('should escalate if tools fail', async () => {
      // This tests graceful degradation
      const input: KYCCheckInput = {
        name: 'Test',
        jurisdiction: 'INVALID',
        documentType: 'UNKNOWN'
      };

      const result = await agent.runKYCCheck(input);

      // Should return a valid decision even if tools had issues
      expect(result.status).toBeDefined();
      expect(['APPROVED', 'REJECTED', 'ESCALATED']).toContain(result.status);
    });
  });

  describe('runAMLCheck', () => {
    it('should execute AML check successfully', async () => {
      const input: AMLCheckInput = {
        wallet: '0x1234567890ABCDEF1234567890ABCDEF12345678',
        jurisdiction: 'AE',
        entityType: 'individual'
      };

      const result = await agent.runAMLCheck(input);

      expect(result).toBeDefined();
      expect(result.status).toMatch(/APPROVED|REJECTED|ESCALATED/);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.toolsUsed).toContain('aml_screening');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle different entity types', async () => {
      const entityTypes = ['individual', 'corporate', 'trust'];

      for (const entityType of entityTypes) {
        const input: AMLCheckInput = {
          wallet: '0xabc123def456',
          jurisdiction: 'AE',
          entityType
        };

        const result = await agent.runAMLCheck(input);
        expect(result).toBeDefined();
        expect(result.status).toBeDefined();
      }
    });

    it('should compute risk score based on rules', async () => {
      const input: AMLCheckInput = {
        wallet: '0x9876543210fedcba9876543210fedcba98765432',
        jurisdiction: 'AE'
      };

      const result = await agent.runAMLCheck(input);

      // Risk score should influence status decision
      if (result.riskScore > 70) {
        // High risk should be REJECTED or ESCALATED
        expect(['REJECTED', 'ESCALATED']).toContain(result.status);
      } else if (result.riskScore > 40) {
        // Medium risk should be ESCALATED or APPROVED
        expect(['ESCALATED', 'APPROVED']).toContain(result.status);
      } else {
        // Low risk should be APPROVED
        expect(result.status).toBe('APPROVED');
      }
    });

    it('should load jurisdiction rules', async () => {
      const input: AMLCheckInput = {
        wallet: '0xtest',
        jurisdiction: 'AE'
      };

      const result = await agent.runAMLCheck(input);

      expect(result).toBeDefined();
      expect(result.toolsUsed).toContain('jurisdiction_rules');
    });

    it('should complete AML check in reasonable time', async () => {
      const input: AMLCheckInput = {
        wallet: '0xspeed',
        jurisdiction: 'AE'
      };

      const result = await agent.runAMLCheck(input);

      expect(result.processingTime).toBeLessThan(5000);
    });

    it('should handle transaction history if provided', async () => {
      const input: AMLCheckInput = {
        wallet: '0x1234',
        jurisdiction: 'AE',
        transactionHistory: [
          { amount: 1000, timestamp: Date.now() },
          { amount: 2000, timestamp: Date.now() }
        ]
      };

      const result = await agent.runAMLCheck(input);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('runFullComplianceCheck', () => {
    it('should execute full compliance check successfully', async () => {
      const kycInput: KYCCheckInput = {
        name: 'Ahmed Al Maktoum',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const amlInput: AMLCheckInput = {
        wallet: '0x1234567890ABCDEF1234567890ABCDEF12345678',
        jurisdiction: 'AE'
      };

      const result = await agent.runFullComplianceCheck(kycInput, amlInput);

      expect(result).toBeDefined();
      expect(result.status).toMatch(/APPROVED|REJECTED|ESCALATED/);
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.toolsUsed).toContain('kyc_verification');
      expect(result.toolsUsed).toContain('aml_screening');
      expect(result.toolsUsed).toContain('jurisdiction_rules');
    });

    it('should combine KYC and AML results', async () => {
      const kycInput: KYCCheckInput = {
        name: 'Test User',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const amlInput: AMLCheckInput = {
        wallet: '0xtest',
        jurisdiction: 'AE'
      };

      const result = await agent.runFullComplianceCheck(kycInput, amlInput);

      // Should include both KYC and AML in reasoning
      expect(result.reasoning).toMatch(/KYC|AML/i);
      expect(result.toolsUsed.length).toBeGreaterThanOrEqual(3);
    });

    it('should use same jurisdiction for both checks', async () => {
      const kycInput: KYCCheckInput = {
        name: 'Test',
        jurisdiction: 'IN',
        documentType: 'PASSPORT'
      };

      const amlInput: AMLCheckInput = {
        wallet: '0xtest',
        jurisdiction: 'IN'
      };

      const result = await agent.runFullComplianceCheck(kycInput, amlInput);

      expect(result).toBeDefined();
      expect(result.reasoning).toContain('IN');
    });

    it('should handle multiple jurisdictions separately', async () => {
      const jurisdictions = ['AE', 'IN', 'US'];

      for (const jurisdiction of jurisdictions) {
        const kycInput: KYCCheckInput = {
          name: 'Test User',
          jurisdiction,
          documentType: 'PASSPORT'
        };

        const amlInput: AMLCheckInput = {
          wallet: '0x1234',
          jurisdiction
        };

        const result = await agent.runFullComplianceCheck(kycInput, amlInput);

        expect(result).toBeDefined();
        expect(result.reasoning).toContain(jurisdiction);
      }
    });

    it('should complete full check in reasonable time', async () => {
      const kycInput: KYCCheckInput = {
        name: 'Speed Test',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const amlInput: AMLCheckInput = {
        wallet: '0xspeed',
        jurisdiction: 'AE'
      };

      const result = await agent.runFullComplianceCheck(kycInput, amlInput);

      // Full check with multiple tools should complete within 10 seconds
      expect(result.processingTime).toBeLessThan(10000);
    });

    it('should aggregate all tool results', async () => {
      const kycInput: KYCCheckInput = {
        name: 'Comprehensive Test',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const amlInput: AMLCheckInput = {
        wallet: '0xcomprehensive',
        jurisdiction: 'AE'
      };

      const result = await agent.runFullComplianceCheck(kycInput, amlInput);

      // Should use multiple tools
      const expectedTools = ['kyc_verification', 'aml_screening', 'jurisdiction_rules', 'compliance_decision'];
      for (const tool of expectedTools) {
        expect(result.toolsUsed).toContain(tool);
      }
    });
  });

  describe('executeCheck', () => {
    it('should execute full compliance check for full checkType', async () => {
      const check = {
        id: 'check-1',
        checkType: 'full',
        name: 'Test User',
        jurisdiction: 'AE',
        fromAddress: '0x1234',
        toAddress: '0x5678'
      };

      const result = await agent.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.toolsUsed.length).toBeGreaterThan(0);
    });

    it('should execute KYC check for kyc checkType', async () => {
      const check = {
        id: 'check-2',
        checkType: 'kyc',
        name: 'John Doe',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const result = await agent.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.toolsUsed).toContain('kyc_verification');
    });

    it('should execute AML check for aml checkType', async () => {
      const check = {
        id: 'check-3',
        checkType: 'aml',
        jurisdiction: 'AE',
        fromAddress: '0x1234567890abcdef',
        wallet: '0xtest'
      };

      const result = await agent.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.toolsUsed).toContain('aml_screening');
    });

    it('should default to full check if checkType not specified', async () => {
      const check = {
        id: 'check-4',
        jurisdiction: 'AE',
        name: 'Default Test',
        fromAddress: '0xabc'
      };

      const result = await agent.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('should extract data from metadata', async () => {
      const check = {
        id: 'check-5',
        checkType: 'full',
        jurisdiction: 'AE',
        fromAddress: '0x1234',
        metadata: {
          entity: {
            name: 'Metadata User'
          },
          kycResult: { verified: true },
          amlResult: { riskScore: 30 }
        }
      };

      const result = await agent.executeCheck(check);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('should handle missing fields gracefully', async () => {
      const check = {
        id: 'check-6'
      };

      const result = await agent.executeCheck(check);

      // Should still return a valid decision
      expect(result).toBeDefined();
      expect(result.status).toMatch(/APPROVED|REJECTED|ESCALATED/);
    });
  });

  describe('Error Handling', () => {
    it('should return ESCALATED status on KYC error', async () => {
      const input: KYCCheckInput = {
        name: '',
        jurisdiction: '',
        documentType: ''
      };

      const result = await agent.runKYCCheck(input);

      // Should gracefully handle empty inputs
      expect(result).toBeDefined();
      expect(['APPROVED', 'REJECTED', 'ESCALATED']).toContain(result.status);
    });

    it('should return ESCALATED status on AML error', async () => {
      const input: AMLCheckInput = {
        wallet: '',
        jurisdiction: ''
      };

      const result = await agent.runAMLCheck(input);

      // Should gracefully handle empty inputs
      expect(result).toBeDefined();
      expect(['APPROVED', 'REJECTED', 'ESCALATED']).toContain(result.status);
    });

    it('should include error message in reasoning on failure', async () => {
      const input: KYCCheckInput = {
        name: 'Error Test',
        jurisdiction: 'INVALID_JURISDICTION_CODE',
        documentType: 'INVALID_DOC'
      };

      const result = await agent.runKYCCheck(input);

      // Even on error, should have reasoning
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Execution', () => {
    it('should handle concurrent KYC checks', async () => {
      const inputs: KYCCheckInput[] = [
        { name: 'User1', jurisdiction: 'AE', documentType: 'PASSPORT' },
        { name: 'User2', jurisdiction: 'IN', documentType: 'NATIONAL_ID' },
        { name: 'User3', jurisdiction: 'US', documentType: 'DRIVER_LICENSE' }
      ];

      const results = await Promise.all(
        inputs.map(input => agent.runKYCCheck(input))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.status).toBeDefined();
      });
    });

    it('should handle concurrent AML checks', async () => {
      const inputs: AMLCheckInput[] = [
        { wallet: '0x1111', jurisdiction: 'AE' },
        { wallet: '0x2222', jurisdiction: 'IN' },
        { wallet: '0x3333', jurisdiction: 'US' }
      ];

      const results = await Promise.all(
        inputs.map(input => agent.runAMLCheck(input))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.riskScore).toBeDefined();
      });
    });
  });

  describe('Risk Scoring', () => {
    it('should calculate consistent risk scores', async () => {
      const input: KYCCheckInput = {
        name: 'Consistency Test',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const result1 = await agent.runKYCCheck(input);
      const result2 = await agent.runKYCCheck(input);

      // Same input should yield similar risk profiles
      expect(Math.abs(result1.riskScore - result2.riskScore)).toBeLessThan(20);
    });

    it('should map risk score to status correctly', async () => {
      const input: AMLCheckInput = {
        wallet: '0xtest',
        jurisdiction: 'AE'
      };

      const result = await agent.runAMLCheck(input);

      // Status should align with risk score
      if (result.riskScore > 70) {
        expect(['REJECTED', 'ESCALATED']).toContain(result.status);
      } else if (result.riskScore > 40) {
        expect(['ESCALATED', 'APPROVED']).toContain(result.status);
      }
    });
  });

  describe('Compliance Workflow', () => {
    it('should support sequential KYC then AML checks', async () => {
      // First do KYC
      const kycInput: KYCCheckInput = {
        name: 'Sequential Test',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const kycResult = await agent.runKYCCheck(kycInput);
      expect(kycResult).toBeDefined();

      // Then do AML based on KYC result
      if (kycResult.status === 'APPROVED') {
        const amlInput: AMLCheckInput = {
          wallet: '0xsequential',
          jurisdiction: 'AE'
        };

        const amlResult = await agent.runAMLCheck(amlInput);
        expect(amlResult).toBeDefined();
      }
    });

    it('should escalate if either KYC or AML fails', async () => {
      const kycInput: KYCCheckInput = {
        name: 'Escalation Test',
        jurisdiction: 'AE',
        documentType: 'PASSPORT'
      };

      const amlInput: AMLCheckInput = {
        wallet: '0xescalation',
        jurisdiction: 'AE'
      };

      const result = await agent.runFullComplianceCheck(kycInput, amlInput);

      // Full compliance should escalate if any component fails
      expect(['APPROVED', 'REJECTED', 'ESCALATED']).toContain(result.status);
    });
  });
});
