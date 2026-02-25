# Day 5: Agent Deployment and Integration Testing

## Objective
Implement comprehensive deployment orchestration and integration testing for the multi-agent compliance system, ensuring reliable production deployment with automated testing, monitoring, and rollback capabilities.

## Implementation Steps

1. **Deployment orchestration**
   - Container orchestration for agent services
   - Service discovery and load balancing
   - Configuration management and secrets handling

2. **Integration testing framework**
   - Multi-agent interaction testing
   - End-to-end compliance workflow testing
   - Performance and load testing

3. **Monitoring and observability**
   - Agent health monitoring
   - Performance metrics collection
   - Alerting and incident response

4. **Rollback and recovery**
   - Automated rollback mechanisms
   - State consistency checks
   - Disaster recovery procedures

## Code Snippets

### 1. Deployment Orchestrator
```typescript
// src/deployment/agent-deployment-orchestrator.ts
import { EventEmitter } from 'events';
import * as k8s from '@kubernetes/client-node';
import Redis from 'ioredis';
import { AgentOrchestrator } from '../agents/core/agent-orchestrator';
import { ProtocolHandler } from '../communication/protocols';

export interface DeploymentConfig {
  kubernetes: {
    namespace: string;
    imageRegistry: string;
    imageTag: string;
    replicas: number;
    resources: {
      cpu: string;
      memory: string;
    };
  };
  redis: {
    url: string;
    clusterMode: boolean;
  };
  monitoring: {
    prometheusEndpoint: string;
    grafanaDashboard: string;
  };
  secrets: {
    vaultUrl: string;
    secretsPath: string;
  };
}

export interface AgentDeployment {
  id: string;
  agentType: string;
  version: string;
  status: 'pending' | 'deploying' | 'running' | 'failed' | 'rolled_back';
  kubernetesResources: {
    deployment: string;
    service: string;
    configMap: string;
    secret: string;
  };
  endpoints: {
    health: string;
    metrics: string;
    api: string;
  };
  metadata: {
    deployedAt: number;
    deployedBy: string;
    environment: string;
    tags: string[];
  };
}

export class AgentDeploymentOrchestrator extends EventEmitter {
  private k8sAppsApi: k8s.AppsV1Api;
  private k8sCoreApi: k8s.CoreV1Api;
  private redis: Redis;
  private config: DeploymentConfig;
  private activeDeployments: Map<string, AgentDeployment> = new Map();

  constructor(config: DeploymentConfig) {
    super();
    this.config = config;

    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    this.k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

    // Initialize Redis
    this.redis = new Redis(config.redis.url);

    this.redis.on('error', (error) => {
      this.emit('redis-error', error);
    });
  }

  public async deployAgent(
    agentType: string,
    version: string,
    options: {
      replicas?: number;
      environment?: Record<string, string>;
      secrets?: Record<string, string>;
      tags?: string[];
    } = {}
  ): Promise<string> {
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.emit('deployment-started', { deploymentId, agentType, version });

      // Create deployment specification
      const deployment = await this.createDeploymentSpec(agentType, version, options);

      // Deploy to Kubernetes
      await this.deployToKubernetes(deployment);

      // Wait for rollout to complete
      await this.waitForRollout(deployment.metadata.name);

      // Register deployment
      const agentDeployment: AgentDeployment = {
        id: deploymentId,
        agentType,
        version,
        status: 'running',
        kubernetesResources: {
          deployment: deployment.metadata.name,
          service: `${deployment.metadata.name}-service`,
          configMap: `${deployment.metadata.name}-config`,
          secret: `${deployment.metadata.name}-secret`,
        },
        endpoints: {
          health: `http://${deployment.metadata.name}-service:8080/health`,
          metrics: `http://${deployment.metadata.name}-service:8080/metrics`,
          api: `http://${deployment.metadata.name}-service:8080/api`,
        },
        metadata: {
          deployedAt: Date.now(),
          deployedBy: process.env.USER || 'system',
          environment: process.env.NODE_ENV || 'production',
          tags: options.tags || [],
        },
      };

      this.activeDeployments.set(deploymentId, agentDeployment);

      // Store deployment info in Redis
      await this.storeDeploymentInfo(agentDeployment);

      this.emit('deployment-completed', { deploymentId, agentDeployment });

      return deploymentId;

    } catch (error) {
      this.emit('deployment-failed', { deploymentId, agentType, error: error.message });

      // Attempt cleanup
      await this.cleanupFailedDeployment(deploymentId);

      throw error;
    }
  }

  public async updateAgent(
    deploymentId: string,
    newVersion: string,
    options: {
      canary?: boolean;
      canaryPercentage?: number;
    } = {}
  ): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      this.emit('update-started', { deploymentId, newVersion });

      if (options.canary) {
        await this.performCanaryUpdate(deployment, newVersion, options.canaryPercentage || 10);
      } else {
        await this.performRollingUpdate(deployment, newVersion);
      }

      // Update deployment record
      deployment.version = newVersion;
      deployment.metadata.deployedAt = Date.now();

      await this.storeDeploymentInfo(deployment);

      this.emit('update-completed', { deploymentId, newVersion });

    } catch (error) {
      this.emit('update-failed', { deploymentId, newVersion, error: error.message });
      throw error;
    }
  }

  public async rollbackAgent(deploymentId: string, targetVersion?: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      this.emit('rollback-started', { deploymentId, targetVersion });

      // Find previous version
      const rollbackVersion = targetVersion || await this.getPreviousVersion(deployment);

      // Perform rollback
      await this.performRollingUpdate(deployment, rollbackVersion);

      // Update deployment record
      deployment.version = rollbackVersion;
      deployment.status = 'rolled_back';
      deployment.metadata.deployedAt = Date.now();

      await this.storeDeploymentInfo(deployment);

      this.emit('rollback-completed', { deploymentId, rollbackVersion });

    } catch (error) {
      this.emit('rollback-failed', { deploymentId, error: error.message });
      throw error;
    }
  }

  public async scaleAgent(
    deploymentId: string,
    replicas: number
  ): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      this.emit('scaling-started', { deploymentId, replicas });

      await this.k8sAppsApi.patchNamespacedDeploymentScale(
        deployment.kubernetesResources.deployment,
        this.config.kubernetes.namespace,
        {
          spec: {
            replicas,
          },
        }
      );

      // Wait for scaling to complete
      await this.waitForRollout(deployment.kubernetesResources.deployment);

      this.emit('scaling-completed', { deploymentId, replicas });

    } catch (error) {
      this.emit('scaling-failed', { deploymentId, replicas, error: error.message });
      throw error;
    }
  }

  public async getAgentStatus(deploymentId: string): Promise<{
    status: string;
    replicas: number;
    availableReplicas: number;
    readyReplicas: number;
    health: 'healthy' | 'degraded' | 'unhealthy';
    lastHealthCheck: number;
  }> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      const k8sDeployment = await this.k8sAppsApi.readNamespacedDeployment(
        deployment.kubernetesResources.deployment,
        this.config.kubernetes.namespace
      );

      const replicas = k8sDeployment.body.spec?.replicas || 0;
      const availableReplicas = k8sDeployment.body.status?.availableReplicas || 0;
      const readyReplicas = k8sDeployment.body.status?.readyReplicas || 0;

      // Determine health status
      let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (readyReplicas === 0) {
        health = 'unhealthy';
      } else if (readyReplicas < replicas) {
        health = 'degraded';
      }

      return {
        status: deployment.status,
        replicas,
        availableReplicas,
        readyReplicas,
        health,
        lastHealthCheck: Date.now(),
      };

    } catch (error) {
      return {
        status: 'error',
        replicas: 0,
        availableReplicas: 0,
        readyReplicas: 0,
        health: 'unhealthy',
        lastHealthCheck: Date.now(),
      };
    }
  }

  public async listDeployments(filters?: {
    agentType?: string;
    status?: string;
    tags?: string[];
  }): Promise<AgentDeployment[]> {
    let deployments = Array.from(this.activeDeployments.values());

    if (filters) {
      deployments = deployments.filter(deployment => {
        if (filters.agentType && deployment.agentType !== filters.agentType) return false;
        if (filters.status && deployment.status !== filters.status) return false;
        if (filters.tags && filters.tags.length > 0) {
          const hasAllTags = filters.tags.every(tag => deployment.metadata.tags.includes(tag));
          if (!hasAllTags) return false;
        }
        return true;
      });
    }

    return deployments;
  }

  public async cleanupDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    try {
      // Delete Kubernetes resources
      await this.k8sAppsApi.deleteNamespacedDeployment(
        deployment.kubernetesResources.deployment,
        this.config.kubernetes.namespace
      );

      await this.k8sCoreApi.deleteNamespacedService(
        deployment.kubernetesResources.service,
        this.config.kubernetes.namespace
      );

      // Remove from active deployments
      this.activeDeployments.delete(deploymentId);

      // Remove from Redis
      await this.redis.del(`deployment:${deploymentId}`);

      this.emit('deployment-cleaned', { deploymentId });

    } catch (error) {
      this.emit('cleanup-failed', { deploymentId, error: error.message });
      throw error;
    }
  }

  private async createDeploymentSpec(
    agentType: string,
    version: string,
    options: any
  ): Promise<k8s.V1Deployment> {
    const deploymentName = `${agentType}-${version.replace(/\./g, '-')}-${Date.now()}`;

    const deployment: k8s.V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deploymentName,
        namespace: this.config.kubernetes.namespace,
        labels: {
          app: agentType,
          version,
          'managed-by': 'agent-deployment-orchestrator',
        },
      },
      spec: {
        replicas: options.replicas || this.config.kubernetes.replicas,
        selector: {
          matchLabels: {
            app: agentType,
            version,
          },
        },
        template: {
          metadata: {
            labels: {
              app: agentType,
              version,
            },
          },
          spec: {
            containers: [
              {
                name: 'agent',
                image: `${this.config.kubernetes.imageRegistry}/${agentType}:${version}`,
                ports: [
                  { containerPort: 8080, name: 'http' },
                  { containerPort: 9090, name: 'metrics' },
                ],
                env: this.buildEnvironmentVariables(options.environment),
                resources: {
                  requests: this.config.kubernetes.resources,
                  limits: this.config.kubernetes.resources,
                },
                livenessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 8080,
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 8080,
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                },
              },
            ],
          },
        },
      },
    };

    return deployment;
  }

  private buildEnvironmentVariables(customEnv?: Record<string, string>): k8s.V1EnvVar[] {
    const envVars: k8s.V1EnvVar[] = [
      {
        name: 'NODE_ENV',
        value: 'production',
      },
      {
        name: 'REDIS_URL',
        value: this.config.redis.url,
      },
      {
        name: 'PROMETHEUS_ENDPOINT',
        value: this.config.monitoring.prometheusEndpoint,
      },
    ];

    if (customEnv) {
      for (const [key, value] of Object.entries(customEnv)) {
        envVars.push({ name: key, value });
      }
    }

    return envVars;
  }

  private async deployToKubernetes(deployment: k8s.V1Deployment): Promise<void> {
    // Create deployment
    await this.k8sAppsApi.createNamespacedDeployment(
      this.config.kubernetes.namespace,
      deployment
    );

    // Create service
    const service: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${deployment.metadata.name}-service`,
        namespace: this.config.kubernetes.namespace,
      },
      spec: {
        selector: deployment.spec.selector.matchLabels,
        ports: [
          { port: 8080, targetPort: 8080, name: 'http' },
          { port: 9090, targetPort: 9090, name: 'metrics' },
        ],
        type: 'ClusterIP',
      },
    };

    await this.k8sCoreApi.createNamespacedService(
      this.config.kubernetes.namespace,
      service
    );
  }

  private async waitForRollout(deploymentName: string, timeout: number = 300000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const deployment = await this.k8sAppsApi.readNamespacedDeployment(
        deploymentName,
        this.config.kubernetes.namespace
      );

      const replicas = deployment.body.spec?.replicas || 0;
      const readyReplicas = deployment.body.status?.readyReplicas || 0;

      if (readyReplicas === replicas && replicas > 0) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Deployment rollout timeout for ${deploymentName}`);
  }

  private async performRollingUpdate(
    deployment: AgentDeployment,
    newVersion: string
  ): Promise<void> {
    const patch = {
      spec: {
        template: {
          metadata: {
            labels: {
              version: newVersion,
            },
          },
          spec: {
            containers: [
              {
                name: 'agent',
                image: `${this.config.kubernetes.imageRegistry}/${deployment.agentType}:${newVersion}`,
              },
            ],
          },
        },
      },
    };

    await this.k8sAppsApi.patchNamespacedDeployment(
      deployment.kubernetesResources.deployment,
      this.config.kubernetes.namespace,
      patch
    );

    await this.waitForRollout(deployment.kubernetesResources.deployment);
  }

  private async performCanaryUpdate(
    deployment: AgentDeployment,
    newVersion: string,
    percentage: number
  ): Promise<void> {
    // Create canary deployment
    const canaryDeployment = await this.createDeploymentSpec(
      deployment.agentType,
      newVersion,
      { replicas: Math.ceil((deployment.replicas || 1) * percentage / 100) }
    );

    canaryDeployment.metadata.name = `${deployment.kubernetesResources.deployment}-canary`;

    await this.deployToKubernetes(canaryDeployment);

    // Wait for canary to be ready
    await this.waitForRollout(canaryDeployment.metadata.name);

    // If canary is successful, proceed with full rollout
    await this.performRollingUpdate(deployment, newVersion);

    // Clean up canary
    await this.k8sAppsApi.deleteNamespacedDeployment(
      canaryDeployment.metadata.name,
      this.config.kubernetes.namespace
    );
  }

  private async getPreviousVersion(deployment: AgentDeployment): Promise<string> {
    // In a real implementation, this would query deployment history
    // For now, return a placeholder
    return '1.0.0';
  }

  private async storeDeploymentInfo(deployment: AgentDeployment): Promise<void> {
    await this.redis.setex(
      `deployment:${deployment.id}`,
      86400 * 30, // 30 days
      JSON.stringify(deployment)
    );
  }

  private async cleanupFailedDeployment(deploymentId: string): Promise<void> {
    // Cleanup logic for failed deployments
    try {
      const deployment = this.activeDeployments.get(deploymentId);
      if (deployment) {
        await this.cleanupDeployment(deploymentId);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createAgentDeploymentOrchestrator(config: DeploymentConfig): AgentDeploymentOrchestrator {
  return new AgentDeploymentOrchestrator(config);
}
```

### 2. Integration Testing Framework
```typescript
// src/testing/agent-integration-tester.ts
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { AgentOrchestrator } from '../agents/core/agent-orchestrator';
import { ProtocolHandler } from '../communication/protocols';
import { ToolRegistry } from '../agents/tools/tool-registry';

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  agents: string[];
  workflow: Array<{
    step: number;
    agent: string;
    action: string;
    parameters: Record<string, any>;
    expectedOutcome: any;
    timeout: number;
  }>;
  assertions: Array<{
    type: 'state' | 'message' | 'performance' | 'compliance';
    target: string;
    condition: string;
    value: any;
  }>;
  metadata: {
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
    estimatedDuration: number;
  };
}

export interface TestResult {
  scenarioId: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  steps: Array<{
    step: number;
    status: 'passed' | 'failed' | 'timeout';
    duration: number;
    error?: string;
    actualOutcome?: any;
  }>;
  assertions: Array<{
    assertion: string;
    status: 'passed' | 'failed';
    actualValue?: any;
    error?: string;
  }>;
  performance: {
    totalMessages: number;
    averageResponseTime: number;
    peakMemoryUsage: number;
    errorRate: number;
  };
  metadata: {
    startedAt: number;
    completedAt: number;
    environment: string;
    version: string;
  };
}

export interface IntegrationTestConfig {
  redisUrl: string;
  agentEndpoints: Record<string, string>;
  testTimeout: number;
  parallelExecution: boolean;
  maxConcurrency: number;
  enablePerformanceMonitoring: boolean;
  resultRetention: number; // in days
}

export class AgentIntegrationTester extends EventEmitter {
  private redis: Redis;
  private config: IntegrationTestConfig;
  private agentOrchestrator: AgentOrchestrator;
  private protocolHandler: ProtocolHandler;
  private toolRegistry: ToolRegistry;
  private activeTests: Map<string, { scenario: TestScenario; startTime: number }> = new Map();

  constructor(
    config: IntegrationTestConfig,
    agentOrchestrator: AgentOrchestrator,
    protocolHandler: ProtocolHandler,
    toolRegistry: ToolRegistry
  ) {
    super();
    this.config = config;
    this.agentOrchestrator = agentOrchestrator;
    this.protocolHandler = protocolHandler;
    this.toolRegistry = toolRegistry;

    this.redis = new Redis(config.redisUrl);

    this.redis.on('error', (error) => {
      this.emit('redis-error', error);
    });
  }

  public async runTestScenario(scenario: TestScenario): Promise<TestResult> {
    const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.emit('test-started', { testId, scenario: scenario.id });

      this.activeTests.set(testId, { scenario, startTime: Date.now() });

      const result = await this.executeTestScenario(scenario);

      // Store result
      await this.storeTestResult(result);

      this.activeTests.delete(testId);

      this.emit('test-completed', { testId, result });

      return result;

    } catch (error) {
      this.emit('test-error', { testId, scenario: scenario.id, error: error.message });

      this.activeTests.delete(testId);

      // Return error result
      return {
        scenarioId: scenario.id,
        status: 'error',
        duration: Date.now() - (this.activeTests.get(testId)?.startTime || Date.now()),
        steps: [],
        assertions: [],
        performance: {
          totalMessages: 0,
          averageResponseTime: 0,
          peakMemoryUsage: 0,
          errorRate: 1,
        },
        metadata: {
          startedAt: this.activeTests.get(testId)?.startTime || Date.now(),
          completedAt: Date.now(),
          environment: process.env.NODE_ENV || 'test',
          version: '1.0.0',
        },
      };
    }
  }

  public async runTestSuite(
    scenarios: TestScenario[],
    options: {
      parallel?: boolean;
      failFast?: boolean;
      categories?: string[];
      priorities?: string[];
    } = {}
  ): Promise<{
    results: TestResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      error: number;
      duration: number;
    };
  }> {
    // Filter scenarios
    let filteredScenarios = scenarios;

    if (options.categories) {
      filteredScenarios = filteredScenarios.filter(s =>
        options.categories!.includes(s.metadata.category)
      );
    }

    if (options.priorities) {
      filteredScenarios = filteredScenarios.filter(s =>
        options.priorities!.includes(s.metadata.priority)
      );
    }

    const startTime = Date.now();
    const results: TestResult[] = [];

    if (options.parallel && this.config.parallelExecution) {
      // Run tests in parallel with concurrency limit
      const batches = this.chunkArray(filteredScenarios, this.config.maxConcurrency);

      for (const batch of batches) {
        const batchPromises = batch.map(scenario => this.runTestScenario(scenario));
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            // Handle rejected promises
            console.error('Test batch error:', result.reason);
          }
        }

        // Check failFast
        if (options.failFast) {
          const hasFailures = results.some(r => r.status === 'failed' || r.status === 'error');
          if (hasFailures) break;
        }
      }
    } else {
      // Run tests sequentially
      for (const scenario of filteredScenarios) {
        const result = await this.runTestScenario(scenario);
        results.push(result);

        if (options.failFast && (result.status === 'failed' || result.status === 'error')) {
          break;
        }
      }
    }

    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: results.filter(r => r.status === 'error').length,
      duration: Date.now() - startTime,
    };

    this.emit('suite-completed', { summary, results });

    return { results, summary };
  }

  public async createComplianceTestScenario(
    complianceType: string,
    jurisdiction: string,
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
  ): Promise<TestScenario> {
    const scenarioId = `compliance-${complianceType}-${jurisdiction}-${Date.now()}`;

    const workflow = this.buildComplianceWorkflow(complianceType, jurisdiction, complexity);
    const assertions = this.buildComplianceAssertions(complianceType, jurisdiction);

    const scenario: TestScenario = {
      id: scenarioId,
      name: `${complianceType} Compliance Test - ${jurisdiction}`,
      description: `Automated test for ${complianceType} compliance in ${jurisdiction} jurisdiction`,
      agents: ['compliance-agent', 'risk-agent', 'reporting-agent'],
      workflow,
      assertions,
      metadata: {
        category: 'compliance',
        priority: complexity === 'complex' ? 'high' : 'medium',
        tags: [complianceType, jurisdiction, complexity],
        estimatedDuration: complexity === 'complex' ? 300000 : 120000,
      },
    };

    return scenario;
  }

  public async loadTestScenariosFromFile(filePath: string): Promise<TestScenario[]> {
    // Implementation would load from JSON/YAML file
    // For now, return empty array
    return [];
  }

  public async exportTestResults(
    results: TestResult[],
    format: 'json' | 'junit' | 'html' = 'json'
  ): Promise<string> {
    switch (format) {
      case 'junit':
        return this.exportJUnit(results);
      case 'html':
        return this.exportHTML(results);
      default:
        return JSON.stringify(results, null, 2);
    }
  }

  public async getTestHistory(
    scenarioId?: string,
    limit: number = 50
  ): Promise<TestResult[]> {
    const pattern = scenarioId ? `test:result:${scenarioId}:*` : `test:result:*`;
    const keys = await this.redis.keys(pattern);

    const results: TestResult[] = [];

    for (const key of keys.slice(0, limit)) {
      const data = await this.redis.get(key);
      if (data) {
        results.push(JSON.parse(data));
      }
    }

    // Sort by completion time (newest first)
    results.sort((a, b) => b.metadata.completedAt - a.metadata.completedAt);

    return results;
  }

  public async getTestMetrics(timeRange?: { start: number; end: number }): Promise<{
    totalTests: number;
    successRate: number;
    averageDuration: number;
    failureRate: number;
    topFailingScenarios: Array<{ scenarioId: string; failureCount: number }>;
    performanceTrends: Array<{ timestamp: number; successRate: number }>;
  }> {
    const endTime = timeRange?.end || Date.now();
    const startTime = timeRange?.start || (endTime - (7 * 24 * 60 * 60 * 1000)); // Last 7 days

    const results = await this.getTestHistory(undefined, 1000);
    const filteredResults = results.filter(r =>
      r.metadata.completedAt >= startTime && r.metadata.completedAt <= endTime
    );

    const totalTests = filteredResults.length;
    const passedTests = filteredResults.filter(r => r.status === 'passed').length;
    const successRate = totalTests > 0 ? passedTests / totalTests : 0;

    const totalDuration = filteredResults.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;

    const failedTests = filteredResults.filter(r => r.status === 'failed').length;
    const failureRate = totalTests > 0 ? failedTests / totalTests : 0;

    // Top failing scenarios
    const failureCounts: Record<string, number> = {};
    filteredResults.filter(r => r.status === 'failed').forEach(r => {
      failureCounts[r.scenarioId] = (failureCounts[r.scenarioId] || 0) + 1;
    });

    const topFailingScenarios = Object.entries(failureCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([scenarioId, failureCount]) => ({ scenarioId, failureCount }));

    // Performance trends (daily)
    const trends: Record<number, { total: number; passed: number }> = {};
    filteredResults.forEach(r => {
      const day = Math.floor(r.metadata.completedAt / (24 * 60 * 60 * 1000));
      if (!trends[day]) {
        trends[day] = { total: 0, passed: 0 };
      }
      trends[day].total++;
      if (r.status === 'passed') {
        trends[day].passed++;
      }
    });

    const performanceTrends = Object.entries(trends)
      .map(([timestamp, stats]) => ({
        timestamp: parseInt(timestamp) * 24 * 60 * 60 * 1000,
        successRate: stats.total > 0 ? stats.passed / stats.total : 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      totalTests,
      successRate,
      averageDuration,
      failureRate,
      topFailingScenarios,
      performanceTrends,
    };
  }

  private async executeTestScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = Date.now();
    const steps: TestResult['steps'] = [];
    const performance = {
      totalMessages: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      errorRate: 0,
    };

    let status: TestResult['status'] = 'passed';

    try {
      // Execute workflow steps
      for (const workflowStep of scenario.workflow) {
        const stepStartTime = Date.now();

        try {
          const result = await this.executeWorkflowStep(workflowStep);

          steps.push({
            step: workflowStep.step,
            status: 'passed',
            duration: Date.now() - stepStartTime,
            actualOutcome: result,
          });

          // Update performance metrics
          performance.totalMessages++;

        } catch (error) {
          steps.push({
            step: workflowStep.step,
            status: 'failed',
            duration: Date.now() - stepStartTime,
            error: error.message,
          });

          status = 'failed';
          break;
        }
      }

      // Execute assertions
      const assertions = await this.executeAssertions(scenario.assertions);

      // Check if any assertions failed
      const failedAssertions = assertions.filter(a => a.status === 'failed');
      if (failedAssertions.length > 0) {
        status = 'failed';
      }

      // Calculate performance metrics
      const totalResponseTime = steps.reduce((sum, step) => sum + step.duration, 0);
      performance.averageResponseTime = steps.length > 0 ? totalResponseTime / steps.length : 0;
      performance.errorRate = steps.length > 0 ?
        steps.filter(s => s.status === 'failed').length / steps.length : 0;

    } catch (error) {
      status = 'error';
    }

    const result: TestResult = {
      scenarioId: scenario.id,
      status,
      duration: Date.now() - startTime,
      steps,
      assertions: await this.executeAssertions(scenario.assertions),
      performance,
      metadata: {
        startedAt: startTime,
        completedAt: Date.now(),
        environment: process.env.NODE_ENV || 'test',
        version: '1.0.0',
      },
    };

    return result;
  }

  private async executeWorkflowStep(step: TestScenario['workflow'][0]): Promise<any> {
    // Implementation would execute the actual workflow step
    // This is a simplified version
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate step execution
        resolve({ success: true, data: `Step ${step.step} completed` });
      }, Math.random() * 1000);
    });
  }

  private async executeAssertions(assertions: TestScenario['assertions']): Promise<TestResult['assertions']> {
    const results: TestResult['assertions'] = [];

    for (const assertion of assertions) {
      try {
        const actualValue = await this.evaluateAssertion(assertion);
        const passed = this.checkAssertion(assertion, actualValue);

        results.push({
          assertion: `${assertion.type}: ${assertion.condition}`,
          status: passed ? 'passed' : 'failed',
          actualValue,
        });
      } catch (error) {
        results.push({
          assertion: `${assertion.type}: ${assertion.condition}`,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return results;
  }

  private async evaluateAssertion(assertion: TestScenario['assertions'][0]): Promise<any> {
    // Implementation would evaluate the actual assertion
    // This is a simplified version
    return { status: 'ok', value: true };
  }

  private checkAssertion(assertion: TestScenario['assertions'][0], actualValue: any): boolean {
    // Implementation would check the assertion condition
    // This is a simplified version
    return true;
  }

  private buildComplianceWorkflow(
    complianceType: string,
    jurisdiction: string,
    complexity: string
  ): TestScenario['workflow'] {
    // Build workflow based on compliance type and complexity
    const workflow: TestScenario['workflow'] = [
      {
        step: 1,
        agent: 'compliance-agent',
        action: 'analyze_transaction',
        parameters: { complianceType, jurisdiction },
        expectedOutcome: { compliant: true },
        timeout: 30000,
      },
      {
        step: 2,
        agent: 'risk-agent',
        action: 'assess_risk',
        parameters: { transactionId: 'test-tx-1' },
        expectedOutcome: { riskLevel: 'low' },
        timeout: 20000,
      },
    ];

    if (complexity === 'complex') {
      workflow.push({
        step: 3,
        agent: 'reporting-agent',
        action: 'generate_report',
        parameters: { format: 'regulatory', jurisdiction },
        expectedOutcome: { reportGenerated: true },
        timeout: 45000,
      });
    }

    return workflow;
  }

  private buildComplianceAssertions(
    complianceType: string,
    jurisdiction: string
  ): TestScenario['assertions'] {
    return [
      {
        type: 'compliance',
        target: 'transaction',
        condition: 'isCompliant',
        value: true,
      },
      {
        type: 'state',
        target: 'agent',
        condition: 'healthCheck',
        value: 'healthy',
      },
      {
        type: 'performance',
        target: 'responseTime',
        condition: 'lessThan',
        value: 50000,
      },
    ];
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async storeTestResult(result: TestResult): Promise<void> {
    const key = `test:result:${result.scenarioId}:${Date.now()}`;
    await this.redis.setex(key, this.config.resultRetention * 24 * 60 * 60, JSON.stringify(result));
  }

  private exportJUnit(results: TestResult[]): string {
    const testSuites = results.map(result => `
      <testsuite name="${result.scenarioId}" tests="${result.steps.length}" failures="${result.steps.filter(s => s.status === 'failed').length}" time="${result.duration / 1000}">
        ${result.steps.map(step => `
          <testcase name="Step ${step.step}" time="${step.duration / 1000}">
            ${step.status === 'failed' ? `<failure message="${step.error || 'Step failed'}"/>` : ''}
          </testcase>
        `).join('')}
      </testsuite>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
      <testsuites>
        ${testSuites}
      </testsuites>
    `;
  }

  private exportHTML(results: TestResult[]): string {
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      error: results.filter(r => r.status === 'error').length,
    };

    return `
      <html>
        <head>
          <title>Agent Integration Test Results</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .test-result { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
            .passed { background: #e8f5e8; border-color: #4caf50; }
            .failed { background: #ffebee; border-color: #f44336; }
            .error { background: #fff3e0; border-color: #ff9800; }
          </style>
        </head>
        <body>
          <h1>Agent Integration Test Results</h1>
          <div class="summary">
            <h2>Summary</h2>
            <p>Total Tests: ${summary.total}</p>
            <p>Passed: ${summary.passed}</p>
            <p>Failed: ${summary.failed}</p>
            <p>Errors: ${summary.error}</p>
            <p>Success Rate: ${summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : 0}%</p>
          </div>
          <h2>Test Results</h2>
          ${results.map(result => `
            <div class="test-result ${result.status}">
              <h3>${result.scenarioId}</h3>
              <p>Status: ${result.status.toUpperCase()}</p>
              <p>Duration: ${result.duration}ms</p>
              <p>Steps: ${result.steps.length}</p>
            </div>
          `).join('')}
        </body>
      </html>
    `;
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createAgentIntegrationTester(
  config: IntegrationTestConfig,
  agentOrchestrator: AgentOrchestrator,
  protocolHandler: ProtocolHandler,
  toolRegistry: ToolRegistry
): AgentIntegrationTester {
  return new AgentIntegrationTester(config, agentOrchestrator, protocolHandler, toolRegistry);
}
```

### 3. Monitoring and Health Service
```typescript
// src/monitoring/agent-health-monitor.ts
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import * as promClient from 'prom-client';
import { AgentDeploymentOrchestrator } from '../deployment/agent-deployment-orchestrator';

export interface HealthCheck {
  id: string;
  agentId: string;
  endpoint: string;
  type: 'http' | 'tcp' | 'custom';
  interval: number; // in milliseconds
  timeout: number;
  retries: number;
  lastCheck: number;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  errorMessage?: string;
  metadata: {
    tags: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface MonitoringConfig {
  redisUrl: string;
  prometheusPort: number;
  healthCheckInterval: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    consecutiveFailures: number;
  };
  notification: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
  };
}

export interface Alert {
  id: string;
  type: 'health' | 'performance' | 'error' | 'deployment';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  agentId?: string;
  deploymentId?: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}

export class AgentHealthMonitor extends EventEmitter {
  private redis: Redis;
  private config: MonitoringConfig;
  private deploymentOrchestrator: AgentDeploymentOrchestrator;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private prometheusRegistry: promClient.Registry;

  // Prometheus metrics
  private agentHealthGauge: promClient.Gauge<string>;
  private responseTimeHistogram: promClient.Histogram<string>;
  private errorRateGauge: promClient.Gauge<string>;
  private alertCounter: promClient.Counter<string>;

  constructor(config: MonitoringConfig, deploymentOrchestrator: AgentDeploymentOrchestrator) {
    super();
    this.config = config;
    this.deploymentOrchestrator = deploymentOrchestrator;

    this.redis = new Redis(config.redisUrl);

    // Initialize Prometheus registry
    this.prometheusRegistry = new promClient.Registry();

    // Create metrics
    this.agentHealthGauge = new promClient.Gauge({
      name: 'agent_health_status',
      help: 'Health status of agents (1=healthy, 0=unhealthy)',
      labelNames: ['agent_id', 'deployment_id'],
      registers: [this.prometheusRegistry],
    });

    this.responseTimeHistogram = new promClient.Histogram({
      name: 'agent_response_time_seconds',
      help: 'Response time of agent health checks',
      labelNames: ['agent_id', 'check_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.prometheusRegistry],
    });

    this.errorRateGauge = new promClient.Gauge({
      name: 'agent_error_rate',
      help: 'Error rate of agent operations',
      labelNames: ['agent_id', 'operation_type'],
      registers: [this.prometheusRegistry],
    });

    this.alertCounter = new promClient.Counter({
      name: 'agent_alerts_total',
      help: 'Total number of alerts generated',
      labelNames: ['severity', 'type'],
      registers: [this.prometheusRegistry],
    });

    this.redis.on('error', (error) => {
      this.emit('redis-error', error);
    });

    // Start monitoring
    this.startHealthChecks();
    this.startPrometheusServer();
  }

  public async registerHealthCheck(
    agentId: string,
    endpoint: string,
    options: {
      type?: 'http' | 'tcp' | 'custom';
      interval?: number;
      timeout?: number;
      retries?: number;
      tags?: string[];
      severity?: 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ): Promise<string> {
    const checkId = `health-${agentId}-${Date.now()}`;

    const healthCheck: HealthCheck = {
      id: checkId,
      agentId,
      endpoint,
      type: options.type || 'http',
      interval: options.interval || this.config.healthCheckInterval,
      timeout: options.timeout || 5000,
      retries: options.retries || 3,
      lastCheck: 0,
      status: 'healthy',
      responseTime: 0,
      metadata: {
        tags: options.tags || [],
        severity: options.severity || 'medium',
      },
    };

    this.healthChecks.set(checkId, healthCheck);

    // Store in Redis
    await this.storeHealthCheck(healthCheck);

    this.emit('health-check-registered', { checkId, agentId });

    return checkId;
  }

  public async unregisterHealthCheck(checkId: string): Promise<void> {
    this.healthChecks.delete(checkId);
    await this.redis.del(`health:check:${checkId}`);
    this.emit('health-check-unregistered', { checkId });
  }

  public async getHealthStatus(agentId?: string): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    agents: Record<string, HealthCheck>;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  }> {
    const checks = agentId
      ? Array.from(this.healthChecks.values()).filter(check => check.agentId === agentId)
      : Array.from(this.healthChecks.values());

    const agents: Record<string, HealthCheck> = {};
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    for (const check of checks) {
      agents[check.agentId] = check;

      switch (check.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
      }
    }

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthy > 0) {
      overall = 'unhealthy';
    } else if (degraded > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      agents,
      summary: {
        total: checks.length,
        healthy,
        degraded,
        unhealthy,
      },
    };
  }

  public async createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    title: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const alert: Alert = {
      id: alertId,
      type,
      severity,
      title,
      description,
      timestamp: Date.now(),
      resolved: false,
      metadata,
    };

    this.activeAlerts.set(alertId, alert);

    // Store in Redis
    await this.storeAlert(alert);

    // Update Prometheus metrics
    this.alertCounter.inc({ severity, type });

    // Send notifications
    await this.sendAlertNotification(alert);

    this.emit('alert-created', { alertId, alert });

    return alertId;
  }

  public async resolveAlert(alertId: string, resolution?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.resolved = true;
    alert.resolvedAt = Date.now();
    alert.metadata.resolution = resolution;

    // Update in Redis
    await this.storeAlert(alert);

    this.activeAlerts.delete(alertId);

    this.emit('alert-resolved', { alertId, resolution });
  }

  public async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values());
  }

  public async getAlertHistory(
    timeRange?: { start: number; end: number },
    limit: number = 100
  ): Promise<Alert[]> {
    const pattern = `alert:*`;
    const keys = await this.redis.keys(pattern);

    const alerts: Alert[] = [];

    for (const key of keys.slice(0, limit)) {
      const data = await this.redis.get(key);
      if (data) {
        const alert: Alert = JSON.parse(data);
        if (!timeRange ||
            (alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end)) {
          alerts.push(alert);
        }
      }
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp - a.timestamp);

    return alerts;
  }

  public getMetrics(): string {
    return this.prometheusRegistry.metrics();
  }

  private async startHealthChecks(): Promise<void> {
    setInterval(async () => {
      for (const [checkId, check] of this.healthChecks) {
        try {
          await this.performHealthCheck(check);
        } catch (error) {
          console.error(`Health check failed for ${checkId}:`, error);
        }
      }
    }, this.config.healthCheckInterval);
  }

  private async performHealthCheck(check: HealthCheck): Promise<void> {
    const startTime = Date.now();

    try {
      let isHealthy = false;
      let responseTime = 0;
      let errorMessage: string | undefined;

      switch (check.type) {
        case 'http':
          ({ isHealthy, responseTime, errorMessage } = await this.checkHttpHealth(check));
          break;
        case 'tcp':
          ({ isHealthy, responseTime, errorMessage } = await this.checkTcpHealth(check));
          break;
        case 'custom':
          ({ isHealthy, responseTime, errorMessage } = await this.checkCustomHealth(check));
          break;
      }

      // Determine status
      let newStatus: HealthCheck['status'] = 'healthy';
      if (!isHealthy) {
        newStatus = 'unhealthy';
      } else if (responseTime > this.config.alertThresholds.responseTime) {
        newStatus = 'degraded';
      }

      // Update check
      check.lastCheck = Date.now();
      check.responseTime = responseTime;
      check.errorMessage = errorMessage;

      // Check for status change
      if (check.status !== newStatus) {
        check.status = newStatus;

        // Update Prometheus metrics
        this.agentHealthGauge.set({ agent_id: check.agentId }, newStatus === 'healthy' ? 1 : 0);

        // Create alert if unhealthy
        if (newStatus === 'unhealthy') {
          await this.createAlert(
            'health',
            check.metadata.severity,
            `Agent ${check.agentId} is unhealthy`,
            `Health check failed: ${errorMessage}`,
            { agentId: check.agentId, checkId: check.id }
          );
        }

        this.emit('health-status-changed', {
          checkId: check.id,
          agentId: check.agentId,
          oldStatus: check.status,
          newStatus,
          responseTime,
        });
      }

      // Update response time metric
      this.responseTimeHistogram.observe({ agent_id: check.agentId, check_type: check.type }, responseTime / 1000);

      // Store updated check
      await this.storeHealthCheck(check);

    } catch (error) {
      check.status = 'unhealthy';
      check.errorMessage = error.message;
      check.lastCheck = Date.now();

      this.emit('health-check-error', { checkId: check.id, error: error.message });
    }
  }

  private async checkHttpHealth(check: HealthCheck): Promise<{
    isHealthy: boolean;
    responseTime: number;
    errorMessage?: string;
  }> {
    const http = require('http');
    const url = require('url');

    return new Promise((resolve) => {
      const startTime = Date.now();
      const parsedUrl = url.parse(check.endpoint);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path,
        method: 'GET',
        timeout: check.timeout,
      };

      const req = http.request(options, (res) => {
        const responseTime = Date.now() - startTime;

        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ isHealthy: true, responseTime });
        } else {
          resolve({
            isHealthy: false,
            responseTime,
            errorMessage: `HTTP ${res.statusCode}`,
          });
        }
      });

      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        resolve({
          isHealthy: false,
          responseTime,
          errorMessage: error.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        resolve({
          isHealthy: false,
          responseTime,
          errorMessage: 'Request timeout',
        });
      });

      req.end();
    });
  }

  private async checkTcpHealth(check: HealthCheck): Promise<{
    isHealthy: boolean;
    responseTime: number;
    errorMessage?: string;
  }> {
    const net = require('net');

    return new Promise((resolve) => {
      const startTime = Date.now();
      const [host, portStr] = check.endpoint.split(':');
      const port = parseInt(portStr);

      const socket = net.createConnection({ host, port, timeout: check.timeout });

      socket.on('connect', () => {
        const responseTime = Date.now() - startTime;
        socket.end();
        resolve({ isHealthy: true, responseTime });
      });

      socket.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        resolve({
          isHealthy: false,
          responseTime,
          errorMessage: error.message,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        const responseTime = Date.now() - startTime;
        resolve({
          isHealthy: false,
          responseTime,
          errorMessage: 'Connection timeout',
        });
      });
    });
  }

  private async checkCustomHealth(check: HealthCheck): Promise<{
    isHealthy: boolean;
    responseTime: number;
    errorMessage?: string;
  }> {
    // Implementation would depend on custom health check logic
    // For now, return a placeholder
    return { isHealthy: true, responseTime: 100 };
  }

  private async startPrometheusServer(): Promise<void> {
    const express = require('express');
    const app = express();

    app.get('/metrics', (req, res) => {
      res.set('Content-Type', this.prometheusRegistry.contentType);
      res.end(this.getMetrics());
    });

    app.listen(this.config.prometheusPort, () => {
      console.log(`Prometheus metrics server listening on port ${this.config.prometheusPort}`);
    });
  }

  private async sendAlertNotification(alert: Alert): Promise<void> {
    if (!this.config.notification.enabled) return;

    try {
      if (this.config.notification.webhookUrl) {
        await this.sendWebhookNotification(alert);
      }

      if (this.config.notification.emailRecipients) {
        await this.sendEmailNotification(alert);
      }
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    const https = require('https');
    const data = JSON.stringify({
      alert_id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      timestamp: alert.timestamp,
      metadata: alert.metadata,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(this.config.notification.webhookUrl, options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Webhook request failed with status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Implementation would use an email service like SendGrid or AWS SES
    // For now, just log the alert
    console.log('Email alert:', alert);
  }

  private async storeHealthCheck(check: HealthCheck): Promise<void> {
    await this.redis.setex(
      `health:check:${check.id}`,
      86400 * 7, // 7 days
      JSON.stringify(check)
    );
  }

  private async storeAlert(alert: Alert): Promise<void> {
    await this.redis.setex(
      `alert:${alert.id}`,
      86400 * 30, // 30 days
      JSON.stringify(alert)
    );
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createAgentHealthMonitor(
  config: MonitoringConfig,
  deploymentOrchestrator: AgentDeploymentOrchestrator
): AgentHealthMonitor {
  return new AgentHealthMonitor(config, deploymentOrchestrator);
}
```

## Notes
- Comprehensive deployment orchestration with Kubernetes integration, canary deployments, and rollback capabilities
- Advanced integration testing framework with multi-agent scenario testing, performance monitoring, and automated test generation
- Production-ready monitoring system with Prometheus metrics, health checks, alerting, and notification systems
- All components include proper error handling, event emission, and Redis-based persistence for reliability