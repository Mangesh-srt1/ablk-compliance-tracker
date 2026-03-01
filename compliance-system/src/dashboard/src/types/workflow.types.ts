/**
 * Workflow Builder Types
 * Type definitions for the no-code compliance workflow builder
 */

export type BlockType = 'condition' | 'action' | 'logic';
export type ConditionType = 'aml_score' | 'kyc_status' | 'sanctions_match' | 'transaction_amount' | 'custom';
export type ActionType = 'approve' | 'reject' | 'escalate' | 'send_alert' | 'update_risk_score' | 'webhook';
export type LogicOperator = 'AND' | 'OR' | 'NOT' | 'IF_THEN_ELSE';

export interface WorkflowBlock {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  data: ConditionBlock | ActionBlock | LogicBlock;
  connections: string[]; // IDs of connected blocks
}

export interface ConditionBlock {
  type: 'condition';
  conditionType: ConditionType;
  operator?: 'eq' | 'lt' | 'gt' | 'lte' | 'gte' | 'contains' | 'matches';
  value?: string | number | boolean;
  label?: string;
  description?: string;
}

export interface ActionBlock {
  type: 'action';
  actionType: ActionType;
  params: Record<string, any>;
  label?: string;
  description?: string;
}

export interface LogicBlock {
  type: 'logic';
  operator: LogicOperator;
  label?: string;
}

export interface Workflow {
  id?: string;
  name: string;
  description: string;
  blocks: WorkflowBlock[];
  startBlock?: string; // ID of entry point block
  endBlock?: string; // ID of exit point block
  version?: number;
  published?: boolean;
  publishedAt?: Date;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deployments?: WorkflowDeployment[];
}

export interface WorkflowDeployment {
  id: string;
  workflowId: string;
  version: number;
  deployedAt: Date;
  deployedBy: string;
  status: 'active' | 'inactive' | 'rollback';
  previousVersion?: number;
}

export interface WorkflowTestResult {
  success: boolean;
  steps: TestStep[];
  finalAction?: ActionType;
  finalParams?: Record<string, any>;
  executionTime: number;
  errors?: string[];
}

export interface TestStep {
  blockId: string;
  blockType: BlockType;
  blockLabel?: string;
  result: boolean | any;
  executionTime: number;
  error?: string;
}

export interface WorkflowCondition {
  fieldName: string;
  conditionType: ConditionType;
  operator: string;
  value: string | number | boolean;
  label: string;
}

export interface WorkflowAction {
  actionType: ActionType;
  parameters: Record<string, any>;
  label: string;
  priority?: number; // For multi-action workflows
}

export interface DragItem {
  type: BlockType;
  data?: any;
}

export interface Canvas {
  width: number;
  height: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

// Test Scenario for workflow validation
export interface TestScenario {
  name: string;
  inputs: Record<string, any>;
  expectedAction: ActionType;
  expectedParams?: Record<string, any>;
}

// Workflow Execution Context (for test/preview)
export interface ExecutionContext {
  entity: {
    id: string;
    name: string;
    aml_score?: number;
    kyc_status?: string;
    sanctions_match?: boolean;
  };
  transaction: {
    amount: number;
    currency: string;
    source: string;
    destination: string;
    timestamp: Date;
  };
  environment?: Record<string, any>;
}
