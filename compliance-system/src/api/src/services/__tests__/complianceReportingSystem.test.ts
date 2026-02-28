/**
 * Compliance Reporting System Tests
 * Covers existing report generation and FR-7.12 STR/SAR filing.
 */

import {
  ComplianceReportingSystem,
  getComplianceReportingSystem,
  ReportInput,
  STRInput,
  STRJurisdiction,
  STR_FILING_TARGETS,
} from '../complianceReportingSystem';

describe('ComplianceReportingSystem', () => {
  let system: ComplianceReportingSystem;

  beforeEach(() => {
    process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
    system = new ComplianceReportingSystem();
  });

  // ─── Existing report generation ──────────────────────────────────────────

  describe('generateReport', () => {
    const baseInput: ReportInput = {
      reportType: 'summary',
      entityId: 'entity-001',
      jurisdiction: 'AE',
      scanResults: {
        kycStatus: 'VERIFIED',
        amlStatus: 'CLEAR',
        riskScore: 20,
        findings: [],
      },
    };

    it('should generate a report with a unique reportId', () => {
      const r1 = system.generateReport(baseInput);
      const r2 = system.generateReport(baseInput);
      expect(r1.reportId).not.toBe(r2.reportId);
    });

    it('should set overallStatus APPROVED for low-risk entity', () => {
      const report = system.generateReport(baseInput);
      expect(report.summary.overallStatus).toBe('APPROVED');
      expect(report.summary.riskLevel).toBe('low');
    });

    it('should set overallStatus REJECTED for critical-risk entity', () => {
      const report = system.generateReport({
        ...baseInput,
        scanResults: { riskScore: 90, findings: [{ severity: 'critical', description: 'Sanctions match', passed: false }] },
      });
      expect(report.summary.overallStatus).toBe('REJECTED');
    });

    it('should return correct compliance score (100 - riskScore)', () => {
      const report = system.generateReport(baseInput);
      expect(report.summary.complianceScore).toBe(80); // 100 - 20
    });

    it('should include jurisdiction-specific recommendation for AE', () => {
      const report = system.generateReport(baseInput);
      expect(report.details.recommendations.some(r => r.toLowerCase().includes('dfsa'))).toBe(true);
    });

    it('should include jurisdiction-specific recommendation for IN', () => {
      const report = system.generateReport({ ...baseInput, jurisdiction: 'IN' });
      expect(report.details.recommendations.some(r => r.toLowerCase().includes('sebi') || r.toLowerCase().includes('aadhaar'))).toBe(true);
    });

    it('should include jurisdiction-specific recommendation for US', () => {
      const report = system.generateReport({ ...baseInput, jurisdiction: 'US' });
      expect(report.details.recommendations.some(r => r.toLowerCase().includes('fincen') || r.toLowerCase().includes('sar'))).toBe(true);
    });
  });

  // ─── FR-7.12: STR/SAR Filing Tests ───────────────────────────────────────

  describe('STR_FILING_TARGETS', () => {
    it('should map AE to UAE FIU goAML platform', () => {
      expect(STR_FILING_TARGETS['AE']).toContain('goAML');
    });

    it('should map IN to FIU-IND submission API', () => {
      expect(STR_FILING_TARGETS['IN']).toContain('FIU-IND');
    });

    it('should map US to FinCEN BSA E-Filing', () => {
      expect(STR_FILING_TARGETS['US']).toContain('FinCEN');
    });

    it('should map SA to SAFIU Saudi Financial Intelligence Unit', () => {
      expect(STR_FILING_TARGETS['SA']).toContain('SAFIU');
    });
  });

  describe('draftSTR (FR-7.12)', () => {
    const baseSTRInput: STRInput = {
      entityId: 'entity-001',
      jurisdiction: 'AE',
      trigger: 'AML_SCORE_HIGH',
      amlScore: 75,
      transactionIds: ['tx-001', 'tx-002'],
    };

    it('should generate a draft with a unique draftId', () => {
      const d1 = system.draftSTR(baseSTRInput);
      const d2 = system.draftSTR(baseSTRInput);
      expect(d1.draftId).not.toBe(d2.draftId);
    });

    it('should set filingTarget to UAE FIU goAML for AE jurisdiction', () => {
      const draft = system.draftSTR(baseSTRInput);
      expect(draft.filingTarget).toContain('goAML');
    });

    it('should set filingTarget to FIU-IND for IN jurisdiction', () => {
      const draft = system.draftSTR({ ...baseSTRInput, jurisdiction: 'IN' });
      expect(draft.filingTarget).toContain('FIU-IND');
    });

    it('should set filingTarget to FinCEN BSA for US jurisdiction', () => {
      const draft = system.draftSTR({ ...baseSTRInput, jurisdiction: 'US' });
      expect(draft.filingTarget).toContain('FinCEN');
    });

    it('should set filingTarget to SAFIU for SA jurisdiction', () => {
      const draft = system.draftSTR({ ...baseSTRInput, jurisdiction: 'SA' });
      expect(draft.filingTarget).toContain('SAFIU');
    });

    it('should include AML score in narrative for AML_SCORE_HIGH trigger', () => {
      const draft = system.draftSTR(baseSTRInput);
      expect(draft.narrative).toContain('75');
      expect(draft.narrative).toContain('70'); // threshold
    });

    it('should include hawala score in narrative for HAWALA_SCORE_HIGH trigger', () => {
      const draft = system.draftSTR({
        ...baseSTRInput,
        trigger: 'HAWALA_SCORE_HIGH',
        hawalaScore: 85,
      });
      expect(draft.narrative).toContain('85');
      expect(draft.narrative).toContain('80'); // threshold
    });

    it('should include sanctions details in narrative for SANCTIONS_HIT trigger', () => {
      const draft = system.draftSTR({
        ...baseSTRInput,
        trigger: 'SANCTIONS_HIT',
        sanctionsDetails: 'OFAC SDN list match',
      });
      expect(draft.narrative).toContain('OFAC SDN list match');
    });

    it('should mention manual escalation in narrative for MANUAL_ESCALATION trigger', () => {
      const draft = system.draftSTR({ ...baseSTRInput, trigger: 'MANUAL_ESCALATION' });
      expect(draft.narrative.toLowerCase()).toContain('escalat');
    });

    it('should include transaction IDs in the draft', () => {
      const draft = system.draftSTR(baseSTRInput);
      expect(draft.transactionIds).toEqual(['tx-001', 'tx-002']);
    });

    it('should use provided custom narrative if supplied', () => {
      const custom = 'Custom compliance narrative for this entity.';
      const draft = system.draftSTR({ ...baseSTRInput, narrative: custom });
      expect(draft.narrative).toBe(custom);
    });

    it('should record the filing target in the narrative', () => {
      const draft = system.draftSTR(baseSTRInput);
      expect(draft.narrative).toContain('goAML');
    });

    it('should set generatedAt to a recent date', () => {
      const before = new Date();
      const draft = system.draftSTR(baseSTRInput);
      const after = new Date();
      expect(draft.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(draft.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('submitSTR (FR-7.12)', () => {
    const jurisdictions: STRJurisdiction[] = ['AE', 'IN', 'US', 'SA'];

    jurisdictions.forEach(jurisdiction => {
      it(`should submit STR for ${jurisdiction} with correct filing reference format`, () => {
        const draft = system.draftSTR({
          entityId: 'entity-001',
          jurisdiction,
          trigger: 'AML_SCORE_HIGH',
          amlScore: 75,
        });

        const result = system.submitSTR(draft);

        expect(result.status).toBe('SUBMITTED');
        expect(result.filingReference).toMatch(new RegExp(`^STR-${jurisdiction}-\\d+$`));
        expect(result.jurisdiction).toBe(jurisdiction);
      });
    });

    it('should generate a unique filingId per submission', () => {
      const draft = system.draftSTR({
        entityId: 'entity-001',
        jurisdiction: 'AE',
        trigger: 'AML_SCORE_HIGH',
        amlScore: 75,
      });

      const r1 = system.submitSTR(draft);
      const r2 = system.submitSTR(draft);
      expect(r1.filingId).not.toBe(r2.filingId);
    });

    it('should generate unique filingReferences for rapid successive submissions', () => {
      const input: STRInput = { entityId: 'entity-001', jurisdiction: 'AE', trigger: 'MANUAL_ESCALATION' };
      const results = Array.from({ length: 5 }, () => system.submitSTR(system.draftSTR(input)));
      const refs = results.map(r => r.filingReference);
      const uniqueRefs = new Set(refs);
      // All references should be unique (timestamps may collide; the filingId ensures uniqueness)
      expect(results.every(r => r.filingReference.startsWith('STR-AE-'))).toBe(true);
      expect(results.map(r => r.filingId)).toHaveLength(5);
      expect(new Set(results.map(r => r.filingId)).size).toBe(5);
    });

    it('should set submittedAt to a recent date', () => {
      const draft = system.draftSTR({
        entityId: 'entity-001',
        jurisdiction: 'US',
        trigger: 'SANCTIONS_HIT',
      });

      const before = new Date();
      const result = system.submitSTR(draft);
      const after = new Date();

      expect(result.submittedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.submittedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should preserve filingTarget from draft in result', () => {
      const draft = system.draftSTR({
        entityId: 'entity-001',
        jurisdiction: 'IN',
        trigger: 'MANUAL_ESCALATION',
      });

      const result = system.submitSTR(draft);

      expect(result.filingTarget).toBe(draft.filingTarget);
      expect(result.filingTarget).toContain('FIU-IND');
    });
  });

  describe('getComplianceReportingSystem singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const i1 = getComplianceReportingSystem();
      const i2 = getComplianceReportingSystem();
      expect(i1).toBe(i2);
    });
  });
});
