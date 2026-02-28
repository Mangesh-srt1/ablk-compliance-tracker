/**
 * PE Tokenization Compliance Service Unit Tests
 * Tests FR-201 (transfer whitelist), FR-202 (holding limits),
 * FR-203 (lock-up), FR-204 (corporate actions)
 */

import {
  PETokenizationComplianceService,
  TokenTransferRequest,
  CorporateActionRequest,
  TokenLifecycle,
} from '../src/services/peTokenizationService';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ADDRESS_1 = '0x1234567890abcdef1234567890abcdef12345678';
const VALID_ADDRESS_2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const TOKEN_ID_1 = 'PE-FUND-AE-001';

const baseTransferRequest: TokenTransferRequest = {
  fromAddress: VALID_ADDRESS_1,
  toAddress: VALID_ADDRESS_2,
  tokenId: TOKEN_ID_1,
  amount: 1000,
  amountUSD: 10000,
  currency: 'USD',
  jurisdiction: 'AE',
  timestamp: new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PETokenizationComplianceService', () => {
  let service: PETokenizationComplianceService;

  beforeEach(() => {
    service = new PETokenizationComplianceService();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FR-201: Token Transfer Compliance
  // ─────────────────────────────────────────────────────────────────────────

  describe('FR-201: checkTransferCompliance', () => {
    it('✅ should REJECT transfer when neither party is KYC verified', async () => {
      const result = await service.checkTransferCompliance(baseTransferRequest);

      expect(result.status).toBe('REJECTED');
      expect(result.checks.kyc_sender.passed).toBe(false);
      expect(result.checks.kyc_recipient.passed).toBe(false);
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('✅ should APPROVE transfer when both parties are KYC verified with low risk', async () => {
      // Add both addresses to whitelist
      service.addToWhitelist(VALID_ADDRESS_1, 'AE', 15);
      service.addToWhitelist(VALID_ADDRESS_2, 'AE', 10);

      const result = await service.checkTransferCompliance(baseTransferRequest);

      expect(result.status).toBe('APPROVED');
      expect(result.checks.kyc_sender.passed).toBe(true);
      expect(result.checks.kyc_recipient.passed).toBe(true);
      expect(result.riskScore).toBeLessThan(30);
    });

    it('✅ should REJECT transfer from restricted jurisdiction (Iran)', async () => {
      service.addToWhitelist(VALID_ADDRESS_1, 'AE', 10);
      service.addToWhitelist(VALID_ADDRESS_2, 'AE', 10);

      const result = await service.checkTransferCompliance({
        ...baseTransferRequest,
        jurisdiction: 'IR', // Iran - restricted
      });

      expect(result.status).toBe('REJECTED');
      expect(result.checks.geofence.passed).toBe(false);
    });

    it('✅ should ESCALATE when high KYC risk scores combined with large transfer amount', async () => {
      // Use elevated KYC risk scores (65 each) which will push composite over 30
      service.addToWhitelist(VALID_ADDRESS_1, 'AE', 65);
      service.addToWhitelist(VALID_ADDRESS_2, 'AE', 65);

      const result = await service.checkTransferCompliance({
        ...baseTransferRequest,
        amountUSD: 100000, // Above $55k AML threshold
      });

      // With elevated KYC risk + AML threshold flag, should be escalated or rejected
      expect(['ESCALATED', 'REJECTED']).toContain(result.status);
    });

    it('✅ should return requestId in result', async () => {
      const result = await service.checkTransferCompliance({
        ...baseTransferRequest,
        requestId: 'TEST-ID-001',
      });

      expect(result.requestId).toBe('TEST-ID-001');
    });

    it('✅ should generate requestId if not provided', async () => {
      const result = await service.checkTransferCompliance(baseTransferRequest);

      expect(result.requestId).toBeDefined();
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);
    });

    it('✅ should include all required check fields in result', async () => {
      const result = await service.checkTransferCompliance(baseTransferRequest);

      expect(result.checks).toHaveProperty('kyc_sender');
      expect(result.checks).toHaveProperty('kyc_recipient');
      expect(result.checks).toHaveProperty('aml');
      expect(result.checks).toHaveProperty('whitelist');
      expect(result.checks).toHaveProperty('holding_limit');
      expect(result.checks).toHaveProperty('lockup');
      expect(result.checks).toHaveProperty('geofence');
    });

    it('✅ should include timestamp in result', async () => {
      const result = await service.checkTransferCompliance(baseTransferRequest);

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('✅ should run checks in parallel (performance < 500ms)', async () => {
      service.addToWhitelist(VALID_ADDRESS_1, 'AE', 10);
      service.addToWhitelist(VALID_ADDRESS_2, 'AE', 10);

      const start = Date.now();
      await service.checkTransferCompliance(baseTransferRequest);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // All checks should complete in < 500ms
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FR-202: Holding Limit Enforcement
  // ─────────────────────────────────────────────────────────────────────────

  describe('FR-202: checkHoldingLimit', () => {
    const lifecycle: TokenLifecycle = {
      tokenId: TOKEN_ID_1,
      fundId: 'FUND-001',
      issuanceDate: new Date(),
      status: 'active',
      jurisdiction: 'AE',
      holdingLimitPercent: 20,        // Max 20% holding
      totalSupply: BigInt(100000),     // 100,000 total tokens
    };

    beforeEach(() => {
      service.registerTokenLifecycle(lifecycle);
    });

    it('✅ should PASS when transfer keeps holding within limit', async () => {
      // Investor currently holds 0, requesting 15,000 = 15% of 100,000
      const result = await service.checkHoldingLimit(VALID_ADDRESS_2, TOKEN_ID_1, 15000);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(0);
    });

    it('✅ should FAIL when transfer would exceed holding limit', async () => {
      // Set current holding to 19,000 (19%)
      service.updateHolding(TOKEN_ID_1, VALID_ADDRESS_2, 19000);

      // Try to add 5,000 more → 24% > 20% limit
      const result = await service.checkHoldingLimit(VALID_ADDRESS_2, TOKEN_ID_1, 5000);

      expect(result.passed).toBe(false);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reason).toContain('holding limit');
    });

    it('✅ should PASS when no holding limit configured', async () => {
      const noLimitLifecycle: TokenLifecycle = {
        ...lifecycle,
        tokenId: 'NO-LIMIT-TOKEN',
        holdingLimitPercent: undefined,
      };
      service.registerTokenLifecycle(noLimitLifecycle);

      const result = await service.checkHoldingLimit(VALID_ADDRESS_2, 'NO-LIMIT-TOKEN', 999999);

      expect(result.passed).toBe(true);
    });

    it('✅ should PASS when token is not registered', async () => {
      const result = await service.checkHoldingLimit(VALID_ADDRESS_2, 'UNKNOWN-TOKEN', 100);

      expect(result.passed).toBe(true);
      // Token not registered → no holding limit configured
      expect(result.reason).toBeDefined();
    });

    it('✅ should track investor holding via getHolding()', () => {
      service.updateHolding(TOKEN_ID_1, VALID_ADDRESS_2, 10000);

      const holding = service.getHolding(TOKEN_ID_1, VALID_ADDRESS_2);

      expect(holding).not.toBeNull();
      expect(holding!.holdingAmount).toBe(10000);
      expect(holding!.holdingPercent).toBe(10); // 10,000/100,000 = 10%
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FR-203: Lock-Up Period Enforcement
  // ─────────────────────────────────────────────────────────────────────────

  describe('FR-203: checkLockupPeriod', () => {
    it('✅ should BLOCK transfer when token is in lock-up period', async () => {
      const futureLockup = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

      service.registerTokenLifecycle({
        tokenId: 'LOCKED-TOKEN',
        fundId: 'FUND-002',
        issuanceDate: new Date(),
        lockupEndDate: futureLockup,
        status: 'locked',
        jurisdiction: 'AE',
        totalSupply: BigInt(100000),
      });

      const result = await service.checkLockupPeriod('LOCKED-TOKEN', VALID_ADDRESS_1);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(100);
      expect(result.reason).toContain('lock-up');
      expect(result.reason).toContain('days remaining');
    });

    it('✅ should ALLOW transfer when lock-up has expired', async () => {
      const pastLockup = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      service.registerTokenLifecycle({
        tokenId: 'UNLOCKED-TOKEN',
        fundId: 'FUND-003',
        issuanceDate: new Date(),
        lockupEndDate: pastLockup,
        status: 'redeemable',
        jurisdiction: 'AE',
        totalSupply: BigInt(100000),
      });

      const result = await service.checkLockupPeriod('UNLOCKED-TOKEN', VALID_ADDRESS_1);

      expect(result.passed).toBe(true);
    });

    it('✅ should ALLOW transfer when no lock-up configured', async () => {
      service.registerTokenLifecycle({
        tokenId: 'NO-LOCKUP-TOKEN',
        fundId: 'FUND-004',
        issuanceDate: new Date(),
        status: 'active',
        jurisdiction: 'AE',
        totalSupply: BigInt(100000),
      });

      const result = await service.checkLockupPeriod('NO-LOCKUP-TOKEN', VALID_ADDRESS_1);

      expect(result.passed).toBe(true);
    });

    it('✅ should BLOCK transfer when cliff vesting has not been reached', async () => {
      const futureCliff = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

      service.registerTokenLifecycle({
        tokenId: 'CLIFF-TOKEN',
        fundId: 'FUND-005',
        issuanceDate: new Date(),
        vestingScheduleType: 'cliff',
        cliffDate: futureCliff,
        status: 'locked',
        jurisdiction: 'AE',
        totalSupply: BigInt(100000),
      });

      const result = await service.checkLockupPeriod('CLIFF-TOKEN', VALID_ADDRESS_1);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('cliff date');
    });

    it('✅ should PASS when token not registered (permissive default)', async () => {
      const result = await service.checkLockupPeriod('UNKNOWN-TOKEN-XYZ', VALID_ADDRESS_1);

      expect(result.passed).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FR-204: Corporate Action Compliance
  // ─────────────────────────────────────────────────────────────────────────

  describe('FR-204a: Dividend Compliance', () => {
    it('✅ should APPROVE valid dividend distribution', async () => {
      const request: CorporateActionRequest = {
        actionType: 'dividend',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        amountUSD: 50000,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.approved).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.withholdingTax).toBe(0); // UAE: 0% withholding
    });

    it('✅ should apply correct withholding tax for India jurisdiction', async () => {
      const request: CorporateActionRequest = {
        actionType: 'dividend',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'IN',
        initiatedBy: VALID_ADDRESS_1,
        amountUSD: 100000,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.withholdingTax).toBe(10); // India: 10%
      expect(result.netAmount).toBeCloseTo(90000, 0); // 100k - 10%
    });

    it('✅ should apply 5% withholding tax for Saudi Arabia', async () => {
      const request: CorporateActionRequest = {
        actionType: 'dividend',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'SA',
        initiatedBy: VALID_ADDRESS_1,
        amountUSD: 100000,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.withholdingTax).toBe(5); // Saudi: 5%
      expect(result.netAmount).toBeCloseTo(95000, 0);
    });
  });

  describe('FR-204b: Redemption Compliance', () => {
    it('✅ should APPROVE standard redemption within limits', async () => {
      // Register token with no lock-up
      service.registerTokenLifecycle({
        tokenId: TOKEN_ID_1,
        fundId: 'FUND-001',
        issuanceDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
        status: 'redeemable',
        jurisdiction: 'AE',
        totalSupply: BigInt(100000),
      });

      const request: CorporateActionRequest = {
        actionType: 'redemption',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        amountUSD: 100000, // $100k - below EDD threshold
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('APPROVED');
    });

    it('✅ should ESCALATE large redemption (> $500k) for EDD review', async () => {
      service.registerTokenLifecycle({
        tokenId: TOKEN_ID_1,
        fundId: 'FUND-001',
        issuanceDate: new Date(),
        status: 'redeemable',
        jurisdiction: 'AE',
        totalSupply: BigInt(100000),
      });

      const request: CorporateActionRequest = {
        actionType: 'redemption',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        amountUSD: 750000, // $750k - above EDD threshold
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('ESCALATED');
      expect(result.complianceNotes).toContainEqual(
        expect.stringContaining('EDD')
      );
    });

    it('✅ should REJECT redemption during lock-up period', async () => {
      const futureLockup = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

      service.registerTokenLifecycle({
        tokenId: 'LOCKED-PE-TOKEN',
        fundId: 'FUND-006',
        issuanceDate: new Date(),
        lockupEndDate: futureLockup,
        status: 'locked',
        jurisdiction: 'AE',
        totalSupply: BigInt(100000),
      });

      const request: CorporateActionRequest = {
        actionType: 'redemption',
        tokenId: 'LOCKED-PE-TOKEN',
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        amountUSD: 50000,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('REJECTED');
      expect(result.reasoning).toContain('lock-up');
    });
  });

  describe('FR-204c: Capital Call Compliance', () => {
    it('✅ should APPROVE standard capital call with proper notice', async () => {
      const noticeSentDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const executionDate = new Date();

      const request: CorporateActionRequest = {
        actionType: 'capital_call',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        capitalCallPercent: 25, // 25% of committed capital
        noticeSentDate,
        executionDate,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('APPROVED');
    });

    it('✅ should REJECT capital call with insufficient notice period (AE requires 10 days)', async () => {
      const noticeSentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // Only 5 days ago
      const executionDate = new Date();

      const request: CorporateActionRequest = {
        actionType: 'capital_call',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        capitalCallPercent: 25,
        noticeSentDate,
        executionDate,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('REJECTED');
      expect(result.reasoning).toContain('notice period');
    });

    it('✅ should ESCALATE unusually large capital call (> 50% of committed)', async () => {
      const noticeSentDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const executionDate = new Date();

      const request: CorporateActionRequest = {
        actionType: 'capital_call',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        capitalCallPercent: 75, // 75% - very large, unusual
        noticeSentDate,
        executionDate,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('ESCALATED');
      expect(result.reasoning).toContain('50%');
    });

    it('✅ should require 21 days notice for India (IN jurisdiction)', async () => {
      const noticeSentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // Only 10 days - insufficient for India
      const executionDate = new Date();

      const request: CorporateActionRequest = {
        actionType: 'capital_call',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'IN',
        initiatedBy: VALID_ADDRESS_1,
        capitalCallPercent: 25,
        noticeSentDate,
        executionDate,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('REJECTED');
      expect(result.reasoning).toContain('21'); // Should mention 21 days
    });

    it('✅ should return actionId in result', async () => {
      const request: CorporateActionRequest = {
        actionId: 'ACTION-TEST-001',
        actionType: 'capital_call',
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
        capitalCallPercent: 10,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.actionId).toBe('ACTION-TEST-001');
    });

    it('✅ should REJECT unknown corporate action type', async () => {
      const request = {
        actionType: 'unknown_action' as any,
        tokenId: TOKEN_ID_1,
        jurisdiction: 'AE',
        initiatedBy: VALID_ADDRESS_1,
      };

      const result = await service.checkCorporateAction(request);

      expect(result.status).toBe('REJECTED');
      expect(result.reasoning).toContain('Unknown');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Idempotency & Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Idempotency & Edge Cases', () => {
    it('✅ should return same result for identical transfer requests (idempotent)', async () => {
      service.addToWhitelist(VALID_ADDRESS_1, 'AE', 10);
      service.addToWhitelist(VALID_ADDRESS_2, 'AE', 10);

      const requestWithId = { ...baseTransferRequest, requestId: 'IDEM-001' };
      const result1 = await service.checkTransferCompliance(requestWithId);
      const result2 = await service.checkTransferCompliance(requestWithId);

      expect(result1.status).toBe(result2.status);
      expect(result1.riskScore).toBe(result2.riskScore);
    });

    it('✅ should handle zero-amount transfer', async () => {
      service.addToWhitelist(VALID_ADDRESS_1, 'AE', 5);
      service.addToWhitelist(VALID_ADDRESS_2, 'AE', 5);

      const result = await service.checkTransferCompliance({
        ...baseTransferRequest,
        amount: 0,
        amountUSD: 0,
      });

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('✅ risk score should be between 0 and 100', async () => {
      const result = await service.checkTransferCompliance(baseTransferRequest);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('✅ result should always include reasoning string', async () => {
      const result = await service.checkTransferCompliance(baseTransferRequest);

      expect(result.reasoning).toBeDefined();
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });
});
