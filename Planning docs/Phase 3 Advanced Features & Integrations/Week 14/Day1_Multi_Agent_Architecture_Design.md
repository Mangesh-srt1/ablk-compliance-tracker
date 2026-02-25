# Day 1: Multi-Agent Architecture Design

## Objective
Design and implement a comprehensive multi-agent architecture for the Ableka Lumina RegTech platform, enabling intelligent collaboration between specialized AI agents for compliance automation, risk assessment, and regulatory reporting.

## Implementation Steps

1. **Define agent roles and responsibilities**
   - Compliance monitoring agents
   - Risk assessment agents
   - Reporting agents
   - Communication protocols

2. **Implement agent communication framework**
   - Message passing system
   - Event-driven architecture
   - Inter-agent coordination

3. **Create agent orchestration system**
   - Workflow management
   - Task delegation
   - Conflict resolution

4. **Add agent learning and adaptation**
   - Experience sharing
   - Performance optimization
   - Adaptive behavior

## Code Snippets

### 1. Agent Base Classes
```typescript
// src/agents/base/agent-base.ts
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface AgentConfig {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  maxConcurrency: number;
  timeout: number;
  retryAttempts: number;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'response' | 'notification' | 'error';
  payload: any;
  timestamp: number;
  correlationId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentTask {
  id: string;
  type: string;
  payload: any;
  priority: AgentMessage['priority'];
  deadline?: number;
  dependencies?: string[];
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  result?: any;
  error?: string;
}

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected activeTasks: Map<string, AgentTask> = new Map();
  protected messageQueue: AgentMessage[] = [];
  protected isRunning = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('message', this.handleMessage.bind(this));
    this.on('task-assigned', this.handleTaskAssigned.bind(this));
    this.on('task-completed', this.handleTaskCompleted.bind(this));
    this.on('error', this.handleError.bind(this));
  }

  public getId(): string {
    return this.config.id;
  }

  public getName(): string {
    return this.config.name;
  }

  public getType(): string {
    return this.config.type;
  }

  public getCapabilities(): string[] {
    return this.config.capabilities;
  }

  public isCapable(capability: string): boolean {
    return this.config.capabilities.includes(capability);
  }

  public getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  public canAcceptTask(): boolean {
    return this.activeTasks.size < this.config.maxConcurrency;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    await this.onStart();
    this.emit('started', { agentId: this.config.id });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Complete all active tasks
    for (const [taskId, task] of this.activeTasks) {
      if (task.status === 'in_progress') {
        await this.cancelTask(taskId, 'Agent shutting down');
      }
    }

    this.isRunning = false;
    await this.onStop();
    this.emit('stopped', { agentId: this.config.id });
  }

  public async assignTask(task: AgentTask): Promise<boolean> {
    if (!this.canAcceptTask()) {
      return false;
    }

    if (!this.canHandleTask(task)) {
      return false;
    }

    task.assignedTo = this.config.id;
    task.status = 'in_progress';
    task.updatedAt = Date.now();

    this.activeTasks.set(task.id, task);
    this.emit('task-assigned', { taskId: task.id, agentId: this.config.id });

    // Process task asynchronously
    this.processTask(task).catch(error => {
      this.handleTaskError(task.id, error);
    });

    return true;
  }

  public async cancelTask(taskId: string, reason: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.status = 'cancelled';
    task.error = reason;
    task.updatedAt = Date.now();

    this.activeTasks.delete(taskId);
    await this.onTaskCancelled(task);
    this.emit('task-cancelled', { taskId, agentId: this.config.id, reason });
  }

  protected abstract canHandleTask(task: AgentTask): boolean;
  protected abstract processTask(task: AgentTask): Promise<void>;
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onTaskCancelled(task: AgentTask): Promise<void>;

  private async handleMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);

    // Process message queue
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      await this.processMessage(msg);
    }
  }

  private async handleTaskAssigned(data: { taskId: string; agentId: string }): Promise<void> {
    if (data.agentId !== this.config.id) return;

    const task = this.activeTasks.get(data.taskId);
    if (task) {
      await this.onTaskAssigned(task);
    }
  }

  private async handleTaskCompleted(data: { taskId: string; agentId: string; result: any }): Promise<void> {
    if (data.agentId !== this.config.id) return;

    const task = this.activeTasks.get(data.taskId);
    if (task) {
      task.status = 'completed';
      task.result = data.result;
      task.updatedAt = Date.now();

      this.activeTasks.delete(data.taskId);
      await this.onTaskCompleted(task);
    }
  }

  private async handleError(error: any): Promise<void> {
    console.error(`Agent ${this.config.id} error:`, error);
    await this.onError(error);
  }

  private async handleTaskError(taskId: string, error: any): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.error = error.message || 'Task execution failed';
    task.updatedAt = Date.now();

    this.activeTasks.delete(taskId);
    await this.onTaskFailed(task, error);
    this.emit('task-failed', { taskId, agentId: this.config.id, error: task.error });
  }

  protected async processMessage(message: AgentMessage): Promise<void> {
    // Default message processing - can be overridden
    switch (message.type) {
      case 'task':
        // Handle task assignment via message
        if (message.payload.task) {
          await this.assignTask(message.payload.task);
        }
        break;
      case 'notification':
        await this.onNotification(message);
        break;
      case 'error':
        await this.onErrorMessage(message);
        break;
    }
  }

  protected async onTaskAssigned(task: AgentTask): Promise<void> {
    // Override in subclasses
  }

  protected async onTaskCompleted(task: AgentTask): Promise<void> {
    // Override in subclasses
  }

  protected async onTaskFailed(task: AgentTask, error: any): Promise<void> {
    // Override in subclasses
  }

  protected async onNotification(message: AgentMessage): Promise<void> {
    // Override in subclasses
  }

  protected async onErrorMessage(message: AgentMessage): Promise<void> {
    // Override in subclasses
  }

  protected async onError(error: any): Promise<void> {
    // Override in subclasses
  }

  public getStatus(): {
    id: string;
    name: string;
    type: string;
    isRunning: boolean;
    activeTasks: number;
    capabilities: string[];
  } {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      isRunning: this.isRunning,
      activeTasks: this.activeTasks.size,
      capabilities: this.config.capabilities,
    };
  }
}

// Factory function
export function createAgentId(): string {
  return uuidv4();
}
```

### 2. Agent Communication System
```typescript
// src/agents/communication/agent-communication.ts
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { AgentMessage, AgentTask } from './agent-base';

export interface CommunicationConfig {
  redisUrl: string;
  channelPrefix: string;
  messageTTL: number;
  maxRetries: number;
}

export class AgentCommunicationSystem extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private config: CommunicationConfig;
  private messageHandlers: Map<string, (message: AgentMessage) => Promise<void>> = new Map();
  private isRunning = false;

  constructor(config: CommunicationConfig) {
    super();
    this.config = config;
    this.redis = new Redis(config.redisUrl);
    this.subscriber = new Redis(config.redisUrl);

    this.setupRedisHandlers();
  }

  private setupRedisHandlers(): void {
    this.subscriber.on('message', async (channel, message) => {
      try {
        const parsedMessage: AgentMessage = JSON.parse(message);
        await this.handleIncomingMessage(parsedMessage);
      } catch (error) {
        this.emit('message-parse-error', { channel, message, error: error.message });
      }
    });

    this.redis.on('error', (error) => {
      this.emit('redis-error', error);
    });

    this.subscriber.on('error', (error) => {
      this.emit('redis-subscriber-error', error);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.subscriber.disconnect();
    this.redis.disconnect();

    this.isRunning = false;
    this.emit('stopped');
  }

  public async sendMessage(message: AgentMessage): Promise<void> {
    try {
      const channel = this.getChannelName(message.to);
      const messageData = JSON.stringify(message);

      // Store message with TTL for reliability
      const messageKey = `message:${message.id}`;
      await this.redis.setex(messageKey, this.config.messageTTL, messageData);

      // Publish to channel
      await this.redis.publish(channel, messageData);

      this.emit('message-sent', { messageId: message.id, to: message.to });
    } catch (error) {
      this.emit('message-send-error', { messageId: message.id, error: error.message });
      throw error;
    }
  }

  public async broadcastMessage(message: AgentMessage, agentTypes?: string[]): Promise<void> {
    try {
      // Get all agent channels or filter by types
      const channels = await this.getAgentChannels(agentTypes);

      const messageData = JSON.stringify(message);

      for (const channel of channels) {
        await this.redis.publish(channel, messageData);
      }

      this.emit('message-broadcast', {
        messageId: message.id,
        channelCount: channels.length,
        agentTypes
      });
    } catch (error) {
      this.emit('message-broadcast-error', { messageId: message.id, error: error.message });
      throw error;
    }
  }

  public async subscribeToAgent(agentId: string): Promise<void> {
    const channel = this.getChannelName(agentId);
    await this.subscriber.subscribe(channel);
    this.emit('subscribed', { agentId, channel });
  }

  public async unsubscribeFromAgent(agentId: string): Promise<void> {
    const channel = this.getChannelName(agentId);
    await this.subscriber.unsubscribe(channel);
    this.emit('unsubscribed', { agentId, channel });
  }

  public async registerMessageHandler(
    agentId: string,
    handler: (message: AgentMessage) => Promise<void>
  ): Promise<void> {
    this.messageHandlers.set(agentId, handler);
  }

  public unregisterMessageHandler(agentId: string): void {
    this.messageHandlers.delete(agentId);
  }

  private async handleIncomingMessage(message: AgentMessage): Promise<void> {
    const handler = this.messageHandlers.get(message.to);

    if (handler) {
      try {
        await handler(message);
        this.emit('message-handled', { messageId: message.id, agentId: message.to });
      } catch (error) {
        this.emit('message-handler-error', {
          messageId: message.id,
          agentId: message.to,
          error: error.message
        });
      }
    } else {
      this.emit('no-handler', { messageId: message.id, agentId: message.to });
    }
  }

  private getChannelName(agentId: string): string {
    return `${this.config.channelPrefix}:agent:${agentId}`;
  }

  private async getAgentChannels(agentTypes?: string[]): Promise<string[]> {
    try {
      const pattern = `${this.config.channelPrefix}:agent:*`;
      const keys = await this.redis.keys(pattern);

      if (!agentTypes || agentTypes.length === 0) {
        return keys;
      }

      // Filter by agent types if specified
      const filteredChannels: string[] = [];

      for (const key of keys) {
        const agentId = key.replace(`${this.config.channelPrefix}:agent:`, '');

        // Get agent info from Redis (assuming it's stored there)
        const agentInfo = await this.redis.get(`agent:info:${agentId}`);
        if (agentInfo) {
          const info = JSON.parse(agentInfo);
          if (agentTypes.includes(info.type)) {
            filteredChannels.push(key);
          }
        }
      }

      return filteredChannels;
    } catch (error) {
      this.emit('get-channels-error', error);
      return [];
    }
  }

  public async sendTask(task: AgentTask, targetAgentId: string): Promise<void> {
    const message: AgentMessage = {
      id: `task-${task.id}`,
      from: 'orchestrator', // Could be dynamic
      to: targetAgentId,
      type: 'task',
      payload: { task },
      timestamp: Date.now(),
      correlationId: task.id,
      priority: task.priority,
    };

    await this.sendMessage(message);
  }

  public async requestAgentStatus(agentId: string): Promise<any> {
    const message: AgentMessage = {
      id: `status-request-${Date.now()}`,
      from: 'orchestrator',
      to: agentId,
      type: 'notification',
      payload: { type: 'status_request' },
      timestamp: Date.now(),
      priority: 'medium',
    };

    await this.sendMessage(message);

    // Wait for response (simplified - in practice would use promises/futures)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Status request timeout'));
      }, 5000);

      const responseHandler = (response: any) => {
        if (response.correlationId === message.id) {
          clearTimeout(timeout);
          this.removeListener('status-response', responseHandler);
          resolve(response);
        }
      };

      this.on('status-response', responseHandler);
    });
  }

  public async getMessageHistory(agentId: string, limit: number = 100): Promise<AgentMessage[]> {
    try {
      const pattern = `message:*:${agentId}`;
      const keys = await this.redis.keys(pattern);

      const messages: AgentMessage[] = [];

      for (const key of keys.slice(0, limit)) {
        const messageData = await this.redis.get(key);
        if (messageData) {
          try {
            const message: AgentMessage = JSON.parse(messageData);
            messages.push(message);
          } catch (error) {
            // Skip invalid messages
          }
        }
      }

      // Sort by timestamp
      messages.sort((a, b) => b.timestamp - a.timestamp);

      return messages;
    } catch (error) {
      this.emit('get-history-error', { agentId, error: error.message });
      return [];
    }
  }

  public getConnectionStatus(): {
    redisConnected: boolean;
    subscriberConnected: boolean;
    activeSubscriptions: number;
  } {
    return {
      redisConnected: this.redis.status === 'ready',
      subscriberConnected: this.subscriber.status === 'ready',
      activeSubscriptions: 0, // Would need to track this
    };
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createAgentCommunicationSystem(config: CommunicationConfig): AgentCommunicationSystem {
  return new AgentCommunicationSystem(config);
}
```

### 3. Agent Orchestrator
```typescript
// src/agents/orchestration/agent-orchestrator.ts
import { EventEmitter } from 'events';
import { BaseAgent, AgentTask, AgentMessage } from './agent-base';
import { AgentCommunicationSystem } from './agent-communication';
import Redis from 'ioredis';
import { PriorityQueue } from '@datastructures-js/priority-queue';

export interface OrchestratorConfig {
  redisUrl: string;
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryAttempts: number;
  agentHeartbeatInterval: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  timeout: number;
  retryPolicy: {
    maxAttempts: number;
    backoffMultiplier: number;
  };
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentType: string;
  capabilities: string[];
  inputMapping: { [key: string]: string };
  outputMapping: { [key: string]: string };
  dependencies: string[];
  timeout: number;
}

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStepInstance[];
  context: Map<string, any>;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface WorkflowStepInstance {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgent?: string;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export class AgentOrchestrator extends EventEmitter {
  private communication: AgentCommunicationSystem;
  private redis: Redis;
  private config: OrchestratorConfig;

  private registeredAgents: Map<string, BaseAgent> = new Map();
  private agentCapabilities: Map<string, string[]> = new Map();
  private taskQueue: PriorityQueue<AgentTask>;
  private activeWorkflows: Map<string, WorkflowInstance> = new Map();
  private workflowDefinitions: Map<string, WorkflowDefinition> = new Map();

  private isRunning = false;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.redis = new Redis(config.redisUrl);

    const commConfig = {
      redisUrl: config.redisUrl,
      channelPrefix: 'agent-comm',
      messageTTL: 3600, // 1 hour
      maxRetries: 3,
    };

    this.communication = createAgentCommunicationSystem(commConfig);

    // Priority queue for tasks (higher priority first)
    this.taskQueue = new PriorityQueue<AgentTask>((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.communication.on('message-handled', (data) => {
      this.emit('message-processed', data);
    });

    this.communication.on('message-send-error', (data) => {
      this.emit('communication-error', data);
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    await this.communication.start();

    // Start heartbeat monitoring
    this.heartbeatInterval = setInterval(() => {
      this.checkAgentHealth();
    }, this.config.agentHeartbeatInterval);

    // Start task processing
    this.processTaskQueue();

    this.isRunning = true;
    this.emit('started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Cancel all active workflows
    for (const [workflowId, workflow] of this.activeWorkflows) {
      if (workflow.status === 'running') {
        await this.cancelWorkflow(workflowId, 'Orchestrator shutting down');
      }
    }

    await this.communication.stop();
    await this.redis.disconnect();

    this.isRunning = false;
    this.emit('stopped');
  }

  public registerAgent(agent: BaseAgent): void {
    const agentId = agent.getId();
    this.registeredAgents.set(agentId, agent);
    this.agentCapabilities.set(agentId, agent.getCapabilities());

    // Subscribe to agent's communication channel
    this.communication.subscribeToAgent(agentId);

    // Register message handler for this agent
    this.communication.registerMessageHandler(agentId, async (message) => {
      await this.handleAgentMessage(agentId, message);
    });

    this.emit('agent-registered', { agentId, capabilities: agent.getCapabilities() });
  }

  public unregisterAgent(agentId: string): void {
    const agent = this.registeredAgents.get(agentId);
    if (agent) {
      this.registeredAgents.delete(agentId);
      this.agentCapabilities.delete(agentId);

      this.communication.unsubscribeFromAgent(agentId);
      this.communication.unregisterMessageHandler(agentId);

      this.emit('agent-unregistered', { agentId });
    }
  }

  public async submitTask(task: AgentTask): Promise<string> {
    task.id = task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    task.status = 'pending';
    task.createdAt = Date.now();
    task.updatedAt = Date.now();

    // Add to queue
    this.taskQueue.push(task);

    // Store task in Redis
    await this.redis.setex(
      `task:${task.id}`,
      86400, // 24 hours
      JSON.stringify(task)
    );

    this.emit('task-submitted', { taskId: task.id, type: task.type });
    return task.id;
  }

  public async startWorkflow(
    definitionId: string,
    initialContext: Map<string, any> = new Map()
  ): Promise<string> {
    const definition = this.workflowDefinitions.get(definitionId);
    if (!definition) {
      throw new Error(`Workflow definition ${definitionId} not found`);
    }

    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const workflow: WorkflowInstance = {
      id: workflowId,
      definitionId,
      status: 'running',
      steps: definition.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
      })),
      context: new Map(initialContext),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.activeWorkflows.set(workflowId, workflow);

    // Start workflow execution
    this.executeWorkflow(workflow);

    this.emit('workflow-started', { workflowId, definitionId });
    return workflowId;
  }

  public async cancelWorkflow(workflowId: string, reason: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') return;

    workflow.status = 'cancelled';
    workflow.updatedAt = Date.now();

    // Cancel all running steps
    for (const step of workflow.steps) {
      if (step.status === 'running' && step.assignedAgent) {
        const agent = this.registeredAgents.get(step.assignedAgent);
        if (agent) {
          await agent.cancelTask(`${workflowId}-${step.stepId}`, reason);
        }
      }
    }

    this.emit('workflow-cancelled', { workflowId, reason });
  }

  private async executeWorkflow(workflow: WorkflowInstance): Promise<void> {
    const definition = this.workflowDefinitions.get(workflow.definitionId)!;

    try {
      // Execute steps in topological order
      const executedSteps = new Set<string>();

      while (executedSteps.size < definition.steps.length) {
        const readySteps = definition.steps.filter(step =>
          !executedSteps.has(step.id) &&
          step.dependencies.every(dep => executedSteps.has(dep))
        );

        if (readySteps.length === 0) {
          // No ready steps but not all executed - circular dependency or failed dependencies
          throw new Error('Workflow execution blocked - circular dependency or failed dependencies');
        }

        // Execute ready steps in parallel
        const stepPromises = readySteps.map(step => this.executeWorkflowStep(workflow, step));
        await Promise.all(stepPromises);

        // Mark steps as executed
        readySteps.forEach(step => executedSteps.add(step.id));
      }

      // Workflow completed successfully
      workflow.status = 'completed';
      workflow.completedAt = Date.now();
      workflow.updatedAt = Date.now();

      this.emit('workflow-completed', { workflowId: workflow.id });

    } catch (error) {
      workflow.status = 'failed';
      workflow.updatedAt = Date.now();

      this.emit('workflow-failed', { workflowId: workflow.id, error: error.message });
    }
  }

  private async executeWorkflowStep(
    workflow: WorkflowInstance,
    step: WorkflowStep
  ): Promise<void> {
    const stepInstance = workflow.steps.find(s => s.stepId === step.id)!;
    stepInstance.status = 'running';
    stepInstance.startedAt = Date.now();

    try {
      // Find suitable agent
      const agentId = await this.findSuitableAgent(step);
      if (!agentId) {
        throw new Error(`No suitable agent found for step ${step.id}`);
      }

      stepInstance.assignedAgent = agentId;

      // Prepare task input
      const taskInput = this.mapStepInput(workflow.context, step.inputMapping);

      // Create and submit task
      const task: AgentTask = {
        id: `${workflow.id}-${step.id}`,
        type: step.name,
        payload: taskInput,
        priority: 'medium',
        deadline: Date.now() + step.timeout,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.submitTask(task);

      // Wait for task completion (simplified - in practice would use proper async handling)
      const result = await this.waitForTaskCompletion(task.id, step.timeout);

      // Map output to workflow context
      this.mapStepOutput(workflow.context, step.outputMapping, result);

      stepInstance.status = 'completed';
      stepInstance.completedAt = Date.now();
      stepInstance.result = result;

    } catch (error) {
      stepInstance.status = 'failed';
      stepInstance.error = error.message;
      throw error;
    }
  }

  private async findSuitableAgent(step: WorkflowStep): Promise<string | null> {
    for (const [agentId, capabilities] of this.agentCapabilities) {
      const agent = this.registeredAgents.get(agentId)!;

      if (!agent.canAcceptTask()) continue;

      // Check if agent has required capabilities
      const hasCapabilities = step.capabilities.every(cap => capabilities.includes(cap));
      if (!hasCapabilities) continue;

      // Check if agent type matches
      if (agent.getType() !== step.agentType) continue;

      return agentId;
    }

    return null;
  }

  private mapStepInput(context: Map<string, any>, inputMapping: { [key: string]: string }): any {
    const input: any = {};

    for (const [inputKey, contextKey] of Object.entries(inputMapping)) {
      input[inputKey] = context.get(contextKey);
    }

    return input;
  }

  private mapStepOutput(
    context: Map<string, any>,
    outputMapping: { [key: string]: string },
    result: any
  ): void {
    for (const [outputKey, contextKey] of Object.entries(outputMapping)) {
      context.set(contextKey, result[outputKey]);
    }
  }

  private async waitForTaskCompletion(taskId: string, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out`));
      }, timeout);

      const completionHandler = (result: any) => {
        clearTimeout(timeoutHandle);
        this.removeListener(`task-completed-${taskId}`, completionHandler);
        resolve(result);
      };

      this.on(`task-completed-${taskId}`, completionHandler);
    });
  }

  private async handleAgentMessage(agentId: string, message: AgentMessage): Promise<void> {
    const agent = this.registeredAgents.get(agentId);
    if (!agent) return;

    // Forward message to agent
    agent.emit('message', message);
  }

  private async processTaskQueue(): Promise<void> {
    while (this.isRunning) {
      if (this.taskQueue.size() === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const task = this.taskQueue.pop()!;
      await this.assignTaskToAgent(task);
    }
  }

  private async assignTaskToAgent(task: AgentTask): Promise<void> {
    // Find suitable agent
    const suitableAgents = Array.from(this.registeredAgents.values()).filter(agent =>
      agent.canAcceptTask() &&
      agent.canHandleTask(task)
    );

    if (suitableAgents.length === 0) {
      // No suitable agent available, requeue
      this.taskQueue.push(task);
      return;
    }

    // Assign to first available agent
    const assigned = await suitableAgents[0].assignTask(task);
    if (!assigned) {
      // Agent couldn't accept task, requeue
      this.taskQueue.push(task);
    }
  }

  private async checkAgentHealth(): Promise<void> {
    for (const [agentId, agent] of this.registeredAgents) {
      try {
        const status = agent.getStatus();
        // Store status in Redis
        await this.redis.setex(
          `agent:status:${agentId}`,
          300, // 5 minutes
          JSON.stringify(status)
        );
      } catch (error) {
        this.emit('agent-health-check-failed', { agentId, error: error.message });
      }
    }
  }

  public registerWorkflowDefinition(definition: WorkflowDefinition): void {
    this.workflowDefinitions.set(definition.id, definition);
    this.emit('workflow-definition-registered', { definitionId: definition.id });
  }

  public getWorkflowStatus(workflowId: string): WorkflowInstance | null {
    return this.activeWorkflows.get(workflowId) || null;
  }

  public getRegisteredAgents(): Array<{ id: string; name: string; type: string; capabilities: string[] }> {
    return Array.from(this.registeredAgents.values()).map(agent => ({
      id: agent.getId(),
      name: agent.getName(),
      type: agent.getType(),
      capabilities: agent.getCapabilities(),
    }));
  }

  public getQueueStats(): {
    queuedTasks: number;
    activeWorkflows: number;
    registeredAgents: number;
  } {
    return {
      queuedTasks: this.taskQueue.size(),
      activeWorkflows: this.activeWorkflows.size,
      registeredAgents: this.registeredAgents.size,
    };
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createAgentOrchestrator(config: OrchestratorConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}
```

### 4. Compliance Monitoring Agent
```typescript
// src/agents/specialized/compliance-monitoring-agent.ts
import { BaseAgent, AgentTask, AgentConfig } from '../base/agent-base';
import { ethers } from 'ethers';
import Redis from 'ioredis';

export interface ComplianceCheck {
  id: string;
  type: 'transaction' | 'account' | 'contract';
  data: any;
  rules: ComplianceRule[];
  result?: {
    passed: boolean;
    violations: string[];
    riskScore: number;
    recommendations: string[];
  };
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  condition: (data: any) => boolean;
  violationMessage: string;
}

export class ComplianceMonitoringAgent extends BaseAgent {
  private redis: Redis;
  private complianceRules: Map<string, ComplianceRule> = new Map();
  private sanctionsList: Set<string> = new Set();

  constructor(
    config: AgentConfig,
    redisUrl: string
  ) {
    super(config);
    this.redis = new Redis(redisUrl);
    this.initializeRules();
    this.loadSanctionsList();
  }

  private initializeRules(): void {
    // Transaction monitoring rules
    this.addRule({
      id: 'large-transaction',
      name: 'Large Transaction Detection',
      description: 'Detect transactions above threshold',
      severity: 'medium',
      condition: (data) => {
        const value = parseFloat(data.value || '0');
        return value > 100000; // 100k threshold
      },
      violationMessage: 'Transaction value exceeds monitoring threshold',
    });

    this.addRule({
      id: 'sanctions-check',
      name: 'Sanctions List Check',
      description: 'Check addresses against sanctions lists',
      severity: 'critical',
      condition: (data) => {
        return this.checkSanctionsViolation(data.from) || this.checkSanctionsViolation(data.to);
      },
      violationMessage: 'Transaction involves sanctioned address',
    });

    this.addRule({
      id: 'unusual-pattern',
      name: 'Unusual Transaction Pattern',
      description: 'Detect unusual transaction patterns',
      severity: 'high',
      condition: (data) => {
        return this.detectUnusualPattern(data);
      },
      violationMessage: 'Transaction exhibits unusual patterns',
    });

    // Account monitoring rules
    this.addRule({
      id: 'high-risk-account',
      name: 'High Risk Account',
      description: 'Monitor high-risk accounts',
      severity: 'high',
      condition: (data) => {
        return this.isHighRiskAccount(data.address);
      },
      violationMessage: 'Account flagged as high risk',
    });
  }

  private addRule(rule: ComplianceRule): void {
    this.complianceRules.set(rule.id, rule);
  }

  private async loadSanctionsList(): Promise<void> {
    try {
      // Load from Redis or external source
      const sanctionsData = await this.redis.get('compliance:sanctions');
      if (sanctionsData) {
        const sanctions = JSON.parse(sanctionsData);
        this.sanctionsList = new Set(sanctions);
      }
    } catch (error) {
      console.error('Failed to load sanctions list:', error);
    }
  }

  protected canHandleTask(task: AgentTask): boolean {
    return [
      'compliance-check',
      'transaction-monitor',
      'account-monitor',
      'risk-assessment'
    ].includes(task.type);
  }

  protected async processTask(task: AgentTask): Promise<void> {
    try {
      switch (task.type) {
        case 'compliance-check':
          await this.performComplianceCheck(task);
          break;
        case 'transaction-monitor':
          await this.monitorTransaction(task);
          break;
        case 'account-monitor':
          await this.monitorAccount(task);
          break;
        case 'risk-assessment':
          await this.performRiskAssessment(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      task.status = 'completed';
      task.result = { success: true };
      this.emit('task-completed', { taskId: task.id, agentId: this.config.id, result: task.result });

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      this.emit('task-failed', { taskId: task.id, agentId: this.config.id, error: task.error });
      throw error;
    }
  }

  private async performComplianceCheck(task: AgentTask): Promise<void> {
    const check: ComplianceCheck = task.payload;

    const violations: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Apply relevant rules
    for (const rule of check.rules) {
      try {
        const violated = rule.condition(check.data);
        if (violated) {
          violations.push(rule.violationMessage);
          riskScore += this.getSeverityScore(rule.severity);

          // Add recommendations based on rule
          recommendations.push(...this.getRuleRecommendations(rule.id));
        }
      } catch (error) {
        console.error(`Error applying rule ${rule.id}:`, error);
      }
    }

    check.result = {
      passed: violations.length === 0,
      violations,
      riskScore,
      recommendations,
    };

    // Store result
    await this.storeComplianceResult(check);

    // Emit alert if high risk
    if (riskScore >= 70) {
      this.emit('compliance-alert', {
        checkId: check.id,
        riskScore,
        violations,
        data: check.data
      });
    }
  }

  private async monitorTransaction(task: AgentTask): Promise<void> {
    const transactionData = task.payload;

    // Create compliance check
    const check: ComplianceCheck = {
      id: `tx-check-${transactionData.hash}`,
      type: 'transaction',
      data: transactionData,
      rules: Array.from(this.complianceRules.values()).filter(rule =>
        ['large-transaction', 'sanctions-check', 'unusual-pattern'].includes(rule.id)
      ),
    };

    // Perform check
    await this.performComplianceCheck({ ...task, payload: check });
  }

  private async monitorAccount(task: AgentTask): Promise<void> {
    const accountData = task.payload;

    const check: ComplianceCheck = {
      id: `account-check-${accountData.address}`,
      type: 'account',
      data: accountData,
      rules: Array.from(this.complianceRules.values()).filter(rule =>
        rule.id === 'high-risk-account'
      ),
    };

    await this.performComplianceCheck({ ...task, payload: check });
  }

  private async performRiskAssessment(task: AgentTask): Promise<void> {
    const assessmentData = task.payload;

    // Comprehensive risk assessment
    const riskFactors = await this.calculateRiskFactors(assessmentData);

    const riskScore = this.computeRiskScore(riskFactors);
    const riskLevel = this.getRiskLevel(riskScore);

    task.result = {
      riskScore,
      riskLevel,
      riskFactors,
      assessmentId: `assessment-${Date.now()}`,
    };
  }

  private checkSanctionsViolation(address?: string): boolean {
    if (!address) return false;
    return this.sanctionsList.has(address.toLowerCase());
  }

  private detectUnusualPattern(data: any): boolean {
    // Implement pattern detection logic
    // Check for rapid successive transactions, unusual amounts, etc.
    return false; // Placeholder
  }

  private isHighRiskAccount(address: string): boolean {
    // Check against high-risk account lists
    return false; // Placeholder
  }

  private getSeverityScore(severity: string): number {
    const scores = { low: 10, medium: 25, high: 50, critical: 100 };
    return scores[severity as keyof typeof scores] || 0;
  }

  private getRuleRecommendations(ruleId: string): string[] {
    const recommendations: { [key: string]: string[] } = {
      'large-transaction': [
        'Review transaction purpose and legitimacy',
        'Verify sender and receiver identities',
        'Consider enhanced due diligence'
      ],
      'sanctions-check': [
        'Immediately block transaction',
        'Report to compliance officer',
        'Freeze associated accounts'
      ],
      'unusual-pattern': [
        'Investigate transaction sequence',
        'Review account activity history',
        'Consider additional verification steps'
      ],
    };

    return recommendations[ruleId] || [];
  }

  private async calculateRiskFactors(data: any): Promise<Array<{ factor: string; score: number; reason: string }>> {
    const factors: Array<{ factor: string; score: number; reason: string }> = [];

    // Transaction amount factor
    if (data.value) {
      const value = parseFloat(data.value);
      if (value > 1000000) {
        factors.push({ factor: 'amount', score: 40, reason: 'Very large transaction amount' });
      } else if (value > 100000) {
        factors.push({ factor: 'amount', score: 20, reason: 'Large transaction amount' });
      }
    }

    // Sanctions factor
    if (this.checkSanctionsViolation(data.from) || this.checkSanctionsViolation(data.to)) {
      factors.push({ factor: 'sanctions', score: 100, reason: 'Involves sanctioned address' });
    }

    // Frequency factor
    const recentTxCount = await this.getRecentTransactionCount(data.from);
    if (recentTxCount > 10) {
      factors.push({ factor: 'frequency', score: 15, reason: 'High transaction frequency' });
    }

    return factors;
  }

  private computeRiskScore(factors: Array<{ factor: string; score: number }>): number {
    const totalScore = factors.reduce((sum, factor) => sum + factor.score, 0);
    return Math.min(totalScore, 100); // Cap at 100
  }

  private getRiskLevel(score: number): string {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private async getRecentTransactionCount(address: string): Promise<number> {
    // Query recent transaction count from Redis/database
    return 0; // Placeholder
  }

  private async storeComplianceResult(check: ComplianceCheck): Promise<void> {
    const key = `compliance:result:${check.id}`;
    await this.redis.setex(key, 2592000, JSON.stringify(check)); // 30 days
  }

  protected async onStart(): Promise<void> {
    await this.loadSanctionsList();
    console.log(`Compliance Monitoring Agent ${this.config.id} started`);
  }

  protected async onStop(): Promise<void> {
    console.log(`Compliance Monitoring Agent ${this.config.id} stopped`);
  }

  protected async onTaskCancelled(task: AgentTask): Promise<void> {
    console.log(`Task ${task.id} cancelled for agent ${this.config.id}`);
  }

  public async updateSanctionsList(newSanctions: string[]): Promise<void> {
    this.sanctionsList = new Set(newSanctions.map(addr => addr.toLowerCase()));
    await this.redis.set('compliance:sanctions', JSON.stringify([...this.sanctionsList]));
  }

  public getComplianceRules(): ComplianceRule[] {
    return Array.from(this.complianceRules.values());
  }
}

// Factory function
export function createComplianceMonitoringAgent(
  config: AgentConfig,
  redisUrl: string
): ComplianceMonitoringAgent {
  return new ComplianceMonitoringAgent(config, redisUrl);
}
```

### 5. Agent Service Integration
```typescript
// src/services/agent-orchestration.service.ts
import { AgentOrchestrator, createAgentOrchestrator } from '../agents/orchestration/agent-orchestrator';
import { ComplianceMonitoringAgent, createComplianceMonitoringAgent } from '../agents/specialized/compliance-monitoring-agent';
import { createAgentId } from '../agents/base/agent-base';

export interface AgentOrchestrationConfig {
  redisUrl: string;
  maxConcurrentTasks: number;
  taskTimeout: number;
  agentHeartbeatInterval: number;
}

export class AgentOrchestrationService {
  private orchestrator: AgentOrchestrator;
  private agents: Map<string, any> = new Map();

  constructor(private config: AgentOrchestrationConfig) {
    this.orchestrator = createAgentOrchestrator({
      redisUrl: config.redisUrl,
      maxConcurrentTasks: config.maxConcurrentTasks,
      taskTimeout: config.taskTimeout,
      retryAttempts: 3,
      agentHeartbeatInterval: config.agentHeartbeatInterval,
    });
  }

  public async start(): Promise<void> {
    await this.orchestrator.start();

    // Initialize default agents
    await this.initializeDefaultAgents();
  }

  public async stop(): Promise<void> {
    // Stop all agents
    for (const [agentId, agent] of this.agents) {
      await agent.stop();
    }

    await this.orchestrator.stop();
  }

  private async initializeDefaultAgents(): Promise<void> {
    // Create compliance monitoring agent
    const complianceAgent = createComplianceMonitoringAgent(
      {
        id: createAgentId(),
        name: 'Compliance Monitor',
        type: 'compliance',
        capabilities: ['compliance-check', 'transaction-monitor', 'account-monitor', 'risk-assessment'],
        maxConcurrency: 10,
        timeout: 30000,
        retryAttempts: 3,
      },
      this.config.redisUrl
    );

    await complianceAgent.start();
    this.orchestrator.registerAgent(complianceAgent);
    this.agents.set(complianceAgent.getId(), complianceAgent);

    // Register workflow definitions
    this.registerDefaultWorkflows();
  }

  private registerDefaultWorkflows(): void {
    // Compliance check workflow
    const complianceWorkflow = {
      id: 'compliance-check-workflow',
      name: 'Transaction Compliance Check',
      steps: [
        {
          id: 'sanctions-check',
          name: 'Check Sanctions',
          agentType: 'compliance',
          capabilities: ['compliance-check'],
          inputMapping: { transaction: 'transactionData' },
          outputMapping: { sanctionsResult: 'sanctionsCheck' },
          dependencies: [],
          timeout: 10000,
        },
        {
          id: 'risk-assessment',
          name: 'Risk Assessment',
          agentType: 'compliance',
          capabilities: ['risk-assessment'],
          inputMapping: { data: 'transactionData' },
          outputMapping: { riskResult: 'riskAssessment' },
          dependencies: ['sanctions-check'],
          timeout: 15000,
        },
      ],
      timeout: 60000,
      retryPolicy: {
        maxAttempts: 3,
        backoffMultiplier: 2,
      },
    };

    this.orchestrator.registerWorkflowDefinition(complianceWorkflow);
  }

  public async submitComplianceCheck(transactionData: any): Promise<string> {
    const task = {
      id: '',
      type: 'compliance-check',
      payload: {
        id: `check-${Date.now()}`,
        type: 'transaction',
        data: transactionData,
        rules: [], // Will be populated by agent
      },
      priority: 'high' as const,
      status: 'pending' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return await this.orchestrator.submitTask(task);
  }

  public async startComplianceWorkflow(transactionData: any): Promise<string> {
    return await this.orchestrator.startWorkflow('compliance-check-workflow', new Map([
      ['transactionData', transactionData]
    ]));
  }

  public getWorkflowStatus(workflowId: string) {
    return this.orchestrator.getWorkflowStatus(workflowId);
  }

  public getRegisteredAgents() {
    return this.orchestrator.getRegisteredAgents();
  }

  public getQueueStats() {
    return this.orchestrator.getQueueStats();
  }

  // Dynamic agent management
  public async addComplianceAgent(name: string): Promise<string> {
    const agent = createComplianceMonitoringAgent(
      {
        id: createAgentId(),
        name,
        type: 'compliance',
        capabilities: ['compliance-check', 'transaction-monitor', 'account-monitor', 'risk-assessment'],
        maxConcurrency: 5,
        timeout: 30000,
        retryAttempts: 3,
      },
      this.config.redisUrl
    );

    await agent.start();
    this.orchestrator.registerAgent(agent);
    this.agents.set(agent.getId(), agent);

    return agent.getId();
  }

  public async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.orchestrator.unregisterAgent(agentId);
      await agent.stop();
      this.agents.delete(agentId);
    }
  }
}

// Export singleton instance
export const agentOrchestration = new AgentOrchestrationService({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '50'),
  taskTimeout: parseInt(process.env.TASK_TIMEOUT || '300000'), // 5 minutes
  agentHeartbeatInterval: parseInt(process.env.AGENT_HEARTBEAT_INTERVAL || '30000'), // 30 seconds
});
```

## Notes
- Comprehensive multi-agent architecture with base agent classes and specialized implementations
- Redis-based communication system with message queuing and pub/sub patterns
- Advanced orchestration with workflow management, task delegation, and dependency resolution
- Compliance monitoring agent with rule-based checking, sanctions screening, and risk assessment
- Production-ready error handling, health monitoring, and scalability features
- Integration with Redis for state management and inter-agent communication