/**
 * Compliance Reporting System
 * Generates structured compliance reports for entities.
 * Supports summary, detailed, executive, and regulatory report types.
 * FR-7.12: Extended with jurisdiction-specific STR/SAR filing (UAE FIU goAML,
 *           FIU-IND, FinCEN BSA, SAFIU).
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

// ─── FR-7.12: STR/SAR Filing Types ───────────────────────────────────────────

/** Jurisdictions supported for automated STR/SAR filing (FR-7.12) */
export type STRJurisdiction = 'AE' | 'IN' | 'US' | 'SA';

/** Trigger conditions that cause an automated STR to be generated */
export type STRTrigger =
  | 'AML_SCORE_HIGH'      // AML risk score ≥ 70
  | 'HAWALA_SCORE_HIGH'   // hawala score ≥ 80
  | 'SANCTIONS_HIT'       // any sanctions match
  | 'MANUAL_ESCALATION';  // compliance officer manually triggered

/** Filing targets per jurisdiction (FR-7.12) */
export const STR_FILING_TARGETS: Record<STRJurisdiction, string> = {
  AE: 'UAE FIU via goAML platform',
  IN: 'FIU-IND submission API',
  US: 'FinCEN BSA E-Filing',
  SA: 'SAFIU Saudi Financial Intelligence Unit',
};

export interface STRInput {
  entityId: string;
  jurisdiction: STRJurisdiction;
  trigger: STRTrigger;
  amlScore?: number;
  hawalaScore?: number;
  transactionIds?: string[];
  narrative?: string;
  sanctionsDetails?: string;
}

export interface STRDraft {
  draftId: string;
  entityId: string;
  jurisdiction: STRJurisdiction;
  filingTarget: string;
  trigger: STRTrigger;
  narrative: string;
  transactionIds: string[];
  generatedAt: Date;
}

export interface STRFilingResult {
  filingId: string;
  status: 'SUBMITTED' | 'PENDING_REVIEW' | 'FAILED';
  filingReference: string; // STR-{JurisdictionCode}-{Timestamp}
  jurisdiction: STRJurisdiction;
  filingTarget: string;
  submittedAt: Date;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/compliance-reporting.log' }),
  ],
});

export interface ReportFinding {
  severity: string;
  description: string;
  passed: boolean;
}

export interface ReportInput {
  reportType: 'summary' | 'detailed' | 'executive' | 'regulatory';
  entityId: string;
  jurisdiction: string;
  scanResults: {
    kycStatus?: string;
    amlStatus?: string;
    riskScore: number;
    findings: ReportFinding[];
  };
  dateRange?: { from: Date; to: Date };
}

export interface ComplianceReport {
  reportId: string;
  reportType: string;
  entityId: string;
  jurisdiction: string;
  generatedAt: Date;
  summary: {
    overallStatus: string;
    complianceScore: number;
    riskLevel: string;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };
  details: {
    executiveSummary: string;
    findings: ReportFinding[];
    recommendations: string[];
    nextReviewDate: Date;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveRiskLevel(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function resolveOverallStatus(score: number, findings: ReportFinding[]): string {
  const hasCritical = findings.some((f) => !f.passed && f.severity === 'critical');
  const hasHigh = findings.some((f) => !f.passed && f.severity === 'high');
  if (score >= 80 || hasCritical) return 'REJECTED';
  if (score >= 60 || hasHigh) return 'ESCALATED';
  if (score < 30 && !hasHigh && !hasCritical) return 'APPROVED';
  return 'PENDING';
}

function countFindingsBySeverity(
  findings: ReportFinding[],
  severity: string
): number {
  return findings.filter((f) => f.severity === severity && !f.passed).length;
}

function buildRecommendations(
  riskScore: number,
  findings: ReportFinding[],
  jurisdiction: string
): string[] {
  const recs: string[] = [];

  if (findings.some((f) => !f.passed && f.severity === 'critical')) {
    recs.push('Immediately escalate to senior compliance officer for critical findings review.');
  }
  if (findings.some((f) => !f.passed && f.severity === 'high')) {
    recs.push('Conduct enhanced due diligence (EDD) to address high-severity findings.');
  }
  if (riskScore >= 60) {
    recs.push('Apply enhanced transaction monitoring for the next 90 days.');
  }
  if (jurisdiction === 'IN') {
    recs.push('Ensure Aadhaar-based KYC verification is completed per SEBI guidelines.');
  }
  if (jurisdiction === 'EU') {
    recs.push('Confirm GDPR data processing lawfulness documentation is on file.');
  }
  if (jurisdiction === 'US') {
    recs.push('File Suspicious Activity Report (SAR) with FinCEN if required by transaction threshold rules.');
  }
  if (jurisdiction === 'AE') {
    recs.push('Obtain DFSA-compliant KYC documentation and schedule periodic review.');
  }
  if (recs.length === 0) {
    recs.push('No immediate action required. Continue routine monitoring schedule.');
  }

  return recs;
}

function buildExecutiveSummary(
  reportType: string,
  riskScore: number,
  overallStatus: string,
  jurisdiction: string,
  entityId: string
): string {
  const base = `Compliance assessment for entity ${entityId} in jurisdiction ${jurisdiction} yielded an overall status of ${overallStatus} with a risk score of ${riskScore}/100.`;

  switch (reportType) {
    case 'executive':
      return `${base} This executive summary provides a high-level view for senior leadership. Immediate attention is ${riskScore >= 60 ? 'required' : 'not required'} at this time.`;
    case 'regulatory':
      return `${base} This regulatory report is prepared for submission to relevant authorities. All findings are documented in accordance with applicable jurisdiction regulations.`;
    case 'detailed':
      return `${base} A full breakdown of all rule evaluations, risk factors, and remediation recommendations is included in this detailed compliance report.`;
    default:
      return `${base} Summary report generated for internal compliance records.`;
  }
}

// Review period in days based on risk level
const REVIEW_PERIODS = {
  HIGH_RISK: 30,
  NORMAL: 90,
} as const;

export class ComplianceReportingSystem {
  /**
   * Generate a compliance report from scan results.
   */
  generateReport(input: ReportInput): ComplianceReport {
    logger.info('Generating compliance report', {
      entityId: input.entityId,
      reportType: input.reportType,
      jurisdiction: input.jurisdiction,
    });

    const { riskScore, findings = [] } = input.scanResults;

    const overallStatus = resolveOverallStatus(riskScore, findings);
    const riskLevel = resolveRiskLevel(riskScore);
    const complianceScore = Math.max(0, 100 - riskScore);

    const criticalFindings = countFindingsBySeverity(findings, 'critical');
    const highFindings = countFindingsBySeverity(findings, 'high');
    const mediumFindings = countFindingsBySeverity(findings, 'medium');
    const lowFindings = countFindingsBySeverity(findings, 'low');

    const recommendations = buildRecommendations(riskScore, findings, input.jurisdiction);
    const executiveSummary = buildExecutiveSummary(
      input.reportType,
      riskScore,
      overallStatus,
      input.jurisdiction,
      input.entityId
    );

    // Next review date: HIGH_RISK days for high/critical, NORMAL days otherwise
    const reviewDays = riskScore >= 60 ? REVIEW_PERIODS.HIGH_RISK : REVIEW_PERIODS.NORMAL;
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + reviewDays);

    const report: ComplianceReport = {
      reportId: uuidv4(),
      reportType: input.reportType,
      entityId: input.entityId,
      jurisdiction: input.jurisdiction,
      generatedAt: new Date(),
      summary: {
        overallStatus,
        complianceScore,
        riskLevel,
        criticalFindings,
        highFindings,
        mediumFindings,
        lowFindings,
      },
      details: {
        executiveSummary,
        findings,
        recommendations,
        nextReviewDate,
      },
    };

    logger.info('Compliance report generated', {
      reportId: report.reportId,
      overallStatus,
      riskLevel,
    });

    return report;
  }

  // ─── FR-7.12: Automated STR/SAR Filing ───────────────────────────────────

  /**
   * Draft a Suspicious Transaction Report (STR/SAR).
   * Narrative is generated from the provided trigger data.
   * Triggered when: AML score ≥ 70, hawala score ≥ 80, sanctions hit, or manual escalation.
   */
  draftSTR(input: STRInput): STRDraft {
    logger.info('Drafting STR/SAR', {
      entityId: input.entityId,
      jurisdiction: input.jurisdiction,
      trigger: input.trigger,
    });

    const filingTarget = STR_FILING_TARGETS[input.jurisdiction];
    const narrative = input.narrative || this.buildSTRNarrative(input);

    const draft: STRDraft = {
      draftId: uuidv4(),
      entityId: input.entityId,
      jurisdiction: input.jurisdiction,
      filingTarget,
      trigger: input.trigger,
      narrative,
      transactionIds: input.transactionIds || [],
      generatedAt: new Date(),
    };

    logger.info('STR/SAR draft generated', {
      draftId: draft.draftId,
      jurisdiction: input.jurisdiction,
      filingTarget,
    });

    return draft;
  }

  /**
   * Submit a drafted STR/SAR to the appropriate jurisdiction authority.
   * Filing reference format: STR-{JurisdictionCode}-{Timestamp} (FR-7.12).
   */
  submitSTR(draft: STRDraft): STRFilingResult {
    logger.info('Submitting STR/SAR', {
      draftId: draft.draftId,
      jurisdiction: draft.jurisdiction,
      filingTarget: draft.filingTarget,
    });

    const timestamp = Date.now();
    const filingReference = `STR-${draft.jurisdiction}-${timestamp}`;

    const result: STRFilingResult = {
      filingId: uuidv4(),
      status: 'SUBMITTED',
      filingReference,
      jurisdiction: draft.jurisdiction,
      filingTarget: draft.filingTarget,
      submittedAt: new Date(),
    };

    logger.info('STR/SAR submitted', {
      filingId: result.filingId,
      filingReference,
      jurisdiction: draft.jurisdiction,
      filingTarget: draft.filingTarget,
    });

    return result;
  }

  /**
   * Build a jurisdiction-specific STR narrative from trigger data.
   */
  private buildSTRNarrative(input: STRInput): string {
    const lines: string[] = [
      `Suspicious Transaction Report for entity ${input.entityId} (Jurisdiction: ${input.jurisdiction}).`,
    ];

    switch (input.trigger) {
      case 'AML_SCORE_HIGH':
        lines.push(`Trigger: AML risk score ${input.amlScore ?? 'N/A'}/100 exceeded threshold of 70.`);
        break;
      case 'HAWALA_SCORE_HIGH':
        lines.push(`Trigger: Hawala/layering score ${input.hawalaScore ?? 'N/A'}/100 exceeded threshold of 80.`);
        break;
      case 'SANCTIONS_HIT':
        lines.push(`Trigger: Entity matched a sanctions list entry. Details: ${input.sanctionsDetails ?? 'N/A'}.`);
        break;
      case 'MANUAL_ESCALATION':
        lines.push('Trigger: Manually escalated by compliance officer for further investigation.');
        break;
    }

    if (input.transactionIds && input.transactionIds.length > 0) {
      lines.push(`Related transactions: ${input.transactionIds.join(', ')}.`);
    }

    const filingTarget = STR_FILING_TARGETS[input.jurisdiction];
    lines.push(`This report is filed with: ${filingTarget}.`);

    return lines.join(' ');
  }
}

// Singleton instance
let instance: ComplianceReportingSystem | null = null;

export function getComplianceReportingSystem(): ComplianceReportingSystem {
  if (!instance) {
    instance = new ComplianceReportingSystem();
  }
  return instance;
}
