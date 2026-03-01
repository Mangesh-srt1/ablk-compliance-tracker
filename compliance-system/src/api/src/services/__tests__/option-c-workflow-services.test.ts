import { beforeEach, describe, expect, it } from '@jest/globals';
import { getWorkflowBuilderService } from '../workflowBuilderService';
import { getWorkflowExecutorService } from '../workflowExecutorService';

describe('Option C: No-Code Workflow Builder', () => {
  const builder = getWorkflowBuilderService();
  const executor = getWorkflowExecutorService();

  beforeEach(() => {
    builder.resetForTests();
  });

  it('creates and retrieves workflow', () => {
    const workflow = builder.createWorkflow({
      name: 'High Risk Escalation',
      jurisdiction: 'US',
      createdBy: 'user-1',
      blocks: [
        {
          blockId: 'b1',
          type: 'CONDITION',
          label: 'Risk > 70',
          config: { field: 'riskScore', operator: 'gt', value: 70 },
        },
        {
          blockId: 'b2',
          type: 'ACTION',
          label: 'Escalate',
          config: { action: 'ESCALATE' },
        },
      ],
    });

    const loaded = builder.getWorkflow(workflow.workflowId);
    expect(loaded?.name).toBe('High Risk Escalation');
    expect(loaded?.status).toBe('DRAFT');
  });

  it('publishes workflow and keeps version history', () => {
    const workflow = builder.createWorkflow({
      name: 'Publish Test',
      jurisdiction: 'AE',
      createdBy: 'user-1',
      blocks: [
        { blockId: 'b1', type: 'CONDITION', label: 'Always', config: { field: 'risk', operator: 'gte', value: 0 } },
      ],
    });

    const published = builder.publishWorkflow(workflow.workflowId, 'compliance-officer');
    const versions = builder.getWorkflowVersions(workflow.workflowId);

    expect(published.status).toBe('PUBLISHED');
    expect(published.version).toBe(2);
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it('tests workflow and executes approve action', () => {
    const workflow = builder.createWorkflow({
      name: 'Approve Low Risk',
      jurisdiction: 'EU',
      createdBy: 'user-2',
      blocks: [
        {
          blockId: 'c1',
          type: 'CONDITION',
          label: 'Risk <= 30',
          config: { field: 'riskScore', operator: 'lte', value: 30 },
        },
        {
          blockId: 'a1',
          type: 'ACTION',
          label: 'Approve',
          config: { action: 'APPROVE' },
        },
      ],
    });

    const result = executor.testWorkflow(workflow.workflowId, { riskScore: 20 });

    expect(result.passed).toBe(true);
    expect(result.actionsExecuted).toContain('APPROVE');
    expect(result.decision).toBe('APPROVE');
  });

  it('tests workflow and skips action when condition fails', () => {
    const workflow = builder.createWorkflow({
      name: 'Reject High Risk',
      jurisdiction: 'US',
      createdBy: 'user-3',
      blocks: [
        {
          blockId: 'c1',
          type: 'CONDITION',
          label: 'Risk > 80',
          config: { field: 'riskScore', operator: 'gt', value: 80 },
        },
        {
          blockId: 'a1',
          type: 'ACTION',
          label: 'Reject',
          config: { action: 'REJECT' },
        },
      ],
    });

    const result = executor.testWorkflow(workflow.workflowId, { riskScore: 40 });

    expect(result.passed).toBe(false);
    expect(result.actionsExecuted.length).toBe(0);
    expect(result.decision).toBe('REVIEW');
  });
});
