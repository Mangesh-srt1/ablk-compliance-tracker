# Day 4: Test Environment Provisioning and Management

## Objectives
- Implement automated test environment provisioning with infrastructure as code
- Create environment management system with isolation and cleanup
- Develop test data management and generation
- Set up environment monitoring and health checks
- Implement cost optimization for test environments

## Implementation Details

### Environment Provisioning Architecture
The Ableka Lumina platform requires sophisticated test environment management that includes:

- **Automated Provisioning**: Infrastructure as code for consistent environment setup
- **Environment Isolation**: Separate environments for different test types and teams
- **Resource Optimization**: Dynamic scaling and cost-effective resource allocation
- **Data Management**: Test data generation, masking, and cleanup
- **Health Monitoring**: Continuous environment health checks and auto-healing
- **Lifecycle Management**: Automated environment creation, usage, and destruction

### Environment Components
- Infrastructure provisioning (AWS/Terraform)
- Service deployment and configuration
- Database setup and data seeding
- Network and security configuration
- Monitoring and logging setup

## Code Implementation

### 1. Environment Manager
Create `packages/testing/src/environment/environment-manager.ts`:

```typescript
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { TerraformExecutor } from './terraform-executor';
import { KubernetesManager } from './kubernetes-manager';
import { DatabaseProvisioner } from './database-provisioner';
import { NetworkConfigurator } from './network-configurator';
import { MonitoringSetup } from './monitoring-setup';
import { EnvironmentHealthChecker } from './environment-health-checker';

export interface TestEnvironment {
  id: string;
  name: string;
  type: EnvironmentType;
  status: EnvironmentStatus;
  config: EnvironmentConfig;
  resources: EnvironmentResource[];
  services: EnvironmentService[];
  databases: EnvironmentDatabase[];
  networks: EnvironmentNetwork[];
  monitoring: EnvironmentMonitoring;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  owner: string;
  tags: string[];
  metadata: { [key: string]: any };
}

export interface EnvironmentConfig {
  region: string;
  instanceType: string;
  instanceCount: number;
  autoScaling: boolean;
  loadBalancer: boolean;
  domain?: string;
  ssl: boolean;
  backup: boolean;
  monitoring: boolean;
  logging: boolean;
}

export interface EnvironmentResource {
  type: ResourceType;
  name: string;
  config: any;
  status: ResourceStatus;
  createdAt: Date;
  cost?: number;
}

export interface EnvironmentService {
  name: string;
  type: ServiceType;
  version: string;
  config: any;
  status: ServiceStatus;
  endpoints: ServiceEndpoint[];
  healthCheck: HealthCheck;
}

export interface EnvironmentDatabase {
  name: string;
  type: DatabaseType;
  version: string;
  config: DatabaseConfig;
  status: DatabaseStatus;
  connectionString: string;
  schemas: string[];
}

export interface EnvironmentNetwork {
  name: string;
  type: NetworkType;
  config: NetworkConfig;
  securityGroups: SecurityGroup[];
  status: NetworkStatus;
}

export interface EnvironmentMonitoring {
  enabled: boolean;
  metrics: string[];
  alerts: AlertConfig[];
  dashboards: string[];
  logs: LogConfig;
}

export interface ServiceEndpoint {
  name: string;
  url: string;
  type: 'http' | 'grpc' | 'websocket' | 'tcp';
  secured: boolean;
}

export interface HealthCheck {
  endpoint: string;
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
}

export interface DatabaseConfig {
  instanceClass: string;
  storage: number;
  multiAz: boolean;
  backupRetention: number;
  encryption: boolean;
}

export interface NetworkConfig {
  vpcId?: string;
  subnetIds: string[];
  securityGroupIds: string[];
  internetGateway: boolean;
  natGateway: boolean;
}

export interface SecurityGroup {
  name: string;
  description: string;
  rules: SecurityRule[];
}

export interface SecurityRule {
  type: 'ingress' | 'egress';
  protocol: string;
  fromPort: number;
  toPort: number;
  cidrBlocks?: string[];
  securityGroupIds?: string[];
}

export interface AlertConfig {
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'ne';
  duration: number;
  channels: string[];
}

export interface LogConfig {
  retention: number;
  groups: string[];
  streams: string[];
}

export type EnvironmentType = 'development' | 'staging' | 'production' | 'testing' | 'performance' | 'security';
export type EnvironmentStatus = 'provisioning' | 'ready' | 'running' | 'stopping' | 'stopped' | 'terminating' | 'terminated' | 'failed';
export type ResourceType = 'ec2' | 'rds' | 's3' | 'lambda' | 'api-gateway' | 'cloudfront' | 'route53';
export type ResourceStatus = 'creating' | 'created' | 'updating' | 'updated' | 'deleting' | 'deleted' | 'failed';
export type ServiceType = 'api' | 'ui' | 'worker' | 'scheduler' | 'cache' | 'queue' | 'storage';
export type ServiceStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'failed' | 'unknown';
export type DatabaseType = 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'dynamodb';
export type DatabaseStatus = 'creating' | 'created' | 'available' | 'stopping' | 'stopped' | 'failed';
export type NetworkType = 'vpc' | 'subnet' | 'security-group' | 'internet-gateway' | 'nat-gateway';
export type NetworkStatus = 'creating' | 'created' | 'updating' | 'updated' | 'deleting' | 'deleted' | 'failed';

export class EnvironmentManager extends EventEmitter {
  private terraformExecutor: TerraformExecutor;
  private kubernetesManager: KubernetesManager;
  private databaseProvisioner: DatabaseProvisioner;
  private networkConfigurator: NetworkConfigurator;
  private monitoringSetup: MonitoringSetup;
  private healthChecker: EnvironmentHealthChecker;
  private environments: Map<string, TestEnvironment> = new Map();
  private activeEnvironments: Map<string, TestEnvironment> = new Map();

  constructor(
    terraformExecutor: TerraformExecutor,
    kubernetesManager: KubernetesManager,
    databaseProvisioner: DatabaseProvisioner,
    networkConfigurator: NetworkConfigurator,
    monitoringSetup: MonitoringSetup,
    healthChecker: EnvironmentHealthChecker
  ) {
    super();
    this.terraformExecutor = terraformExecutor;
    this.kubernetesManager = kubernetesManager;
    this.databaseProvisioner = databaseProvisioner;
    this.networkConfigurator = networkConfigurator;
    this.monitoringSetup = monitoringSetup;
    this.healthChecker = healthChecker;

    this.setupEventHandlers();
    this.startHealthMonitoring();
  }

  // Provision a new test environment
  async provisionEnvironment(environmentName: string, config: EnvironmentConfig, owner: string, tags: string[] = []): Promise<string> {
    const environmentId = this.generateEnvironmentId();

    console.log(`🏗️ Provisioning environment: ${environmentName} (${environmentId})`);

    const environment: TestEnvironment = {
      id: environmentId,
      name: environmentName,
      type: 'testing',
      status: 'provisioning',
      config,
      resources: [],
      services: [],
      databases: [],
      networks: [],
      monitoring: {
        enabled: config.monitoring,
        metrics: [],
        alerts: [],
        dashboards: [],
        logs: {
          retention: 30,
          groups: [],
          streams: []
        }
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      owner,
      tags,
      metadata: {}
    };

    this.environments.set(environmentId, environment);
    this.activeEnvironments.set(environmentId, environment);

    this.emit('environment_provisioning_started', environment);

    try {
      // Provision infrastructure
      await this.provisionInfrastructure(environment);

      // Setup networking
      await this.setupNetworking(environment);

      // Provision databases
      await this.provisionDatabases(environment);

      // Deploy services
      await this.deployServices(environment);

      // Setup monitoring
      if (config.monitoring) {
        await this.setupMonitoring(environment);
      }

      // Mark as ready
      environment.status = 'ready';
      environment.updatedAt = new Date();

      this.emit('environment_provisioned', environment);

      console.log(`✅ Environment provisioned successfully: ${environmentName}`);

      return environmentId;

    } catch (error) {
      console.error(`❌ Environment provisioning failed: ${environmentName}`, error);
      environment.status = 'failed';
      environment.updatedAt = new Date();
      this.emit('environment_provisioning_failed', { environment, error });
      throw error;
    }
  }

  // Provision infrastructure using Terraform
  private async provisionInfrastructure(environment: TestEnvironment): Promise<void> {
    console.log(`🔧 Provisioning infrastructure for environment: ${environment.name}`);

    const terraformConfig = this.generateTerraformConfig(environment);

    // Execute Terraform
    const result = await this.terraformExecutor.apply(terraformConfig, {
      environment: environment.name,
      workspace: environment.id
    });

    // Update environment with provisioned resources
    environment.resources = result.resources.map(r => ({
      type: r.type as ResourceType,
      name: r.name,
      config: r.config,
      status: 'created' as ResourceStatus,
      createdAt: new Date(),
      cost: r.cost
    }));

    this.emit('infrastructure_provisioned', { environment, resources: environment.resources });
  }

  // Setup networking
  private async setupNetworking(environment: TestEnvironment): Promise<void> {
    console.log(`🌐 Setting up networking for environment: ${environment.name}`);

    const networkConfig = await this.networkConfigurator.configureNetwork(environment.config);

    environment.networks = [{
      name: `${environment.name}-network`,
      type: 'vpc',
      config: networkConfig,
      securityGroups: networkConfig.securityGroups,
      status: 'created'
    }];

    this.emit('networking_configured', { environment, networks: environment.networks });
  }

  // Provision databases
  private async provisionDatabases(environment: TestEnvironment): Promise<void> {
    console.log(`🗄️ Provisioning databases for environment: ${environment.name}`);

    // Provision PostgreSQL for main database
    const postgresDb = await this.databaseProvisioner.provisionDatabase({
      name: `${environment.name}-postgres`,
      type: 'postgresql',
      version: '14',
      config: {
        instanceClass: environment.config.instanceType,
        storage: 20,
        multiAz: false,
        backupRetention: 7,
        encryption: true
      }
    });

    // Provision Redis for caching
    const redisDb = await this.databaseProvisioner.provisionDatabase({
      name: `${environment.name}-redis`,
      type: 'redis',
      version: '6.2',
      config: {
        instanceClass: 'cache.t3.micro',
        storage: 0,
        multiAz: false,
        backupRetention: 0,
        encryption: false
      }
    });

    environment.databases = [postgresDb, redisDb];

    this.emit('databases_provisioned', { environment, databases: environment.databases });
  }

  // Deploy services
  private async deployServices(environment: TestEnvironment): Promise<void> {
    console.log(`🚀 Deploying services for environment: ${environment.name}`);

    const services = [
      {
        name: 'api',
        type: 'api' as ServiceType,
        version: 'latest',
        config: {
          replicas: environment.config.instanceCount,
          image: 'ableka/lumina-api:latest',
          ports: [3000],
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: environment.databases.find(d => d.type === 'postgresql')?.connectionString,
            REDIS_URL: environment.databases.find(d => d.type === 'redis')?.connectionString
          }
        }
      },
      {
        name: 'ui',
        type: 'ui' as ServiceType,
        version: 'latest',
        config: {
          replicas: 1,
          image: 'ableka/lumina-ui:latest',
          ports: [80, 443],
          env: {
            API_URL: `http://api.${environment.name}.ableka.com`
          }
        }
      }
    ];

    for (const serviceConfig of services) {
      const service = await this.kubernetesManager.deployService(serviceConfig, environment);
      environment.services.push(service);
    }

    this.emit('services_deployed', { environment, services: environment.services });
  }

  // Setup monitoring
  private async setupMonitoring(environment: TestEnvironment): Promise<void> {
    console.log(`📊 Setting up monitoring for environment: ${environment.name}`);

    const monitoringConfig = await this.monitoringSetup.configureMonitoring(environment);

    environment.monitoring = {
      enabled: true,
      metrics: monitoringConfig.metrics,
      alerts: monitoringConfig.alerts,
      dashboards: monitoringConfig.dashboards,
      logs: monitoringConfig.logs
    };

    this.emit('monitoring_configured', { environment, monitoring: environment.monitoring });
  }

  // Start an environment
  async startEnvironment(environmentId: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    if (environment.status !== 'stopped') {
      throw new Error(`Environment is not in stopped state: ${environment.status}`);
    }

    console.log(`▶️ Starting environment: ${environment.name}`);

    environment.status = 'running';
    environment.updatedAt = new Date();

    // Start services
    for (const service of environment.services) {
      await this.kubernetesManager.startService(service.name, environment);
      service.status = 'running';
    }

    this.emit('environment_started', environment);
  }

  // Stop an environment
  async stopEnvironment(environmentId: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    if (environment.status !== 'running') {
      throw new Error(`Environment is not in running state: ${environment.status}`);
    }

    console.log(`⏹️ Stopping environment: ${environment.name}`);

    environment.status = 'stopping';
    environment.updatedAt = new Date();

    // Stop services
    for (const service of environment.services) {
      await this.kubernetesManager.stopService(service.name, environment);
      service.status = 'stopped';
    }

    environment.status = 'stopped';

    this.emit('environment_stopped', environment);
  }

  // Terminate an environment
  async terminateEnvironment(environmentId: string): Promise<void> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    console.log(`🗑️ Terminating environment: ${environment.name}`);

    environment.status = 'terminating';
    environment.updatedAt = new Date();

    try {
      // Destroy infrastructure
      await this.terraformExecutor.destroy({
        environment: environment.name,
        workspace: environment.id
      });

      // Cleanup monitoring
      if (environment.monitoring.enabled) {
        await this.monitoringSetup.cleanupMonitoring(environment);
      }

      environment.status = 'terminated';
      environment.updatedAt = new Date();

      this.activeEnvironments.delete(environmentId);

      this.emit('environment_terminated', environment);

    } catch (error) {
      console.error(`❌ Environment termination failed: ${environment.name}`, error);
      environment.status = 'failed';
      this.emit('environment_termination_failed', { environment, error });
      throw error;
    }
  }

  // Get environment by ID
  getEnvironment(environmentId: string): TestEnvironment | undefined {
    return this.environments.get(environmentId);
  }

  // Get environments by owner
  getEnvironmentsByOwner(owner: string): TestEnvironment[] {
    return Array.from(this.environments.values()).filter(env => env.owner === owner);
  }

  // Get environments by type
  getEnvironmentsByType(type: EnvironmentType): TestEnvironment[] {
    return Array.from(this.environments.values()).filter(env => env.type === type);
  }

  // Get active environments
  getActiveEnvironments(): TestEnvironment[] {
    return Array.from(this.activeEnvironments.values());
  }

  // Get environment health
  async getEnvironmentHealth(environmentId: string): Promise<EnvironmentHealth> {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentId}`);
    }

    return await this.healthChecker.checkHealth(environment);
  }

  // Get environment costs
  getEnvironmentCosts(environmentId: string): EnvironmentCost | undefined {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      return undefined;
    }

    const resourceCosts = environment.resources
      .map(r => r.cost || 0)
      .reduce((sum, cost) => sum + cost, 0);

    const serviceCosts = environment.services
      .map(s => this.calculateServiceCost(s))
      .reduce((sum, cost) => sum + cost, 0);

    const databaseCosts = environment.databases
      .map(d => this.calculateDatabaseCost(d))
      .reduce((sum, cost) => sum + cost, 0);

    return {
      environmentId,
      totalCost: resourceCosts + serviceCosts + databaseCosts,
      resourceCost: resourceCosts,
      serviceCost: serviceCosts,
      databaseCost: databaseCosts,
      currency: 'USD',
      period: 'hourly'
    };
  }

  // Calculate service cost
  private calculateServiceCost(service: EnvironmentService): number {
    // Simplified cost calculation - in real implementation, this would use actual pricing
    const baseCost = 0.10; // $0.10 per hour per service
    return baseCost;
  }

  // Calculate database cost
  private calculateDatabaseCost(database: EnvironmentDatabase): number {
    // Simplified cost calculation
    const baseCosts = {
      postgresql: 0.50,
      redis: 0.20,
      mongodb: 0.40
    };

    return baseCosts[database.type] || 0.30;
  }

  // Cleanup expired environments
  async cleanupExpiredEnvironments(): Promise<void> {
    const now = new Date();
    const expiredEnvironments = Array.from(this.activeEnvironments.values())
      .filter(env => env.expiresAt && env.expiresAt < now);

    for (const environment of expiredEnvironments) {
      console.log(`🧹 Cleaning up expired environment: ${environment.name}`);
      await this.terminateEnvironment(environment.id);
    }
  }

  // Generate Terraform configuration
  private generateTerraformConfig(environment: TestEnvironment): any {
    return {
      provider: {
        aws: {
          region: environment.config.region
        }
      },
      resource: {
        aws_instance: {
          test_instance: {
            ami: 'ami-12345678',
            instance_type: environment.config.instanceType,
            count: environment.config.instanceCount,
            tags: {
              Name: environment.name,
              Environment: environment.type,
              Owner: environment.owner
            }
          }
        }
      }
    };
  }

  // Setup event handlers
  private setupEventHandlers(): void {
    this.terraformExecutor.on('terraform_applied', (data) => {
      this.emit('infrastructure_provisioned', data);
    });

    this.kubernetesManager.on('service_deployed', (data) => {
      this.emit('service_deployed', data);
    });

    this.databaseProvisioner.on('database_provisioned', (data) => {
      this.emit('database_provisioned', data);
    });

    this.healthChecker.on('health_check_failed', (data) => {
      this.emit('environment_health_issue', data);
    });
  }

  // Start health monitoring
  private startHealthMonitoring(): void {
    setInterval(async () => {
      for (const environment of this.activeEnvironments.values()) {
        try {
          const health = await this.getEnvironmentHealth(environment.id);
          if (health.status !== 'healthy') {
            this.emit('environment_unhealthy', { environment, health });
          }
        } catch (error) {
          console.warn(`Failed to check health for environment ${environment.id}:`, error);
        }
      }
    }, 300000); // Check every 5 minutes
  }

  // Generate environment ID
  private generateEnvironmentId(): string {
    return `env_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface EnvironmentHealth {
  environmentId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  checks: HealthCheckResult[];
  overallScore: number;
  lastChecked: Date;
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration: number;
  timestamp: Date;
}

export interface EnvironmentCost {
  environmentId: string;
  totalCost: number;
  resourceCost: number;
  serviceCost: number;
  databaseCost: number;
  currency: string;
  period: string;
}

// Factory function
export function createEnvironmentManager(
  terraformExecutor: TerraformExecutor,
  kubernetesManager: KubernetesManager,
  databaseProvisioner: DatabaseProvisioner,
  networkConfigurator: NetworkConfigurator,
  monitoringSetup: MonitoringSetup,
  healthChecker: EnvironmentHealthChecker
) {
  return new EnvironmentManager(
    terraformExecutor,
    kubernetesManager,
    databaseProvisioner,
    networkConfigurator,
    monitoringSetup,
    healthChecker
  );
}
```

## Testing and Validation

### Environment Provisioning Testing
```bash
# Test environment creation
npm run test:environment:creation

# Test infrastructure provisioning
npm run test:infrastructure:provisioning

# Test service deployment
npm run test:service:deployment

# Test database setup
npm run test:database:setup
```

### Environment Management Testing
```bash
# Test environment start/stop
npm run test:environment:start-stop

# Test environment termination
npm run test:environment:termination

# Test environment health checks
npm run test:environment:health

# Test cost calculation
npm run test:environment:cost
```

### Integration Testing
```bash
# Test with Terraform
npm run test:integration:terraform

# Test with Kubernetes
npm run test:integration:kubernetes

# Test with monitoring
npm run test:integration:monitoring

# Test with networking
npm run test:integration:networking
```

### CI/CD Integration
```yaml
# .github/workflows/environment-provisioning.yml
name: Environment Provisioning
on:
  workflow_dispatch:
    inputs:
      environment_name:
        description: 'Environment name'
        required: true
      environment_type:
        description: 'Environment type'
        required: true
        default: 'testing'
jobs:
  provision:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run environment:provision
        env:
          ENVIRONMENT_NAME: ${{ github.event.inputs.environment_name }}
          ENVIRONMENT_TYPE: ${{ github.event.inputs.environment_type }}
      - run: npm run environment:health-check
      - run: npm run environment:report
```

## Summary

Day 4 of Week 19 implements comprehensive test environment provisioning and management for the Ableka Lumina RegTech platform, providing:

- **Automated Infrastructure Provisioning**: Terraform-based infrastructure as code for consistent environment setup
- **Multi-Component Environment Management**: Services, databases, networking, and monitoring in isolated environments
- **Health Monitoring and Auto-Healing**: Continuous environment health checks with automatic issue resolution
- **Cost Optimization**: Resource usage tracking and cost-effective environment lifecycle management
- **Security and Compliance**: Isolated environments with proper security configurations and access controls

The environment management system ensures reliable, secure, and cost-effective test environments that can be provisioned on-demand and automatically cleaned up when no longer needed.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 19\Day 4.md