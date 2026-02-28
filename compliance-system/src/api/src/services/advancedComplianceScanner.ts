/**
 * Advanced Compliance Scanner
 * Orchestrates RiskAssessmentEngine, MultiJurisdictionalMonitor, and ComplianceReportingSystem
 * to produce comprehensive compliance scan results.
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { RiskAssessmentEngine } from './riskAssessmentEngine';
import type { RiskAssessmentResult } from './riskAssessmentEngine';
import { MultiJurisdictionalMonitor } from './multiJurisdictionalMonitor';
import type { JurisdictionCheckResult } from './multiJurisdictionalMonitor';
import { ComplianceReportingSystem } from './complianceReportingSystem';
import type { ComplianceReport } from './complianceReportingSystem';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/advanced-compliance-scanner.log' }),
  ],
});

// Thresholds used during scan orchestration
const MULTI_JURISDICTION_THRESHOLD = 2;  // Number of jurisdictions above which risk is elevated
const MULTI_JURISDICTION_RISK_HIGH = 40; // Risk value when entity spans many jurisdictions
const MULTI_JURISDICTION_RISK_LOW = 20;  // Risk value for standard jurisdiction footprint
const TRANSACTION_VOLUME_DIVISOR = 10_000; // Normalises transaction amount to 0-100 scale

export interface AdvancedScanInput {
  entityId: string;
  scanType: 'comprehensive' | 'targeted' | 'regulatory' | 'ad-hoc';
  jurisdiction: string[];
  entityData: {
    name: string;
    country?: string;
    age?: number;
    pepStatus?: boolean;
  };
  kycScore?: number;
  amlScore?: number;
  sanctionsMatch?: boolean;
  transactionData?: {
    amount?: number;
    currency?: string;
  };
}

export interface AdvancedScanResult {
  scanId: string;
  entityId: string;
  scanType: string;
  status: 'completed' | 'failed';
  riskAssessment: RiskAssessmentResult;
  jurisdictionFindings: JurisdictionCheckResult;
  report: ComplianceReport;
  overallStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING';
  processingTime: number;
  timestamp: Date;
}

function determineOverallStatus(
  riskScore: number,
  jurisdictionFindings: JurisdictionCheckResult
): 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING' {
  const hasCritical = jurisdictionFindings.findings.some(
    (f) => !f.passed && f.severity === 'critical'
  );
  const hasHigh = jurisdictionFindings.findings.some(
    (f) => !f.passed && f.severity === 'high'
  );

  if (riskScore >= 80 || hasCritical) return 'REJECTED';
  if (riskScore >= 60 || hasHigh) return 'ESCALATED';
  if (riskScore < 30 && !hasHigh && !hasCritical) return 'APPROVED';
  return 'PENDING';
}

export class AdvancedComplianceScanner {
  constructor(
    private readonly riskEngine: RiskAssessmentEngine,
    private readonly jurisdictionMonitor: MultiJurisdictionalMonitor,
    private readonly reportingSystem: ComplianceReportingSystem
  ) {}

  /**
   * Run a full advanced compliance scan for the given entity.
   */
  async runScan(input: AdvancedScanInput): Promise<AdvancedScanResult> {
    const scanId = uuidv4();
    const startTime = Date.now();

    logger.info('Advanced compliance scan started', {
      scanId,
      entityId: input.entityId,
      scanType: input.scanType,
      jurisdictions: input.jurisdiction,
    });

    try {
      // Step 1: Risk Assessment
      const riskAssessment = this.riskEngine.assessRisk({
        kycScore: input.kycScore,
        amlScore: input.amlScore,
        sanctionsMatch: input.sanctionsMatch,
        pepMatch: input.entityData.pepStatus,
        jurisdictionRisk: input.jurisdiction.length > MULTI_JURISDICTION_THRESHOLD
          ? MULTI_JURISDICTION_RISK_HIGH
          : MULTI_JURISDICTION_RISK_LOW,
        transactionVolume: input.transactionData?.amount
          ? Math.min(100, input.transactionData.amount / TRANSACTION_VOLUME_DIVISOR)
          : undefined,
      });

      // Step 2: Multi-Jurisdictional Check
      const jurisdictionFindings = this.jurisdictionMonitor.checkJurisdictions({
        entityId: input.entityId,
        jurisdiction: input.jurisdiction,
        entityData: {
          name: input.entityData.name,
          country: input.entityData.country,
          age: input.entityData.age,
          pepStatus: input.entityData.pepStatus,
          sanctionsMatch: input.sanctionsMatch,
        },
        transactionData: input.transactionData,
      });

      // Step 3: Determine overall status
      const overallStatus = determineOverallStatus(riskAssessment.riskScore, jurisdictionFindings);

      // Step 4: Generate Report
      const primaryJurisdiction = input.jurisdiction[0] ?? 'GLOBAL';
      const reportType =
        input.scanType === 'regulatory'
          ? 'regulatory'
          : input.scanType === 'comprehensive'
            ? 'detailed'
            : 'summary';

      const report = this.reportingSystem.generateReport({
        reportType: reportType as 'summary' | 'detailed' | 'executive' | 'regulatory',
        entityId: input.entityId,
        jurisdiction: primaryJurisdiction,
        scanResults: {
          riskScore: riskAssessment.riskScore,
          findings: jurisdictionFindings.findings.map((f) => ({
            severity: f.severity,
            description: f.description,
            passed: f.passed,
          })),
        },
      });

      const processingTime = Date.now() - startTime;

      const result: AdvancedScanResult = {
        scanId,
        entityId: input.entityId,
        scanType: input.scanType,
        status: 'completed',
        riskAssessment,
        jurisdictionFindings,
        report,
        overallStatus,
        processingTime,
        timestamp: new Date(),
      };

      logger.info('Advanced compliance scan completed', {
        scanId,
        entityId: input.entityId,
        overallStatus,
        processingTime,
      });

      return result;
    } catch (err) {
      const processingTime = Date.now() - startTime;
      logger.error('Advanced compliance scan failed', {
        scanId,
        entityId: input.entityId,
        error: err instanceof Error ? err.message : String(err),
      });

      // Re-throw so the caller (route) can handle it
      throw err;
    }
  }
}

// Singleton instance using default service instances
let instance: AdvancedComplianceScanner | null = null;

export function getAdvancedComplianceScanner(): AdvancedComplianceScanner {
  if (!instance) {
    instance = new AdvancedComplianceScanner(
      new RiskAssessmentEngine(),
      new MultiJurisdictionalMonitor(),
      new ComplianceReportingSystem()
    );
  }
  return instance;
}
