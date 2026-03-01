/**
 * SAR/CTR Automation Service
 * Orchestrates automated SAR and CTR generation, validation, and filing
 * Main service for regulatory reporting automation
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import {
  SARDraft,
  SARSubmission,
  CTRForm,
  CTRSubmission,
  SARGenerationRequest,
  CTRGenerationRequest,
  SARStatus,
  CTRStatus,
  SARJurisdiction,
  BatchFilingResult,
} from '../types/sar-ctr.types';
import { getSARThresholdEngine } from './sarThresholdEngine';
import { getFinCenCtRGenerator } from './finCenCtRGenerator';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/sar-ctr-automation.log' }),
  ],
});

export class SARCTRAutomationService {
  private thresholdEngine = getSARThresholdEngine();
  private ctrGenerator = getFinCenCtRGenerator();

  // In-memory storage for now (TODO: replace with database)
  private sarDrafts: Map<string, SARDraft> = new Map();
  private ctrForms: Map<string, CTRForm> = new Map();
  private filingAuditLog: Array<any> = [];

  /**
   * Auto-generate SAR based on transaction evaluation
   */
  async generateSAR(request: SARGenerationRequest, entityData: any): Promise<SARDraft> {
    logger.info('Generating SAR', { entityId: request.entityId, jurisdiction: request.jurisdiction });

    // Evaluate transaction triggers
    const evaluation = await this.thresholdEngine.evaluateTriggers({
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      transactions: [], // TODO: fetch from database
      amlScore: request.amlScore ?? 0,
      hawalaScore: request.hawalaScore,
      sanctionsMatches: request.sanctionsDetails,
    });

    if (!evaluation.shouldGenerateSAR) {
      throw new Error('No suspicious activity triggers matched; SAR not required');
    }

    // Generate filing reference
    const filingReference = this.generateFilingReference('SAR', request.jurisdiction);

    // Create SAR draft
    const sarDraft: SARDraft = {
      sarId: uuidv4(),
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      filingTarget: this.getFilingTarget(request.jurisdiction),
      triggers: evaluation.matchedTriggers,
      narrative: this.generateSARNarrative(
        entityData,
        evaluation.matchedTriggers,
        request.manualNote
      ),
      transactionIds: request.transactionIds,
      generatedAt: new Date(),
      status: 'DRAFT',
      createdBy: request.entityId, // TODO: Get from auth context
    };

    // Store draft
    this.sarDrafts.set(sarDraft.sarId, sarDraft);

    logger.info('SAR draft created', {
      sarId: sarDraft.sarId,
      entityId: request.entityId,
      triggerCount: evaluation.matchedTriggers.length,
    });

    return sarDraft;
  }

  /**
   * Auto-generate CTR form
   */
  async generateCTR(request: CTRGenerationRequest, entityData: any): Promise<CTRForm> {
    logger.info('Generating CTR', { entityId: request.entityId, currency: request.currency });

    const ctrForm = await this.ctrGenerator.generateCTR(request, entityData);

    // Validate completeness
    const validation = this.ctrGenerator.validateCTRForm(ctrForm);
    if (!validation.isValid) {
      logger.error('CTR validation failed', { errors: validation.errors });
      throw new Error(`CTR form invalid: ${validation.errors.join('; ')}`);
    }

    // Store form
    this.ctrForms.set(ctrForm.ctrId, ctrForm);

    logger.info('CTR form generated', {
      ctrId: ctrForm.ctrId,
      entityId: request.entityId,
      totalAmount: request.aggregatedAmount,
    });

    return ctrForm;
  }

  /**
   * Submit SAR to regulatory authority
   */
  async submitSAR(
    sarId: string,
    submittedBy: string,
    config?: { autoSubmit?: boolean }
  ): Promise<SARSubmission> {
    const sarDraft = this.sarDrafts.get(sarId);
    if (!sarDraft) {
      throw new Error(`SAR not found: ${sarId}`);
    }

    if (sarDraft.status !== 'DRAFT' && sarDraft.status !== 'PENDING_REVIEW') {
      throw new Error(`Cannot submit SAR with status: ${sarDraft.status}`);
    }

    // Auto-submit if enabled in config
    if (config?.autoSubmit) {
      logger.info('Auto-submitting SAR', { sarId });
    } else {
      logger.info('Submitting SAR (manual)', { sarId, submittedBy });
    }

    const filingId = uuidv4();
    const filingReference = this.generateFilingReference('SAR', sarDraft.jurisdiction);
    const submittedAt = new Date();

    const submission: SARSubmission = {
      sarId,
      filingId,
      filingReference,
      jurisdiction: sarDraft.jurisdiction,
      filingTarget: sarDraft.filingTarget,
      submittedAt,
      submittedBy,
      status: 'SUBMITTED',
    };

    // Update draft status
    sarDraft.status = 'SUBMITTED';

    // Create audit log entry
    this.recordAuditLog({
      reportId: sarId,
      reportType: 'SAR',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      changeReason: config?.autoSubmit ? 'Auto-submitted' : 'Manual submission',
      changedBy: submittedBy,
      filingId,
      filingReference,
    });

    logger.info('SAR submitted', {
      sarId,
      filingId,
      filingReference,
      jurisdiction: sarDraft.jurisdiction,
    });

    return submission;
  }

  /**
   * Submit CTR to regulatory authority
   */
  async submitCTR(
    ctrId: string,
    submittedBy: string,
    config?: { autoSubmit?: boolean; targetAuthority?: string }
  ): Promise<CTRSubmission> {
    const ctrForm = this.ctrForms.get(ctrId);
    if (!ctrForm) {
      throw new Error(`CTR not found: ${ctrId}`);
    }

    if (ctrForm.status !== 'DRAFT' && ctrForm.status !== 'PENDING_SUBMISSION') {
      throw new Error(`Cannot submit CTR with status: ${ctrForm.status}`);
    }

    const filingId = uuidv4();
    const filingReference = this.generateFilingReference('CTR', 'US');
    const submittedAt = new Date();

    const submission: CTRSubmission = {
      ctrId,
      filingId,
      filingReference,
      submittedAt,
      submittedBy,
      filingTarget: config?.targetAuthority || 'FinCEN',
      status: 'SUBMITTED',
    };

    // Update form status
    ctrForm.status = 'SUBMITTED';

    // Create audit log entry
    this.recordAuditLog({
      reportId: ctrId,
      reportType: 'CTR',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      changeReason: config?.autoSubmit ? 'Auto-submitted' : 'Manual submission',
      changedBy: submittedBy,
      filingId,
      filingReference,
    });

    logger.info('CTR submitted', {
      ctrId,
      filingId,
      filingReference,
      targetAuthority: config?.targetAuthority || 'FinCEN',
    });

    return submission;
  }

  /**
   * Batch submit multiple SARs and CTRs
   */
  async batchSubmit(
    reportIds: string[],
    submittedBy: string
  ): Promise<BatchFilingResult> {
    const results = await Promise.allSettled(
      reportIds.map(async (reportId) => {
        // Try as SAR first
        const sarDraft = this.sarDrafts.get(reportId);
        if (sarDraft) {
          const submission = await this.submitSAR(reportId, submittedBy);
          return {
            reportId,
            reportType: 'SAR' as const,
            status: 'SUCCESS' as const,
            filingId: submission.filingId,
            filingReference: submission.filingReference,
          };
        }

        // Try as CTR
        const ctrForm = this.ctrForms.get(reportId);
        if (ctrForm) {
          const submission = await this.submitCTR(reportId, submittedBy);
          return {
            reportId,
            reportType: 'CTR' as const,
            status: 'SUCCESS' as const,
            filingId: submission.filingId,
            filingReference: submission.filingReference,
          };
        }

        throw new Error(`Report not found: ${reportId}`);
      })
    );

    const filings = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { ...result.value };
      } else {
        return {
          reportId: reportIds[index],
          reportType: 'SAR' as const,
          status: 'FAILED' as const,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    const successCount = filings.filter((f) => f.status === 'SUCCESS').length;
    const failureCount = filings.filter((f) => f.status === 'FAILED').length;

    logger.info('Batch submission complete', {
      totalProcessed: reportIds.length,
      successCount,
      failureCount,
    });

    return {
      totalProcessed: reportIds.length,
      successCount,
      failureCount,
      filings,
      submittedAt: new Date(),
    };
  }

  /**
   * Get SAR draft by ID
   */
  getSARDraft(sarId: string): SARDraft | undefined {
    return this.sarDrafts.get(sarId);
  }

  /**
   * Get CTR form by ID
   */
  getCTRForm(ctrId: string): CTRForm | undefined {
    return this.ctrForms.get(ctrId);
  }

  /**
   * List all SARs with optional filtering
   */
  listSARs(filters?: {
    status?: SARStatus;
    jurisdiction?: SARJurisdiction;
    startDate?: Date;
    endDate?: Date;
  }): SARDraft[] {
    let sars = Array.from(this.sarDrafts.values());

    if (filters?.status) {
      sars = sars.filter((s) => s.status === filters.status);
    }

    if (filters?.jurisdiction) {
      sars = sars.filter((s) => s.jurisdiction === filters.jurisdiction);
    }

    if (filters?.startDate) {
      sars = sars.filter((s) => s.generatedAt >= filters.startDate!);
    }

    if (filters?.endDate) {
      sars = sars.filter((s) => s.generatedAt <= filters.endDate!);
    }

    return sars;
  }

  /**
   * List all CTRs with optional filtering
   */
  listCTRs(filters?: {
    status?: CTRStatus;
    Currency?: string;
    startDate?: Date;
    endDate?: Date;
  }): CTRForm[] {
    let ctrs = Array.from(this.ctrForms.values());

    if (filters?.status) {
      ctrs = ctrs.filter((c) => c.status === filters.status);
    }

    if (filters?.Currency) {
      ctrs = ctrs.filter((c) => c.currency === filters.Currency);
    }

    if (filters?.startDate) {
      ctrs = ctrs.filter((c) => c.generatedAt >= filters.startDate!);
    }

    if (filters?.endDate) {
      ctrs = ctrs.filter((c) => c.generatedAt <= filters.endDate!);
    }

    return ctrs;
  }

  /**
   * Get audit log
   */
  getAuditLog(filters?: { reportId?: string; reportType?: string }): any[] {
    let logs = this.filingAuditLog;

    if (filters?.reportId) {
      logs = logs.filter((l) => l.reportId === filters.reportId);
    }

    if (filters?.reportType) {
      logs = logs.filter((l) => l.reportType === filters.reportType);
    }

    return logs;
  }

  /**
   * Generate filing reference number
   */
  private generateFilingReference(reportType: 'SAR' | 'CTR', jurisdiction: SARJurisdiction): string {
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split('T')[0].replace(/-/g, '');
    const sequence = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `${reportType}-${jurisdiction}-${dateStr}-${sequence}`;
  }

  /**
   * Get filing target for jurisdiction
   */
  private getFilingTarget(jurisdiction: SARJurisdiction): string {
    const targets: Record<SARJurisdiction, string> = {
      US: 'FinCEN BSA E-Filing System',
      AE: 'UAE FIU (goAML Platform)',
      IN: 'FIU-IND Submission API',
      SA: 'SAFIU (Saudi Financial Intelligence Unit)',
      EU: 'FATF Financial Intelligence Unit',
    };
    return targets[jurisdiction] || 'Unknown FIU';
  }

  /**
   * Generate SAR narrative
   */
  private generateSARNarrative(entityData: any, triggers: any[], manualNote?: string): string {
    const lines = [
      `SUSPICIOUS ACTIVITY REPORT - ${new Date().toISOString().split('T')[0]}`,
      `Entity: ${entityData.name || 'Unknown'}`,
      `Entity ID: ${entityData.id || 'N/A'}`,
      '',
      'SUSPICIOUS ACTIVITY INDICATORS:',
    ];

    triggers.forEach((trigger) => {
      lines.push(`• ${trigger.description}`);
      if (trigger.evidence) {
        trigger.evidence.forEach((evidence: string) => {
          lines.push(`  - ${evidence}`);
        });
      }
    });

    lines.push('');
    lines.push('COMPLIANCE NOTE:');
    lines.push(
      'This SAR has been automatically generated based on' +
        ' transaction monitoring rules. All findings should be independently verified.'
    );

    if (manualNote) {
      lines.push('');
      lines.push('ADDITIONAL NOTES:');
      lines.push(manualNote);
    }

    return lines.join('\n');
  }

  /**
   * Record audit log entry
   */
  private recordAuditLog(entry: any): void {
    this.filingAuditLog.push({
      auditId: uuidv4(),
      ...entry,
      changedAt: new Date(),
    });
  }
}

// Singleton instance
let instance: SARCTRAutomationService | null = null;

export function getSARCTRAutomationService(): SARCTRAutomationService {
  if (!instance) {
    instance = new SARCTRAutomationService();
  }
  return instance;
}
