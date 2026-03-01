/**
 * No-code workflow types for Option C.
 */

export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type WorkflowBlockType = 'CONDITION' | 'ACTION' | 'LOGIC';
export type WorkflowDecision = 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW';

export interface WorkflowBlock {
  blockId: string;
  type: WorkflowBlockType;
  label: string;
  config: Record<string, unknown>;
}

export interface WorkflowConnection {
  fromBlockId: string;
  toBlockId: string;
}

export interface WorkflowDefinition {
  workflowId: string;
  name: string;
  description?: string;
  jurisdiction: string;
  version: number;
  status: WorkflowStatus;
  blocks: WorkflowBlock[];
  connections: WorkflowConnection[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedBy?: string;
  publishedAt?: Date;
}

export interface WorkflowExecutionTrace {
  blockId: string;
  blockType: WorkflowBlockType;
  output: unknown;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  passed: boolean;
  decision: WorkflowDecision;
  actionsExecuted: string[];
  trace: WorkflowExecutionTrace[];
}
