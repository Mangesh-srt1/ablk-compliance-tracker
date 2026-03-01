/**
 * SAR/CTR Services - Comprehensive Unit Tests
 * Tests for SARThresholdEngine, FinCenCtRGenerator, and SARCTRAutomationService
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { getSARThresholdEngine } from '../sarThresholdEngine';
import { getFinCenCtRGenerator } from '../finCenCtRGenerator';
import { getSARCTRAutomationService } from '../sarCtrAutomationService';
import {
  SARGenerationRequest,
  CTRGenerationRequest,
  SARJurisdiction,
  SARDraft,
  CTRForm,
} from '../../types/sar-ctr.types';

describe('Phase 1: SAR/CTR Services (Unit Tests)', () => {
  let thresholdEngine: any;
  let ctrGenerator: any;
  let automationService: any;
  const originalFilerId = process.env.FINCEN_FILER_ID;
  const originalInstitutionName = process.env.FINCEN_INSTITUTION_NAME;

  beforeAll(() => {
    process.env.FINCEN_FILER_ID = process.env.FINCEN_FILER_ID || 'TEST_FILER_001';
    process.env.FINCEN_INSTITUTION_NAME =
      process.env.FINCEN_INSTITUTION_NAME || 'Ableka Lumina Test Institution';
  });

  afterAll(() => {
    if (typeof originalFilerId === 'undefined') {
      delete process.env.FINCEN_FILER_ID;
    } else {
      process.env.FINCEN_FILER_ID = originalFilerId;
    }

    if (typeof originalInstitutionName === 'undefined') {
      delete process.env.FINCEN_INSTITUTION_NAME;
    } else {
      process.env.FINCEN_INSTITUTION_NAME = originalInstitutionName;
    }
  });

  beforeEach(() => {
    thresholdEngine = getSARThresholdEngine();
    ctrGenerator = getFinCenCtRGenerator();
    automationService = getSARCTRAutomationService();
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUITE 1: SAR Threshold Engine Tests
  // ═══════════════════════════════════════════════════════════════════

  describe('SARThresholdEngine', () => {
    it('should detect AML score high trigger', async () => {
      const result = await thresholdEngine.evaluateTriggers({
        entityId: 'entity-001',
        jurisdiction: 'US' as SARJurisdiction,
        transactions: [],
        amlScore: 85,
        baselineProfile: { avgAmount: 5000, stdDevAmount: 1000, avgDailyCount: 2 },
      });

      expect(result.shouldGenerateSAR).toBe(true);
      expect(result.matchedTriggers).toContainEqual(
        expect.objectContaining({ type: 'AML_SCORE_HIGH', isMatched: true })
      );
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.riskFactors.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect hawala score high trigger', async () => {
      const result = await thresholdEngine.evaluateTriggers({
        entityId: 'entity-002',
        jurisdiction: 'AE' as SARJurisdiction,
        transactions: [],
        amlScore: 50,
        hawalaScore: 85,
        baselineProfile: { avgAmount: 5000, stdDevAmount: 1000, avgDailyCount: 2 },
      });

      expect(result.shouldGenerateSAR).toBe(true);
      expect(result.matchedTriggers).toContainEqual(
        expect.objectContaining({ type: 'HAWALA_SCORE_HIGH', isMatched: true })
      );
    });

    it('should detect sanctions hit trigger', async () => {
      const result = await thresholdEngine.evaluateTriggers({
        entityId: 'entity-003',
        jurisdiction: 'US' as SARJurisdiction,
        transactions: [],
        amlScore: 30,
        sanctionsMatches: ['OFAC_SDN', 'UN_SECURITY_COUNCIL'],
      });

      expect(result.shouldGenerateSAR).toBe(true);
      expect(result.matchedTriggers).toContainEqual(
        expect.objectContaining({ type: 'SANCTIONS_HIT', confidence: 100 })
      );
      expect(result.riskFactors).toContainEqual(
        expect.stringContaining('SANCTIONS_HIT')
      );
    });

    it('should return no triggers when all checks pass', async () => {
      const result = await thresholdEngine.evaluateTriggers({
        entityId: 'entity-004',
        jurisdiction: 'US' as SARJurisdiction,
        transactions: [],
        amlScore: 20,
        hawalaScore: 30,
        sanctionsMatches: [],
      });

      expect(result.shouldGenerateSAR).toBe(false);
      expect(result.matchedTriggers.length).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle multiple triggers simultaneously', async () => {
      const result = await thresholdEngine.evaluateTriggers({
        entityId: 'entity-005',
        jurisdiction: 'US' as SARJurisdiction,
        transactions: [
          {
            amount: 50000,
            timestamp: new Date().toISOString(),
            destination_country: 'KP', // North Korea (high-risk)
          },
        ],
        amlScore: 95,
        hawalaScore: 92,
        sanctionsMatches: ['OFAC_SDN'],
        baselineProfile: { avgAmount: 5000, stdDevAmount: 1000, avgDailyCount: 2 },
      });

      expect(result.matchedTriggers.length).toBeGreaterThanOrEqual(3);
      expect(result.shouldGenerateSAR).toBe(true);
    });

    it('should get and update configuration', () => {
      const initialConfig = thresholdEngine.getConfig('US');
      expect(initialConfig?.amlScoreThreshold).toBe(70);

      thresholdEngine.updateConfig('US', { amlScoreThreshold: 60 });
      const updatedConfig = thresholdEngine.getConfig('US');
      expect(updatedConfig?.amlScoreThreshold).toBe(60);

      // Reset for other tests
      thresholdEngine.updateConfig('US', { amlScoreThreshold: 70 });
    });

    it('should throw error for unsupported jurisdiction', async () => {
      const invalidJurisdiction = 'XX' as any;
      await expect(
        thresholdEngine.evaluateTriggers({
          entityId: 'entity-006',
          jurisdiction: invalidJurisdiction,
          transactions: [],
          amlScore: 50,
        })
      ).rejects.toThrow('Unsupported jurisdiction');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUITE 2: FinCEN CTR Form Generator Tests
  // ═══════════════════════════════════════════════════════════════════

  describe('FinCenCtRGenerator', () => {
    const entityData = {
      name: 'John Doe',
      type: 'individual',
      jurisdiction: 'US',
      id: 'entity-001',
    };

    it('should generate valid CTR form', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-001',
        currency: 'USD',
        transactionIds: ['tx-001', 'tx-002'],
        aggregatedAmount: 25000,
        threshold: 10000,
        narrative: 'Multiple transactions in short timeframe',
      };

      const ctrForm = await ctrGenerator.generateCTR(request, entityData);

      expect(ctrForm).toBeDefined();
      expect(ctrForm.ctrId).toBeDefined();
      expect(ctrForm.filerId).toBeDefined();
      expect(ctrForm.totalAmount).toBe(25000);
      expect(ctrForm.currency).toBe('USD');
      expect(ctrForm.entityName).toBe('John Doe');
      expect(ctrForm.status).toBe('DRAFT');
      expect(ctrForm.lines.length).toBeGreaterThan(0);
    });

    it('should reject empty transaction list', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-001',
        currency: 'USD',
        transactionIds: [],
        aggregatedAmount: 0,
      };

      await expect(ctrGenerator.generateCTR(request, entityData)).rejects.toThrow(
        'At least one transaction ID required'
      );
    });

    it('should validate CTR form completeness', () => {
      const validForm = {
        ctrId: 'ctr-001',
        filingVersion: '2.0',
        filerId: 'FILER123',
        reportingInstitution: 'Bank XYZ',
        reportingDate: new Date(),
        filingDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        currency: 'USD' as any,
        totalAmount: 25000,
        transactionCount: 2,
        entityName: 'John Doe',
        entityType: 'individual',
        entityCountry: 'US',
        lines: [
          {
            sequenceNumber: 1,
            transactionDate: new Date(),
            transactionAmount: 15000,
            currency: 'USD' as any,
            transactionType: 'wire' as any,
            counterpartyName: 'ABC Corp',
            counterpartyCountry: 'US',
            sourceCountry: 'US',
            destinationCountry: 'CA',
          },
        ],
        narrative: 'Valid CTR',
        status: 'DRAFT',
        generatedAt: new Date(),
        createdBy: 'system',
      };

      const validation = ctrGenerator.validateCTRForm(validForm);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should reject invalid CTR form (missing entity name)', () => {
      const invalidForm = {
        ctrId: 'ctr-002',
        filingVersion: '2.0',
        filerId: 'FILER123',
        reportingInstitution: 'Bank XYZ',
        reportingDate: new Date(),
        filingDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        currency: 'USD' as any,
        totalAmount: 25000,
        transactionCount: 0,
        entityName: '',
        entityType: 'individual',
        entityCountry: 'US',
        lines: [],
        narrative: '',
        status: 'DRAFT',
        generatedAt: new Date(),
        createdBy: 'system',
      };

      const validation = ctrGenerator.validateCTRForm(invalidForm);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.join(',')).toMatch(/entity name/i);
    });

    it('should export CTR to JSON format', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-001',
        currency: 'USD',
        transactionIds: ['tx-001'],
        aggregatedAmount: 15000,
      };

      const ctrForm = await ctrGenerator.generateCTR(request, entityData);
      const jsonExport = ctrGenerator.exportCTR(ctrForm, 'json');

      expect(jsonExport).toBeTruthy();
      expect(jsonExport).toContain('"filerId"');
      expect(jsonExport).toContain('"totalAmount"');
      expect(jsonExport).toContain('15000');
    });

    it('should export CTR to CSV format', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-001',
        currency: 'USD',
        transactionIds: ['tx-001'],
        aggregatedAmount: 15000,
      };

      const ctrForm = await ctrGenerator.generateCTR(request, entityData);
      const csvExport = ctrGenerator.exportCTR(ctrForm, 'csv');

      expect(csvExport).toBeTruthy();
      expect(csvExport).toContain('Filer ID');
      expect(csvExport).toContain('John Doe');
    });

    it('should export CTR to XML format', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-001',
        currency: 'USD',
        transactionIds: ['tx-001'],
        aggregatedAmount: 15000,
      };

      const ctrForm = await ctrGenerator.generateCTR(request, entityData);
      const xmlExport = ctrGenerator.exportCTR(ctrForm, 'xml');

      expect(xmlExport).toBeTruthy();
      expect(xmlExport).toContain('<?xml version="1.0"');
      expect(xmlExport).toContain('<CTRForm>');
      expect(xmlExport).toContain('</CTRForm>');
    });

    it('should calculate correct filing deadline', () => {
      const reportDate = new Date('2026-03-01');
      const deadline = ctrGenerator.calculateFilingDeadline(reportDate, 15);

      const expectedDate = new Date('2026-03-16');
      expect(deadline.getDate()).toBe(expectedDate.getDate());
    });

    it('should handle currency conversion', () => {
      const converted = ctrGenerator.convertToReportingCurrency(1000, 'AED', 'USD', 0.27);
      expect(converted).toBe(270);

      const noConversion = ctrGenerator.convertToReportingCurrency(1000, 'USD', 'USD', 1);
      expect(noConversion).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUITE 3: SAR/CTR Automation Service Tests
  // ═══════════════════════════════════════════════════════════════════

  describe('SARCTRAutomationService', () => {
    const entityData = {
      id: 'entity-001',
      name: 'John Doe',
      type: 'individual',
      jurisdiction: 'US',
    };

    it('should generate SAR draft successfully', async () => {
      const request: SARGenerationRequest = {
        entityId: 'entity-001',
        jurisdiction: 'US',
        transactionIds: ['tx-001', 'tx-002'],
        amlScore: 80,
        sanctionsDetails: ['OFAC_SDN'],
        manualNote: 'Flagged by compliance officer',
      };

      const sarDraft = await automationService.generateSAR(request, entityData);

      expect(sarDraft).toBeDefined();
      expect(sarDraft.sarId).toBeDefined();
      expect(sarDraft.status).toBe('DRAFT');
      expect(sarDraft.entityId).toBe('entity-001');
      expect(sarDraft.triggers.length).toBeGreaterThan(0);
      expect(sarDraft.narrative).toBeTruthy();
      expect(sarDraft.narrative).toContain('John Doe');
    });

    it('should reject SAR generation if no triggers matched', async () => {
      const request: SARGenerationRequest = {
        entityId: 'entity-002',
        jurisdiction: 'US',
        transactionIds: ['tx-001'],
        amlScore: 20, // Below threshold
        sanctionsDetails: [],
      };

      // Mock engine to return no triggers
      await expect(automationService.generateSAR(request, entityData)).rejects.toThrow(
        'No suspicious activity triggers matched'
      );
    });

    it('should generate CTR form successfully', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-001',
        currency: 'USD',
        transactionIds: ['tx-001', 'tx-002'],
        aggregatedAmount: 25000,
        threshold: 10000,
      };

      const ctrForm = await automationService.generateCTR(request, entityData);

      expect(ctrForm).toBeDefined();
      expect(ctrForm.ctrId).toBeDefined();
      expect(ctrForm.status).toBe('DRAFT');
      expect(ctrForm.totalAmount).toBe(25000);
      expect(ctrForm.entityName).toBe('John Doe');
    });

    it('should submit SAR and update status', async () => {
      const request: SARGenerationRequest = {
        entityId: 'entity-003',
        jurisdiction: 'US',
        transactionIds: ['tx-001'],
        amlScore: 85,
      };

      const sarDraft = await automationService.generateSAR(request, entityData);
      const submission = await automationService.submitSAR(sarDraft.sarId, 'user-001');

      expect(submission).toBeDefined();
      expect(submission.filingId).toBeDefined();
      expect(submission.filingReference).toMatch(/^SAR-US-/);
      expect(submission.status).toBe('SUBMITTED');
      expect(submission.submittedAt).toBeTruthy();

      const updatedDraft = automationService.getSARDraft(sarDraft.sarId);
      expect(updatedDraft?.status).toBe('SUBMITTED');
    });

    it('should submit CTR and update status', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-004',
        currency: 'USD',
        transactionIds: ['tx-001'],
        aggregatedAmount: 15000,
      };

      const ctrForm = await automationService.generateCTR(request, entityData);
      const submission = await automationService.submitCTR(ctrForm.ctrId, 'user-002');

      expect(submission).toBeDefined();
      expect(submission.filingId).toBeDefined();
      expect(submission.filingReference).toMatch(/^CTR-US-/);
      expect(submission.status).toBe('SUBMITTED');
      expect(submission.submittedBy).toBe('user-002');

      const updatedForm = automationService.getCTRForm(ctrForm.ctrId);
      expect(updatedForm?.status).toBe('SUBMITTED');
    });

    it('should batch submit multiple reports', async () => {
      const sarRequest: SARGenerationRequest = {
        entityId: 'entity-005',
        jurisdiction: 'US',
        transactionIds: ['tx-001'],
        amlScore: 75,
      };

      const ctrRequest: CTRGenerationRequest = {
        entityId: 'entity-006',
        currency: 'USD',
        transactionIds: ['tx-001'],
        aggregatedAmount: 20000,
      };

      const sar = await automationService.generateSAR(sarRequest, { ...entityData, id: 'entity-005' });
      const ctr = await automationService.generateCTR(ctrRequest, { ...entityData, id: 'entity-006' });

      const batchResult = await automationService.batchSubmit(
        [sar.sarId, ctr.ctrId],
        'user-003'
      );

      expect(batchResult.totalProcessed).toBe(2);
      expect(batchResult.successCount).toBeGreaterThanOrEqual(1);
      expect(batchResult.filings.length).toBe(2);
    });

    it('should retrieve SAR by ID', async () => {
      const request: SARGenerationRequest = {
        entityId: 'entity-007',
        jurisdiction: 'AE',
        transactionIds: ['tx-001'],
        hawalaScore: 85,
      };

      const sarDraft = await automationService.generateSAR(request, { ...entityData, jurisdiction: 'AE' });
      const retrieved = automationService.getSARDraft(sarDraft.sarId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sarId).toBe(sarDraft.sarId);
      expect(retrieved?.jurisdiction).toBe('AE');
    });

    it('should list SARs with filtering', async () => {
      const request: SARGenerationRequest = {
        entityId: 'entity-008',
        jurisdiction: 'US',
        transactionIds: ['tx-001'],
        amlScore: 75,
      };

      const sar = await automationService.generateSAR(request, { ...entityData, id: 'entity-008' });

      const allSars = automationService.listSARs();
      expect(allSars.length).toBeGreaterThan(0);

      const usaSars = automationService.listSARs({ jurisdiction: 'US' });
      expect(usaSars.some((sar: SARDraft) => sar.jurisdiction === 'US')).toBe(true);

      const draftSars = automationService.listSARs({ status: 'DRAFT' });
      expect(draftSars.some((sar: SARDraft) => sar.status === 'DRAFT')).toBe(true);
    });

    it('should list CTRs with filtering', async () => {
      const request: CTRGenerationRequest = {
        entityId: 'entity-009',
        currency: 'USD',
        transactionIds: ['tx-001'],
        aggregatedAmount: 15000,
      };

      const ctr = await automationService.generateCTR(request, { ...entityData, id: 'entity-009' });

      const allCtrs = automationService.listCTRs();
      expect(allCtrs.length).toBeGreaterThan(0);

      const usdCtrs = automationService.listCTRs({ Currency: 'USD' });
      expect(usdCtrs.some((ctr: CTRForm) => ctr.currency === 'USD')).toBe(true);

      const draftCtrs = automationService.listCTRs({ status: 'DRAFT' });
      expect(draftCtrs.some((ctr: CTRForm) => ctr.status === 'DRAFT')).toBe(true);
    });

    it('should track audit log entries', async () => {
      const request: SARGenerationRequest = {
        entityId: 'entity-010',
        jurisdiction: 'IN',
        transactionIds: ['tx-001'],
        amlScore: 80,
      };

      const sar = await automationService.generateSAR(request, { ...entityData, id: 'entity-010', jurisdiction: 'IN' });
      await automationService.submitSAR(sar.sarId, 'user-004');

      const auditLog = automationService.getAuditLog({ reportId: sar.sarId });
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].reportType).toBe('SAR');
      expect(auditLog[0].newStatus).toBe('SUBMITTED');
    });

    it('should prevent submission of non-draft reports', async () => {
      const request: SARGenerationRequest = {
        entityId: 'entity-011',
        jurisdiction: 'US',
        transactionIds: ['tx-001'],
        amlScore: 80,
      };

      const sar = await automationService.generateSAR(request, { ...entityData, id: 'entity-011' });
      await automationService.submitSAR(sar.sarId, 'user-005');

      // Attempt to submit again
      await expect(automationService.submitSAR(sar.sarId, 'user-005')).rejects.toThrow();
    });

    it('should handle non-existent report retrieval', () => {
      const retrieved = automationService.getSARDraft('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // INTEGRATION SCENARIOS
  // ═══════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should complete full SAR workflow: generate -> submit -> track', async () => {
      const entityData = {
        id: 'entity-integration-001',
        name: 'Integration Test Corp',
        type: 'business',
        jurisdiction: 'US',
      };

      // Step 1: Generate SAR (trigger: AML + Sanctions)
      const sarRequest: SARGenerationRequest = {
        entityId: entityData.id,
        jurisdiction: 'US',
        transactionIds: ['tx-001', 'tx-002'],
        amlScore: 90,
        sanctionsDetails: ['OFAC_SDN'],
      };

      const sarDraft = await automationService.generateSAR(sarRequest, entityData);
      expect(sarDraft.status).toBe('DRAFT');
      expect(sarDraft.triggers.length).toBeGreaterThanOrEqual(2);

      // Step 2: Submit SAR
      const submission = await automationService.submitSAR(sarDraft.sarId, 'compliance-001');
      expect(submission.status).toBe('SUBMITTED');
      expect(submission.filingReference).toBeTruthy();

      // Step 3: Verify audit trail
      const auditLog = automationService.getAuditLog({ reportId: sarDraft.sarId });
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].changeReason).toMatch(/Manual submission/);

      // Step 4: Verify list includes submitted SAR
      const submittedSars = automationService.listSARs({ status: 'SUBMITTED' });
      expect(submittedSars.some((sar: SARDraft) => sar.sarId === sarDraft.sarId)).toBe(true);
    });

    it('should complete full CTR workflow: generate -> export -> submit', async () => {
      const entityData = {
        id: 'entity-integration-002',
        name: 'Integration Test Bank',
        type: 'business',
        jurisdiction: 'US',
      };

      // Step 1: Generate CTR
      const ctrRequest: CTRGenerationRequest = {
        entityId: entityData.id,
        currency: 'USD',
        transactionIds: ['tx-001', 'tx-002', 'tx-003'],
        aggregatedAmount: 35000,
        threshold: 10000,
        narrative: 'Integration test - multiple high-value transfers',
      };

      const ctrForm = await automationService.generateCTR(ctrRequest, entityData);
      expect(ctrForm.status).toBe('DRAFT');
      expect(ctrForm.totalAmount).toBe(35000);
      expect(ctrForm.transactionCount).toBe(3);

      // Step 2: Export to multiple formats
      const jsonExport = ctrGenerator.exportCTR(ctrForm, 'json');
      expect(jsonExport).toContain('35000');

      const csvExport = ctrGenerator.exportCTR(ctrForm, 'csv');
      expect(csvExport).toContain('Integration Test Bank');

      // Step 3: Submit CTR
      const submission = await automationService.submitCTR(ctrForm.ctrId, 'compliance-002');
      expect(submission.status).toBe('SUBMITTED');
      expect(submission.filingTarget).toBe('FinCEN');

      // Step 4: Verify list includes submitted CTR
      const submittedCtrs = automationService.listCTRs({ status: 'SUBMITTED' });
      expect(submittedCtrs.some((ctr: CTRForm) => ctr.ctrId === ctrForm.ctrId)).toBe(true);
    });

    it('should handle multi-jurisdiction SAR generation', async () => {
      const jurisdictions: SARJurisdiction[] = ['US', 'AE', 'IN'];

      for (const jurisdiction of jurisdictions) {
        const entityData = {
          id: `entity-${jurisdiction}`,
          name: `Test Entity - ${jurisdiction}`,
          type: 'individual',
          jurisdiction,
        };

        const request: SARGenerationRequest = {
          entityId: entityData.id,
          jurisdiction,
          transactionIds: ['tx-001'],
          amlScore: 75,
        };

        const sar = await automationService.generateSAR(request, entityData);
        expect(sar.jurisdiction).toBe(jurisdiction);
        expect(sar.filingTarget).toMatch(/(FinCEN|UAE FIU|FIU-IND)/);
      }
    });
  });
});
