import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../middleware/authMiddleware', () => ({
  requirePermission: () => (req: any, _res: any, next: any) => {
    req.user = {
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      permissions: ['workflows:read', 'workflows:write'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    next();
  },
}));

const createWorkflowMock = jest.fn();
const getWorkflowMock = jest.fn();
const listWorkflowsMock = jest.fn();
const publishWorkflowMock = jest.fn();
const getWorkflowVersionsMock = jest.fn();

jest.mock('../../services/workflowBuilderService', () => ({
  getWorkflowBuilderService: () => ({
    createWorkflow: createWorkflowMock,
    getWorkflow: getWorkflowMock,
    listWorkflows: listWorkflowsMock,
    publishWorkflow: publishWorkflowMock,
    getWorkflowVersions: getWorkflowVersionsMock,
  }),
}));

const testWorkflowMock = jest.fn();

jest.mock('../../services/workflowExecutorService', () => ({
  getWorkflowExecutorService: () => ({
    testWorkflow: testWorkflowMock,
  }),
}));

import workflowRoutes from '../../routes/workflowRoutes';

describe('Integration: Option C workflow routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/workflows', workflowRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/v1/workflows/create validates payload', async () => {
    const response = await request(app).post('/api/v1/workflows/create').send({
      name: '',
      blocks: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_INPUT');
  });

  it('POST /api/v1/workflows/create creates workflow', async () => {
    createWorkflowMock.mockReturnValue({
      workflowId: 'wf-1',
      name: 'High Risk Escalation',
      jurisdiction: 'US',
      version: 1,
      status: 'DRAFT',
      blocks: [{ blockId: 'b1', type: 'CONDITION' }],
      connections: [],
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app).post('/api/v1/workflows/create').send({
      name: 'High Risk Escalation',
      jurisdiction: 'US',
      blocks: [{ blockId: 'b1', type: 'CONDITION', label: 'Risk > 70', config: {} }],
      createdBy: 'user-1',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(createWorkflowMock).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/workflows/:workflowId returns 404 when missing', async () => {
    getWorkflowMock.mockReturnValue(undefined);

    const response = await request(app).get('/api/v1/workflows/wf-missing');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('POST /api/v1/workflows/:workflowId/publish publishes workflow', async () => {
    publishWorkflowMock.mockReturnValue({
      workflowId: 'wf-1',
      version: 2,
      status: 'PUBLISHED',
      publishedBy: 'user-1',
    });

    const response = await request(app)
      .post('/api/v1/workflows/wf-1/publish')
      .send({ publishedBy: 'user-1' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(publishWorkflowMock).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/workflows/:workflowId/test executes workflow', async () => {
    testWorkflowMock.mockReturnValue({
      workflowId: 'wf-1',
      passed: true,
      decision: 'APPROVE',
      actionsExecuted: ['APPROVE'],
      trace: [],
    });

    const response = await request(app).post('/api/v1/workflows/wf-1/test').send({
      input: { riskScore: 20 },
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.decision).toBe('APPROVE');
  });

  it('GET /api/v1/workflows/versions/:workflowId returns history', async () => {
    getWorkflowVersionsMock.mockReturnValue([
      { workflowId: 'wf-1', version: 1, status: 'DRAFT' },
      { workflowId: 'wf-1', version: 2, status: 'PUBLISHED' },
    ]);

    const response = await request(app).get('/api/v1/workflows/versions/wf-1');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(getWorkflowVersionsMock).toHaveBeenCalledTimes(1);
  });
});
