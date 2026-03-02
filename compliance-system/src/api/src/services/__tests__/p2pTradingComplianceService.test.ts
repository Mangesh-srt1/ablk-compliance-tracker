/**
 * P2P Trading Compliance Service Unit Tests
 * Tests detection of:
 * - Token layering patterns (Company X → Y → Z → sell for fiat)
 * - Hawala-style laundering via token transfers
 * - Custodian bypass risks
 * - Sanctions evasion through P2P transfers
 */

import {
  P2PTradingComplianceService,
  P2PTransferRequest,
} from '../../services/p2pTradingComplianceService';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ADDR_COMPANY_X = '0x1111111111111111111111111111111111111111';
const ADDR_COMPANY_Y = '0x2222222222222222222222222222222222222222';
const ADDR_COMPANY_Z = '0x3333333333333333333333333333333333333333';
const ADDR_SANCTIONED = '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead';
const TOKEN_ID = 'RE-DUBAI-TOKEN-001';

const baseP2PRequest: P2PTransferRequest = {
  fromAddress: ADDR_COMPANY_X,
  toAddress: ADDR_COMPANY_Y,
  tokenId: TOKEN_ID,
  amount: 1000,
  amountUSD: 50000,
  jurisdiction: 'AE',
  isCustodianInvolved: true,
  timestamp: new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('P2PTradingComplianceService', () => {
  let service: P2PTradingComplianceService;

  beforeEach(() => {
    service = new P2PTradingComplianceService();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Happy paths: Low-risk transfers
  // ─────────────────────────────────────────────────────────────────────────

  describe('Low-risk transfers', () => {
    it('✅ should APPROVE custodian-routed transfer with no red flags', async () => {
      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        isCustodianInvolved: true,
        amountUSD: 10000,
      });

      expect(result.status).toBe('APPROVED');
      expect(result.riskScore).toBeLessThan(30);
      expect(result.custodianBypassed).toBe(false);
    });

    it('✅ should return requestId in result', async () => {
      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        requestId: 'P2P-TEST-001',
      });

      expect(result.requestId).toBe('P2P-TEST-001');
    });

    it('✅ should generate requestId if not provided', async () => {
      const result = await service.screenP2PTransfer(baseP2PRequest);

      expect(result.requestId).toBeDefined();
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);
    });

    it('✅ should include all required fields in result', async () => {
      const result = await service.screenP2PTransfer(baseP2PRequest);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('custodianBypassed');
      expect(result).toHaveProperty('layeringRisk');
      expect(result).toHaveProperty('hawalaSuspicion');
      expect(result).toHaveProperty('sanctionsRisk');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('requiredActions');
      expect(result).toHaveProperty('timestamp');
    });

    it('✅ risk score should be between 0 and 100', async () => {
      const result = await service.screenP2PTransfer(baseP2PRequest);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    });

    it('✅ result should include human-readable reasoning', async () => {
      const result = await service.screenP2PTransfer(baseP2PRequest);

      expect(result.reasoning).toBeDefined();
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sanctions Detection
  // ─────────────────────────────────────────────────────────────────────────

  describe('Sanctions detection', () => {
    it('✅ should REJECT transfer from sanctioned address', async () => {
      service.addSanctionedAddress(ADDR_SANCTIONED);

      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        fromAddress: ADDR_SANCTIONED,
      });

      expect(result.status).toBe('REJECTED');
      expect(result.sanctionsRisk.senderFlagged).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(70);
    });

    it('✅ should REJECT transfer to sanctioned address', async () => {
      service.addSanctionedAddress(ADDR_SANCTIONED);

      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        toAddress: ADDR_SANCTIONED,
      });

      expect(result.status).toBe('REJECTED');
      expect(result.sanctionsRisk.recipientFlagged).toBe(true);
    });

    it('✅ should include SAR filing in required actions on sanctions match', async () => {
      service.addSanctionedAddress(ADDR_SANCTIONED);

      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        fromAddress: ADDR_SANCTIONED,
      });

      expect(result.requiredActions).toContainEqual(expect.stringMatching(/SAR/i));
    });

    it('✅ should not flag clean address as sanctioned', async () => {
      const result = await service.screenP2PTransfer(baseP2PRequest);

      expect(result.sanctionsRisk.senderFlagged).toBe(false);
      expect(result.sanctionsRisk.recipientFlagged).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Custodian Bypass Detection
  // ─────────────────────────────────────────────────────────────────────────

  describe('Custodian bypass detection', () => {
    it('✅ should flag custodian bypass in result', async () => {
      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        isCustodianInvolved: false,
      });

      expect(result.custodianBypassed).toBe(true);
    });

    it('✅ should ESCALATE large transfer when custodian is bypassed', async () => {
      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        isCustodianInvolved: false,
        amountUSD: 100000, // $100k without custodian
      });

      expect(['ESCALATED', 'REJECTED']).toContain(result.status);
      expect(result.custodianBypassed).toBe(true);
    });

    it('✅ hawala risk should flag CUSTODIAN_BYPASSED when custodian not involved', async () => {
      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        isCustodianInvolved: false,
        amountUSD: 15000,
      });

      expect(result.hawalaSuspicion.flags).toContain('CUSTODIAN_BYPASSED');
    });

    it('✅ custodian-routed transfer should have lower risk than bypassed transfer', async () => {
      const custodianResult = await service.screenP2PTransfer({
        ...baseP2PRequest,
        isCustodianInvolved: true,
      });

      const service2 = new P2PTradingComplianceService();
      const bypassResult = await service2.screenP2PTransfer({
        ...baseP2PRequest,
        isCustodianInvolved: false,
      });

      expect(custodianResult.riskScore).toBeLessThanOrEqual(bypassResult.riskScore);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Token Layering Detection
  // The scenario: Company X transfers to Company Y,
  // Company Y immediately resells (layering to obscure origin)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Token layering detection', () => {
    it('✅ should not detect layering on first-time transfer with no history', async () => {
      const result = await service.detectLayeringPattern(baseP2PRequest);

      expect(result.detected).toBe(false);
      expect(result.hopCount).toBe(0);
    });

    it('✅ should detect layering when recipient rapidly resells received tokens', async () => {
      const now = new Date();

      // Step 1: Company Y receives tokens from Company X
      await service.screenP2PTransfer({
        ...baseP2PRequest,
        fromAddress: ADDR_COMPANY_X,
        toAddress: ADDR_COMPANY_Y,
        timestamp: new Date(now.getTime() - 2 * 60 * 1000), // 2 minutes ago
      });

      // Step 2: Company Y immediately tries to transfer out (layering!)
      const result = await service.detectLayeringPattern({
        ...baseP2PRequest,
        fromAddress: ADDR_COMPANY_Y,
        toAddress: ADDR_COMPANY_Z,
        timestamp: now,
      });

      expect(result.detected).toBe(true);
      expect(result.hopCount).toBeGreaterThanOrEqual(1);
    });

    it('✅ should increase score with more hops in chain', async () => {
      // First hop
      const singleHopResult = await service.detectLayeringPattern({
        ...baseP2PRequest,
        fromAddress: ADDR_COMPANY_Y,
      });

      // Simulate 3 recent inbound transfers to sender to simulate multiple hops
      const serviceWithHistory = new P2PTradingComplianceService();
      const now = new Date();

      // Simulate X → Y → (3 times)
      for (let i = 0; i < 3; i++) {
        await serviceWithHistory.screenP2PTransfer({
          fromAddress: ADDR_COMPANY_X,
          toAddress: ADDR_COMPANY_Y,
          tokenId: TOKEN_ID,
          amount: 100,
          amountUSD: 5000,
          jurisdiction: 'AE',
          isCustodianInvolved: true,
          timestamp: new Date(now.getTime() - (i + 1) * 60 * 60 * 1000), // 1-3 hours ago
        });
      }

      // Now Y tries to transfer
      const multiHopResult = await serviceWithHistory.detectLayeringPattern({
        ...baseP2PRequest,
        fromAddress: ADDR_COMPANY_Y,
        toAddress: ADDR_COMPANY_Z,
        timestamp: now,
      });

      expect(multiHopResult.score).toBeGreaterThanOrEqual(singleHopResult.score);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Hawala / Illicit Pattern Detection
  // The scenario: tokens used to convert dirty fiat to clean fiat
  // (trafficking proceeds, terrorism financing, hawala)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Hawala pattern detection', () => {
    it('✅ should flag LARGE_P2P_TRANSFER_NO_CUSTODIAN for large custodian-bypass', async () => {
      const result = await service.detectHawalaPattern({
        ...baseP2PRequest,
        isCustodianInvolved: false,
        amountUSD: 25000, // > $10k threshold
      });

      expect(result.flags).toContain('LARGE_P2P_TRANSFER_NO_CUSTODIAN');
    });

    it('✅ should flag HIGH_VALUE_P2P_TRANSFER for very large transfers', async () => {
      const result = await service.detectHawalaPattern({
        ...baseP2PRequest,
        amountUSD: 75000, // > $50k
      });

      expect(result.flags).toContain('HIGH_VALUE_P2P_TRANSFER');
    });

    it('✅ should flag VELOCITY_STRUCTURING_PATTERN for repeated small transfers', async () => {
      const now = new Date();

      // Simulate 3 prior transfers from same sender to same recipient
      for (let i = 0; i < 3; i++) {
        await service.screenP2PTransfer({
          fromAddress: ADDR_COMPANY_X,
          toAddress: ADDR_COMPANY_Y,
          tokenId: TOKEN_ID,
          amount: 100,
          amountUSD: 4999, // Just below typical reporting threshold
          jurisdiction: 'AE',
          isCustodianInvolved: false,
          timestamp: new Date(now.getTime() - (i + 1) * 30 * 60 * 1000),
        });
      }

      const result = await service.detectHawalaPattern({
        ...baseP2PRequest,
        isCustodianInvolved: false,
        amountUSD: 4999,
        timestamp: now,
      });

      expect(result.flags).toContain('VELOCITY_STRUCTURING_PATTERN');
    });

    it('✅ should flag ROUND_NUMBER_P2P_TRANSFER for round numbers without custodian', async () => {
      const result = await service.detectHawalaPattern({
        ...baseP2PRequest,
        isCustodianInvolved: false,
        amountUSD: 10000, // Round number, no custodian
      });

      expect(result.flags).toContain('ROUND_NUMBER_P2P_TRANSFER');
    });

    it('✅ should have lower hawala score for custodian-routed transfers', async () => {
      const [custodianResult, bypassResult] = await Promise.all([
        service.detectHawalaPattern({ ...baseP2PRequest, isCustodianInvolved: true }),
        service.detectHawalaPattern({ ...baseP2PRequest, isCustodianInvolved: false }),
      ]);

      expect(custodianResult.score).toBeLessThan(bypassResult.score);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Custodian Registration
  // ─────────────────────────────────────────────────────────────────────────

  describe('Custodian management', () => {
    it('✅ should register and recognize custodian address', () => {
      const custodianAddr = '0xcccccccccccccccccccccccccccccccccccccccc';

      service.addCustodianAddress(custodianAddr);

      expect(service.isCustodian(custodianAddr)).toBe(true);
    });

    it('✅ should not recognize unregistered address as custodian', () => {
      expect(service.isCustodian(ADDR_COMPANY_X)).toBe(false);
    });

    it('✅ should handle case-insensitive address matching for custodian', () => {
      const custodianAddr = '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

      service.addCustodianAddress(custodianAddr);

      expect(service.isCustodian(custodianAddr.toLowerCase())).toBe(true);
      expect(service.isCustodian(custodianAddr.toUpperCase())).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Idempotency & Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Idempotency & edge cases', () => {
    it('✅ should be deterministic for same input', async () => {
      const request: P2PTransferRequest = {
        ...baseP2PRequest,
        requestId: 'IDEM-P2P-001',
      };

      const result1 = await service.screenP2PTransfer(request);
      // Reset requestId for second call (same service instance)
      const result2 = await service.screenP2PTransfer({ ...request });

      expect(result1.status).toBe(result2.status);
      expect(result1.custodianBypassed).toBe(result2.custodianBypassed);
    });

    it('✅ should handle zero-amount transfer without crashing', async () => {
      const result = await service.screenP2PTransfer({
        ...baseP2PRequest,
        amount: 0,
        amountUSD: 0,
      });

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('✅ required actions should always be an array', async () => {
      const result = await service.screenP2PTransfer(baseP2PRequest);

      expect(Array.isArray(result.requiredActions)).toBe(true);
    });

    it('✅ timestamp should be a Date in result', async () => {
      const result = await service.screenP2PTransfer(baseP2PRequest);

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Full scenario: Company X → Company Y → sell for fiat (hawala/trafficking)
  // The key use case from the problem statement
  // ─────────────────────────────────────────────────────────────────────────

  describe('Full scenario: Token-based money laundering (hawala/trafficking)', () => {
    it('✅ should ESCALATE or REJECT when Company X transfers to Company Y who bypasses custodian', async () => {
      const now = new Date();

      // Step 1: Company X transfers tokens to Company Y
      // (This could be converting dirty fiat into tokens via Company X)
      await service.screenP2PTransfer({
        fromAddress: ADDR_COMPANY_X,
        toAddress: ADDR_COMPANY_Y,
        tokenId: TOKEN_ID,
        amount: 5000,
        amountUSD: 250000,
        jurisdiction: 'AE',
        isCustodianInvolved: false, // Bypassing custodian
        timestamp: new Date(now.getTime() - 10 * 60 * 1000),
      });

      // Step 2: Company Y now tries to sell on platform (layering + custodian bypass)
      const result = await service.screenP2PTransfer({
        fromAddress: ADDR_COMPANY_Y,
        toAddress: ADDR_COMPANY_Z,
        tokenId: TOKEN_ID,
        amount: 5000,
        amountUSD: 250000,
        jurisdiction: 'AE',
        isCustodianInvolved: false, // Still bypassing custodian
        timestamp: now,
      });

      // This pattern (X → Y → sell, all bypassing custodian) should be flagged
      expect(['ESCALATED', 'REJECTED']).toContain(result.status);
      expect(result.custodianBypassed).toBe(true);
      expect(result.riskScore).toBeGreaterThan(25);
    });

    it('✅ should APPROVE same pattern when custodian is properly involved', async () => {
      const now = new Date();

      // Same pattern but with custodian properly routing both transfers
      await service.screenP2PTransfer({
        fromAddress: ADDR_COMPANY_X,
        toAddress: ADDR_COMPANY_Y,
        tokenId: TOKEN_ID,
        amount: 500,
        amountUSD: 5000,  // Small, low-risk amount
        jurisdiction: 'AE',
        isCustodianInvolved: true, // Custodian properly involved
        timestamp: new Date(now.getTime() - 10 * 60 * 1000),
      });

      const result = await service.screenP2PTransfer({
        fromAddress: ADDR_COMPANY_Y,
        toAddress: ADDR_COMPANY_Z,
        tokenId: TOKEN_ID,
        amount: 500,
        amountUSD: 5000,
        jurisdiction: 'AE',
        isCustodianInvolved: true, // Custodian routing settlement
        timestamp: now,
      });

      // With custodian, this is legitimate trading
      expect(result.status).toBe('APPROVED');
    });
  });
});
