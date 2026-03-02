/**
 * Unit Tests: DocumentValidationTool & AssetValidationTool
 *
 * Tests rule-based structural analysis, integrity checks, verdict derivation,
 * and error-handling – all without requiring an Anthropic API key.
 */

import crypto from 'crypto';
import {
  DocumentValidationTool,
  initializeDocumentValidationTool,
  DOCUMENT_TYPES,
  DocumentValidationResult,
} from '../../../src/tools/documentValidationTool';
import {
  AssetValidationTool,
  initializeAssetValidationTool,
  ASSET_TYPES,
  AssetValidationResult,
} from '../../../src/tools/assetValidationTool';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ─── DocumentValidationTool ───────────────────────────────────────────────────

describe('DocumentValidationTool', () => {
  let tool: DocumentValidationTool;

  beforeEach(() => {
    // Ensure LLM path is skipped in all tests (no real API key in CI)
    delete process.env.ANTHROPIC_API_KEY;
    tool = initializeDocumentValidationTool();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(tool).toBeDefined();
      expect(tool).toBeInstanceOf(DocumentValidationTool);
      expect(tool.name).toBe('document_validation');
    });

    it('should have a descriptive help text', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.description.toLowerCase()).toContain('document');
    });

    it('should expose all expected document types', () => {
      expect(DOCUMENT_TYPES).toContain('passport');
      expect(DOCUMENT_TYPES).toContain('national_id');
      expect(DOCUMENT_TYPES).toContain('title_deed');
      expect(DOCUMENT_TYPES).toContain('bank_statement');
      expect(DOCUMENT_TYPES).toContain('business_registration');
      expect(DOCUMENT_TYPES).toContain('financial_statement');
    });
  });

  describe('Output format', () => {
    it('should return valid JSON string', async () => {
      const result = await tool._call({
        documentId: 'doc-001',
        documentType: 'passport',
        content: 'Passport issued by UAE Ministry of Interior. Name: Ahmed Al Maktoum.',
        entityName: 'Ahmed Al Maktoum',
        issuerName: 'UAE Ministry of Interior',
        issuerJurisdiction: 'AE',
        issuedDate: '2022-01-01',
        expiryDate: '2032-01-01',
      });
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should include all required result fields', async () => {
      const raw = await tool._call({
        documentId: 'doc-002',
        documentType: 'national_id',
        content: 'National ID issued by India. Name: Priya Sharma. ID: 1234567890.',
        entityName: 'Priya Sharma',
        issuerName: 'Government of India',
        issuerJurisdiction: 'IN',
        issuedDate: '2020-06-15',
      });
      const result: DocumentValidationResult = JSON.parse(raw);

      expect(result).toHaveProperty('documentId', 'doc-002');
      expect(result).toHaveProperty('documentType', 'national_id');
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('authenticityScore');
      expect(result).toHaveProperty('fraudRiskScore');
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('integrityCheck');
      expect(result).toHaveProperty('aiAnalysis');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('timestamp');

      expect(['AUTHENTIC', 'SUSPICIOUS', 'FORGED', 'UNVERIFIABLE']).toContain(result.verdict);
      expect(result.authenticityScore).toBeGreaterThanOrEqual(0);
      expect(result.authenticityScore).toBeLessThanOrEqual(100);
      expect(result.fraudRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.fraudRiskScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.flags)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('AUTHENTIC verdict – clean document', () => {
    it('should return AUTHENTIC for a well-formed, non-expired document', async () => {
      const raw = await tool._call({
        documentId: 'doc-clean',
        documentType: 'passport',
        content: 'Valid passport issued by the United States Department of State. Bearer: John Doe. Passport No: A12345678.',
        entityName: 'John Doe',
        issuerName: 'US Department of State',
        issuerJurisdiction: 'US',
        issuedDate: '2021-03-01',
        expiryDate: '2031-03-01',
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      expect(result.verdict).toBe('AUTHENTIC');
      expect(result.fraudRiskScore).toBeLessThan(35);
    });
  });

  describe('Suspicious keyword detection', () => {
    it('should flag a passport containing "void"', async () => {
      const raw = await tool._call({
        documentId: 'doc-void',
        documentType: 'passport',
        content: 'VOID Passport – this document has been cancelled by the issuing authority.',
        entityName: 'Test User',
        issuerName: 'Test Authority',
        issuerJurisdiction: 'US',
        issuedDate: '2020-01-01',
        expiryDate: '2030-01-01',
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      expect(result.verdict).not.toBe('AUTHENTIC');
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'SUSPICIOUS_KEYWORD')).toBe(true);
    });

    it('should flag a title_deed containing "disputed"', async () => {
      const raw = await tool._call({
        documentId: 'doc-disputed',
        documentType: 'title_deed',
        content: 'This property is under disputed ownership due to ongoing litigation.',
        entityName: 'Jane Doe',
        issuerName: 'Dubai Land Department',
        issuerJurisdiction: 'AE',
        issuedDate: '2019-05-10',
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'SUSPICIOUS_KEYWORD')).toBe(true);
    });
  });

  describe('Date validation', () => {
    it('should flag a document with a future issuedDate', async () => {
      const raw = await tool._call({
        documentId: 'doc-future',
        documentType: 'national_id',
        content: 'National ID with a future issue date. Name: Test Person.',
        entityName: 'Test Person',
        issuerName: 'Government Agency',
        issuerJurisdiction: 'IN',
        issuedDate: '2099-01-01',
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'FUTURE_ISSUED_DATE')).toBe(true);
      expect(result.verdict).not.toBe('AUTHENTIC');
    });

    it('should flag an expired document', async () => {
      const raw = await tool._call({
        documentId: 'doc-expired',
        documentType: 'passport',
        content: 'Passport issued by Canada. Name: Alice Smith.',
        entityName: 'Alice Smith',
        issuerName: 'Government of Canada',
        issuerJurisdiction: 'CA',
        issuedDate: '2010-01-01',
        expiryDate: '2015-01-01', // expired
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'DOCUMENT_EXPIRED')).toBe(true);
    });

    it('should flag when expiry is before issued date', async () => {
      const raw = await tool._call({
        documentId: 'doc-bad-dates',
        documentType: 'drivers_license',
        content: 'Driver license issued by California DMV. Name: Bob Brown.',
        entityName: 'Bob Brown',
        issuerName: 'California DMV',
        issuerJurisdiction: 'US',
        issuedDate: '2023-06-01',
        expiryDate: '2022-06-01', // before issued
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'EXPIRY_BEFORE_ISSUE')).toBe(true);
    });
  });

  describe('Hash integrity', () => {
    it('should pass hash check when content matches provided SHA-256', async () => {
      const content = 'Bank statement content for hash verification test.';
      const hash = sha256(content);

      const raw = await tool._call({
        documentId: 'doc-hash-ok',
        documentType: 'bank_statement',
        content,
        entityName: 'Test Entity',
        issuerName: 'Test Bank',
        issuerJurisdiction: 'AE',
        issuedDate: '2023-01-01',
        documentHash: hash,
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      expect(result.integrityCheck.hashMatch).toBe(true);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'HASH_MISMATCH')).toBe(false);
    });

    it('should flag HASH_MISMATCH when content does not match hash', async () => {
      const raw = await tool._call({
        documentId: 'doc-hash-fail',
        documentType: 'bank_statement',
        content: 'Tampered bank statement content.',
        entityName: 'Test Entity',
        issuerName: 'Test Bank',
        issuerJurisdiction: 'AE',
        issuedDate: '2023-01-01',
        documentHash: 'a'.repeat(64), // wrong hash
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      expect(result.integrityCheck.hashMatch).toBe(false);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'HASH_MISMATCH')).toBe(true);
      expect(result.verdict).not.toBe('AUTHENTIC');
    });
  });

  describe('Missing required fields', () => {
    it('should flag missing entityName for passport', async () => {
      const raw = await tool._call({
        documentId: 'doc-missing',
        documentType: 'passport',
        content: 'Passport content without entity name',
        issuerName: 'Some Authority',
        issuerJurisdiction: 'US',
        issuedDate: '2020-01-01',
        expiryDate: '2030-01-01',
        // entityName missing
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c.includes('MISSING_FIELD'))).toBe(true);
    });
  });

  describe('All supported document types', () => {
    it.each(DOCUMENT_TYPES as unknown as string[])(
      'should return a valid result for documentType "%s"',
      async (docType) => {
        const raw = await tool._call({
          documentId: `doc-type-${docType}`,
          documentType: docType as any,
          content: `Sample content for ${docType} document validation test.`,
          entityName: 'Test Person',
          issuerName: 'Test Issuer',
          issuerJurisdiction: 'AE',
          issuedDate: '2022-01-01',
        });
        expect(() => JSON.parse(raw)).not.toThrow();
        const result: DocumentValidationResult = JSON.parse(raw);
        expect(['AUTHENTIC', 'SUSPICIOUS', 'FORGED', 'UNVERIFIABLE']).toContain(result.verdict);
      }
    );
  });

  describe('Error handling', () => {
    it('should return UNVERIFIABLE for completely empty content', async () => {
      const raw = await tool._call({
        documentId: 'doc-empty',
        documentType: 'other',
        content: '',
      });
      const result: DocumentValidationResult = JSON.parse(raw);
      expect(result).toBeDefined();
      expect(['AUTHENTIC', 'SUSPICIOUS', 'FORGED', 'UNVERIFIABLE']).toContain(result.verdict);
    });
  });
});

// ─── AssetValidationTool ──────────────────────────────────────────────────────

describe('AssetValidationTool', () => {
  let tool: AssetValidationTool;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    tool = initializeAssetValidationTool();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(tool).toBeDefined();
      expect(tool).toBeInstanceOf(AssetValidationTool);
      expect(tool.name).toBe('asset_validation');
    });

    it('should expose all expected asset types', () => {
      expect(ASSET_TYPES).toContain('real_estate');
      expect(ASSET_TYPES).toContain('tokenized_security');
      expect(ASSET_TYPES).toContain('private_equity_fund');
      expect(ASSET_TYPES).toContain('debt_instrument');
    });
  });

  describe('Output format', () => {
    it('should return valid JSON with required fields', async () => {
      const raw = await tool._call({
        assetId: 'asset-001',
        assetType: 'real_estate',
        assetDescription: 'Residential apartment in Downtown Dubai. 2-bed, 1200 sqft.',
        ownerName: 'Ahmed Al Maktoum',
        ownerJurisdiction: 'AE',
        registryReference: 'DLD-2023-456789',
        registrationDate: '2023-03-15',
        valuationAmount: 1500000,
      });
      const result: AssetValidationResult = JSON.parse(raw);

      expect(result).toHaveProperty('assetId', 'asset-001');
      expect(result).toHaveProperty('assetType', 'real_estate');
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('validityScore');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('flags');
      expect(result).toHaveProperty('integrityCheck');
      expect(result).toHaveProperty('aiAnalysis');
      expect(result).toHaveProperty('recommendations');

      expect(['VALID', 'SUSPICIOUS', 'INVALID', 'UNVERIFIABLE']).toContain(result.verdict);
      expect(result.validityScore).toBeGreaterThanOrEqual(0);
      expect(result.validityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('VALID verdict – clean asset', () => {
    it('should return VALID for a well-formed asset with all fields', async () => {
      const raw = await tool._call({
        assetId: 'asset-clean',
        assetType: 'real_estate',
        assetDescription: 'Registered freehold property at Business Bay Dubai. Clear title.',
        ownerName: 'Priya Sharma',
        ownerJurisdiction: 'AE',
        registryReference: 'DLD-2022-987654',
        registrationDate: '2022-08-01',
        valuationAmount: 2000000,
      });
      const result: AssetValidationResult = JSON.parse(raw);
      expect(result.verdict).toBe('VALID');
      expect(result.riskScore).toBeLessThan(35);
    });
  });

  describe('Suspicious keyword detection', () => {
    it('should flag an asset description containing "disputed"', async () => {
      const raw = await tool._call({
        assetId: 'asset-disputed',
        assetType: 'real_estate',
        assetDescription: 'Property with disputed ownership under active court litigation.',
        ownerName: 'Unknown Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2020-01-01',
        valuationAmount: 500000,
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'SUSPICIOUS_ASSET_KEYWORD')).toBe(true);
    });

    it('should flag "lien" in asset description', async () => {
      const raw = await tool._call({
        assetId: 'asset-lien',
        assetType: 'real_estate',
        assetDescription: 'Property has an outstanding lien from the previous mortgage holder.',
        ownerName: 'Bob Smith',
        ownerJurisdiction: 'US',
        registrationDate: '2019-01-01',
        valuationAmount: 300000,
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'SUSPICIOUS_ASSET_KEYWORD')).toBe(true);
    });
  });

  describe('Valuation checks', () => {
    it('should flag implausibly low valuation for real_estate', async () => {
      const raw = await tool._call({
        assetId: 'asset-lowval',
        assetType: 'real_estate',
        assetDescription: 'Residential property in Dubai Marina. 3-bedroom apartment.',
        ownerName: 'Test Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2021-01-01',
        valuationAmount: 10, // implausibly low
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'IMPLAUSIBLY_LOW_VALUATION')).toBe(true);
    });

    it('should flag zero valuation', async () => {
      const raw = await tool._call({
        assetId: 'asset-zeroval',
        assetType: 'tokenized_security',
        assetDescription: 'Tokenized security representing 1000 units of ABC Fund.',
        ownerName: 'Fund Manager',
        ownerJurisdiction: 'AE',
        registrationDate: '2023-01-01',
        valuationAmount: 0,
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'ZERO_OR_NEGATIVE_VALUATION')).toBe(true);
    });
  });

  describe('Ownership chain validation', () => {
    it('should pass a valid ownership chain where last owner matches ownerName', async () => {
      const raw = await tool._call({
        assetId: 'asset-chain-ok',
        assetType: 'real_estate',
        assetDescription: 'Property with clear chain of title.',
        ownerName: 'Current Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2015-01-01',
        valuationAmount: 750000,
        ownershipChain: [
          { owner: 'Original Developer', transferDate: '2015-01-01' },
          { owner: 'Intermediate Owner', transferDate: '2018-06-01' },
          { owner: 'Current Owner', transferDate: '2022-03-01' },
        ],
      });
      const result: AssetValidationResult = JSON.parse(raw);
      expect(result.integrityCheck.ownershipChainValid).toBe(true);
    });

    it('should flag ownership chain with out-of-order dates', async () => {
      const raw = await tool._call({
        assetId: 'asset-chain-bad',
        assetType: 'real_estate',
        assetDescription: 'Property with questionable chain of title.',
        ownerName: 'Final Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2015-01-01',
        valuationAmount: 500000,
        ownershipChain: [
          { owner: 'Owner A', transferDate: '2018-01-01' },
          { owner: 'Owner B', transferDate: '2016-01-01' }, // before previous transfer
          { owner: 'Final Owner', transferDate: '2022-01-01' },
        ],
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'OWNERSHIP_CHAIN_DATE_INCONSISTENCY')).toBe(true);
      expect(result.integrityCheck.ownershipChainValid).toBe(false);
    });

    it('should flag ownership mismatch between chain last entry and ownerName', async () => {
      const raw = await tool._call({
        assetId: 'asset-chain-mismatch',
        assetType: 'real_estate',
        assetDescription: 'Property where declared owner does not match chain.',
        ownerName: 'Claimed Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2015-01-01',
        valuationAmount: 500000,
        ownershipChain: [
          { owner: 'Original Owner', transferDate: '2015-01-01' },
          { owner: 'Different Person', transferDate: '2020-01-01' }, // not "Claimed Owner"
        ],
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'OWNERSHIP_MISMATCH')).toBe(true);
    });
  });

  describe('Hash integrity', () => {
    it('should pass hash check when content matches provided SHA-256', async () => {
      const content = 'Title deed content for integrity verification.';
      const hash = sha256(content);

      const raw = await tool._call({
        assetId: 'asset-hash-ok',
        assetType: 'real_estate',
        assetDescription: 'Title deed for property in Abu Dhabi.',
        ownerName: 'Property Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2021-01-01',
        valuationAmount: 1000000,
        contentHash: hash,
        contentForHashing: content,
      });
      const result: AssetValidationResult = JSON.parse(raw);
      expect(result.integrityCheck.hashMatch).toBe(true);
    });

    it('should flag ASSET_HASH_MISMATCH for tampered content', async () => {
      const raw = await tool._call({
        assetId: 'asset-hash-fail',
        assetType: 'real_estate',
        assetDescription: 'Title deed for a tampered asset record.',
        ownerName: 'Test Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2021-01-01',
        valuationAmount: 800000,
        contentHash: 'b'.repeat(64), // wrong hash
        contentForHashing: 'original content that has been changed',
      });
      const result: AssetValidationResult = JSON.parse(raw);
      expect(result.integrityCheck.hashMatch).toBe(false);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'ASSET_HASH_MISMATCH')).toBe(true);
    });
  });

  describe('Missing registry reference', () => {
    it('should flag missing registryReference for real_estate', async () => {
      const raw = await tool._call({
        assetId: 'asset-noreg',
        assetType: 'real_estate',
        assetDescription: 'Property without a registry reference number.',
        ownerName: 'Test Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2021-01-01',
        valuationAmount: 500000,
        // registryReference missing
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'MISSING_REGISTRY_REFERENCE')).toBe(true);
    });
  });

  describe('Future registration date', () => {
    it('should flag a future registrationDate as CRITICAL', async () => {
      const raw = await tool._call({
        assetId: 'asset-future',
        assetType: 'real_estate',
        assetDescription: 'Property with a future registration date.',
        ownerName: 'Future Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2099-01-01',
        valuationAmount: 500000,
      });
      const result: AssetValidationResult = JSON.parse(raw);
      const codes = result.flags.map(f => f.code);
      expect(codes.some(c => c === 'FUTURE_REGISTRATION_DATE')).toBe(true);
    });
  });

  describe('All supported asset types', () => {
    it.each(ASSET_TYPES as unknown as string[])(
      'should return a valid result for assetType "%s"',
      async (assetType) => {
        const raw = await tool._call({
          assetId: `asset-type-${assetType}`,
          assetType: assetType as any,
          assetDescription: `Sample description for ${assetType} asset validation test.`,
          ownerName: 'Test Owner',
          ownerJurisdiction: 'AE',
        });
        expect(() => JSON.parse(raw)).not.toThrow();
        const result: AssetValidationResult = JSON.parse(raw);
        expect(['VALID', 'SUSPICIOUS', 'INVALID', 'UNVERIFIABLE']).toContain(result.verdict);
      }
    );
  });
});

// ─── DocumentValidationAgent (via dependency injection) ───────────────────────

describe('DocumentValidationAgent (injected tools)', () => {
  const { DocumentValidationAgent } = require('../../../src/agents/documentValidationAgent');

  it('should return APPROVED when document verdict is AUTHENTIC and no asset', async () => {
    const mockDocTool = {
      call: jest.fn().mockResolvedValue(
        JSON.stringify({
          documentId: 'doc-a1',
          documentType: 'passport',
          verdict: 'AUTHENTIC',
          authenticityScore: 90,
          fraudRiskScore: 10,
          flags: [],
          integrityCheck: { passed: true },
          aiAnalysis: { performed: false, confidence: 0, reasoning: 'mock' },
          recommendations: ['OK'],
          timestamp: new Date().toISOString(),
        })
      ),
    };

    const agent = new DocumentValidationAgent({ documentValidationTool: mockDocTool });
    const result = await agent.validateCombined({
      requestId: 'req-001',
      document: {
        documentId: 'doc-a1',
        documentType: 'passport',
        content: 'Valid passport content',
        entityName: 'John',
        issuerName: 'State Dept',
        issuerJurisdiction: 'US',
        issuedDate: '2021-01-01',
        expiryDate: '2031-01-01',
      },
    });

    expect(result.overallStatus).toBe('APPROVED');
    expect(result.toolsUsed).toContain('document_validation');
    expect(mockDocTool.call).toHaveBeenCalledTimes(1);
  });

  it('should return REJECTED when document verdict is FORGED', async () => {
    const mockDocTool = {
      call: jest.fn().mockResolvedValue(
        JSON.stringify({
          documentId: 'doc-b1',
          documentType: 'passport',
          verdict: 'FORGED',
          authenticityScore: 5,
          fraudRiskScore: 95,
          flags: [{ code: 'SUSPICIOUS_KEYWORD', severity: 'CRITICAL', description: 'void detected' }],
          integrityCheck: { passed: false },
          aiAnalysis: { performed: false, confidence: 0, reasoning: 'mock' },
          recommendations: ['Reject'],
          timestamp: new Date().toISOString(),
        })
      ),
    };

    const agent = new DocumentValidationAgent({ documentValidationTool: mockDocTool });
    const result = await agent.validateCombined({
      requestId: 'req-002',
      document: {
        documentId: 'doc-b1',
        documentType: 'passport',
        content: 'VOID Passport content',
      },
    });

    expect(result.overallStatus).toBe('REJECTED');
  });

  it('should return REJECTED when asset verdict is INVALID', async () => {
    const mockAssetTool = {
      call: jest.fn().mockResolvedValue(
        JSON.stringify({
          assetId: 'asset-c1',
          assetType: 'real_estate',
          verdict: 'INVALID',
          validityScore: 5,
          riskScore: 95,
          flags: [{ code: 'OWNERSHIP_MISMATCH', severity: 'CRITICAL', description: 'mismatch' }],
          integrityCheck: { passed: false },
          aiAnalysis: { performed: false, confidence: 0, reasoning: 'mock' },
          recommendations: ['Reject asset'],
          timestamp: new Date().toISOString(),
        })
      ),
    };

    const agent = new DocumentValidationAgent({ assetValidationTool: mockAssetTool });
    const result = await agent.validateCombined({
      requestId: 'req-003',
      asset: {
        assetId: 'asset-c1',
        assetType: 'real_estate',
        assetDescription: 'Fraudulent property',
        ownerName: 'Wrong Owner',
        ownerJurisdiction: 'AE',
        registrationDate: '2020-01-01',
        valuationAmount: 500000,
      },
    });

    expect(result.overallStatus).toBe('REJECTED');
  });

  it('should return ESCALATED when document verdict is SUSPICIOUS', async () => {
    const mockDocTool = {
      call: jest.fn().mockResolvedValue(
        JSON.stringify({
          documentId: 'doc-d1',
          documentType: 'bank_statement',
          verdict: 'SUSPICIOUS',
          authenticityScore: 55,
          fraudRiskScore: 45,
          flags: [{ code: 'SUSPICIOUS_KEYWORD', severity: 'HIGH', description: 'test' }],
          integrityCheck: { passed: false },
          aiAnalysis: { performed: false, confidence: 0, reasoning: 'mock' },
          recommendations: ['Review needed'],
          timestamp: new Date().toISOString(),
        })
      ),
    };

    const agent = new DocumentValidationAgent({ documentValidationTool: mockDocTool });
    const result = await agent.validateCombined({
      requestId: 'req-004',
      document: {
        documentId: 'doc-d1',
        documentType: 'bank_statement',
        content: 'Suspicious bank statement',
      },
    });

    expect(result.overallStatus).toBe('ESCALATED');
  });

  it('should run document and asset checks in parallel', async () => {
    const callOrder: string[] = [];

    const mockDocTool = {
      call: jest.fn().mockImplementation(() => {
        callOrder.push('doc');
        return Promise.resolve(
          JSON.stringify({
            documentId: 'doc-e1',
            documentType: 'passport',
            verdict: 'AUTHENTIC',
            authenticityScore: 90,
            fraudRiskScore: 10,
            flags: [],
            integrityCheck: { passed: true },
            aiAnalysis: { performed: false, confidence: 0, reasoning: 'mock' },
            recommendations: [],
            timestamp: new Date().toISOString(),
          })
        );
      }),
    };

    const mockAssetTool = {
      call: jest.fn().mockImplementation(() => {
        callOrder.push('asset');
        return Promise.resolve(
          JSON.stringify({
            assetId: 'asset-e1',
            assetType: 'real_estate',
            verdict: 'VALID',
            validityScore: 90,
            riskScore: 10,
            flags: [],
            integrityCheck: { passed: true },
            aiAnalysis: { performed: false, confidence: 0, reasoning: 'mock' },
            recommendations: [],
            timestamp: new Date().toISOString(),
          })
        );
      }),
    };

    const agent = new DocumentValidationAgent({
      documentValidationTool: mockDocTool,
      assetValidationTool: mockAssetTool,
    });

    const result = await agent.validateCombined({
      requestId: 'req-005',
      document: { documentId: 'doc-e1', documentType: 'passport', content: 'Passport content' },
      asset: { assetId: 'asset-e1', assetType: 'real_estate', assetDescription: 'Real estate' },
    });

    expect(result.toolsUsed).toContain('document_validation');
    expect(result.toolsUsed).toContain('asset_validation');
    expect(mockDocTool.call).toHaveBeenCalledTimes(1);
    expect(mockAssetTool.call).toHaveBeenCalledTimes(1);
    // Both 'doc' and 'asset' should have been called (order may vary)
    expect(callOrder).toHaveLength(2);
  });
});
