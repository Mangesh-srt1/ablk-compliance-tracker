/**
 * Asset Validation Tool – LangChain StructuredTool
 *
 * AI-powered validation for Real-World Assets (RWA) – property titles, fund
 * units, tokenized securities, and other financial/physical assets.
 *
 * Analysis pipeline:
 *  1. Asset-metadata consistency and completeness checks (rule-based)
 *  2. Hash / digital-signature integrity verification
 *  3. LLM-enhanced ownership-chain and title analysis (when available)
 *  4. Weighted risk scoring → verdict: VALID | SUSPICIOUS | INVALID | UNVERIFIABLE
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
    new winston.transports.File({ filename: 'logs/asset-validation-tool.log' }),
  ],
});

// ─── Asset types ──────────────────────────────────────────────────────────────

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

// ─── Zod schema ───────────────────────────────────────────────────────────────

const AssetValidationInputSchema = z.object({
  assetId: z.string().describe('Unique identifier for the asset submission'),
  assetType: z.enum(ASSET_TYPES).describe('Category of the asset'),
  assetDescription: z
    .string()
    .describe('Textual description of the asset (from title deed, certificate, etc.)'),
  ownerName: z.string().optional().describe('Current registered owner name'),
  ownerJurisdiction: z
    .string()
    .optional()
    .describe('Jurisdiction where the owner is registered'),
  registryReference: z
    .string()
    .optional()
    .describe('Registry or land-department reference number'),
  registrationDate: z
    .string()
    .optional()
    .describe('ISO-8601 date of asset registration'),
  valuationAmount: z
    .number()
    .optional()
    .describe('Declared asset valuation in USD'),
  valuationCurrency: z
    .string()
    .optional()
    .describe('Currency of the valuation (default USD)'),
  ownershipChain: z
    .array(
      z.object({
        owner: z.string(),
        transferDate: z.string().optional(),
        registryRef: z.string().optional(),
      })
    )
    .optional()
    .describe('Historical ownership records (oldest → most recent)'),
  contentHash: z
    .string()
    .optional()
    .describe('SHA-256 hash of the supporting asset document'),
  contentForHashing: z
    .string()
    .optional()
    .describe('Raw content to hash and compare against contentHash'),
  metadata: z.record(z.any()).optional().describe('Additional key-value metadata'),
});

export type AssetValidationInput = z.infer<typeof AssetValidationInputSchema>;

// ─── Result types ─────────────────────────────────────────────────────────────

export type AssetVerdict = 'VALID' | 'SUSPICIOUS' | 'INVALID' | 'UNVERIFIABLE';

export interface AssetValidationFlag {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface AssetValidationResult {
  assetId: string;
  assetType: AssetType;
  verdict: AssetVerdict;
  /** Overall validity score: 0 (definitely invalid) → 100 (definitely valid) */
  validityScore: number;
  riskScore: number;
  flags: AssetValidationFlag[];
  integrityCheck: {
    passed: boolean;
    hashMatch?: boolean;
    ownershipChainValid?: boolean;
    registrationDateValid?: boolean;
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

/** Suspicious phrases for asset descriptions */
const ASSET_SUSPICIOUS_KEYWORDS = [
  'disputed',
  'encumbered',
  'lien',
  'litigated',
  'foreclosure',
  'void',
  'cancelled',
  'specimen',
  'fake',
  'fraudulent',
  'unauthorized',
  'illegal',
  'stolen',
  'embezzled',
];

/** Implausibly low valuations trigger extra scrutiny (USD) */
const MIN_VALUATION_THRESHOLDS: Partial<Record<AssetType, number>> = {
  real_estate: 1000,
  tokenized_security: 100,
  private_equity_fund: 10000,
  debt_instrument: 100,
};

function computeSha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/**
 * Rule-based structural analysis for assets.
 */
function runAssetStructuralAnalysis(
  input: AssetValidationInput
): { flags: AssetValidationFlag[]; riskContribution: number } {
  const flags: AssetValidationFlag[] = [];
  let risk = 0;

  // 1. Suspicious keyword scan on description
  const lower = (input.assetDescription || '').toLowerCase();
  for (const word of ASSET_SUSPICIOUS_KEYWORDS) {
    if (lower.includes(word)) {
      flags.push({
        code: 'SUSPICIOUS_ASSET_KEYWORD',
        severity: 'HIGH',
        description: `Asset description contains suspicious keyword: "${word}".`,
      });
      risk += 20;
    }
  }

  // 2. Insufficient description
  if ((input.assetDescription || '').trim().length < 10) {
    flags.push({
      code: 'INSUFFICIENT_ASSET_DESCRIPTION',
      severity: 'MEDIUM',
      description: 'Asset description is too short for meaningful validation.',
    });
    risk += 15;
  }

  // 3. Missing registry reference for asset types that require it
  const registryRequired: AssetType[] = [
    'real_estate',
    'tokenized_security',
    'private_equity_fund',
    'debt_instrument',
  ];
  if (registryRequired.includes(input.assetType) && !input.registryReference) {
    flags.push({
      code: 'MISSING_REGISTRY_REFERENCE',
      severity: 'HIGH',
      description: `Registry reference is required for asset type '${input.assetType}'.`,
    });
    risk += 20;
  }

  // 4. Registration date checks
  if (input.registrationDate) {
    if (!isValidIsoDate(input.registrationDate)) {
      flags.push({
        code: 'INVALID_REGISTRATION_DATE',
        severity: 'HIGH',
        description: 'Registration date is not a valid ISO-8601 date.',
      });
      risk += 15;
    } else if (new Date(input.registrationDate) > new Date()) {
      flags.push({
        code: 'FUTURE_REGISTRATION_DATE',
        severity: 'CRITICAL',
        description: 'Registration date is in the future – asset cannot be valid.',
      });
      risk += 40;
    }
  }

  // 5. Implausibly low valuation
  if (input.valuationAmount !== undefined && input.valuationAmount !== null) {
    const minThreshold = MIN_VALUATION_THRESHOLDS[input.assetType];
    if (minThreshold !== undefined && input.valuationAmount < minThreshold) {
      flags.push({
        code: 'IMPLAUSIBLY_LOW_VALUATION',
        severity: 'MEDIUM',
        description: `Declared valuation $${input.valuationAmount} is below minimum threshold $${minThreshold} for ${input.assetType}.`,
      });
      risk += 15;
    }
    if (input.valuationAmount <= 0) {
      flags.push({
        code: 'ZERO_OR_NEGATIVE_VALUATION',
        severity: 'HIGH',
        description: 'Asset valuation must be a positive number.',
      });
      risk += 25;
    }
  }

  // 6. Ownership chain consistency
  let ownershipChainValid: boolean | undefined;
  if (input.ownershipChain && input.ownershipChain.length > 0) {
    ownershipChainValid = true;
    const chain = input.ownershipChain;
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1]!;
      const curr = chain[i]!;
      if (
        prev.transferDate &&
        curr.transferDate &&
        isValidIsoDate(prev.transferDate) &&
        isValidIsoDate(curr.transferDate) &&
        new Date(curr.transferDate) < new Date(prev.transferDate)
      ) {
        flags.push({
          code: 'OWNERSHIP_CHAIN_DATE_INCONSISTENCY',
          severity: 'HIGH',
          description: `Ownership transfer dates are out of order between "${prev.owner}" and "${curr.owner}".`,
        });
        risk += 30;
        ownershipChainValid = false;
      }
    }
    // Last owner should match declared owner
    const lastOwner = chain[chain.length - 1]!.owner;
    if (input.ownerName && lastOwner !== input.ownerName) {
      flags.push({
        code: 'OWNERSHIP_MISMATCH',
        severity: 'CRITICAL',
        description: `Current owner "${input.ownerName}" does not match last chain entry "${lastOwner}".`,
      });
      risk += 40;
      ownershipChainValid = false;
    }
  }

  // 7. Hash integrity
  let hashMatch: boolean | undefined;
  if (input.contentHash && input.contentForHashing) {
    const computed = computeSha256(input.contentForHashing);
    hashMatch = computed === input.contentHash;
    if (!hashMatch) {
      flags.push({
        code: 'ASSET_HASH_MISMATCH',
        severity: 'CRITICAL',
        description:
          'Asset document hash does not match provided content – possible tampering.',
      });
      risk += 50;
    }
  }

  return { flags, riskContribution: Math.min(risk, 100) };
}

/**
 * Derive verdict from combined risk score.
 */
function deriveAssetVerdictAndScore(
  structuralRisk: number,
  semanticRisk: number,
  llmPerformed: boolean
): { validityScore: number; riskScore: number; verdict: AssetVerdict } {
  const combined = llmPerformed
    ? structuralRisk * 0.6 + semanticRisk * 0.4
    : structuralRisk;

  const riskScore = Math.round(Math.min(combined, 100));
  const validityScore = 100 - riskScore;

  let verdict: AssetVerdict;
  if (riskScore >= 70) {
    verdict = 'INVALID';
  } else if (riskScore >= 35) {
    verdict = 'SUSPICIOUS';
  } else {
    verdict = 'VALID';
  }

  return { validityScore, riskScore, verdict };
}

// ─── LangChain StructuredTool ─────────────────────────────────────────────────

/**
 * AssetValidationTool
 *
 * AI-powered LangChain tool that validates the authenticity and genuineness
 * of Real-World Assets. It performs:
 *   • Structural rule-based analysis (always on)
 *   • Ownership-chain consistency verification
 *   • Hash integrity check for supporting documents
 *   • LLM semantic reasoning on asset description (when Anthropic key present)
 *   • Weighted risk scoring
 *   • Explainable verdict: VALID | SUSPICIOUS | INVALID | UNVERIFIABLE
 */
export class AssetValidationTool extends StructuredTool<any> {
  name = 'asset_validation';
  description = `Validate the authenticity and genuineness of a Real-World Asset (RWA) using AI.
    Performs structural analysis, ownership-chain consistency checks, hash integrity verification,
    and optional LLM-based semantic analysis of asset descriptions.
    Supports: real_estate, tokenized_security, private_equity_fund, debt_instrument,
              commodity, intellectual_property, vehicle, art_collectible, other.
    Returns: verdict (VALID|SUSPICIOUS|INVALID|UNVERIFIABLE), validityScore (0-100),
             riskScore (0-100), flags, integrityCheck, aiAnalysis, recommendations.`;

  schema = AssetValidationInputSchema;

  async _call(input: AssetValidationInput): Promise<string> {
    const startTime = Date.now();

    try {
      logger.info('AssetValidationTool: Starting validation', {
        assetId: input.assetId,
        assetType: input.assetType,
        ownerJurisdiction: input.ownerJurisdiction,
      });

      // ── Step 1: Structural analysis ──────────────────────────────────────
      const { flags: structuralFlags, riskContribution: structuralRisk } =
        runAssetStructuralAnalysis(input);

      // ── Step 2: LLM semantic analysis ────────────────────────────────────
      let llmPerformed = false;
      let llmRisk = 0;
      let llmReasoning =
        'LLM analysis not performed (ANTHROPIC_API_KEY not configured or unavailable).';
      let llmConfidence = 0;

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const { ChatAnthropic } = await import('@langchain/anthropic');
          const llm = new ChatAnthropic({
            modelName: 'claude-3-haiku-20240307',
            temperature: 0,
            maxTokens: 512,
            apiKey: process.env.ANTHROPIC_API_KEY,
          });

          const chainSummary = input.ownershipChain
            ? input.ownershipChain.map(e => `${e.owner} (${e.transferDate ?? 'date unknown'})`).join(' → ')
            : 'not provided';

          const prompt = `You are a Real-World Asset compliance expert.
Analyze the following asset record for signs of fraud, misrepresentation, or invalidity.

Asset type: ${input.assetType}
Owner: ${input.ownerName ?? 'unknown'}
Jurisdiction: ${input.ownerJurisdiction ?? 'unknown'}
Registry reference: ${input.registryReference ?? 'not provided'}
Registration date: ${input.registrationDate ?? 'not provided'}
Declared valuation: ${input.valuationAmount ?? 'not provided'} ${input.valuationCurrency ?? 'USD'}
Ownership chain: ${chainSummary}
Description (first 400 chars): ${(input.assetDescription || '').substring(0, 400)}

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
          logger.warn('AssetValidationTool: LLM analysis failed, using structural only', {
            error: llmError instanceof Error ? llmError.message : String(llmError),
          });
          llmReasoning = `LLM analysis unavailable: ${llmError instanceof Error ? llmError.message : 'unknown error'}. Structural analysis used.`;
        }
      }

      // ── Step 3: Derive verdict ────────────────────────────────────────────
      const { validityScore, riskScore, verdict } = deriveAssetVerdictAndScore(
        structuralRisk,
        llmRisk,
        llmPerformed
      );

      // ── Step 4: Integrity checks summary ─────────────────────────────────
      const hashMismatchFlag = structuralFlags.find(f => f.code === 'ASSET_HASH_MISMATCH');
      const ownershipFlag = structuralFlags.find(
        f => f.code === 'OWNERSHIP_CHAIN_DATE_INCONSISTENCY' || f.code === 'OWNERSHIP_MISMATCH'
      );
      const futureDateFlag = structuralFlags.find(f => f.code === 'FUTURE_REGISTRATION_DATE');

      let ownershipChainValid: boolean | undefined;
      if (input.ownershipChain && input.ownershipChain.length > 0) {
        ownershipChainValid = !ownershipFlag;
      }

      const integrityCheck = {
        passed: !hashMismatchFlag && !ownershipFlag && !futureDateFlag,
        hashMatch: input.contentHash ? !hashMismatchFlag : undefined,
        ownershipChainValid,
        registrationDateValid: input.registrationDate ? !futureDateFlag : undefined,
      };

      // ── Step 5: Recommendations ───────────────────────────────────────────
      const recommendations: string[] = [];
      if (verdict === 'INVALID') {
        recommendations.push('Reject asset – high probability of fraud or invalid title.');
        recommendations.push('Report to compliance officer for immediate investigation.');
        recommendations.push('Do not proceed with tokenization or transfer.');
      } else if (verdict === 'SUSPICIOUS') {
        recommendations.push('Escalate for manual compliance review before proceeding.');
        recommendations.push('Request certified documentation from registering authority.');
        recommendations.push('Conduct independent valuation if valuation flags are present.');
      } else if (verdict === 'VALID') {
        recommendations.push('Asset passed AI validation checks.');
        if (!llmPerformed) {
          recommendations.push(
            'Consider enabling LLM analysis (set ANTHROPIC_API_KEY) for enhanced verification.'
          );
        }
      } else {
        recommendations.push('Insufficient data for automated validation – manual review required.');
      }

      const duration = Date.now() - startTime;
      const result: AssetValidationResult = {
        assetId: input.assetId,
        assetType: input.assetType,
        verdict,
        validityScore,
        riskScore,
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

      logger.info('AssetValidationTool: Validation complete', {
        assetId: input.assetId,
        verdict,
        validityScore,
        riskScore,
        flagCount: structuralFlags.length,
        llmPerformed,
        duration,
      });

      return JSON.stringify(result);
    } catch (error) {
      logger.error('AssetValidationTool: Validation failed', {
        assetId: input.assetId,
        error: error instanceof Error ? error.message : String(error),
      });

      const fallback: AssetValidationResult = {
        assetId: input.assetId,
        assetType: input.assetType,
        verdict: 'UNVERIFIABLE',
        validityScore: 0,
        riskScore: 50,
        flags: [
          {
            code: 'ASSET_VALIDATION_SERVICE_ERROR',
            severity: 'HIGH',
            description: `Asset validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        integrityCheck: { passed: false },
        aiAnalysis: {
          performed: false,
          confidence: 0,
          reasoning: 'Asset validation service error – manual review required.',
        },
        recommendations: ['Manual asset review required due to service error.'],
        timestamp: new Date(),
      };

      return JSON.stringify(fallback);
    }
  }
}

export function initializeAssetValidationTool(): AssetValidationTool {
  return new AssetValidationTool();
}
