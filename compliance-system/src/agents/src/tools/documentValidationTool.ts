/**
 * Document Validation Tool – LangChain StructuredTool
 *
 * AI-powered authenticity verification for compliance documents (passport,
 * national ID, title deed, business registration, financial statements, etc.).
 *
 * Analysis pipeline:
 *  1. Structural / metadata consistency checks (rule-based, always runs)
 *  2. LLM-enhanced semantic analysis via Anthropic Claude (when available)
 *  3. Weighted fraud-score aggregation → verdict: AUTHENTIC | SUSPICIOUS | FORGED
 *
 * Follows the same StructuredTool pattern used by kycTool.ts and amlTool.ts.
 */

import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import crypto from 'crypto';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/document-validation-tool.log' }),
  ],
});

// ─── Supported document types ────────────────────────────────────────────────

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

// ─── Zod schema ───────────────────────────────────────────────────────────────

const DocumentValidationInputSchema = z.object({
  documentId: z.string().describe('Unique identifier for the document submission'),
  documentType: z
    .enum(DOCUMENT_TYPES)
    .describe('Type of document being validated'),
  content: z
    .string()
    .describe(
      'Document text content extracted via OCR, or base-64 encoded raw content'
    ),
  issuerName: z
    .string()
    .optional()
    .describe('Claimed issuing authority (e.g. "Dubai Land Department")'),
  issuerJurisdiction: z
    .string()
    .optional()
    .describe('Jurisdiction of the issuing authority (AE, IN, US, EU …)'),
  entityName: z
    .string()
    .optional()
    .describe('Name of the individual / entity the document belongs to'),
  issuedDate: z
    .string()
    .optional()
    .describe('ISO-8601 date on which the document was issued'),
  expiryDate: z
    .string()
    .optional()
    .describe('ISO-8601 expiry date, if applicable'),
  documentHash: z
    .string()
    .optional()
    .describe('SHA-256 hash of the original document file for integrity checks'),
  metadata: z.record(z.any()).optional().describe('Additional key-value metadata'),
});

export type DocumentValidationInput = z.infer<typeof DocumentValidationInputSchema>;

// ─── Result types ─────────────────────────────────────────────────────────────

export type AuthenticityVerdict = 'AUTHENTIC' | 'SUSPICIOUS' | 'FORGED' | 'UNVERIFIABLE';

export interface DocumentValidationFlag {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface DocumentValidationResult {
  documentId: string;
  documentType: DocumentType;
  verdict: AuthenticityVerdict;
  /** Overall authenticity score: 0 (definitely forged) → 100 (definitely authentic) */
  authenticityScore: number;
  fraudRiskScore: number;
  flags: DocumentValidationFlag[];
  integrityCheck: {
    passed: boolean;
    hashMatch?: boolean;
    expiryValid?: boolean;
    dateConsistent?: boolean;
  };
  aiAnalysis: {
    performed: boolean;
    confidence: number;
    reasoning: string;
  };
  recommendations: string[];
  timestamp: Date;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Keywords that indicate suspicious patterns by document type */
const SUSPICIOUS_KEYWORDS: Record<DocumentType, string[]> = {
  passport: ['cancelled', 'void', 'specimen', 'invalid', 'revoked'],
  national_id: ['expired', 'cancelled', 'void', 'specimen'],
  drivers_license: ['suspended', 'revoked', 'cancelled', 'void'],
  utility_bill: ['final notice', 'disconnected', 'overdue', 'specimen'],
  bank_statement: ['fraudulent', 'blocked', 'frozen', 'specimen', 'void'],
  title_deed: ['encumbered', 'disputed', 'lien', 'specimen', 'void', 'unregistered'],
  business_registration: [
    'deregistered',
    'dissolved',
    'struck off',
    'specimen',
    'void',
    'inactive',
  ],
  financial_statement: ['restated', 'qualified opinion', 'disclaimer', 'adverse opinion'],
  property_certificate: ['disputed', 'encumbered', 'void', 'specimen'],
  tax_document: ['void', 'specimen', 'amended', 'under investigation'],
  other: ['void', 'specimen', 'cancelled', 'invalid'],
};

/** Minimum required fields per document type */
const REQUIRED_FIELDS: Record<DocumentType, string[]> = {
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

function computeSha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/**
 * Rule-based structural analysis – always runs, no LLM needed.
 * Returns an array of flags and a base fraud-risk contribution (0-100 scale).
 */
function runStructuralAnalysis(
  input: DocumentValidationInput
): { flags: DocumentValidationFlag[]; riskContribution: number } {
  const flags: DocumentValidationFlag[] = [];
  let risk = 0;

  // 1. Required-field completeness
  const required = REQUIRED_FIELDS[input.documentType] || [];
  for (const field of required) {
    if (!input[field as keyof DocumentValidationInput]) {
      flags.push({
        code: `MISSING_FIELD_${field.toUpperCase()}`,
        severity: 'MEDIUM',
        description: `Required field '${field}' is missing for document type '${input.documentType}'.`,
      });
      risk += 10;
    }
  }

  // 2. Suspicious-keyword scan
  const lowerContent = (input.content || '').toLowerCase();
  const suspiciousWords = SUSPICIOUS_KEYWORDS[input.documentType] || [];
  for (const word of suspiciousWords) {
    if (lowerContent.includes(word)) {
      flags.push({
        code: 'SUSPICIOUS_KEYWORD',
        severity: 'HIGH',
        description: `Document content contains suspicious keyword: "${word}".`,
      });
      risk += 20;
    }
  }

  // 3. Date consistency
  if (input.issuedDate) {
    if (!isValidIsoDate(input.issuedDate)) {
      flags.push({
        code: 'INVALID_ISSUED_DATE',
        severity: 'HIGH',
        description: 'The issued date is not a valid ISO-8601 date.',
      });
      risk += 15;
    } else if (new Date(input.issuedDate) > new Date()) {
      flags.push({
        code: 'FUTURE_ISSUED_DATE',
        severity: 'CRITICAL',
        description: 'The issued date is in the future – document cannot be valid.',
      });
      risk += 40;
    }
  }

  if (input.expiryDate) {
    if (!isValidIsoDate(input.expiryDate)) {
      flags.push({
        code: 'INVALID_EXPIRY_DATE',
        severity: 'MEDIUM',
        description: 'The expiry date is not a valid ISO-8601 date.',
      });
      risk += 10;
    } else if (new Date(input.expiryDate) < new Date()) {
      flags.push({
        code: 'DOCUMENT_EXPIRED',
        severity: 'HIGH',
        description: 'The document has expired and is no longer valid.',
      });
      risk += 25;
    }

    if (
      input.issuedDate &&
      isValidIsoDate(input.issuedDate) &&
      isValidIsoDate(input.expiryDate) &&
      new Date(input.expiryDate) <= new Date(input.issuedDate)
    ) {
      flags.push({
        code: 'EXPIRY_BEFORE_ISSUE',
        severity: 'CRITICAL',
        description: 'Expiry date is on or before the issued date – document is invalid.',
      });
      risk += 40;
    }
  }

  // 4. Minimal content length
  if ((input.content || '').trim().length < 20) {
    flags.push({
      code: 'INSUFFICIENT_CONTENT',
      severity: 'MEDIUM',
      description: 'Document content is too short to perform meaningful validation.',
    });
    risk += 15;
  }

  // 5. Hash integrity
  let hashMatch: boolean | undefined;
  if (input.documentHash) {
    const computed = computeSha256(input.content || '');
    hashMatch = computed === input.documentHash;
    if (!hashMatch) {
      flags.push({
        code: 'HASH_MISMATCH',
        severity: 'CRITICAL',
        description:
          'Document hash does not match the provided content – the document may have been tampered with.',
      });
      risk += 50;
    }
  }

  return { flags, riskContribution: Math.min(risk, 100) };
}

/**
 * Derive a simple authenticity score (0-100) and verdict from risk scores.
 * Weights:  structural 60 % | semantic (LLM) 40 %
 */
function deriveVerdictAndScore(
  structuralRisk: number,
  semanticRisk: number,
  llmPerformed: boolean
): { authenticityScore: number; fraudRiskScore: number; verdict: AuthenticityVerdict } {
  const combined = llmPerformed
    ? structuralRisk * 0.6 + semanticRisk * 0.4
    : structuralRisk;

  const fraudRiskScore = Math.round(Math.min(combined, 100));
  const authenticityScore = 100 - fraudRiskScore;

  let verdict: AuthenticityVerdict;
  if (fraudRiskScore >= 70) {
    verdict = 'FORGED';
  } else if (fraudRiskScore >= 35) {
    verdict = 'SUSPICIOUS';
  } else {
    verdict = 'AUTHENTIC';
  }

  return { authenticityScore, fraudRiskScore, verdict };
}

// ─── LangChain StructuredTool ─────────────────────────────────────────────────

/**
 * DocumentValidationTool
 *
 * AI-powered LangChain tool that validates the authenticity and genuineness
 * of compliance documents. It performs:
 *   • Structural rule-based analysis (always on)
 *   • LLM semantic reasoning (when Anthropic key is configured)
 *   • Hash integrity verification
 *   • Weighted fraud-risk scoring
 *   • Explainable verdict: AUTHENTIC | SUSPICIOUS | FORGED | UNVERIFIABLE
 */
export class DocumentValidationTool extends StructuredTool<any> {
  name = 'document_validation';
  description = `Validate the authenticity and genuineness of a compliance document using AI.
    Performs structural analysis, keyword fraud detection, date consistency checks, hash integrity
    verification, and optional LLM-based semantic analysis.
    Supports: passport, national_id, drivers_license, utility_bill, bank_statement,
              title_deed, business_registration, financial_statement, property_certificate,
              tax_document, other.
    Returns: verdict (AUTHENTIC|SUSPICIOUS|FORGED|UNVERIFIABLE), authenticityScore (0-100),
             fraudRiskScore (0-100), flags, integrityCheck, aiAnalysis, recommendations.`;

  schema = DocumentValidationInputSchema;

  /**
   * Execute document validation analysis.
   */
  async _call(input: DocumentValidationInput): Promise<string> {
    const startTime = Date.now();

    try {
      logger.info('DocumentValidationTool: Starting validation', {
        documentId: input.documentId,
        documentType: input.documentType,
        issuerJurisdiction: input.issuerJurisdiction,
      });

      // ── Step 1: Structural analysis (always runs) ────────────────────────
      const { flags: structuralFlags, riskContribution: structuralRisk } =
        runStructuralAnalysis(input);

      // ── Step 2: LLM semantic analysis (when API key present) ─────────────
      let llmPerformed = false;
      let llmRisk = 0;
      let llmReasoning =
        'LLM analysis not performed (ANTHROPIC_API_KEY not configured or unavailable).';
      let llmConfidence = 0;

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const { ChatAnthropic } = await import('@langchain/anthropic');
          const llm = new ChatAnthropic({
            modelName: 'claude-3-haiku-20240307', // lightweight model for document checks
            temperature: 0,
            maxTokens: 512,
            apiKey: process.env.ANTHROPIC_API_KEY,
          });

          const prompt = `You are a compliance document authenticity expert.
Analyze the following document for signs of fraud, forgery, or tampering.

Document type: ${input.documentType}
Issuer: ${input.issuerName ?? 'unknown'}
Jurisdiction: ${input.issuerJurisdiction ?? 'unknown'}
Entity name: ${input.entityName ?? 'unknown'}
Issued date: ${input.issuedDate ?? 'not provided'}
Expiry date: ${input.expiryDate ?? 'not provided'}
Content excerpt (first 500 chars): ${(input.content || '').substring(0, 500)}

Existing structural flags: ${structuralFlags.map(f => f.code).join(', ') || 'none'}

Respond ONLY with a JSON object:
{
  "fraudRiskScore": <integer 0-100>,
  "confidence": <float 0-1>,
  "reasoning": "<one-sentence explanation>"
}`;

          const response = await llm.invoke(prompt);
          const raw = typeof response.content === 'string' ? response.content : '';
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            llmRisk = typeof parsed.fraudRiskScore === 'number' ? parsed.fraudRiskScore : 0;
            llmConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;
            llmReasoning = parsed.reasoning || 'LLM analysis completed.';
            llmPerformed = true;
          }
        } catch (llmError) {
          logger.warn('DocumentValidationTool: LLM analysis failed, using structural only', {
            error: llmError instanceof Error ? llmError.message : String(llmError),
          });
          llmReasoning = `LLM analysis unavailable: ${llmError instanceof Error ? llmError.message : 'unknown error'}. Structural analysis used.`;
        }
      }

      // ── Step 3: Derive final verdict ─────────────────────────────────────
      const { authenticityScore, fraudRiskScore, verdict } = deriveVerdictAndScore(
        structuralRisk,
        llmRisk,
        llmPerformed
      );

      // ── Step 4: Integrity checks summary ─────────────────────────────────
      const hashMismatchFlag = structuralFlags.find(f => f.code === 'HASH_MISMATCH');
      const expiredFlag = structuralFlags.find(f => f.code === 'DOCUMENT_EXPIRED');
      const futureDateFlag = structuralFlags.find(f => f.code === 'FUTURE_ISSUED_DATE');
      const expiryBeforeIssueFlag = structuralFlags.find(f => f.code === 'EXPIRY_BEFORE_ISSUE');

      const integrityCheck = {
        passed: !hashMismatchFlag && !expiredFlag && !futureDateFlag && !expiryBeforeIssueFlag,
        hashMatch: input.documentHash ? !hashMismatchFlag : undefined,
        expiryValid: input.expiryDate ? !expiredFlag : undefined,
        dateConsistent: !futureDateFlag && !expiryBeforeIssueFlag,
      };

      // ── Step 5: Recommendations ──────────────────────────────────────────
      const recommendations: string[] = [];
      if (verdict === 'FORGED') {
        recommendations.push('Reject document – high probability of forgery.');
        recommendations.push('Report to compliance officer for investigation.');
        recommendations.push('Request original certified copy from issuing authority.');
      } else if (verdict === 'SUSPICIOUS') {
        recommendations.push('Escalate for manual compliance review.');
        recommendations.push('Request additional supporting documents.');
        recommendations.push('Cross-reference with issuing authority database.');
      } else if (verdict === 'AUTHENTIC') {
        recommendations.push('Document passed AI validation checks.');
        if (!llmPerformed) {
          recommendations.push(
            'Consider enabling LLM analysis (set ANTHROPIC_API_KEY) for enhanced verification.'
          );
        }
      } else {
        recommendations.push('Insufficient content for automated validation – manual review required.');
      }

      const duration = Date.now() - startTime;
      const result: DocumentValidationResult = {
        documentId: input.documentId,
        documentType: input.documentType,
        verdict,
        authenticityScore,
        fraudRiskScore,
        flags: structuralFlags,
        integrityCheck,
        aiAnalysis: {
          performed: llmPerformed,
          confidence: llmConfidence,
          reasoning: llmReasoning,
        },
        recommendations,
        timestamp: new Date(),
      };

      logger.info('DocumentValidationTool: Validation complete', {
        documentId: input.documentId,
        verdict,
        authenticityScore,
        fraudRiskScore,
        flagCount: structuralFlags.length,
        llmPerformed,
        duration,
      });

      return JSON.stringify(result);
    } catch (error) {
      logger.error('DocumentValidationTool: Validation failed', {
        documentId: input.documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      const fallback: DocumentValidationResult = {
        documentId: input.documentId,
        documentType: input.documentType,
        verdict: 'UNVERIFIABLE',
        authenticityScore: 0,
        fraudRiskScore: 50,
        flags: [
          {
            code: 'VALIDATION_SERVICE_ERROR',
            severity: 'HIGH',
            description: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        integrityCheck: { passed: false },
        aiAnalysis: {
          performed: false,
          confidence: 0,
          reasoning: 'Validation service error – manual review required.',
        },
        recommendations: ['Manual document review required due to service error.'],
        timestamp: new Date(),
      };

      return JSON.stringify(fallback);
    }
  }
}

export function initializeDocumentValidationTool(): DocumentValidationTool {
  return new DocumentValidationTool();
}
