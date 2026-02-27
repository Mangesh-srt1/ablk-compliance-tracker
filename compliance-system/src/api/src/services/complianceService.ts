/**
 * Compliance Service
 * Business logic for compliance operations
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import db from '../config/database';
import SqlLoader from '../utils/sqlLoader';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/compliance-service.log' }),
  ],
});

const sqlLoader = SqlLoader.getInstance();

export interface ComplianceCheck {
  id: string;
  transactionId: string;
  checkType: 'kyc' | 'aml' | 'sebi' | 'full';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated';
  riskScore?: number;
  findings?: any;
  agentId?: string;
  createdAt: Date;
  completedAt?: Date;
  requestedBy: string;
}

export interface ComplianceRule {
  id: string;
  ruleName: string;
  ruleType: string;
  conditions: any;
  actions: any;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Compliance Decision represents aggregated compliance verdict
 */
export interface ComplianceDecision {
  decisionId: string;
  entityId: string;
  kycStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING';
  amlStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING';
  overallStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING';
  riskScore: number;
  kycRiskScore?: number;
  amlRiskScore?: number;
  combinedFlags: string[];
  recommendations: string[];
  jurisdiction: string;
  approvedBy?: string;
  approvalDate?: Date;
  expiryDate?: Date;
  auditTrail: AuditEntry[];
}

/**
 * Audit entry for compliance decisions
 */
export interface AuditEntry {
  timestamp: Date;
  action: string;
  userId: string;
  details: any;
  status: 'success' | 'failure';
}

/**
 * Compliance Rule with enhanced evaluation logic
 */
export interface EnhancedComplianceRule extends ComplianceRule {
  jurisdictions?: string[];
  riskThresholds?: {
    low: number;
    medium: number;
    high: number;
  };
  autoEscalate?: boolean;
  notifyChannels?: string[];
}

export class ComplianceService {
  private auditTrail: Map<string, AuditEntry[]> = new Map();

  /**
   * Aggregate compliance decision from KYC and AML results
   */
  async aggregateComplianceDecision(
    entityId: string,
    kycResult: any,
    amlResult: any,
    jurisdiction: string,
    userId?: string
  ): Promise<ComplianceDecision> {
    const decisionId = uuidv4();
    const timestamp = new Date();

    try {
      logger.info('Aggregating compliance decision', {
        decisionId,
        entityId,
        kycScore: kycResult?.score,
        amlScore: amlResult?.score,
        jurisdiction,
        userId,
      });

      // Extract risk scores
      const kycRiskScore = kycResult?.score || 0;
      const amlRiskScore = amlResult?.score || 0;
      const overallScore = (kycRiskScore + amlRiskScore) / 2;

      // Determine individual statuses
      const kycStatus = this.determineStatus(kycRiskScore);
      const amlStatus = this.determineStatus(amlRiskScore);

      // Combine flags from both checks
      const combinedFlags: string[] = [
        ...(kycResult?.flags?.map((f: any) => f.type) || []),
        ...(amlResult?.flags?.map((f: any) => f.type) || []),
      ];

      // Determine overall status (most restrictive wins)
      const overallStatus = this.determineOverallStatus(kycStatus, amlStatus);

      // Generate combined recommendations
      const recommendations = [
        ...(kycResult?.recommendations || []),
        ...(amlResult?.recommendations || []),
      ];

      const decision: ComplianceDecision = {
        decisionId,
        entityId,
        kycStatus,
        amlStatus,
        overallStatus,
        riskScore: overallScore,
        kycRiskScore,
        amlRiskScore,
        combinedFlags: [...new Set(combinedFlags)],
        recommendations: [...new Set(recommendations)],
        jurisdiction,
        auditTrail: [],
      };

      // Add audit trail entry
      const auditEntry: AuditEntry = {
        timestamp,
        action: 'DECISION_AGGREGATED',
        userId: userId || 'SYSTEM',
        details: {
          kycStatus,
          amlStatus,
          overallScore,
          flagCount: combinedFlags.length,
        },
        status: 'success',
      };
      decision.auditTrail.push(auditEntry);

      // Store decision in database
      await this.storeComplianceDecision(decision);

      return decision;
    } catch (error) {
      logger.error('Error aggregating compliance decision', {
        decisionId,
        entityId,
        error: (error as any).message,
      });

      // Log failure audit trail
      const failureEntry: AuditEntry = {
        timestamp,
        action: 'DECISION_AGGREGATION_FAILED',
        userId: userId || 'SYSTEM',
        details: { error: (error as any).message },
        status: 'failure',
      };
      
      if (!this.auditTrail.has(entityId)) {
        this.auditTrail.set(entityId, []);
      }
      this.auditTrail.get(entityId)!.push(failureEntry);

      throw error;
    }
  }

  /**
   * Determine compliance status based on risk score
   */
  private determineStatus(riskScore: number): 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING' {
    if (riskScore >= 70) return 'REJECTED';
    if (riskScore >= 40) return 'ESCALATED';
    if (riskScore >= 20) return 'PENDING';
    return 'APPROVED';
  }

  /**
   * Determine overall status (most restrictive)
   */
  private determineOverallStatus(
    kycStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING',
    amlStatus: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING'
  ): 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING' {
    const statusPriority: { [key: string]: number } = {
      REJECTED: 4,
      ESCALATED: 3,
      PENDING: 2,
      APPROVED: 1,
    };

    const maxPriority = Math.max(statusPriority[kycStatus] || 0, statusPriority[amlStatus] || 0);
    for (const [status, priority] of Object.entries(statusPriority)) {
      if (priority === maxPriority) return status as 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'PENDING';
    }
    return 'APPROVED';
  }

  /**
   * Store compliance decision in database
   */
  private async storeComplianceDecision(decision: ComplianceDecision): Promise<void> {
    const query = sqlLoader.getQuery('compliance_checks/insert_compliance_decision');

    try {
      await db.query(query, [
        decision.decisionId,
        decision.entityId,
        decision.overallStatus,
        decision.riskScore,
        decision.jurisdiction,
        JSON.stringify(decision.combinedFlags),
        JSON.stringify(decision.recommendations),
        JSON.stringify(decision.auditTrail),
      ]);

      logger.info('Compliance decision stored', {
        decisionId: decision.decisionId,
        entityId: decision.entityId,
        status: decision.overallStatus,
      });
    } catch (error) {
      logger.error('Error storing compliance decision', {
        decisionId: decision.decisionId,
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Apply compliance rules to a decision
   */
  async applyComplianceRules(decision: ComplianceDecision): Promise<string[]> {
    const applicableRules: string[] = [];

    try {
      logger.info('Applying compliance rules', {
        decisionId: decision.decisionId,
        jurisdiction: decision.jurisdiction,
      });

      // Get rules for jurisdiction
      const rulesQuery = sqlLoader.getQuery('compliance_checks/get_rules_by_jurisdiction');
      const rulesResult = await db.query(rulesQuery, [decision.jurisdiction]);

      for (const rule of rulesResult.rows) {
        // Check if rule conditions are met
        const conditions = rule.conditions || {};
        const riskThreshold = conditions.riskThreshold || 70;

        if (decision.riskScore >= riskThreshold) {
          applicableRules.push(rule.rule_name);

          // Execute rule actions
          if (rule.actions?.escalate === true) {
            decision.overallStatus = 'ESCALATED';
          }
          if (rule.actions?.notify === true) {
            logger.warn('Compliance rule triggered - notification sent', {
              ruleName: rule.rule_name,
              decisionId: decision.decisionId,
            });
          }

          // Log in audit trail
          decision.auditTrail.push({
            timestamp: new Date(),
            action: `RULE_APPLIED_${rule.rule_name}`,
            userId: 'COMPLIANCE_ENGINE',
            details: { rule: rule.rule_name, actions: rule.actions },
            status: 'success',
          });
        }
      }

      return applicableRules;
    } catch (error) {
      logger.error('Error applying compliance rules', {
        decisionId: decision.decisionId,
        error: (error as any).message,
      });
      return [];
    }
  }

  /**
   * Approve compliance decision
   */
  async approveDecision(decisionId: string, approvedBy: string): Promise<void> {
    const timestamp = new Date();

    try {
      logger.info('Approving compliance decision', {
        decisionId,
        approvedBy,
      });

      const query = sqlLoader.getQuery('compliance_checks/approve_decision');
      await db.query(query, [decisionId, approvedBy, timestamp]);

    } catch (error) {
      logger.error('Error approving decision', {
        decisionId,
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Reject compliance decision
   */
  async rejectDecision(decisionId: string, rejectedBy: string, reason: string): Promise<void> {
    const timestamp = new Date();

    try {
      logger.info('Rejecting compliance decision', {
        decisionId,
        rejectedBy,
        reason,
      });

      const query = sqlLoader.getQuery('compliance_checks/reject_decision');
      await db.query(query, [decisionId, rejectedBy, timestamp, reason]);

    } catch (error) {
      logger.error('Error rejecting decision', {
        decisionId,
        error: (error as any).message,
      });
      throw error;
    }
  }

  /**
   * Get audit trail for entity
   */
  async getAuditTrail(entityId: string): Promise<AuditEntry[]> {
    try {
      const query = sqlLoader.getQuery('compliance_checks/get_audit_trail');
      const result = await db.query(query, [entityId]);

      return result.rows.map((row: any) => ({
        timestamp: row.timestamp,
        action: row.action,
        userId: row.user_id,
        details: row.details,
        status: row.status,
      }));
    } catch (error) {
      logger.error('Error fetching audit trail', {
        entityId,
        error: (error as any).message,
      });
      return [];
    }
  }

  /**
   * Get compliance checks with pagination and filtering
   */
  async getComplianceChecks(filters: {
    page: number;
    limit: number;
    status?: string;
    agentType?: string;
    riskLevel?: string;
    userId?: string;
  }): Promise<{
    checks: ComplianceCheck[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit, status, agentType, riskLevel } = filters;
    const offset = (page - 1) * limit;

    // Prepare parameters for externalized queries
    const riskThreshold = riskLevel
      ? riskLevel === 'high'
        ? 0.7
        : riskLevel === 'medium'
          ? 0.3
          : 0
      : null;

    const countQuery = sqlLoader.getQuery('compliance_checks/get_checks_count');
    const dataQuery = sqlLoader.getQuery('compliance_checks/get_checks_paginated');

    const queryParams = [status || null, agentType || null, riskThreshold, limit, offset];

    try {
      const [countResult, dataResult] = await Promise.all([
        db.query(countQuery, queryParams.slice(0, 3)), // count query uses first 3 params
        db.query(dataQuery, queryParams), // data query uses all 5 params
      ]);

      const total = Number.parseInt(countResult.rows[0].total, 10);
      const totalPages = Math.ceil(total / limit);

      const checks: ComplianceCheck[] = dataResult.rows.map((row) => ({
        id: row.id,
        transactionId: row.transaction_id,
        checkType: row.check_type,
        status: row.status,
        riskScore: row.risk_score,
        findings: row.findings,
        agentId: row.agent_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        requestedBy: row.requested_by,
      }));

      return {
        checks,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Error fetching compliance checks:', error);
      throw error;
    }
  }

  /**
   * Get compliance check by ID
   */
  async getComplianceCheckById(id: string): Promise<ComplianceCheck | null> {
    const query = `
      SELECT
        cc.id,
        cc.transaction_id,
        cc.check_type,
        cc.status,
        cc.risk_score,
        cc.findings,
        cc.agent_id,
        cc.created_at,
        cc.completed_at,
        cc.requested_by,
        ca.name as agent_name,
        ca.agent_type
      FROM compliance.compliance_checks cc
      LEFT JOIN compliance.compliance_agents ca ON cc.agent_id = ca.id
      WHERE cc.id = $1
    `;

    try {
      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        transactionId: row.transaction_id,
        checkType: row.check_type,
        status: row.status,
        riskScore: row.risk_score,
        findings: row.findings,
        agentId: row.agent_id,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        requestedBy: row.requested_by,
      };
    } catch (error) {
      logger.error('Error fetching compliance check by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new compliance check
   */
  async createComplianceCheck(data: {
    transactionId: string;
    checkType: string;
    priority: string;
    requestedBy: string;
  }): Promise<ComplianceCheck> {
    const { transactionId, checkType, priority, requestedBy } = data;

    // Determine which agent to use based on check type
    let agentType: string;
    switch (checkType) {
      case 'kyc':
        agentType = 'kyc';
        break;
      case 'aml':
        agentType = 'aml';
        break;
      case 'sebi':
        agentType = 'sebi';
        break;
      default:
        agentType = 'supervisor';
    }

    // Get agent ID
    const agentQuery = sqlLoader.getQuery('compliance_checks/get_active_agent');
    const agentResult = await db.query(agentQuery, [agentType, 'active']);

    if (agentResult.rows.length === 0) {
      throw new Error(`No active ${agentType} agent available`);
    }

    const agentId = agentResult.rows[0].id;

    const insertQuery = sqlLoader.getQuery('compliance_checks/insert_check');

    try {
      const result = await db.query(insertQuery, [transactionId, checkType, agentId, requestedBy]);

      const row = result.rows[0];
      logger.info('Compliance check created', {
        checkId: row.id,
        transactionId,
        checkType,
        agentType,
      });

      return {
        id: row.id,
        transactionId: row.transaction_id,
        checkType: row.check_type,
        status: row.status,
        agentId: row.agent_id,
        createdAt: row.created_at,
        requestedBy: row.requested_by,
      };
    } catch (error) {
      logger.error('Error creating compliance check:', error);
      throw error;
    }
  }

  /**
   * Approve compliance check
   */
  async approveComplianceCheck(
    checkId: string,
    approvedBy: string,
    notes?: string
  ): Promise<boolean> {
    const updateQuery = sqlLoader.getQuery('compliance_checks/approve_check');

    const approvalData = {
      approved: true,
      approvedBy,
      approvedAt: new Date().toISOString(),
      notes: notes || null,
    };

    try {
      const result = await db.query(updateQuery, [
        checkId,
        approvedBy,
        JSON.stringify(approvalData),
      ]);

      if (result.rows.length > 0) {
        logger.info('Compliance check approved', { checkId, approvedBy });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error approving compliance check:', error);
      throw error;
    }
  }

  /**
   * Reject compliance check
   */
  async rejectComplianceCheck(
    checkId: string,
    rejectedBy: string,
    reason: string,
    notes?: string
  ): Promise<boolean> {
    const updateQuery = sqlLoader.getQuery('compliance_checks/reject_check');
    const rejectionData = {
      notes: notes || null,
    };

    try {
      const result = await db.query(updateQuery, [
        checkId,
        rejectedBy,
        reason,
        JSON.stringify(rejectionData),
      ]);

      if (result.rows.length > 0) {
        logger.info('Compliance check rejected', { checkId, rejectedBy, reason });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error rejecting compliance check:', error);
      throw error;
    }
  }

  /**
   * Get compliance rules
   */
  async getComplianceRules(activeOnly: boolean = true): Promise<ComplianceRule[]> {
    const query = sqlLoader.getQuery('compliance_rules/get_rules');

    try {
      const result = await db.query(query, [activeOnly]);

      return result.rows.map((row) => ({
        id: row.id,
        ruleName: row.rule_name,
        ruleType: row.rule_type,
        conditions: row.conditions,
        actions: row.actions,
        priority: row.priority,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('Error fetching compliance rules:', error);
      throw error;
    }
  }

  /**
   * Create compliance rule
   */
  async createComplianceRule(data: {
    ruleName: string;
    ruleType: string;
    conditions: any;
    actions: any;
    priority?: number;
    createdBy: string;
  }): Promise<ComplianceRule> {
    const { ruleName, ruleType, conditions, actions, priority = 5, createdBy } = data;

    const insertQuery = sqlLoader.getQuery('compliance_rules/insert_rule');

    try {
      const result = await db.query(insertQuery, [
        ruleName,
        ruleType,
        JSON.stringify(conditions),
        JSON.stringify(actions),
        priority,
        true,
      ]);

      const row = result.rows[0];
      logger.info('Compliance rule created', {
        ruleId: row.id,
        ruleName,
        ruleType,
        createdBy,
      });

      return {
        id: row.id,
        ruleName: row.rule_name,
        ruleType: row.rule_type,
        conditions: row.conditions,
        actions: row.actions,
        priority: row.priority,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('Error creating compliance rule:', error);
      throw error;
    }
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(): Promise<any> {
    const metricsQuery = `
      SELECT
        COUNT(*) as total_checks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_checks,
        COUNT(CASE WHEN status = 'escalated' THEN 1 END) as escalated_checks,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_checks,
        AVG(CASE WHEN risk_score IS NOT NULL THEN risk_score END) as avg_risk_score,
        COUNT(CASE WHEN risk_score > 0.7 THEN 1 END) as high_risk_checks,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as checks_last_24h
      FROM compliance.compliance_checks
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;

    try {
      const result = await db.query(metricsQuery);
      const metrics = result.rows[0];

      return {
        totalChecks: Number.parseInt(metrics.total_checks, 10),
        completedChecks: Number.parseInt(metrics.completed_checks, 10),
        escalatedChecks: Number.parseInt(metrics.escalated_checks, 10),
        failedChecks: Number.parseInt(metrics.failed_checks, 10),
        averageRiskScore: Number.parseFloat(metrics.avg_risk_score) || 0,
        highRiskChecks: Number.parseInt(metrics.high_risk_checks, 10),
        checksLast24Hours: Number.parseInt(metrics.checks_last_24h, 10),
        successRate:
          metrics.total_checks > 0
            ? (Number.parseInt(metrics.completed_checks, 10) /
                Number.parseInt(metrics.total_checks, 10)) *
              100
            : 0,
      };
    } catch (error) {
      logger.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }
}
