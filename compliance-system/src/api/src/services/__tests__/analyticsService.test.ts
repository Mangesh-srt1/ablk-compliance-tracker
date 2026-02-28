/**
 * Analytics Service Unit Tests
 */

import { AnalyticsService } from '../analyticsService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createLogger: jest.fn(() => mockLogger),
    format: { combine: jest.fn(), timestamp: jest.fn(), json: jest.fn() },
    transports: { Console: jest.fn(), File: jest.fn() },
  };
});

import db from '../../config/database';

const mockQuery = db.query as jest.Mock;

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService();
  });

  // ─── getComplianceMetrics ─────────────────────────────────────────────────────

  describe('getComplianceMetrics', () => {
    const metricsRow = {
      total_checks: '100',
      approved_checks: '70',
      rejected_checks: '20',
      escalated_checks: '10',
      avg_risk_score: '35.5',
      avg_processing_time: '450',
    };

    it('should return correct rates for normal data', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [metricsRow] });

      const m = await service.getComplianceMetrics();

      expect(m.totalChecks).toBe(100);
      expect(m.approvedChecks).toBe(70);
      expect(m.rejectedChecks).toBe(20);
      expect(m.escalatedChecks).toBe(10);
      expect(m.approvalRate).toBeCloseTo(0.7);
      expect(m.rejectionRate).toBeCloseTo(0.2);
      expect(m.escalationRate).toBeCloseTo(0.1);
      expect(m.averageRiskScore).toBeCloseTo(35.5);
      expect(m.averageProcessingTime).toBeCloseTo(450);
    });

    it('should return zero rates when totalChecks is 0', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          total_checks: '0',
          approved_checks: '0',
          rejected_checks: '0',
          escalated_checks: '0',
          avg_risk_score: null,
          avg_processing_time: null,
        }],
      });

      const m = await service.getComplianceMetrics();

      expect(m.totalChecks).toBe(0);
      expect(m.approvalRate).toBe(0);
      expect(m.averageRiskScore).toBe(0);
    });

    it('should apply date and jurisdiction filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [metricsRow] });
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');

      await service.getComplianceMetrics(start, end, 'AE');

      const [, params] = mockQuery.mock.calls[0];
      expect(params).toContain(start);
      expect(params).toContain(end);
      expect(params).toContain('AE');
    });

    it('should throw on DB failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db error'));
      await expect(service.getComplianceMetrics()).rejects.toThrow('db error');
    });
  });

  // ─── getRiskTrends ────────────────────────────────────────────────────────────

  describe('getRiskTrends', () => {
    it('should return daily trend data', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', avg_risk_score: '25.0', total_checks: '10', high_risk_count: '2' },
          { date: '2024-01-02', avg_risk_score: '30.5', total_checks: '15', high_risk_count: '3' },
        ],
      });

      const trends = await service.getRiskTrends(7);

      expect(trends).toHaveLength(2);
      expect(trends[0].date).toBe('2024-01-01');
      expect(trends[0].averageRiskScore).toBeCloseTo(25.0);
      expect(trends[0].totalChecks).toBe(10);
      expect(trends[0].highRiskCount).toBe(2);
    });

    it('should cap days at 365', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getRiskTrends(9999);

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe(365);
    });

    it('should include jurisdiction filter when provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getRiskTrends(30, 'AE');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('jurisdiction');
      expect(params).toContain('AE');
    });

    it('should throw on DB failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('trend error'));
      await expect(service.getRiskTrends()).rejects.toThrow('trend error');
    });
  });

  // ─── getJurisdictionMetrics ───────────────────────────────────────────────────

  describe('getJurisdictionMetrics', () => {
    it('should return jurisdiction metrics with risk distribution', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ total_checks: '50', low_risk: '30', medium_risk: '15', high_risk: '5' }],
        })
        .mockResolvedValueOnce({
          rows: [
            { flag: 'PEP_MATCH', flag_count: '10' },
            { flag: 'SANCTIONS', flag_count: '5' },
          ],
        });

      const m = await service.getJurisdictionMetrics('AE');

      expect(m.jurisdiction).toBe('AE');
      expect(m.totalChecks).toBe(50);
      expect(m.riskDistribution.low).toBe(30);
      expect(m.riskDistribution.medium).toBe(15);
      expect(m.riskDistribution.high).toBe(5);
      expect(m.topFlags).toEqual(['PEP_MATCH', 'SANCTIONS']);
    });

    it('should handle empty results gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ total_checks: '0', low_risk: '0', medium_risk: '0', high_risk: '0' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const m = await service.getJurisdictionMetrics('XX');

      expect(m.totalChecks).toBe(0);
      expect(m.topFlags).toEqual([]);
    });

    it('should throw on DB failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('jurisdiction error'));
      await expect(service.getJurisdictionMetrics('AE')).rejects.toThrow('jurisdiction error');
    });
  });

  // ─── getTopRiskFactors ────────────────────────────────────────────────────────

  describe('getTopRiskFactors', () => {
    it('should return top risk factors with counts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { flag: 'SANCTIONS', flag_count: '25' },
          { flag: 'PEP_MATCH', flag_count: '18' },
        ],
      });

      const factors = await service.getTopRiskFactors(5);

      expect(factors).toHaveLength(2);
      expect(factors[0]).toEqual({ flag: 'SANCTIONS', count: 25 });
      expect(factors[1]).toEqual({ flag: 'PEP_MATCH', count: 18 });
    });

    it('should cap limit at 100', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getTopRiskFactors(999);

      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe(100);
    });
  });
});
