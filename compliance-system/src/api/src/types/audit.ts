/**
 * Audit Trail Types
 * Shared context and reporting types for compliance decision auditability.
 */

import { Jurisdiction } from './aml';

export enum AuditEventType {
  KYC_CHECK = 'KYC_CHECK',
  KYB_CHECK = 'KYB_CHECK',
  AML_CHECK = 'AML_CHECK',
  KYT_MONITORING = 'KYT_MONITORING',
  SANCTIONS_SCREENING = 'SANCTIONS_SCREENING',
  PEP_SCREENING = 'PEP_SCREENING',
  SAR_FILED = 'SAR_FILED',
  CTR_FILED = 'CTR_FILED',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

export enum ViolationType {
  SANCTIONS = 'SANCTIONS',
  STRUCTURING = 'STRUCTURING',
  TERRORISM_FINANCING = 'TERRORISM_FINANCING',
  FRAUD_PATTERN = 'FRAUD_PATTERN',
  ADVERSE_MEDIA = 'ADVERSE_MEDIA',
  UNDISCLOSED_UBO = 'UNDISCLOSED_UBO',
  PEP_RELATED_RISK = 'PEP_RELATED_RISK',
}

export interface AuditActor {
  id: string;
  type: 'SYSTEM' | 'USER' | 'SERVICE';
  role?: string;
  displayName?: string;
}

export interface AuditEvidence {
  type: string;
  reference: string;
  hash?: string;
  metadata?: Record<string, any>;
}

export interface AuditDecision {
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'REVIEW_REQUIRED';
  riskScore: number;
  rationale: string;
  recommendedActions: string[];
}

export interface AuditContext {
  auditId: string;
  correlationId: string;
  eventType: AuditEventType;
  entityId: string;
  jurisdiction: Jurisdiction;
  timestamp: string;
  actor: AuditActor;
  decision: AuditDecision;
  violations: ViolationType[];
  evidence: AuditEvidence[];
  sourceSystem?: string;
  metadata?: Record<string, any>;
}

export interface SuspiciousActivityReport {
  sarId: string;
  entityId: string;
  jurisdiction: Jurisdiction;
  filedAt: string;
  reasonSummary: string;
  triggeredViolations: ViolationType[];
  transactionReferences: string[];
  narrative: string;
  auditContextId: string;
}

export interface CurrencyTransactionReport {
  ctrId: string;
  entityId: string;
  jurisdiction: Jurisdiction;
  filedAt: string;
  thresholdAmount: number;
  currency: string;
  aggregatedAmount: number;
  transactionReferences: string[];
  auditContextId: string;
}
