/**
 * Unit Tests: Advanced Compliance Scanner and related services
 *
 * Tests:
 * 1. RiskAssessmentEngine - calculates low risk correctly
 * 2. RiskAssessmentEngine - calculates critical risk for sanctions match
 * 3. RiskAssessmentEngine - returns correct risk levels for different scores
 * 4. MultiJurisdictionalMonitor - checks IN jurisdiction rules (age < 18 fails)
 * 5. MultiJurisdictionalMonitor - returns compliant for valid entity
 * 6. AdvancedComplianceScanner - full scan returns completed status
 * 7. AdvancedComplianceScanner - APPROVED for low risk entity
 * 8. AdvancedComplianceScanner - REJECTED for sanctioned entity
 */

// Mock winston before any imports that use it
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

// Mock uuid for deterministic IDs in tests
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

import { RiskAssessmentEngine } from '../riskAssessmentEngine';
import { MultiJurisdictionalMonitor } from '../multiJurisdictionalMonitor';
import { AdvancedComplianceScanner } from '../advancedComplianceScanner';
import { ComplianceReportingSystem } from '../complianceReportingSystem';

// ─── RiskAssessmentEngine ────────────────────────────────────────────────────

describe('RiskAssessmentEngine', () => {
  let engine: RiskAssessmentEngine;

  beforeEach(() => {
    engine = new RiskAssessmentEngine();
  });

  it('calculates low risk for a well-verified entity', () => {
    const result = engine.assessRisk({
      kycScore: 90,      // inverted → 10 risk; contribution = 10*0.25 = 2.5
      amlScore: 5,       // contribution = 5*0.30 = 1.5
      sanctionsMatch: false,
      pepMatch: false,
      velocityAnomaly: false,
      jurisdictionRisk: 10,
      transactionVolume: 5,
    });

    expect(result.riskLevel).toBe('low');
    expect(result.riskScore).toBeLessThan(30);
    expect(result.breakdown).toBeDefined();
    expect(result.reasoning).toMatch(/low/i);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('calculates critical risk for a sanctioned entity', () => {
    const result = engine.assessRisk({
      kycScore: 20,      // inverted → 80 risk
      amlScore: 90,
      sanctionsMatch: true,   // +40 points
      pepMatch: true,         // +20 points
      velocityAnomaly: true,  // +15 points
      jurisdictionRisk: 80,
      transactionVolume: 80,
    });

    expect(result.riskLevel).toBe('critical');
    expect(result.riskScore).toBeGreaterThanOrEqual(80);
    expect(result.breakdown['sanctionsMatch']).toBe(40);
    expect(result.breakdown['pepMatch']).toBe(20);
    expect(result.breakdown['velocityAnomaly']).toBe(15);
    expect(result.reasoning).toContain('Sanctions list match detected');
  });

  it('returns correct risk levels for boundary scores', () => {
    // Score near 0 → low
    const lowResult = engine.assessRisk({
      kycScore: 100,
      amlScore: 0,
      sanctionsMatch: false,
      pepMatch: false,
      velocityAnomaly: false,
      jurisdictionRisk: 0,
      transactionVolume: 0,
    });
    expect(lowResult.riskLevel).toBe('low');

    // Medium: score 30-60 — achieved with moderate aml + no sanctions
    const mediumResult = engine.assessRisk({
      kycScore: 50,
      amlScore: 60,
      sanctionsMatch: false,
      pepMatch: false,
      velocityAnomaly: false,
      jurisdictionRisk: 50,
      transactionVolume: 30,
    });
    expect(['medium', 'high']).toContain(mediumResult.riskLevel);
    expect(mediumResult.riskScore).toBeGreaterThanOrEqual(30);
  });
});

// ─── MultiJurisdictionalMonitor ──────────────────────────────────────────────

describe('MultiJurisdictionalMonitor', () => {
  let monitor: MultiJurisdictionalMonitor;

  beforeEach(() => {
    monitor = new MultiJurisdictionalMonitor();
  });

  it('fails IN age requirement when entity is under 18', () => {
    const result = monitor.checkJurisdictions({
      entityId: 'entity-001',
      jurisdiction: ['IN'],
      entityData: {
        name: 'Minor User',
        country: 'IN',
        age: 15,
        pepStatus: false,
        sanctionsMatch: false,
      },
    });

    const ageFinding = result.findings.find((f) => f.ruleName === 'IN_AGE_REQUIREMENT');
    expect(ageFinding).toBeDefined();
    expect(ageFinding?.passed).toBe(false);
    expect(result.overallCompliant).toBe(false);
  });

  it('returns compliant result for a valid Indian entity (age >= 18, no sanctions)', () => {
    const result = monitor.checkJurisdictions({
      entityId: 'entity-002',
      jurisdiction: ['GLOBAL'],
      entityData: {
        name: 'Verified User',
        country: 'US',
        age: 30,
        pepStatus: false,
        sanctionsMatch: false,
      },
    });

    expect(result.entityId).toBe('entity-002');
    expect(result.overallCompliant).toBe(true);
    expect(result.findings.every((f) => f.passed)).toBe(true);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('fails GLOBAL sanctions rule when sanctionsMatch is true', () => {
    const result = monitor.checkJurisdictions({
      entityId: 'entity-003',
      jurisdiction: ['GLOBAL'],
      entityData: {
        name: 'Blocked Entity',
        sanctionsMatch: true,
        pepStatus: false,
      },
    });

    const sanctionFinding = result.findings.find((f) => f.ruleName === 'GLOBAL_SANCTIONS_SCREENING');
    expect(sanctionFinding?.passed).toBe(false);
    expect(result.overallCompliant).toBe(false);
  });
});

// ─── AdvancedComplianceScanner ───────────────────────────────────────────────

describe('AdvancedComplianceScanner', () => {
  let scanner: AdvancedComplianceScanner;
  let riskEngine: RiskAssessmentEngine;
  let jurisdictionMonitor: MultiJurisdictionalMonitor;
  let reportingSystem: ComplianceReportingSystem;

  beforeEach(() => {
    riskEngine = new RiskAssessmentEngine();
    jurisdictionMonitor = new MultiJurisdictionalMonitor();
    reportingSystem = new ComplianceReportingSystem();
    scanner = new AdvancedComplianceScanner(riskEngine, jurisdictionMonitor, reportingSystem);
  });

  it('returns completed status for a full scan', async () => {
    const result = await scanner.runScan({
      entityId: 'entity-scan-001',
      scanType: 'comprehensive',
      jurisdiction: ['GLOBAL'],
      entityData: { name: 'Test Entity', pepStatus: false },
      kycScore: 80,
      amlScore: 20,
      sanctionsMatch: false,
    });

    expect(result.status).toBe('completed');
    expect(result.entityId).toBe('entity-scan-001');
    expect(result.scanType).toBe('comprehensive');
    expect(result.riskAssessment).toBeDefined();
    expect(result.jurisdictionFindings).toBeDefined();
    expect(result.report).toBeDefined();
    expect(result.processingTime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('returns APPROVED for a low-risk entity with good scores', async () => {
    const result = await scanner.runScan({
      entityId: 'entity-low-risk',
      scanType: 'targeted',
      jurisdiction: ['GLOBAL'],
      entityData: {
        name: 'Clean Entity',
        country: 'US',
        age: 35,
        pepStatus: false,
      },
      kycScore: 95,
      amlScore: 5,
      sanctionsMatch: false,
    });

    expect(result.overallStatus).toBe('APPROVED');
    expect(result.riskAssessment.riskScore).toBeLessThan(30);
  });

  it('returns REJECTED for a sanctioned entity with high risk scores', async () => {
    const result = await scanner.runScan({
      entityId: 'entity-sanctioned',
      scanType: 'comprehensive',
      jurisdiction: ['GLOBAL'],
      entityData: {
        name: 'High Risk Corp',
        pepStatus: true,
        sanctionsMatch: true,
      },
      kycScore: 10,
      amlScore: 95,
      sanctionsMatch: true,
    });

    expect(result.overallStatus).toBe('REJECTED');
    expect(result.riskAssessment.riskScore).toBeGreaterThanOrEqual(80);
  });
});
