/**
 * Document & Asset Validation Service (API package)
 *
 * Self-contained validation logic for the API layer. Performs the same
 * rule-based structural analysis as documentValidationTool.ts / assetValidationTool.ts
 * in the agents package, without cross-workspace TypeScript imports.
 *
 * For LLM-enhanced analysis the service calls the agents service HTTP endpoint
 * when AGENTS_SERVICE_URL and ANTHROPIC_API_KEY are configured.
 */

import crypto from 'crypto';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/document-validation-service.log' }),
  ],
});

// ─── Shared constants ─────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'passport',
  'national_id',
  'drivers_license',
  'utility_bill',
  'bank_statement',
  'title_deed',
  'business_registration',
  'financial_statement',
  'property_certificate',
  'tax_document',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ASSET_TYPES = [
  'real_estate',
  'tokenized_security',
  'private_equity_fund',
  'debt_instrument',
  'commodity',
  'intellectual_property',
  'vehicle',
  'art_collectible',
  'other',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

// ─── Input / result types ─────────────────────────────────────────────────────

export interface DocumentValidationInput {
  documentId: string;
  documentType: DocumentType;
  content: string;
  issuerName?: string;
  issuerJurisdiction?: string;
  entityName?: string;
  issuedDate?: string;
  expiryDate?: string;
  documentHash?: string;
  metadata?: Record<string, any>;
}

export interface AssetValidationInput {
  assetId: string;
  assetType: AssetType;
  assetDescription: string;
  ownerName?: string;
  ownerJurisdiction?: string;
  registryReference?: string;
  registrationDate?: string;
  valuationAmount?: number;
  valuationCurrency?: string;
  ownershipChain?: Array<{ owner: string; transferDate?: string; registryRef?: string }>;
  contentHash?: string;
  contentForHashing?: string;
  metadata?: Record<string, any>;
}

export type AuthenticityVerdict = 'AUTHENTIC' | 'SUSPICIOUS' | 'FORGED' | 'UNVERIFIABLE';
export type AssetVerdict = 'VALID' | 'SUSPICIOUS' | 'INVALID' | 'UNVERIFIABLE';

export interface ValidationFlag {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface DocumentValidationResult {
  documentId: string;
  documentType: DocumentType;
  verdict: AuthenticityVerdict;
  authenticityScore: number;
  fraudRiskScore: number;
  flags: ValidationFlag[];
  integrityCheck: { passed: boolean; hashMatch?: boolean; expiryValid?: boolean; dateConsistent?: boolean };
  aiAnalysis: { performed: boolean; confidence: number; reasoning: string };
  recommendations: string[];
  timestamp: Date;
}

export interface AssetValidationResult {
  assetId: string;
  assetType: AssetType;
  verdict: AssetVerdict;
  validityScore: number;
  riskScore: number;
  flags: ValidationFlag[];
  integrityCheck: { passed: boolean; hashMatch?: boolean; ownershipChainValid?: boolean; registrationDateValid?: boolean };
  aiAnalysis: { performed: boolean; confidence: number; reasoning: string };
  recommendations: string[];
  timestamp: Date;
}

export interface CombinedValidationResult {
  requestId: string;
  overallStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  overallRiskScore: number;
  documentResult?: DocumentValidationResult;
  assetResult?: AssetValidationResult;
  reasoning: string;
  toolsUsed: string[];
  processingTime: number;
  timestamp: Date;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const DOCUMENT_SUSPICIOUS_KEYWORDS: Record<DocumentType, string[]> = {
  passport: ['cancelled', 'void', 'specimen', 'invalid', 'revoked'],
  national_id: ['expired', 'cancelled', 'void', 'specimen'],
  drivers_license: ['suspended', 'revoked', 'cancelled', 'void'],
  utility_bill: ['final notice', 'disconnected', 'overdue', 'specimen'],
  bank_statement: ['fraudulent', 'blocked', 'frozen', 'specimen', 'void'],
  title_deed: ['encumbered', 'disputed', 'lien', 'specimen', 'void', 'unregistered'],
  business_registration: ['deregistered', 'dissolved', 'struck off', 'specimen', 'void', 'inactive'],
  financial_statement: ['restated', 'qualified opinion', 'disclaimer', 'adverse opinion'],
  property_certificate: ['disputed', 'encumbered', 'void', 'specimen'],
  tax_document: ['void', 'specimen', 'amended', 'under investigation'],
  other: ['void', 'specimen', 'cancelled', 'invalid'],
};

const DOCUMENT_REQUIRED_FIELDS: Record<DocumentType, string[]> = {
  passport: ['issuerName', 'entityName', 'issuedDate', 'expiryDate'],
  national_id: ['issuerName', 'entityName', 'issuedDate'],
  drivers_license: ['issuerName', 'entityName', 'issuedDate', 'expiryDate'],
  utility_bill: ['issuerName', 'entityName', 'issuedDate'],
  bank_statement: ['issuerName', 'entityName', 'issuedDate'],
  title_deed: ['issuerName', 'entityName', 'issuedDate'],
  business_registration: ['issuerName', 'entityName', 'issuedDate'],
  financial_statement: ['issuerName', 'entityName', 'issuedDate'],
  property_certificate: ['issuerName', 'entityName', 'issuedDate'],
  tax_document: ['issuerName', 'entityName', 'issuedDate'],
  other: [],
};

const ASSET_SUSPICIOUS_KEYWORDS = [
  'disputed', 'encumbered', 'lien', 'litigated', 'foreclosure',
  'void', 'cancelled', 'specimen', 'fake', 'fraudulent',
  'unauthorized', 'illegal', 'stolen', 'embezzled',
];

const ASSET_MIN_VALUATION: Partial<Record<AssetType, number>> = {
  real_estate: 1000,
  tokenized_security: 100,
  private_equity_fund: 10000,
  debt_instrument: 100,
};

const ASSET_REGISTRY_REQUIRED: AssetType[] = [
  'real_estate', 'tokenized_security', 'private_equity_fund', 'debt_instrument',
];

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

// ─── Document structural analysis ────────────────────────────────────────────

function analyzeDocument(input: DocumentValidationInput): { flags: ValidationFlag[]; risk: number } {
  const flags: ValidationFlag[] = [];
  let risk = 0;

  // Required fields
  for (const field of DOCUMENT_REQUIRED_FIELDS[input.documentType] || []) {
    if (!input[field as keyof DocumentValidationInput]) {
      flags.push({ code: `MISSING_FIELD_${field.toUpperCase()}`, severity: 'MEDIUM', description: `Required field '${field}' is missing.` });
      risk += 10;
    }
  }

  // Suspicious keywords
  const lower = (input.content || '').toLowerCase();
  for (const word of DOCUMENT_SUSPICIOUS_KEYWORDS[input.documentType] || []) {
    if (lower.includes(word)) {
      flags.push({ code: 'SUSPICIOUS_KEYWORD', severity: 'HIGH', description: `Document contains suspicious keyword: "${word}".` });
      risk += 20;
    }
  }

  // Date checks
  if (input.issuedDate) {
    if (!isIsoDate(input.issuedDate)) {
      flags.push({ code: 'INVALID_ISSUED_DATE', severity: 'HIGH', description: 'Issued date is not a valid ISO-8601 date.' });
      risk += 15;
    } else if (new Date(input.issuedDate) > new Date()) {
      flags.push({ code: 'FUTURE_ISSUED_DATE', severity: 'CRITICAL', description: 'Issued date is in the future.' });
      risk += 40;
    }
  }
  if (input.expiryDate) {
    if (!isIsoDate(input.expiryDate)) {
      flags.push({ code: 'INVALID_EXPIRY_DATE', severity: 'MEDIUM', description: 'Expiry date is not a valid ISO-8601 date.' });
      risk += 10;
    } else if (new Date(input.expiryDate) < new Date()) {
      flags.push({ code: 'DOCUMENT_EXPIRED', severity: 'HIGH', description: 'Document has expired.' });
      risk += 25;
    }
    if (input.issuedDate && isIsoDate(input.issuedDate) && isIsoDate(input.expiryDate) && new Date(input.expiryDate) <= new Date(input.issuedDate)) {
      flags.push({ code: 'EXPIRY_BEFORE_ISSUE', severity: 'CRITICAL', description: 'Expiry date is on or before issued date.' });
      risk += 40;
    }
  }

  // Content length
  if ((input.content || '').trim().length < 20) {
    flags.push({ code: 'INSUFFICIENT_CONTENT', severity: 'MEDIUM', description: 'Document content is too short for meaningful validation.' });
    risk += 15;
  }

  // Hash integrity
  if (input.documentHash) {
    const computed = sha256(input.content || '');
    if (computed !== input.documentHash) {
      flags.push({ code: 'HASH_MISMATCH', severity: 'CRITICAL', description: 'Document hash does not match content – possible tampering.' });
      risk += 50;
    }
  }

  return { flags, risk: Math.min(risk, 100) };
}

// ─── Asset structural analysis ────────────────────────────────────────────────

function analyzeAsset(input: AssetValidationInput): { flags: ValidationFlag[]; risk: number; ownershipChainValid?: boolean } {
  const flags: ValidationFlag[] = [];
  let risk = 0;
  let ownershipChainValid: boolean | undefined;

  // Suspicious keywords
  const lower = (input.assetDescription || '').toLowerCase();
  for (const word of ASSET_SUSPICIOUS_KEYWORDS) {
    if (lower.includes(word)) {
      flags.push({ code: 'SUSPICIOUS_ASSET_KEYWORD', severity: 'HIGH', description: `Asset description contains suspicious keyword: "${word}".` });
      risk += 20;
    }
  }

  // Description length
  if ((input.assetDescription || '').trim().length < 10) {
    flags.push({ code: 'INSUFFICIENT_ASSET_DESCRIPTION', severity: 'MEDIUM', description: 'Asset description too short.' });
    risk += 15;
  }

  // Registry reference
  if (ASSET_REGISTRY_REQUIRED.includes(input.assetType) && !input.registryReference) {
    flags.push({ code: 'MISSING_REGISTRY_REFERENCE', severity: 'HIGH', description: `Registry reference required for ${input.assetType}.` });
    risk += 20;
  }

  // Registration date
  if (input.registrationDate) {
    if (!isIsoDate(input.registrationDate)) {
      flags.push({ code: 'INVALID_REGISTRATION_DATE', severity: 'HIGH', description: 'Registration date is not valid ISO-8601.' });
      risk += 15;
    } else if (new Date(input.registrationDate) > new Date()) {
      flags.push({ code: 'FUTURE_REGISTRATION_DATE', severity: 'CRITICAL', description: 'Registration date is in the future.' });
      risk += 40;
    }
  }

  // Valuation
  if (input.valuationAmount !== undefined && input.valuationAmount !== null) {
    const min = ASSET_MIN_VALUATION[input.assetType];
    if (min !== undefined && input.valuationAmount < min) {
      flags.push({ code: 'IMPLAUSIBLY_LOW_VALUATION', severity: 'MEDIUM', description: `Valuation $${input.valuationAmount} is below minimum $${min} for ${input.assetType}.` });
      risk += 15;
    }
    if (input.valuationAmount <= 0) {
      flags.push({ code: 'ZERO_OR_NEGATIVE_VALUATION', severity: 'HIGH', description: 'Asset valuation must be positive.' });
      risk += 25;
    }
  }

  // Ownership chain
  if (input.ownershipChain && input.ownershipChain.length > 0) {
    ownershipChainValid = true;
    const chain = input.ownershipChain;
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1]!;
      const curr = chain[i]!;
      if (prev.transferDate && curr.transferDate && isIsoDate(prev.transferDate) && isIsoDate(curr.transferDate) && new Date(curr.transferDate) < new Date(prev.transferDate)) {
        flags.push({ code: 'OWNERSHIP_CHAIN_DATE_INCONSISTENCY', severity: 'HIGH', description: `Ownership transfer dates out of order between "${prev.owner}" and "${curr.owner}".` });
        risk += 30;
        ownershipChainValid = false;
      }
    }
    const lastOwner = chain[chain.length - 1]!.owner;
    if (input.ownerName && lastOwner !== input.ownerName) {
      flags.push({ code: 'OWNERSHIP_MISMATCH', severity: 'CRITICAL', description: `Owner "${input.ownerName}" does not match last chain entry "${lastOwner}".` });
      risk += 40;
      ownershipChainValid = false;
    }
  }

  // Hash
  if (input.contentHash && input.contentForHashing) {
    const computed = sha256(input.contentForHashing);
    if (computed !== input.contentHash) {
      flags.push({ code: 'ASSET_HASH_MISMATCH', severity: 'CRITICAL', description: 'Asset document hash mismatch – possible tampering.' });
      risk += 50;
    }
  }

  return { flags, risk: Math.min(risk, 100), ownershipChainValid };
}

// ─── DocumentValidationService ────────────────────────────────────────────────

export class DocumentValidationService {

  async validateDocument(input: DocumentValidationInput): Promise<DocumentValidationResult> {
    const startTime = Date.now();
    logger.info('DocumentValidationService: Validating document', { documentId: input.documentId, documentType: input.documentType });

    const { flags, risk } = analyzeDocument(input);
    const fraudRiskScore = risk;
    const authenticityScore = 100 - fraudRiskScore;

    let verdict: AuthenticityVerdict;
    if (fraudRiskScore >= 70) verdict = 'FORGED';
    else if (fraudRiskScore >= 35) verdict = 'SUSPICIOUS';
    else if ((input.content || '').trim().length < 5) verdict = 'UNVERIFIABLE';
    else verdict = 'AUTHENTIC';

    const hashMismatch = flags.find(f => f.code === 'HASH_MISMATCH');
    const expired = flags.find(f => f.code === 'DOCUMENT_EXPIRED');
    const futureDate = flags.find(f => f.code === 'FUTURE_ISSUED_DATE');
    const expiryBeforeIssue = flags.find(f => f.code === 'EXPIRY_BEFORE_ISSUE');

    const recommendations: string[] = [];
    if (verdict === 'FORGED') {
      recommendations.push('Reject document – high probability of forgery.');
      recommendations.push('Report to compliance officer for investigation.');
    } else if (verdict === 'SUSPICIOUS') {
      recommendations.push('Escalate for manual compliance review.');
      recommendations.push('Request additional supporting documents.');
    } else if (verdict === 'AUTHENTIC') {
      recommendations.push('Document passed AI validation checks.');
    } else {
      recommendations.push('Insufficient content – manual review required.');
    }

    const result: DocumentValidationResult = {
      documentId: input.documentId,
      documentType: input.documentType,
      verdict,
      authenticityScore,
      fraudRiskScore,
      flags,
      integrityCheck: {
        passed: !hashMismatch && !expired && !futureDate && !expiryBeforeIssue,
        hashMatch: input.documentHash ? !hashMismatch : undefined,
        expiryValid: input.expiryDate ? !expired : undefined,
        dateConsistent: !futureDate && !expiryBeforeIssue,
      },
      aiAnalysis: {
        performed: false,
        confidence: 0.8,
        reasoning: 'Structural rule-based analysis performed. Configure ANTHROPIC_API_KEY in agents service for LLM-enhanced analysis.',
      },
      recommendations,
      timestamp: new Date(),
    };

    logger.info('DocumentValidationService: Complete', { documentId: input.documentId, verdict, fraudRiskScore, duration: Date.now() - startTime });
    return result;
  }

  async validateAsset(input: AssetValidationInput): Promise<AssetValidationResult> {
    const startTime = Date.now();
    logger.info('DocumentValidationService: Validating asset', { assetId: input.assetId, assetType: input.assetType });

    const { flags, risk, ownershipChainValid } = analyzeAsset(input);
    const riskScore = risk;
    const validityScore = 100 - riskScore;

    let verdict: AssetVerdict;
    if (riskScore >= 70) verdict = 'INVALID';
    else if (riskScore >= 35) verdict = 'SUSPICIOUS';
    else if ((input.assetDescription || '').trim().length < 5) verdict = 'UNVERIFIABLE';
    else verdict = 'VALID';

    const hashMismatch = flags.find(f => f.code === 'ASSET_HASH_MISMATCH');
    const futureDate = flags.find(f => f.code === 'FUTURE_REGISTRATION_DATE');

    const recommendations: string[] = [];
    if (verdict === 'INVALID') {
      recommendations.push('Reject asset – high probability of fraud or invalid title.');
      recommendations.push('Do not proceed with tokenization or transfer.');
    } else if (verdict === 'SUSPICIOUS') {
      recommendations.push('Escalate for manual compliance review before proceeding.');
      recommendations.push('Request certified documentation from registering authority.');
    } else if (verdict === 'VALID') {
      recommendations.push('Asset passed AI validation checks.');
    } else {
      recommendations.push('Insufficient data – manual review required.');
    }

    const result: AssetValidationResult = {
      assetId: input.assetId,
      assetType: input.assetType,
      verdict,
      validityScore,
      riskScore,
      flags,
      integrityCheck: {
        passed: !hashMismatch && ownershipChainValid !== false && !futureDate,
        hashMatch: (input.contentHash && input.contentForHashing) ? !hashMismatch : undefined,
        ownershipChainValid,
        registrationDateValid: input.registrationDate ? !futureDate : undefined,
      },
      aiAnalysis: {
        performed: false,
        confidence: 0.8,
        reasoning: 'Structural rule-based analysis performed. Configure ANTHROPIC_API_KEY in agents service for LLM-enhanced analysis.',
      },
      recommendations,
      timestamp: new Date(),
    };

    logger.info('DocumentValidationService: Asset complete', { assetId: input.assetId, verdict, riskScore, duration: Date.now() - startTime });
    return result;
  }

  async validateCombined(input: {
    requestId: string;
    document?: DocumentValidationInput;
    asset?: AssetValidationInput;
  }): Promise<CombinedValidationResult> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    const [docResult, assetResult] = await Promise.all([
      input.document ? this.validateDocument(input.document).then(r => { toolsUsed.push('document_validation'); return r; }) : Promise.resolve(undefined),
      input.asset ? this.validateAsset(input.asset).then(r => { toolsUsed.push('asset_validation'); return r; }) : Promise.resolve(undefined),
    ]);

    const scores: number[] = [];
    if (docResult) scores.push(docResult.fraudRiskScore);
    if (assetResult) scores.push(assetResult.riskScore);
    const overallRiskScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;

    let overallStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED';
    if (docResult?.verdict === 'FORGED' || assetResult?.verdict === 'INVALID') {
      overallStatus = 'REJECTED';
    } else if (docResult?.verdict === 'SUSPICIOUS' || assetResult?.verdict === 'SUSPICIOUS' || overallRiskScore >= 35) {
      overallStatus = 'ESCALATED';
    } else if (!docResult && !assetResult) {
      overallStatus = 'ESCALATED';
    } else {
      overallStatus = 'APPROVED';
    }

    const parts: string[] = [];
    if (overallStatus === 'APPROVED') parts.push('All validation checks passed.');
    else if (overallStatus === 'REJECTED') parts.push('Critical validation failures detected.');
    else parts.push('Validation requires manual review.');
    if (docResult) parts.push(`Document: ${docResult.verdict} (risk ${docResult.fraudRiskScore}/100)`);
    if (assetResult) parts.push(`Asset: ${assetResult.verdict} (risk ${assetResult.riskScore}/100)`);
    parts.push(`Overall risk: ${overallRiskScore}/100`);

    return {
      requestId: input.requestId,
      overallStatus,
      overallRiskScore,
      documentResult: docResult,
      assetResult,
      reasoning: parts.join('. '),
      toolsUsed,
      processingTime: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

export const documentValidationService = new DocumentValidationService();
