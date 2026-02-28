/**
 * Compliance Reporting System
 * Generates structured compliance reports for entities.
 * Supports summary, detailed, executive, and regulatory report types.
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

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
}

// Singleton instance
let instance: ComplianceReportingSystem | null = null;

export function getComplianceReportingSystem(): ComplianceReportingSystem {
  if (!instance) {
    instance = new ComplianceReportingSystem();
  }
  return instance;
}
