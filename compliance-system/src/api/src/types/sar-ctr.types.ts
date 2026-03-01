/**
 * SAR/CTR Type Definitions
 * Structures for automated SAR and CTR filing
 */

export type SARJurisdiction = 'US' | 'AE' | 'IN' | 'SA' | 'EU';
export type CTRCurrency = 'USD' | 'AED' | 'INR' | 'SAR' | 'EUR';

export type SARTriggerType =
  | 'AML_SCORE_HIGH'      // AML risk ≥ 70
  | 'HAWALA_SCORE_HIGH'   // Structured transfer pattern
  | 'SANCTIONS_HIT'       // Sanctions match
  | 'STRUCTURING_PATTERN' // Multiple txs just below $10k
  | 'VELOCITY_ANOMALY'    // Transaction amount >> baseline
  | 'COUNTERPARTY_RISK'   // High-risk jurisdiction
  | 'MANUAL_ESCALATION';  // Compliance officer flag

export type SARStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'ACKNOWLEDGED_WITH_CORRECTION'
  | 'REJECTED'
  | 'CLOSED';

export type CTRStatus =
  | 'DRAFT'
  | 'PENDING_SUBMISSION'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'FILED'
  | 'REJECTED'
  | 'FILED_WITH_CORRECTIONS';

export interface SARTriggerCondition {
  type: SARTriggerType;
  isMatched: boolean;
  confidence: number; // 0-100
  description: string;
  evidence: string[];
}

export interface SARGenerationRequest {
  entityId: string;
  jurisdiction: SARJurisdiction;
  transactionIds: string[];
  amlScore?: number;
  hawalaScore?: number;
  sanctionsDetails?: string[];
  manualNote?: string;
}

export interface SARDraft {
  sarId: string;
  entityId: string;
  jurisdiction: SARJurisdiction;
  filingTarget: string; // e.g., "FinCEN BSA E-Filing"
  triggers: SARTriggerCondition[];
  narrative: string;
  transactionIds: string[];
  generatedAt: Date;
  status: SARStatus;
  createdBy: string; // User ID
}

export interface SARSubmission {
  sarId: string;
  filingId: string;
  filingReference: string; // SAR-{YYYY}{MM}{DD}-{Seq}
  jurisdiction: SARJurisdiction;
  filingTarget: string;
  submittedAt: Date;
  submittedBy: string;
  status: SARStatus;
  acknowledgmentDate?: Date;
  acknowledgmentNumber?: string;
}

export interface CTRGenerationRequest {
  entityId: string;
  currency: CTRCurrency;
  transactionIds: string[];
  aggregatedAmount: number;
  threshold?: number; // Default: $10,000 USD equivalent
  narrative?: string;
}

export interface CTRLine {
  sequenceNumber: number;
  transactionDate: Date;
  transactionAmount: number;
  currency: CTRCurrency;
  transactionType: 'wire' | 'cash' | 'check' | 'other';
  counterpartyName: string;
  counterpartyCountry: string;
  sourceCountry: string;
  destinationCountry: string;
}

export interface CTRForm {
  ctrId: string;
  filingVersion: string; // e.g., "2.0"
  filerId: string;
  reportingInstitution: string;
  reportingDate: Date;
  filingDeadline: Date;
  currency: CTRCurrency;
  totalAmount: number;
  transactionCount: number;
  entityName: string;
  entityType: 'individual' | 'business';
  entityCountry: string;
  lines: CTRLine[];
  narrative?: string;
  status: CTRStatus;
  generatedAt: Date;
  createdBy: string;
}

export interface CTRSubmission {
  ctrId: string;
  filingId: string;
  filingReference: string; // CTR-{YYYY}{MM}{DD}-{Seq}
  submittedAt: Date;
  submittedBy: string;
  filingTarget: string; // "FinCEN", "Banking Authority", etc.
  status: CTRStatus;
  acknowledgmentNumber?: string;
  acknowledgmentDate?: Date;
}

export interface SARCTRTriggerRule {
  jurisdiction: SARJurisdiction;
  triggerType: SARTriggerType;
  condition: string; // Description or code expression
  escalationDays: number; // Days to comply with filing
  narrative: string; // Auto-generated narrative
  enabled: boolean;
}

export interface SARCTRFilingAudit {
  auditId: string;
  reportId: string;
  reportType: 'SAR' | 'CTR';
  previousStatus: SARStatus | CTRStatus;
  newStatus: SARStatus | CTRStatus;
  changeReason: string;
  changedBy: string; // User ID
  changedAt: Date;
  metadata?: Record<string, any>;
}

export interface BatchFilingResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  filings: Array<{
    reportId: string;
    reportType: 'SAR' | 'CTR';
    status: 'SUCCESS' | 'FAILED';
    filingId?: string;
    filingReference?: string;
    error?: string;
  }>;
  submittedAt: Date;
}

export interface TriggerEvaluationResult {
  entityId: string;
  evaluatedAt: Date;
  matchedTriggers: SARTriggerCondition[];
  shouldGenerateSAR: boolean;
  shouldGenerateCTR: boolean;
  recommendedJurisdiction: SARJurisdiction;
  riskFactors: string[];
  recommendations: string[];
  confidence: number; // 0-100
}

export interface SARCTRConfiguration {
  jurisdiction: SARJurisdiction;
  amlScoreThreshold: number; // Default: 70
  hawalaScoreThreshold: number; // Default: 80
  velocityMultiplier: number; // Default: 3x baseline
  ctrAmountThreshold: number; // Default: $10,000
  ctrcurrency: CTRCurrency;
  escalationDays: number;
  enableAutoFiling: boolean;
  enableAutoSubmission: boolean;
  reviewerEmail?: string;
}
