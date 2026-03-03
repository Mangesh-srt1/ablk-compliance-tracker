/**
 * Document & Asset Validation Agent
 *
 * LangChain-based orchestrator that combines:
 *   • DocumentValidationTool – AI document authenticity verification
 *   • AssetValidationTool    – AI Real-World Asset validation
 *
 * Follows the same dependency-injection / graceful-degradation pattern
 * used by supervisorAgent.ts, kycAgent.ts, and amlAgent.ts.
 */

import winston from 'winston';
import {
  DocumentValidationTool,
  initializeDocumentValidationTool,
  DocumentValidationInput,
  DocumentValidationResult,
} from '../tools/documentValidationTool';
import {
  AssetValidationTool,
  initializeAssetValidationTool,
  AssetValidationInput,
  AssetValidationResult,
} from '../tools/assetValidationTool';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/document-validation-agent.log' }),
  ],
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentValidationAgentDeps {
  documentValidationTool?: { call: (input: DocumentValidationInput) => Promise<any> };
  assetValidationTool?: { call: (input: AssetValidationInput) => Promise<any> };
}

export interface CombinedValidationInput {
  /** Unique request identifier */
  requestId: string;
  document?: DocumentValidationInput;
  asset?: AssetValidationInput;
}

export interface CombinedValidationResult {
  requestId: string;
  /** APPROVED when all checks pass; REJECTED when any check fails hard; ESCALATED otherwise */
  overallStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  overallRiskScore: number;
  documentResult?: DocumentValidationResult;
  assetResult?: AssetValidationResult;
  reasoning: string;
  toolsUsed: string[];
  processingTime: number;
  timestamp: Date;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

/**
 * DocumentValidationAgent
 *
 * Orchestrates AI-powered validation of compliance documents and Real-World
 * Assets. Can be used standalone or embedded in the SupervisorAgent pipeline.
 *
 * • Runs document and asset checks in parallel for performance.
 * • Provides explainable reasoning combining both check results.
 * • Supports dependency injection for unit testing.
 */
export class DocumentValidationAgent {
  private documentTool: DocumentValidationTool;
  private assetTool: AssetValidationTool;
  private _injectedDeps: DocumentValidationAgentDeps | null = null;

  constructor(deps?: DocumentValidationAgentDeps) {
    if (deps) {
      this._injectedDeps = deps;
      // Stubs so real tool construction is skipped in tests
      this.documentTool = null as any;
      this.assetTool = null as any;
      return;
    }

    this.documentTool = initializeDocumentValidationTool();
    this.assetTool = initializeAssetValidationTool();

    logger.info('DocumentValidationAgent: Initialized', {
      tools: ['document_validation', 'asset_validation'],
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Validate a single document.
   */
  async validateDocument(input: DocumentValidationInput): Promise<DocumentValidationResult> {
    const raw = await this._callDocumentTool(input);
    return this._parseDocumentResult(raw, input.documentId);
  }

  /**
   * Validate a single asset.
   */
  async validateAsset(input: AssetValidationInput): Promise<AssetValidationResult> {
    const raw = await this._callAssetTool(input);
    return this._parseAssetResult(raw, input.assetId);
  }

  /**
   * Run document + asset validation in parallel and produce a combined decision.
   */
  async validateCombined(input: CombinedValidationInput): Promise<CombinedValidationResult> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    logger.info('DocumentValidationAgent: Starting combined validation', {
      requestId: input.requestId,
      hasDocument: !!input.document,
      hasAsset: !!input.asset,
    });

    let documentResult: DocumentValidationResult | undefined;
    let assetResult: AssetValidationResult | undefined;

    // ── Parallel execution ───────────────────────────────────────────────────
    const [docRaw, assetRaw] = await Promise.all([
      input.document ? this._callDocumentTool(input.document).catch(e => ({ _error: e.message })) : Promise.resolve(null),
      input.asset ? this._callAssetTool(input.asset).catch(e => ({ _error: e.message })) : Promise.resolve(null),
    ]);

    if (docRaw !== null) {
      toolsUsed.push('document_validation');
      documentResult = this._parseDocumentResult(docRaw, input.document!.documentId);
    }
    if (assetRaw !== null) {
      toolsUsed.push('asset_validation');
      assetResult = this._parseAssetResult(assetRaw, input.asset!.assetId);
    }

    // ── Aggregate decision ───────────────────────────────────────────────────
    const scores: number[] = [];
    if (documentResult) scores.push(documentResult.fraudRiskScore);
    if (assetResult) scores.push(assetResult.riskScore);

    const overallRiskScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 50;

    const docVerdict = documentResult?.verdict;
    const assetVerdict = assetResult?.verdict;

    let overallStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED';
    if (docVerdict === 'FORGED' || assetVerdict === 'INVALID') {
      overallStatus = 'REJECTED';
    } else if (
      docVerdict === 'SUSPICIOUS' ||
      assetVerdict === 'SUSPICIOUS' ||
      overallRiskScore >= 35
    ) {
      overallStatus = 'ESCALATED';
    } else if (!documentResult && !assetResult) {
      overallStatus = 'ESCALATED';
    } else {
      overallStatus = 'APPROVED';
    }

    // ── Reasoning ────────────────────────────────────────────────────────────
    const parts: string[] = [];
    if (overallStatus === 'APPROVED') {
      parts.push('All validation checks passed.');
    } else if (overallStatus === 'REJECTED') {
      parts.push('One or more critical validation failures detected.');
    } else {
      parts.push('Validation requires manual review.');
    }
    if (documentResult) parts.push(`Document: ${docVerdict} (fraud risk ${documentResult.fraudRiskScore}/100)`);
    if (assetResult) parts.push(`Asset: ${assetVerdict} (risk ${assetResult.riskScore}/100)`);
    parts.push(`Overall risk: ${overallRiskScore}/100`);

    const result: CombinedValidationResult = {
      requestId: input.requestId,
      overallStatus,
      overallRiskScore,
      documentResult,
      assetResult,
      reasoning: parts.join('. '),
      toolsUsed,
      processingTime: Date.now() - startTime,
      timestamp: new Date(),
    };

    logger.info('DocumentValidationAgent: Combined validation complete', {
      requestId: input.requestId,
      overallStatus,
      overallRiskScore,
      processingTime: result.processingTime,
    });

    return result;
  }

  /**
   * Agent info (mirrors getAgentInfo on SupervisorAgent for consistency).
   */
  getAgentInfo(): { tools: string[]; status: 'READY' } {
    return { tools: ['document_validation', 'asset_validation'], status: 'READY' };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async _callDocumentTool(input: DocumentValidationInput): Promise<any> {
    if (this._injectedDeps?.documentValidationTool) {
      return this._injectedDeps.documentValidationTool.call(input);
    }
    return this.documentTool._call(input);
  }

  private async _callAssetTool(input: AssetValidationInput): Promise<any> {
    if (this._injectedDeps?.assetValidationTool) {
      return this._injectedDeps.assetValidationTool.call(input);
    }
    return this.assetTool._call(input);
  }

  private _parseDocumentResult(
    raw: any,
    fallbackId: string
  ): DocumentValidationResult {
    if (raw && (raw as any)._error) {
      return {
        documentId: fallbackId,
        documentType: 'other',
        verdict: 'UNVERIFIABLE',
        authenticityScore: 0,
        fraudRiskScore: 50,
        flags: [{ code: 'TOOL_ERROR', severity: 'HIGH', description: (raw as any)._error }],
        integrityCheck: { passed: false },
        aiAnalysis: { performed: false, confidence: 0, reasoning: 'Tool error.' },
        recommendations: ['Manual review required.'],
        timestamp: new Date(),
      };
    }
    const parsed = typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch (e) {
            logger.error('DocumentValidationAgent: Failed to parse document tool response', {
              fallbackId,
              error: e instanceof Error ? e.message : String(e),
            });
            return {};
          }
        })()
      : raw;
    return parsed as DocumentValidationResult;
  }

  private _parseAssetResult(raw: any, fallbackId: string): AssetValidationResult {
    if (raw && (raw as any)._error) {
      return {
        assetId: fallbackId,
        assetType: 'other',
        verdict: 'UNVERIFIABLE',
        validityScore: 0,
        riskScore: 50,
        flags: [{ code: 'TOOL_ERROR', severity: 'HIGH', description: (raw as any)._error }],
        integrityCheck: { passed: false },
        aiAnalysis: { performed: false, confidence: 0, reasoning: 'Tool error.' },
        recommendations: ['Manual review required.'],
        timestamp: new Date(),
      };
    }
    const parsed = typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch (e) {
            logger.error('DocumentValidationAgent: Failed to parse asset tool response', {
              fallbackId,
              error: e instanceof Error ? e.message : String(e),
            });
            return {};
          }
        })()
      : raw;
    return parsed as AssetValidationResult;
  }
}

export function initializeDocumentValidationAgent(
  deps?: DocumentValidationAgentDeps
): DocumentValidationAgent {
  return new DocumentValidationAgent(deps);
}
