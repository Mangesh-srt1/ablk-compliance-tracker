import express from 'express';
import request from 'supertest';

jest.mock('../../middleware/authMiddleware', () => ({
  requirePermission: () => (req: any, _res: any, next: any) => {
    req.user = {
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      permissions: ['reports:audit', 'reports:read'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    next();
  },
}));

const draftSTRMock = jest.fn();
const submitSTRMock = jest.fn();
const draftCTRMock = jest.fn();
const submitCTRMock = jest.fn();

jest.mock('../../services/complianceReportingSystem', () => ({
  getComplianceReportingSystem: () => ({
    draftSTR: draftSTRMock,
    submitSTR: submitSTRMock,
    draftCTR: draftCTRMock,
    submitCTR: submitCTRMock,
  }),
}));

import reportRoutes from '../../routes/reportRoutes';

describe('Integration: report routes regulatory auto filing', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', reportRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/reports/regulatory/sar-auto drafts and submits SAR', async () => {
    draftSTRMock.mockReturnValue({
      reportId: 'str-001',
      jurisdiction: 'AE',
      trigger: 'AML_SCORE_HIGH',
      targetBody: 'UAE_FIU',
      filingDeadlineHours: 24,
      generatedAt: new Date().toISOString(),
      payload: {
        entityId: 'entity-1',
        transactionIds: ['tx-1', 'tx-2'],
        amlScore: 91,
      },
    });

    submitSTRMock.mockReturnValue({
      reportId: 'str-001',
      submitted: true,
      filedAt: new Date().toISOString(),
      filingReference: 'SAR-AE-12345',
      targetBody: 'UAE_FIU',
    });

    const response = await request(app)
      .post('/api/reports/regulatory/sar-auto')
      .send({
        entityId: 'entity-1',
        jurisdiction: 'AE',
        trigger: 'AML_SCORE_HIGH',
        transactionIds: ['tx-1', 'tx-2'],
        amlScore: 91,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.draft.reportId).toBe('str-001');
    expect(response.body.data.filing.submitted).toBe(true);
    expect(draftSTRMock).toHaveBeenCalledTimes(1);
    expect(submitSTRMock).toHaveBeenCalledTimes(1);
  });

  it('POST /api/reports/regulatory/ctr-auto drafts and submits CTR', async () => {
    draftCTRMock.mockReturnValue({
      reportId: 'ctr-001',
      jurisdiction: 'US',
      targetBody: 'FINCEN_BSA',
      filingDeadlineHours: 24,
      generatedAt: new Date().toISOString(),
      payload: {
        entityId: 'entity-2',
        currency: 'USD',
        thresholdAmount: 10000,
        aggregatedAmount: 12750,
        transactionIds: ['tx-10', 'tx-11'],
      },
    });

    submitCTRMock.mockReturnValue({
      reportId: 'ctr-001',
      submitted: true,
      filedAt: new Date().toISOString(),
      filingReference: 'CTR-US-98765',
      targetBody: 'FINCEN_BSA',
    });

    const response = await request(app)
      .post('/api/reports/regulatory/ctr-auto')
      .send({
        entityId: 'entity-2',
        jurisdiction: 'US',
        currency: 'USD',
        thresholdAmount: 10000,
        aggregatedAmount: 12750,
        transactionIds: ['tx-10', 'tx-11'],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.draft.reportId).toBe('ctr-001');
    expect(response.body.data.filing.submitted).toBe(true);
    expect(draftCTRMock).toHaveBeenCalledTimes(1);
    expect(submitCTRMock).toHaveBeenCalledTimes(1);
  });
});
