import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowDefinition, WorkflowStatus } from '../types/workflow.types';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/workflow-builder-service.log' }),
  ],
});

export class WorkflowBuilderService {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private versions: Map<string, WorkflowDefinition[]> = new Map();

  createWorkflow(input: {
    name: string;
    description?: string;
    jurisdiction: string;
    blocks: WorkflowDefinition['blocks'];
    connections?: WorkflowDefinition['connections'];
    createdBy: string;
  }): WorkflowDefinition {
    const now = new Date();
    const workflow: WorkflowDefinition = {
      workflowId: uuidv4(),
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      jurisdiction: input.jurisdiction,
      version: 1,
      status: 'DRAFT',
      blocks: input.blocks,
      connections: input.connections ?? [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(workflow.workflowId, workflow);
    this.versions.set(workflow.workflowId, [structuredClone(workflow)]);

    logger.info('Workflow created', {
      workflowId: workflow.workflowId,
      name: workflow.name,
      blockCount: workflow.blocks.length,
    });

    return workflow;
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  listWorkflows(status?: WorkflowStatus): WorkflowDefinition[] {
    const values = Array.from(this.workflows.values());
    if (!status) {
      return values;
    }
    return values.filter((entry) => entry.status === status);
  }

  updateWorkflow(
    workflowId: string,
    patch: Partial<Pick<WorkflowDefinition, 'name' | 'description' | 'blocks' | 'connections' | 'jurisdiction'>>
  ): WorkflowDefinition {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status === 'PUBLISHED') {
      throw new Error('Published workflows cannot be modified directly; create a new version');
    }

    const updated: WorkflowDefinition = {
      ...workflow,
      ...patch,
      updatedAt: new Date(),
    };

    this.workflows.set(workflowId, updated);
    const versionHistory = this.versions.get(workflowId) ?? [];
    versionHistory.push(structuredClone(updated));
    this.versions.set(workflowId, versionHistory);

    return updated;
  }

  publishWorkflow(workflowId: string, publishedBy: string): WorkflowDefinition {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const nextVersion = workflow.version + 1;
    const now = new Date();
    const published: WorkflowDefinition = {
      ...workflow,
      status: 'PUBLISHED',
      version: nextVersion,
      publishedBy,
      publishedAt: now,
      updatedAt: now,
    };

    this.workflows.set(workflowId, published);
    const versionHistory = this.versions.get(workflowId) ?? [];
    versionHistory.push(structuredClone(published));
    this.versions.set(workflowId, versionHistory);

    logger.info('Workflow published', {
      workflowId,
      version: published.version,
      publishedBy,
    });

    return published;
  }

  getWorkflowVersions(workflowId: string): WorkflowDefinition[] {
    return this.versions.get(workflowId) ?? [];
  }

  resetForTests(): void {
    this.workflows.clear();
    this.versions.clear();
  }
}

let instance: WorkflowBuilderService | null = null;

export function getWorkflowBuilderService(): WorkflowBuilderService {
  if (!instance) {
    instance = new WorkflowBuilderService();
  }
  return instance;
}
