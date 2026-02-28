/**
 * Analytics Service
 * Provides compliance metrics, risk trends, and jurisdiction analytics.
 */

import winston from 'winston';
import db from '../config/database';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/analytics.log' }),
  ],
});

export interface ComplianceMetrics {
  totalChecks: number;
  approvedChecks: number;
  rejectedChecks: number;
  escalatedChecks: number;
  approvalRate: number;
  rejectionRate: number;
  escalationRate: number;
  averageRiskScore: number;
  averageProcessingTime: number;
}

export interface JurisdictionMetrics {
  jurisdiction: string;
  totalChecks: number;
  riskDistribution: { low: number; medium: number; high: number };
  topFlags: string[];
}

export interface RiskTrend {
  date: string;
  averageRiskScore: number;
  totalChecks: number;
  highRiskCount: number;
}

export class AnalyticsService {
  /**
   * Get overall compliance metrics for a date range and optional jurisdiction.
   */
  async getComplianceMetrics(
    startDate?: Date,
    endDate?: Date,
    jurisdiction?: string
  ): Promise<ComplianceMetrics> {
    try {
      logger.info('Fetching compliance metrics', { startDate, endDate, jurisdiction });

      const params: unknown[] = [];
      const conditions: string[] = [];
      let idx = 1;

      if (startDate) {
        conditions.push(`created_at >= $${idx++}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`created_at <= $${idx++}`);
        params.push(endDate);
      }
      if (jurisdiction) {
        conditions.push(`jurisdiction = $${idx++}`);
        params.push(jurisdiction);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await db.query<{
        total_checks: string;
        approved_checks: string;
        rejected_checks: string;
        escalated_checks: string;
        avg_risk_score: string | null;
        avg_processing_time: string | null;
      }>(
        `SELECT
           COUNT(*) AS total_checks,
           SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_checks,
           SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_checks,
           SUM(CASE WHEN status = 'ESCALATED' THEN 1 ELSE 0 END) AS escalated_checks,
           AVG(risk_score) AS avg_risk_score,
           AVG(processing_time_ms) AS avg_processing_time
         FROM compliance_checks
         ${whereClause}`,
        params
      );

      const row = result.rows[0];
      const total = parseInt(row.total_checks, 10) || 0;
      const approved = parseInt(row.approved_checks, 10) || 0;
      const rejected = parseInt(row.rejected_checks, 10) || 0;
      const escalated = parseInt(row.escalated_checks, 10) || 0;

      return {
        totalChecks: total,
        approvedChecks: approved,
        rejectedChecks: rejected,
        escalatedChecks: escalated,
        approvalRate: total > 0 ? approved / total : 0,
        rejectionRate: total > 0 ? rejected / total : 0,
        escalationRate: total > 0 ? escalated / total : 0,
        averageRiskScore: row.avg_risk_score ? parseFloat(row.avg_risk_score) : 0,
        averageProcessingTime: row.avg_processing_time ? parseFloat(row.avg_processing_time) : 0,
      };
    } catch (error) {
      logger.error('Failed to fetch compliance metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get jurisdiction-specific metrics including risk distribution and top flags.
   */
  async getJurisdictionMetrics(jurisdiction: string): Promise<JurisdictionMetrics> {
    try {
      logger.info('Fetching jurisdiction metrics', { jurisdiction });

      const [totalsResult, flagsResult] = await Promise.all([
        db.query<{
          total_checks: string;
          low_risk: string;
          medium_risk: string;
          high_risk: string;
        }>(
          `SELECT
             COUNT(*) AS total_checks,
             SUM(CASE WHEN risk_score < 30 THEN 1 ELSE 0 END) AS low_risk,
             SUM(CASE WHEN risk_score >= 30 AND risk_score < 70 THEN 1 ELSE 0 END) AS medium_risk,
             SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) AS high_risk
           FROM compliance_checks
           WHERE jurisdiction = $1`,
          [jurisdiction]
        ),
        db.query<{ flag: string; flag_count: string }>(
          `SELECT unnest(flags) AS flag, COUNT(*) AS flag_count
           FROM compliance_checks
           WHERE jurisdiction = $1
             AND flags IS NOT NULL
           GROUP BY flag
           ORDER BY flag_count DESC
           LIMIT 5`,
          [jurisdiction]
        ),
      ]);

      const totals = totalsResult.rows[0];
      return {
        jurisdiction,
        totalChecks: parseInt(totals.total_checks, 10) || 0,
        riskDistribution: {
          low: parseInt(totals.low_risk, 10) || 0,
          medium: parseInt(totals.medium_risk, 10) || 0,
          high: parseInt(totals.high_risk, 10) || 0,
        },
        topFlags: flagsResult.rows.map((r) => r.flag),
      };
    } catch (error) {
      logger.error('Failed to fetch jurisdiction metrics', {
        error: error instanceof Error ? error.message : String(error),
        jurisdiction,
      });
      throw error;
    }
  }

  /**
   * Get daily risk trends over the specified number of days.
   */
  async getRiskTrends(days = 30, jurisdiction?: string): Promise<RiskTrend[]> {
    try {
      logger.info('Fetching risk trends', { days, jurisdiction });

      const safeDays = Math.min(Math.max(1, days), 365);
      const params: unknown[] = [safeDays];
      let jurisdictionClause = '';

      if (jurisdiction) {
        params.push(jurisdiction);
        jurisdictionClause = `AND jurisdiction = $${params.length}`;
      }

      const result = await db.query<{
        date: string;
        avg_risk_score: string | null;
        total_checks: string;
        high_risk_count: string;
      }>(
        `SELECT
           DATE(created_at) AS date,
           AVG(risk_score) AS avg_risk_score,
           COUNT(*) AS total_checks,
           SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) AS high_risk_count
         FROM compliance_checks
         WHERE created_at >= NOW() - INTERVAL '1 day' * $1
           ${jurisdictionClause}
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        params
      );

      return result.rows.map((r) => ({
        date: r.date,
        averageRiskScore: r.avg_risk_score ? parseFloat(r.avg_risk_score) : 0,
        totalChecks: parseInt(r.total_checks, 10) || 0,
        highRiskCount: parseInt(r.high_risk_count, 10) || 0,
      }));
    } catch (error) {
      logger.error('Failed to fetch risk trends', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get the top risk flags across all compliance checks.
   */
  async getTopRiskFactors(limit = 10): Promise<Array<{ flag: string; count: number }>> {
    try {
      logger.info('Fetching top risk factors', { limit });

      const safeLimit = Math.min(Math.max(1, limit), 100);
      const result = await db.query<{ flag: string; flag_count: string }>(
        `SELECT unnest(flags) AS flag, COUNT(*) AS flag_count
         FROM compliance_checks
         WHERE flags IS NOT NULL
         GROUP BY flag
         ORDER BY flag_count DESC
         LIMIT $1`,
        [safeLimit]
      );

      return result.rows.map((r) => ({ flag: r.flag, count: parseInt(r.flag_count, 10) }));
    } catch (error) {
      logger.error('Failed to fetch top risk factors', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
