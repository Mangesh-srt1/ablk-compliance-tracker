import express from 'express';
import request from 'supertest';

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      permissions: ['aml:execute', 'aml:read', 'reports:read', 'reports:audit'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    next();
  },
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

const performAmlCheckMock = jest.fn();
const getAmlCheckMock = jest.fn();

jest.mock('../../services/amlService', () => ({
  AmlService: jest.fn().mockImplementation(() => ({
    performAmlCheck: performAmlCheckMock,
    getAmlCheck: getAmlCheckMock,
  })),
}));

const analyzeTransactionsMock = jest.fn();

jest.mock('../../services/transactionMonitoringService', () => ({
  transactionMonitoringService: {
    analyzeTransactions: analyzeTransactionsMock,
  },
}));

import amlRoutes from '../../routes/amlRoutes';
import kytRoutes from '../../routes/kytRoutes';

describe('Integration: AML enhanced PEP + KYT routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api', amlRoutes);
  app.use('/api', kytRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/aml-pep-screen returns AML result with enhanced PEP details', async () => {
    performAmlCheckMock.mockResolvedValue({
      checkId: 'aml-1',
      entityId: 'entity-1',
      jurisdiction: 'IN',
      score: 52,
      riskLevel: 1,
      flags: [
        {
          type: 'PEP_ASSOCIATE_MATCH',
          severity: 'HIGH',
          message: 'PEP family/associate link detected',
        },
      ],
      recommendations: ['Increase review cadence for politically exposed party relationships'],
      screeningResults: {
        ofac: 'CLEAR',
        euSanctions: 'CLEAR',
        pep: 'HIT',
        pepDetails: {
          result: 'HIT',
          hasFamilyOrAssociateMatch: true,
          matches: [
            {
              name: 'Relative Minister',
              category: 'SENIOR_POLITICIAN',
              relationship: 'FAMILY',
              confidence: 0.75,
              source: 'RELATED_PARTY_NAME_SCREENING',
            },
          ],
          databaseLastUpdatedAt: new Date().toISOString(),
        },
      },
      processingTime: 45,
      timestamp: new Date().toISOString(),
    });

    const response = await request(app)
      .post('/api/aml-pep-screen')
      .send({
        entityId: 'entity-1',
        jurisdiction: 'IN',
        transactions: [
          {
            id: 'tx-1',
            amount: 100,
            currency: 'USD',
            counterparty: 'cp-1',
            timestamp: new Date().toISOString(),
            type: 'transfer',
          },
        ],
        entityData: {
          name: 'Entity One',
          country: 'IN',
          occupation: 'consultant',
          familyMembers: ['Relative Minister'],
          associates: ['Business Partner'],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.screeningResults.pepDetails.hasFamilyOrAssociateMatch).toBe(true);
    expect(performAmlCheckMock).toHaveBeenCalledTimes(1);
  });

  it('POST /api/kyt-monitor returns anomaly analysis results', async () => {
    analyzeTransactionsMock.mockResolvedValue({
      checkId: 'kyt-1',
      entityId: 'entity-2',
      jurisdiction: 'IN',
      score: 64,
      riskLevel: 'HIGH',
      alerts: [
        {
          type: 'STRUCTURING_PATTERN',
          severity: 'HIGH',
          message: 'Potential structuring pattern detected near reporting threshold',
          confidence: 0.85,
        },
      ],
      recommendations: ['Investigate potential threshold-avoidance structuring behavior.'],
      analyzedTransactions: 3,
      processingTime: 30,
      timestamp: new Date().toISOString(),
    });

    const now = new Date();
    const response = await request(app)
      .post('/api/kyt-monitor')
      .send({
        entityId: 'entity-2',
        jurisdiction: 'IN',
        transactions: [
          {
            id: 'tx-2',
            amount: 9500,
            currency: 'USD',
            timestamp: now.toISOString(),
            fromAddress: '0xabc',
            toAddress: '0xdef',
            counterparty: 'cp-a',
          },
          {
            id: 'tx-3',
            amount: 9600,
            currency: 'USD',
            timestamp: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
            fromAddress: '0xabc',
            toAddress: '0xghi',
            counterparty: 'cp-b',
          },
          {
            id: 'tx-4',
            amount: 9700,
            currency: 'USD',
            timestamp: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
            fromAddress: '0xabc',
            toAddress: '0xjkl',
            counterparty: 'cp-c',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.riskLevel).toBe('HIGH');
    expect(response.body.data.alerts[0].type).toBe('STRUCTURING_PATTERN');
    expect(analyzeTransactionsMock).toHaveBeenCalledTimes(1);
  });
});
