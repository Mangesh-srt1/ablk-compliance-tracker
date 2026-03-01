import winston from 'winston';
import { WorkflowExecutionResult, WorkflowExecutionTrace } from '../types/workflow.types';
import { getWorkflowBuilderService } from './workflowBuilderService';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/workflow-executor-service.log' }),
  ],
});

export class WorkflowExecutorService {
  private workflowBuilder = getWorkflowBuilderService();

  testWorkflow(workflowId: string, input: Record<string, unknown>): WorkflowExecutionResult {
    const workflow = this.workflowBuilder.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const trace: WorkflowExecutionTrace[] = [];
    const actionsExecuted: string[] = [];

    let current = true;

    for (const block of workflow.blocks) {
      if (block.type === 'CONDITION') {
        const conditionResult = this.evaluateCondition(block.config, input);
        current = current && conditionResult;
        trace.push({
          blockId: block.blockId,
          blockType: block.type,
          output: conditionResult,
        });
        continue;
      }

      if (block.type === 'LOGIC') {
        const operator = String(block.config.operator || 'AND').toUpperCase();
        if (operator === 'NOT') {
          current = !current;
        }
        trace.push({
          blockId: block.blockId,
          blockType: block.type,
          output: current,
        });
        continue;
      }

      if (block.type === 'ACTION') {
        const actionName = String(block.config.action || 'REVIEW');
        if (current) {
          actionsExecuted.push(actionName);
        }
        trace.push({
          blockId: block.blockId,
          blockType: block.type,
          output: current ? actionName : 'SKIPPED',
        });
      }
    }

    const decision = actionsExecuted.includes('REJECT')
      ? 'REJECT'
      : actionsExecuted.includes('ESCALATE')
        ? 'ESCALATE'
        : actionsExecuted.includes('APPROVE')
          ? 'APPROVE'
          : 'REVIEW';

    const result: WorkflowExecutionResult = {
      workflowId,
      passed: current,
      decision,
      actionsExecuted,
      trace,
    };

    logger.info('Workflow test executed', {
      workflowId,
      decision,
      actionsExecutedCount: actionsExecuted.length,
      passed: current,
    });

    return result;
  }

  executePublishedWorkflow(workflowId: string, input: Record<string, unknown>): WorkflowExecutionResult {
    const workflow = this.workflowBuilder.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status !== 'PUBLISHED') {
      throw new Error('Workflow must be published before execution');
    }

    return this.testWorkflow(workflowId, input);
  }

  private evaluateCondition(
    config: Record<string, unknown>,
    input: Record<string, unknown>
  ): boolean {
    const field = String(config.field || '');
    const operator = String(config.operator || 'eq').toLowerCase();
    const value = config.value;

    const inputValue = input[field];

    switch (operator) {
      case 'eq':
        return inputValue === value;
      case 'neq':
        return inputValue !== value;
      case 'gt':
        return Number(inputValue) > Number(value);
      case 'gte':
        return Number(inputValue) >= Number(value);
      case 'lt':
        return Number(inputValue) < Number(value);
      case 'lte':
        return Number(inputValue) <= Number(value);
      case 'contains':
        return Array.isArray(inputValue)
          ? inputValue.includes(value)
          : String(inputValue ?? '').includes(String(value));
      case 'in':
        return Array.isArray(value) && value.includes(inputValue);
      default:
        return false;
    }
  }
}

let instance: WorkflowExecutorService | null = null;

export function getWorkflowExecutorService(): WorkflowExecutorService {
  if (!instance) {
    instance = new WorkflowExecutorService();
  }
  return instance;
}
