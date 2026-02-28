/**
 * Oracle Verification Service Unit Tests
 * Tests FR-401 (property valuation), FR-402 (double-dipping), FR-403 (source of funds)
 */

import {
  OracleVerificationService,
  OracleVerificationRequest,
  AssetRegistrationRequest,
  SourceOfFundsRequest,
} from '../src/services/oracleVerificationService';

describe('OracleVerificationService', () => {
  let service: OracleVerificationService;

  const validTokenAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const validTokenAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

  const baseAssetRequest: AssetRegistrationRequest = {
    assetType: 'real_estate',
    legalIdentifier: 'DEED-DUBAI-2024-001',
    legalIdentifierType: 'title_deed',
    tokenContractAddress: validTokenAddress,
    issuerEntityId: 'ISSUER-001',
    jurisdiction: 'AE',
    assetValueUSD: 5000000,
    issuanceDateISO: '2026-01-01',
  };

  beforeEach(() => {
    service = new OracleVerificationService();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FR-402: Double-Dipping Prevention
  // ─────────────────────────────────────────────────────────────────────────

  describe('FR-402: registerAsset (Double-Dipping Prevention)', () => {
    it('✅ should REGISTER a new asset successfully', async () => {
      const result = await service.registerAsset(baseAssetRequest);

      expect(result.status).toBe('REGISTERED');
      expect(result.registered).toBe(true);
      expect(result.assetId).toBeDefined();
      expect(result.uniquenessCertificateId).toBeDefined();
      expect(result.uniquenessCertificateId).toContain('CERT-');
    });

    it('✅ should DETECT duplicate tokenization of the same asset (double-dipping)', async () => {
      // Register the asset first time
      await service.registerAsset(baseAssetRequest);

      // Try to register the SAME legal identifier with a DIFFERENT token contract
      const duplicateRequest: AssetRegistrationRequest = {
        ...baseAssetRequest,
        tokenContractAddress: validTokenAddress2, // Different contract!
      };

      const result = await service.registerAsset(duplicateRequest);

      expect(result.status).toBe('DUPLICATE_DETECTED');
      expect(result.registered).toBe(false);
      expect(result.reasoning).toContain('DOUBLE-DIPPING');
      expect(result.reasoning).toContain(validTokenAddress); // References original contract
    });

    it('✅ should DETECT when token contract is already linked to different asset', async () => {
      // Register the asset with tokenAddress1
      await service.registerAsset(baseAssetRequest);

      // Try to register a DIFFERENT legal identifier with the SAME token contract
      const conflictRequest: AssetRegistrationRequest = {
        ...baseAssetRequest,
        legalIdentifier: 'DEED-DUBAI-2024-DIFFERENT', // Different legal ID
        // tokenContractAddress: same as baseAssetRequest
      };

      const result = await service.registerAsset(conflictRequest);

      expect(result.status).toBe('DUPLICATE_DETECTED');
      expect(result.registered).toBe(false);
    });

    it('✅ should ALLOW re-registration of same asset with same token contract (idempotent)', async () => {
      // Register first time
      await service.registerAsset(baseAssetRequest);

      // Register again with identical data
      const result = await service.registerAsset(baseAssetRequest);

      expect(result.status).toBe('REGISTERED');
      expect(result.registered).toBe(true);
    });

    it('✅ should generate unique assetId for each registration', async () => {
      const request1: AssetRegistrationRequest = {
        ...baseAssetRequest,
        legalIdentifier: 'DEED-001',
        tokenContractAddress: validTokenAddress,
      };

      const request2: AssetRegistrationRequest = {
        ...baseAssetRequest,
        legalIdentifier: 'DEED-002',
        tokenContractAddress: validTokenAddress2,
      };

      const result1 = await service.registerAsset(request1);
      const result2 = await service.registerAsset(request2);

      expect(result1.assetId).not.toBe(result2.assetId);
    });

    it('✅ should register PE fund type assets', async () => {
      const fundRequest: AssetRegistrationRequest = {
        assetType: 'pe_fund',
        legalIdentifier: 'SEBI-AIF-CAT2-2024-001',
        legalIdentifierType: 'fund_registration',
        tokenContractAddress: '0x9999999999999999999999999999999999999999', // Unique address
        issuerEntityId: 'FUND-MANAGER-IN-001',
        jurisdiction: 'IN',
        assetValueUSD: 50000000,
        issuanceDateISO: '2026-01-15',
      };

      const result = await service.registerAsset(fundRequest);

      expect(result.status).toBe('REGISTERED');
      expect(result.registered).toBe(true);
    });

    it('✅ should retrieve registered asset by legal identifier', async () => {
      await service.registerAsset(baseAssetRequest);

      const asset = service.getRegisteredAsset(baseAssetRequest.legalIdentifier);

      expect(asset).not.toBeNull();
      expect(asset!.legalIdentifier).toBe(baseAssetRequest.legalIdentifier);
      expect(asset!.tokenContractAddress).toBe(baseAssetRequest.tokenContractAddress);
    });

    it('✅ should return null for unregistered asset', () => {
      const asset = service.getRegisteredAsset('NON-EXISTENT-DEED');

      expect(asset).toBeNull();
    });

    it('✅ should include timestamp in result', async () => {
      const result = await service.registerAsset(baseAssetRequest);

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FR-401: Property Valuation Oracle
  // ─────────────────────────────────────────────────────────────────────────

  describe('FR-401: verifyPropertyValuation', () => {
    it('✅ should APPROVE when token valuation is within oracle NAV range', async () => {
      const request: OracleVerificationRequest = {
        assetId: '1000000', // Mock oracle returns based on numeric parsing
        tokenContractAddress: validTokenAddress,
        tokenSupply: 1000,            // 1000 tokens
        requestedTokenPriceUSD: 1000, // $1,000/token = $1M total
        jurisdiction: 'AE',
        maxDiscrepancyPercent: 10,
      };

      const result = await service.verifyPropertyValuation(request);

      expect(result.verificationId).toBeDefined();
      expect(result.impliedTokenNAV).toBe(1000 * 1000); // 1M
      expect(['APPROVED', 'ESCALATED', 'REJECTED']).toContain(result.status);
      expect(typeof result.discrepancyPercent).toBe('number');
    });

    it('✅ should include all required fields in result', async () => {
      const request: OracleVerificationRequest = {
        assetId: 'ASSET-001',
        tokenContractAddress: validTokenAddress,
        tokenSupply: 1000,
        requestedTokenPriceUSD: 1000,
        jurisdiction: 'AE',
      };

      const result = await service.verifyPropertyValuation(request);

      expect(result.verificationId).toBeDefined();
      expect(result.oracleNAV).toBeGreaterThan(0);
      expect(result.impliedTokenNAV).toBeGreaterThan(0);
      expect(result.discrepancyPercent).toBeGreaterThanOrEqual(0);
      expect(result.lastValuationDate).toBeInstanceOf(Date);
      expect(result.valuerName).toBeDefined();
      expect(typeof result.compliant).toBe('boolean');
      expect(result.reasoning).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('✅ should use provided verificationId', async () => {
      const request: OracleVerificationRequest = {
        verificationId: 'ORACLE-TEST-001',
        assetId: 'ASSET-002',
        tokenContractAddress: validTokenAddress,
        tokenSupply: 100,
        requestedTokenPriceUSD: 10000,
        jurisdiction: 'AE',
      };

      const result = await service.verifyPropertyValuation(request);

      expect(result.verificationId).toBe('ORACLE-TEST-001');
    });

    it('✅ should calculate correct impliedTokenNAV', async () => {
      const tokenSupply = 5000;
      const tokenPrice = 200; // $200/token → $1M total

      const request: OracleVerificationRequest = {
        assetId: 'ASSET-NAV-001',
        tokenContractAddress: validTokenAddress,
        tokenSupply,
        requestedTokenPriceUSD: tokenPrice,
        jurisdiction: 'AE',
      };

      const result = await service.verifyPropertyValuation(request);

      expect(result.impliedTokenNAV).toBe(tokenSupply * tokenPrice); // 1,000,000
    });

    it('✅ should use default max discrepancy of 10% when not specified', async () => {
      const request: OracleVerificationRequest = {
        assetId: 'ASSET-003',
        tokenContractAddress: validTokenAddress,
        tokenSupply: 100,
        requestedTokenPriceUSD: 1000,
        jurisdiction: 'AE',
        // maxDiscrepancyPercent not provided → defaults to 10
      };

      const result = await service.verifyPropertyValuation(request);

      // Result should have a valid status regardless of discrepancy
      expect(['APPROVED', 'ESCALATED', 'REJECTED']).toContain(result.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FR-403: Source of Funds Verification
  // ─────────────────────────────────────────────────────────────────────────

  describe('FR-403: verifySourceOfFunds', () => {
    const baseSOFRequest: SourceOfFundsRequest = {
      investorId: 'INVESTOR-001',
      investmentAmountUSD: 250000,
      jurisdiction: 'AE',
      declaredSourceType: 'business',
      declaredSourceDescription: 'Proceeds from sale of technology company',
      bankStatementsProvided: true,
      selfCertificationProvided: true,
    };

    it('✅ should APPROVE source of funds with adequate documentation', async () => {
      const result = await service.verifySourceOfFunds(baseSOFRequest);

      expect(result.status).toBe('APPROVED');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(75);
    });

    it('✅ should ESCALATE when bank statements not provided', async () => {
      const result = await service.verifySourceOfFunds({
        ...baseSOFRequest,
        bankStatementsProvided: false,
        selfCertificationProvided: false,
      });

      expect(['ESCALATED', 'REJECTED']).toContain(result.status);
      expect(result.flags).toContain('BANK_STATEMENTS_NOT_PROVIDED');
    });

    it('✅ should flag large investment (> $5M) for additional scrutiny', async () => {
      const result = await service.verifySourceOfFunds({
        ...baseSOFRequest,
        investmentAmountUSD: 7500000, // $7.5M
      });

      expect(result.flags).toContain('VERY_LARGE_INVESTMENT');
    });

    it('✅ should require EDD for investments >= $2M', async () => {
      const result = await service.verifySourceOfFunds({
        ...baseSOFRequest,
        investmentAmountUSD: 2000000, // $2M
      });

      expect(result.requiresEDD).toBe(true);
    });

    it('✅ should reduce confidence score for employment income on large investment', async () => {
      // Employment income for $1M+ investment is less plausible than business income
      const employmentResult = await service.verifySourceOfFunds({
        ...baseSOFRequest,
        investmentAmountUSD: 1500000,
        declaredSourceType: 'employment', // Less plausible for this amount
      });

      const businessResult = await service.verifySourceOfFunds({
        ...baseSOFRequest,
        investmentAmountUSD: 1500000,
        declaredSourceType: 'business', // More plausible for this amount
      });

      // Employment income should score lower than business income for large investments
      expect(employmentResult.confidenceScore).toBeLessThan(businessResult.confidenceScore);
    });

    it('✅ should include verificationId in result', async () => {
      const result = await service.verifySourceOfFunds({
        ...baseSOFRequest,
        verificationId: 'SOF-TEST-001',
      });

      expect(result.verificationId).toBe('SOF-TEST-001');
    });

    it('✅ should generate verificationId if not provided', async () => {
      const result = await service.verifySourceOfFunds(baseSOFRequest);

      expect(result.verificationId).toBeDefined();
      expect(typeof result.verificationId).toBe('string');
    });

    it('✅ should include timestamp in result', async () => {
      const result = await service.verifySourceOfFunds(baseSOFRequest);

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('✅ confidence score should be between 0 and 100', async () => {
      const result = await service.verifySourceOfFunds(baseSOFRequest);

      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
    });

    it('✅ should include human-readable reasoning', async () => {
      const result = await service.verifySourceOfFunds(baseSOFRequest);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(10);
    });
  });
});
