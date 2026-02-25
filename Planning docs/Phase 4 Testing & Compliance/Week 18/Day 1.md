# Day 1: Advanced Performance Optimization and Scaling Strategies

## Objectives
- Implement advanced performance optimization techniques
- Design horizontal and vertical scaling strategies
- Optimize database performance for high-throughput scenarios
- Implement caching strategies and CDN integration
- Set up performance monitoring and alerting

## Implementation Details

### Performance Optimization Framework
The Ableka Lumina platform requires advanced performance optimization to handle:

- High-volume compliance scanning requests
- Real-time regulatory updates processing
- Multi-jurisdictional data synchronization
- AI agent processing at scale
- Global user base with varying latency requirements

### Scaling Strategies
- Horizontal scaling with load balancers
- Vertical scaling for compute-intensive tasks
- Database read/write splitting
- Microservices architecture optimization
- Global CDN deployment

## Code Implementation

### 1. Advanced Performance Optimizer
Create `packages/api/src/performance/advanced-optimizer.ts`:

```typescript
import { EventEmitter } from 'events';
import * as os from 'os';
import * as cluster from 'cluster';
import { PerformanceMonitor } from './performance-monitor';
import { CacheManager } from '../cache/cache-manager';
import { DatabasePoolManager } from '../database/pool-manager';

export interface PerformanceMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  activeConnections: number;
  queueLength: number;
}

export interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_action';
  reason: string;
  metrics: PerformanceMetrics;
  recommendedInstances: number;
}

export class AdvancedPerformanceOptimizer extends EventEmitter {
  private performanceMonitor: PerformanceMonitor;
  private cacheManager: CacheManager;
  private dbPoolManager: DatabasePoolManager;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1000;
  private scalingThresholds = {
    cpuHigh: 80,
    cpuLow: 30,
    memoryHigh: 85,
    memoryLow: 50,
    responseTimeHigh: 2000, // 2 seconds
    errorRateHigh: 5, // 5%
    queueLengthHigh: 100
  };

  constructor() {
    super();
    this.performanceMonitor = new PerformanceMonitor();
    this.cacheManager = new CacheManager();
    this.dbPoolManager = new DatabasePoolManager();

    this.initializeOptimizer();
    this.setupEventHandlers();
  }

  private initializeOptimizer() {
    // Start performance monitoring
    this.performanceMonitor.startMonitoring();

    // Initialize caching strategies
    this.initializeCachingStrategies();

    // Setup database connection pooling
    this.setupDatabasePooling();

    // Initialize cluster management if in cluster mode
    if (cluster.isPrimary) {
      this.initializeClusterManagement();
    }
  }

  private setupEventHandlers() {
    // Listen to performance metrics
    this.performanceMonitor.on('metrics', this.handlePerformanceMetrics.bind(this));

    // Listen to scaling events
    this.on('scaling_decision', this.handleScalingDecision.bind(this));
  }

  // Handle incoming performance metrics
  private handlePerformanceMetrics(metrics: PerformanceMetrics) {
    // Store metrics history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Analyze metrics and make scaling decisions
    const decision = this.analyzeScalingDecision(metrics);

    if (decision.action !== 'no_action') {
      this.emit('scaling_decision', decision);
    }

    // Optimize based on current metrics
    this.optimizePerformance(metrics);
  }

  // Analyze metrics and determine scaling action
  private analyzeScalingDecision(metrics: PerformanceMetrics): ScalingDecision {
    const recentMetrics = this.getRecentMetrics(5); // Last 5 minutes
    const avgMetrics = this.calculateAverageMetrics(recentMetrics);

    let action: 'scale_up' | 'scale_down' | 'no_action' = 'no_action';
    let reason = 'Performance within acceptable ranges';

    // Scale up conditions
    if (avgMetrics.cpuUsage > this.scalingThresholds.cpuHigh) {
      action = 'scale_up';
      reason = `High CPU usage: ${avgMetrics.cpuUsage.toFixed(1)}%`;
    } else if (avgMetrics.memoryUsage > this.scalingThresholds.memoryHigh) {
      action = 'scale_up';
      reason = `High memory usage: ${avgMetrics.memoryUsage.toFixed(1)}%`;
    } else if (avgMetrics.responseTime > this.scalingThresholds.responseTimeHigh) {
      action = 'scale_up';
      reason = `High response time: ${avgMetrics.responseTime}ms`;
    } else if (avgMetrics.errorRate > this.scalingThresholds.errorRateHigh) {
      action = 'scale_up';
      reason = `High error rate: ${avgMetrics.errorRate.toFixed(1)}%`;
    } else if (avgMetrics.queueLength > this.scalingThresholds.queueLengthHigh) {
      action = 'scale_up';
      reason = `High queue length: ${avgMetrics.queueLength}`;
    }

    // Scale down conditions (more conservative)
    else if (avgMetrics.cpuUsage < this.scalingThresholds.cpuLow &&
             avgMetrics.memoryUsage < this.scalingThresholds.memoryLow &&
             recentMetrics.length > 10) { // Only scale down if we have enough history
      action = 'scale_down';
      reason = `Low resource usage: CPU ${avgMetrics.cpuUsage.toFixed(1)}%, Memory ${avgMetrics.memoryUsage.toFixed(1)}%`;
    }

    // Calculate recommended instances
    const recommendedInstances = this.calculateRecommendedInstances(avgMetrics);

    return {
      action,
      reason,
      metrics: avgMetrics,
      recommendedInstances
    };
  }

  // Calculate recommended number of instances
  private calculateRecommendedInstances(metrics: PerformanceMetrics): number {
    const currentInstances = this.getCurrentInstanceCount();

    // Base calculation on CPU usage
    let recommendedInstances = currentInstances;

    if (metrics.cpuUsage > this.scalingThresholds.cpuHigh) {
      // Scale up by factor of current CPU usage
      const scaleFactor = metrics.cpuUsage / this.scalingThresholds.cpuHigh;
      recommendedInstances = Math.ceil(currentInstances * scaleFactor);
    } else if (metrics.cpuUsage < this.scalingThresholds.cpuLow) {
      // Scale down more conservatively
      const scaleFactor = metrics.cpuUsage / this.scalingThresholds.cpuLow;
      recommendedInstances = Math.max(1, Math.floor(currentInstances * scaleFactor));
    }

    // Cap the scaling to reasonable limits
    return Math.max(1, Math.min(recommendedInstances, 20));
  }

  // Get current instance count
  private getCurrentInstanceCount(): number {
    if (cluster.isPrimary) {
      return Object.keys(cluster.workers || {}).length;
    }
    return 1; // Single instance
  }

  // Get recent metrics for analysis
  private getRecentMetrics(minutes: number): PerformanceMetrics[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  // Calculate average metrics
  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) {
      return this.metricsHistory[this.metricsHistory.length - 1] || {
        timestamp: new Date(),
        cpuUsage: 0,
        memoryUsage: 0,
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        activeConnections: 0,
        queueLength: 0
      };
    }

    const sum = metrics.reduce((acc, m) => ({
      cpuUsage: acc.cpuUsage + m.cpuUsage,
      memoryUsage: acc.memoryUsage + m.memoryUsage,
      responseTime: acc.responseTime + m.responseTime,
      throughput: acc.throughput + m.throughput,
      errorRate: acc.errorRate + m.errorRate,
      activeConnections: acc.activeConnections + m.activeConnections,
      queueLength: acc.queueLength + m.queueLength
    }), {
      cpuUsage: 0,
      memoryUsage: 0,
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      activeConnections: 0,
      queueLength: 0
    });

    const count = metrics.length;

    return {
      timestamp: new Date(),
      cpuUsage: sum.cpuUsage / count,
      memoryUsage: sum.memoryUsage / count,
      responseTime: sum.responseTime / count,
      throughput: sum.throughput / count,
      errorRate: sum.errorRate / count,
      activeConnections: sum.activeConnections / count,
      queueLength: sum.queueLength / count
    };
  }

  // Optimize performance based on current metrics
  private optimizePerformance(metrics: PerformanceMetrics) {
    // Database optimization
    if (metrics.responseTime > 1000) {
      this.optimizeDatabasePerformance(metrics);
    }

    // Cache optimization
    if (metrics.responseTime > 500) {
      this.optimizeCachingStrategy(metrics);
    }

    // Connection pool optimization
    this.optimizeConnectionPooling(metrics);

    // Memory optimization
    if (metrics.memoryUsage > 80) {
      this.optimizeMemoryUsage(metrics);
    }
  }

  // Database performance optimization
  private optimizeDatabasePerformance(metrics: PerformanceMetrics) {
    // Adjust connection pool size
    const optimalPoolSize = this.calculateOptimalPoolSize(metrics);
    this.dbPoolManager.setPoolSize(optimalPoolSize);

    // Enable/disable query caching
    if (metrics.responseTime > 2000) {
      this.dbPoolManager.enableQueryCaching();
    } else {
      this.dbPoolManager.disableQueryCaching();
    }

    // Adjust query timeout
    const queryTimeout = metrics.responseTime > 5000 ? 30000 : 10000;
    this.dbPoolManager.setQueryTimeout(queryTimeout);

    console.log(`🔧 Database optimization: pool_size=${optimalPoolSize}, query_timeout=${queryTimeout}ms`);
  }

  // Calculate optimal database pool size
  private calculateOptimalPoolSize(metrics: PerformanceMetrics): number {
    // Base pool size on active connections and CPU usage
    const baseSize = Math.max(2, Math.min(20, Math.floor(metrics.activeConnections / 10) + 1));

    // Adjust based on CPU usage
    if (metrics.cpuUsage > 70) {
      return Math.max(1, baseSize - 1);
    } else if (metrics.cpuUsage < 30) {
      return baseSize + 2;
    }

    return baseSize;
  }

  // Cache optimization
  private optimizeCachingStrategy(metrics: PerformanceMetrics) {
    // Adjust cache TTL based on performance
    if (metrics.responseTime > 1000) {
      // Increase cache TTL for better hit rates
      this.cacheManager.setGlobalTTL(3600); // 1 hour
    } else {
      // Decrease cache TTL for fresher data
      this.cacheManager.setGlobalTTL(1800); // 30 minutes
    }

    // Enable/disable cache compression
    if (metrics.memoryUsage > 75) {
      this.cacheManager.enableCompression();
    }

    // Adjust cache size limits
    const maxMemory = metrics.memoryUsage > 80 ? '512mb' : '1gb';
    this.cacheManager.setMaxMemory(maxMemory);

    console.log(`🔧 Cache optimization: ttl=${this.cacheManager.getGlobalTTL()}s, max_memory=${maxMemory}`);
  }

  // Connection pool optimization
  private optimizeConnectionPooling(metrics: PerformanceMetrics) {
    // Adjust keep-alive settings
    if (metrics.activeConnections > 1000) {
      this.dbPoolManager.enableConnectionPooling();
    }

    // Adjust connection timeout
    const connectionTimeout = metrics.responseTime > 3000 ? 30000 : 10000;
    this.dbPoolManager.setConnectionTimeout(connectionTimeout);
  }

  // Memory optimization
  private optimizeMemoryUsage(metrics: PerformanceMetrics) {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }

    // Clear unused cache entries
    this.cacheManager.clearExpiredEntries();

    // Reduce cache size
    this.cacheManager.setMaxMemory('256mb');

    // Log memory optimization
    const memUsage = process.memoryUsage();
    console.log(`🔧 Memory optimization: rss=${Math.round(memUsage.rss / 1024 / 1024)}MB, heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  }

  // Initialize caching strategies
  private initializeCachingStrategies() {
    // Multi-level caching strategy
    this.cacheManager.addCacheLayer('memory', {
      ttl: 300, // 5 minutes
      maxKeys: 10000
    });

    this.cacheManager.addCacheLayer('redis', {
      ttl: 1800, // 30 minutes
      maxKeys: 100000
    });

    // Cache warming for frequently accessed data
    this.initializeCacheWarming();
  }

  // Cache warming for frequently accessed data
  private initializeCacheWarming() {
    // Warm cache with jurisdiction data
    this.cacheManager.warmCache('jurisdictions', async () => {
      // Implementation would fetch jurisdiction data
      return ['EU', 'US', 'UK', 'SG', 'AU', 'CA', 'CH'];
    });

    // Warm cache with regulatory templates
    this.cacheManager.warmCache('regulatory_templates', async () => {
      // Implementation would fetch template data
      return ['GDPR', 'SOX', 'FCA', 'MAS'];
    });
  }

  // Setup database connection pooling
  private setupDatabasePooling() {
    this.dbPoolManager.configurePool({
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 60000
    });

    // Setup read/write splitting
    this.dbPoolManager.setupReadWriteSplitting({
      writeConnection: process.env.DATABASE_URL,
      readConnections: [
        process.env.DATABASE_READ_REPLICA_1,
        process.env.DATABASE_READ_REPLICA_2
      ].filter(Boolean)
    });
  }

  // Initialize cluster management
  private initializeClusterManagement() {
    const numCPUs = os.cpus().length;
    const workerCount = Math.min(numCPUs, 8); // Max 8 workers

    console.log(`🚀 Starting cluster with ${workerCount} workers`);

    for (let i = 0; i < workerCount; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
      // Restart worker
      cluster.fork();
    });

    cluster.on('online', (worker) => {
      console.log(`Worker ${worker.process.pid} is online`);
    });
  }

  // Handle scaling decisions
  private handleScalingDecision(decision: ScalingDecision) {
    console.log(`📊 Scaling decision: ${decision.action} - ${decision.reason}`);

    if (decision.action === 'scale_up') {
      this.scaleUp(decision.recommendedInstances);
    } else if (decision.action === 'scale_down') {
      this.scaleDown(decision.recommendedInstances);
    }
  }

  // Scale up instances
  private scaleUp(targetInstances: number) {
    if (!cluster.isPrimary) return;

    const currentWorkers = Object.keys(cluster.workers || {}).length;

    for (let i = currentWorkers; i < targetInstances; i++) {
      cluster.fork();
    }

    console.log(`⬆️ Scaled up to ${targetInstances} instances`);
  }

  // Scale down instances
  private scaleDown(targetInstances: number) {
    if (!cluster.isPrimary) return;

    const workers = Object.values(cluster.workers || {});
    const excessWorkers = workers.length - targetInstances;

    for (let i = 0; i < excessWorkers; i++) {
      const worker = workers[i];
      worker?.kill();
    }

    console.log(`⬇️ Scaled down to ${targetInstances} instances`);
  }

  // Get current performance metrics
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  // Get performance history
  getMetricsHistory(minutes?: number): PerformanceMetrics[] {
    if (!minutes) return this.metricsHistory;

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  // Generate performance report
  generatePerformanceReport(): any {
    const currentMetrics = this.getCurrentMetrics();
    const recentMetrics = this.getRecentMetrics(60); // Last hour
    const avgMetrics = this.calculateAverageMetrics(recentMetrics);

    return {
      timestamp: new Date().toISOString(),
      current: currentMetrics,
      average: avgMetrics,
      trends: this.analyzePerformanceTrends(recentMetrics),
      recommendations: this.generatePerformanceRecommendations(avgMetrics)
    };
  }

  // Analyze performance trends
  private analyzePerformanceTrends(metrics: PerformanceMetrics[]): any {
    if (metrics.length < 2) return { trend: 'insufficient_data' };

    const first = metrics[0];
    const last = metrics[metrics.length - 1];

    return {
      cpuTrend: last.cpuUsage - first.cpuUsage,
      memoryTrend: last.memoryUsage - first.memoryUsage,
      responseTimeTrend: last.responseTime - first.responseTime,
      throughputTrend: last.throughput - first.throughput,
      errorRateTrend: last.errorRate - first.errorRate
    };
  }

  // Generate performance recommendations
  private generatePerformanceRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations = [];

    if (metrics.cpuUsage > 80) {
      recommendations.push('Consider horizontal scaling or optimizing CPU-intensive operations');
    }

    if (metrics.memoryUsage > 85) {
      recommendations.push('Implement memory optimization and consider increasing instance size');
    }

    if (metrics.responseTime > 2000) {
      recommendations.push('Optimize database queries and implement caching strategies');
    }

    if (metrics.errorRate > 5) {
      recommendations.push('Investigate and fix high error rates');
    }

    if (metrics.throughput < 100) {
      recommendations.push('Consider optimizing for higher throughput');
    }

    return recommendations;
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down performance optimizer...');

    this.performanceMonitor.stopMonitoring();
    await this.cacheManager.close();
    await this.dbPoolManager.close();

    if (cluster.isPrimary) {
      // Kill all workers
      for (const worker of Object.values(cluster.workers || {})) {
        worker?.kill();
      }
    }
  }
}

// Export singleton instance
export const advancedPerformanceOptimizer = new AdvancedPerformanceOptimizer();
```

### 2. Horizontal Scaling Manager
Create `packages/api/src/scaling/horizontal-scaling-manager.ts`:

```typescript
import { EventEmitter } from 'events';
import * as AWS from 'aws-sdk';
import { AdvancedPerformanceOptimizer } from '../performance/advanced-optimizer';

export interface ScalingConfiguration {
  minInstances: number;
  maxInstances: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  cooldownPeriod: number; // seconds
  scalingStep: number;
}

export interface ScalingEvent {
  timestamp: Date;
  action: 'scale_out' | 'scale_in';
  instancesBefore: number;
  instancesAfter: number;
  reason: string;
  metrics: any;
}

export class HorizontalScalingManager extends EventEmitter {
  private ecs: AWS.ECS;
  private ec2: AWS.EC2;
  private cloudWatch: AWS.CloudWatch;
  private configuration: ScalingConfiguration;
  private scalingHistory: ScalingEvent[] = [];
  private lastScalingTime: Date = new Date(0);
  private performanceOptimizer: AdvancedPerformanceOptimizer;

  constructor(configuration: ScalingConfiguration) {
    super();
    this.configuration = configuration;
    this.performanceOptimizer = new AdvancedPerformanceOptimizer();

    // Initialize AWS services
    this.initializeAWSServices();

    // Setup event handlers
    this.setupEventHandlers();
  }

  private initializeAWSServices() {
    this.ecs = new AWS.ECS({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.ec2 = new AWS.EC2({
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.cloudWatch = new AWS.CloudWatch({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  private setupEventHandlers() {
    // Listen to performance optimizer scaling decisions
    this.performanceOptimizer.on('scaling_decision', this.handleScalingDecision.bind(this));
  }

  // Handle scaling decisions from performance optimizer
  private async handleScalingDecision(decision: any) {
    const now = new Date();
    const timeSinceLastScaling = (now.getTime() - this.lastScalingTime.getTime()) / 1000;

    // Check cooldown period
    if (timeSinceLastScaling < this.configuration.cooldownPeriod) {
      console.log(`⏳ Scaling cooldown active (${timeSinceLastScaling}s remaining)`);
      return;
    }

    // Determine scaling action
    let action: 'scale_out' | 'scale_in' | null = null;
    let targetInstances = decision.recommendedInstances;

    if (decision.action === 'scale_up') {
      action = 'scale_out';
      targetInstances = Math.min(targetInstances, this.configuration.maxInstances);
    } else if (decision.action === 'scale_down') {
      action = 'scale_in';
      targetInstances = Math.max(targetInstances, this.configuration.minInstances);
    }

    if (action && targetInstances !== this.getCurrentInstanceCount()) {
      await this.executeScaling(action, targetInstances, decision.reason, decision.metrics);
    }
  }

  // Execute scaling action
  private async executeScaling(
    action: 'scale_out' | 'scale_in',
    targetInstances: number,
    reason: string,
    metrics: any
  ) {
    console.log(`🔄 Executing ${action} to ${targetInstances} instances: ${reason}`);

    try {
      const currentInstances = await this.getCurrentInstanceCount();

      // Execute scaling via ECS
      await this.scaleECSService(targetInstances);

      // Wait for scaling to complete
      await this.waitForScalingCompletion(targetInstances);

      // Record scaling event
      const scalingEvent: ScalingEvent = {
        timestamp: new Date(),
        action,
        instancesBefore: currentInstances,
        instancesAfter: targetInstances,
        reason,
        metrics
      };

      this.scalingHistory.push(scalingEvent);
      this.lastScalingTime = new Date();

      this.emit('scaling_completed', scalingEvent);

      console.log(`✅ Scaling completed: ${currentInstances} → ${targetInstances} instances`);

    } catch (error) {
      console.error('❌ Scaling failed:', error);
      this.emit('scaling_failed', { action, targetInstances, error: error.message });
    }
  }

  // Scale ECS service
  private async scaleECSService(desiredCount: number): Promise<void> {
    const clusterName = process.env.ECS_CLUSTER_NAME;
    const serviceName = process.env.ECS_SERVICE_NAME;

    if (!clusterName || !serviceName) {
      throw new Error('ECS cluster and service names not configured');
    }

    await this.ecs.updateService({
      cluster: clusterName,
      service: serviceName,
      desiredCount
    }).promise();

    console.log(`📊 Updated ECS service desired count to ${desiredCount}`);
  }

  // Wait for scaling completion
  private async waitForScalingCompletion(targetCount: number, timeoutMs: number = 300000): Promise<void> {
    const startTime = Date.now();
    const clusterName = process.env.ECS_CLUSTER_NAME;
    const serviceName = process.env.ECS_SERVICE_NAME;

    while (Date.now() - startTime < timeoutMs) {
      const service = await this.ecs.describeServices({
        cluster: clusterName,
        services: [serviceName]
      }).promise();

      const runningCount = service.services?.[0]?.runningCount || 0;

      if (runningCount === targetCount) {
        console.log(`✅ Scaling completed: ${runningCount} instances running`);
        return;
      }

      console.log(`⏳ Waiting for scaling: ${runningCount}/${targetCount} instances`);
      await this.delay(10000); // Wait 10 seconds
    }

    throw new Error('Scaling timeout exceeded');
  }

  // Get current instance count
  private async getCurrentInstanceCount(): Promise<number> {
    const clusterName = process.env.ECS_CLUSTER_NAME;
    const serviceName = process.env.ECS_SERVICE_NAME;

    if (!clusterName || !serviceName) {
      return 1; // Default for local development
    }

    try {
      const service = await this.ecs.describeServices({
        cluster: clusterName,
        services: [serviceName]
      }).promise();

      return service.services?.[0]?.runningCount || 1;
    } catch (error) {
      console.error('Failed to get instance count:', error);
      return 1;
    }
  }

  // Manual scaling trigger
  async manualScale(targetInstances: number, reason: string = 'Manual scaling') {
    const metrics = this.performanceOptimizer.getCurrentMetrics();
    const action = targetInstances > await this.getCurrentInstanceCount() ? 'scale_out' : 'scale_in';

    await this.executeScaling(action, targetInstances, reason, metrics);
  }

  // Predictive scaling based on schedules
  async setupScheduledScaling(schedule: Array<{ time: string; instances: number; reason: string }>) {
    for (const item of schedule) {
      const [hours, minutes] = item.time.split(':').map(Number);
      const now = new Date();
      const scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

      if (scheduledTime < now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1); // Next day
      }

      const delay = scheduledTime.getTime() - now.getTime();

      setTimeout(async () => {
        console.log(`⏰ Scheduled scaling: ${item.instances} instances - ${item.reason}`);
        await this.manualScale(item.instances, item.reason);

        // Repeat daily
        setInterval(async () => {
          await this.manualScale(item.instances, item.reason);
        }, 24 * 60 * 60 * 1000);
      }, delay);
    }
  }

  // Setup CloudWatch alarms for auto-scaling
  async setupCloudWatchAlarms() {
    const alarms = [
      {
        name: 'HighCPUUtilization',
        metric: 'CPUUtilization',
        threshold: this.configuration.targetCPUUtilization,
        comparisonOperator: 'GreaterThanThreshold'
      },
      {
        name: 'HighMemoryUtilization',
        metric: 'MemoryUtilization',
        threshold: this.configuration.targetMemoryUtilization,
        comparisonOperator: 'GreaterThanThreshold'
      }
    ];

    for (const alarm of alarms) {
      await this.cloudWatch.putMetricAlarm({
        AlarmName: `${process.env.ENVIRONMENT || 'dev'}-${alarm.name}`,
        AlarmDescription: `Auto-scaling alarm for ${alarm.metric}`,
        MetricName: alarm.metric,
        Namespace: 'AWS/ECS',
        Statistic: 'Average',
        Period: 300, // 5 minutes
        Threshold: alarm.threshold,
        ComparisonOperator: alarm.comparisonOperator,
        EvaluationPeriods: 2,
        Dimensions: [
          {
            Name: 'ClusterName',
            Value: process.env.ECS_CLUSTER_NAME || 'default'
          },
          {
            Name: 'ServiceName',
            Value: process.env.ECS_SERVICE_NAME || 'default'
          }
        ],
        AlarmActions: [
          // SNS topic for scaling notifications
          process.env.SCALING_SNS_TOPIC_ARN || ''
        ].filter(Boolean)
      }).promise();
    }

    console.log('📊 CloudWatch alarms configured for auto-scaling');
  }

  // Get scaling history
  getScalingHistory(hours?: number): ScalingEvent[] {
    if (!hours) return this.scalingHistory;

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.scalingHistory.filter(event => event.timestamp >= cutoffTime);
  }

  // Generate scaling report
  generateScalingReport(): any {
    const history = this.getScalingHistory(24); // Last 24 hours
    const currentInstances = this.getCurrentInstanceCount();

    return {
      timestamp: new Date().toISOString(),
      currentInstances,
      configuration: this.configuration,
      scalingEvents: history,
      summary: {
        totalScaleOut: history.filter(e => e.action === 'scale_out').length,
        totalScaleIn: history.filter(e => e.action === 'scale_in').length,
        averageInstances: history.length > 0 ?
          history.reduce((sum, e) => sum + e.instancesAfter, 0) / history.length : currentInstances,
        lastScaling: this.lastScalingTime
      }
    };
  }

  // Health check
  async healthCheck(): Promise<any> {
    try {
      const currentInstances = await this.getCurrentInstanceCount();
      const metrics = this.performanceOptimizer.getCurrentMetrics();

      return {
        status: 'healthy',
        currentInstances,
        lastScaling: this.lastScalingTime,
        metrics,
        scalingHistoryCount: this.scalingHistory.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🛑 Shutting down horizontal scaling manager...');
    await this.performanceOptimizer.shutdown();
  }
}

// Export factory function
export function createHorizontalScalingManager(configuration?: Partial<ScalingConfiguration>) {
  const defaultConfig: ScalingConfiguration = {
    minInstances: 1,
    maxInstances: 10,
    targetCPUUtilization: 70,
    targetMemoryUtilization: 80,
    cooldownPeriod: 300, // 5 minutes
    scalingStep: 1
  };

  return new HorizontalScalingManager({ ...defaultConfig, ...configuration });
}
```

### 3. Database Performance Optimizer
Create `packages/api/src/database/performance-optimizer.ts`:

```typescript
import { Pool, PoolClient } from 'pg';
import { EventEmitter } from 'events';
import { DatabasePoolManager } from './pool-manager';

export interface QueryMetrics {
  query: string;
  executionTime: number;
  timestamp: Date;
  slow: boolean;
  connectionId: string;
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  impact: 'high' | 'medium' | 'low';
}

export class DatabasePerformanceOptimizer extends EventEmitter {
  private pool: Pool;
  private poolManager: DatabasePoolManager;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryThreshold = 1000; // 1 second
  private maxMetricsHistory = 10000;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
    this.poolManager = new DatabasePoolManager();

    this.initializeOptimizer();
    this.setupEventHandlers();
  }

  private initializeOptimizer() {
    // Start query monitoring
    this.startQueryMonitoring();

    // Start periodic analysis
    this.analysisInterval = setInterval(() => {
      this.performPerformanceAnalysis();
    }, 300000); // Every 5 minutes
  }

  private setupEventHandlers() {
    this.on('slow_query_detected', this.handleSlowQuery.bind(this));
    this.on('performance_issue', this.handlePerformanceIssue.bind(this));
  }

  // Start query monitoring
  private startQueryMonitoring() {
    // Monkey patch the pool to monitor queries
    const originalQuery = this.pool.query.bind(this.pool);

    this.pool.query = async (text: string, params?: any[]) => {
      const startTime = Date.now();
      let connectionId = 'unknown';

      try {
        // Get connection info if available
        const client = await this.pool.connect();
        connectionId = client.processID?.toString() || 'unknown';
        client.release();

        const result = await originalQuery(text, params);
        const executionTime = Date.now() - startTime;

        // Record metrics
        this.recordQueryMetrics(text, executionTime, connectionId);

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        this.recordQueryMetrics(text, executionTime, connectionId, error);
        throw error;
      }
    };
  }

  // Record query metrics
  private recordQueryMetrics(
    query: string,
    executionTime: number,
    connectionId: string,
    error?: any
  ) {
    const metrics: QueryMetrics = {
      query: this.sanitizeQuery(query),
      executionTime,
      timestamp: new Date(),
      slow: executionTime > this.slowQueryThreshold,
      connectionId
    };

    this.queryMetrics.push(metrics);

    // Maintain history limit
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics.shift();
    }

    // Emit events for slow queries
    if (metrics.slow) {
      this.emit('slow_query_detected', metrics);
    }

    // Emit events for errors
    if (error) {
      this.emit('query_error', { metrics, error });
    }
  }

  // Sanitize query for logging
  private sanitizeQuery(query: string): string {
    // Remove actual values but keep structure
    return query.replace(/'[^']*'/g, '?').replace(/\$[0-9]+/g, '?');
  }

  // Handle slow query detection
  private handleSlowQuery(metrics: QueryMetrics) {
    console.warn(`🐌 Slow query detected: ${metrics.executionTime}ms - ${metrics.query}`);

    // Analyze and suggest optimizations
    this.analyzeSlowQuery(metrics);
  }

  // Analyze slow query and suggest optimizations
  private async analyzeSlowQuery(metrics: QueryMetrics) {
    try {
      // Get query execution plan
      const plan = await this.explainQuery(metrics.query);

      // Analyze plan for optimization opportunities
      const recommendations = this.analyzeExecutionPlan(plan, metrics.query);

      if (recommendations.length > 0) {
        this.emit('performance_issue', {
          type: 'slow_query',
          query: metrics.query,
          executionTime: metrics.executionTime,
          recommendations
        });
      }
    } catch (error) {
      console.error('Failed to analyze slow query:', error);
    }
  }

  // Get query execution plan
  private async explainQuery(query: string): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      return result.rows[0]['QUERY PLAN'];
    } finally {
      client.release();
    }
  }

  // Analyze execution plan
  private analyzeExecutionPlan(plan: any, query: string): string[] {
    const recommendations: string[] = [];

    // Check for sequential scans
    if (this.hasSequentialScan(plan)) {
      recommendations.push('Consider adding indexes for better query performance');
    }

    // Check for missing indexes
    const missingIndexes = this.identifyMissingIndexes(plan, query);
    recommendations.push(...missingIndexes);

    // Check for inefficient joins
    if (this.hasInefficientJoins(plan)) {
      recommendations.push('Review join conditions and consider adding composite indexes');
    }

    // Check for large result sets
    if (this.hasLargeResultSet(plan)) {
      recommendations.push('Consider pagination or limiting result sets');
    }

    return recommendations;
  }

  // Check for sequential scans
  private hasSequentialScan(plan: any): boolean {
    const checkNode = (node: any): boolean => {
      if (node['Node Type'] === 'Seq Scan') {
        return true;
      }
      if (node.Plans) {
        return node.Plans.some(checkNode);
      }
      return false;
    };

    return checkNode(plan[0]);
  }

  // Identify missing indexes
  private identifyMissingIndexes(plan: any, query: string): string[] {
    const recommendations: string[] = [];

    // Extract table and column information from query
    const tables = this.extractTablesFromQuery(query);
    const whereColumns = this.extractWhereColumns(query);

    for (const table of tables) {
      for (const column of whereColumns) {
        // Check if index exists
        if (!this.indexExists(table, column)) {
          recommendations.push(`Consider adding index on ${table}.${column}`);
        }
      }
    }

    return recommendations;
  }

  // Check if index exists
  private async indexExists(table: string, column: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 1 FROM pg_indexes
        WHERE tablename = $1 AND indexdef LIKE $2
      `, [table, `%${column}%`]);

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  // Check for inefficient joins
  private hasInefficientJoins(plan: any): boolean {
    const checkNode = (node: any): boolean => {
      if (node['Node Type'] === 'Nested Loop' && node['Actual Rows'] > 1000) {
        return true;
      }
      if (node.Plans) {
        return node.Plans.some(checkNode);
      }
      return false;
    };

    return checkNode(plan[0]);
  }

  // Check for large result sets
  private hasLargeResultSet(plan: any): boolean {
    return plan[0]['Actual Rows'] > 10000;
  }

  // Extract tables from query
  private extractTablesFromQuery(query: string): string[] {
    const fromMatch = query.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      return [fromMatch[1]];
    }
    return [];
  }

  // Extract WHERE columns from query
  private extractWhereColumns(query: string): string[] {
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+(?:GROUP|ORDER|LIMIT|$))/i);
    if (whereMatch) {
      const conditions = whereMatch[1];
      const columns = conditions.match(/\b(\w+)\s*[=<>!]+\s*[^=<>!]/g) || [];
      return columns.map(col => col.split(/\s*[=<>!]+/)[0].trim());
    }
    return [];
  }

  // Perform periodic performance analysis
  private async performPerformanceAnalysis() {
    console.log('🔍 Performing database performance analysis...');

    try {
      // Analyze table statistics
      await this.analyzeTableStatistics();

      // Check index usage
      await this.analyzeIndexUsage();

      // Optimize autovacuum settings
      await this.optimizeAutovacuumSettings();

      // Generate recommendations
      const recommendations = await this.generateOptimizationRecommendations();

      if (recommendations.length > 0) {
        this.emit('performance_analysis_complete', { recommendations });
      }

    } catch (error) {
      console.error('Performance analysis failed:', error);
    }
  }

  // Analyze table statistics
  private async analyzeTableStatistics() {
    const client = await this.pool.connect();
    try {
      // Update table statistics
      await client.query('ANALYZE');

      // Check for tables needing analyze
      const result = await client.query(`
        SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
        FROM pg_stat_user_tables
        WHERE n_tup_ins + n_tup_upd + n_tup_del > 1000
        ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
        LIMIT 10
      `);

      if (result.rows.length > 0) {
        console.log('📊 Tables with high modification rates:', result.rows);
      }
    } finally {
      client.release();
    }
  }

  // Analyze index usage
  private async analyzeIndexUsage() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 10
      `);

      if (result.rows.length > 0) {
        console.log('⚠️ Unused indexes found:', result.rows.map(r => r.indexname));
      }
    } finally {
      client.release();
    }
  }

  // Optimize autovacuum settings
  private async optimizeAutovacuumSettings() {
    const client = await this.pool.connect();
    try {
      // Check current autovacuum settings
      const result = await client.query(`
        SELECT name, setting, unit
        FROM pg_settings
        WHERE name LIKE 'autovacuum%'
      `);

      console.log('🔧 Current autovacuum settings:', result.rows);
    } finally {
      client.release();
    }
  }

  // Generate optimization recommendations
  private async generateOptimizationRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    const client = await this.pool.connect();
    try {
      // Find tables with slow queries
      const slowQueries = this.queryMetrics.filter(m => m.slow);

      for (const slowQuery of slowQueries.slice(0, 10)) { // Top 10 slow queries
        const tables = this.extractTablesFromQuery(slowQuery.query);
        const columns = this.extractWhereColumns(slowQuery.query);

        for (const table of tables) {
          for (const column of columns) {
            if (!await this.indexExists(table, column)) {
              recommendations.push({
                table,
                columns: [column],
                type: 'btree',
                reason: `Slow query detected: ${slowQuery.executionTime}ms`,
                impact: slowQuery.executionTime > 5000 ? 'high' : 'medium'
              });
            }
          }
        }
      }
    } finally {
      client.release();
    }

    return recommendations;
  }

  // Create recommended indexes
  async createRecommendedIndexes(recommendations: IndexRecommendation[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      for (const rec of recommendations) {
        if (rec.impact === 'high') {
          const indexName = `idx_${rec.table}_${rec.columns.join('_')}`;
          const indexSQL = `CREATE INDEX CONCURRENTLY ${indexName} ON ${rec.table} (${rec.columns.join(', ')})`;

          console.log(`🔧 Creating index: ${indexSQL}`);
          await client.query(indexSQL);
        }
      }
    } finally {
      client.release();
    }
  }

  // Get performance metrics
  getPerformanceMetrics(hours?: number): QueryMetrics[] {
    if (!hours) return this.queryMetrics;

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.queryMetrics.filter(m => m.timestamp >= cutoffTime);
  }

  // Generate performance report
  generatePerformanceReport(): any {
    const recentMetrics = this.getPerformanceMetrics(1); // Last hour
    const slowQueries = recentMetrics.filter(m => m.slow);

    return {
      timestamp: new Date().toISOString(),
      totalQueries: recentMetrics.length,
      slowQueries: slowQueries.length,
      averageExecutionTime: recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length,
      slowestQuery: slowQueries.sort((a, b) => b.executionTime - a.executionTime)[0],
      recommendations: this.generateOptimizationRecommendations()
    };
  }

  // Handle performance issues
  private handlePerformanceIssue(issue: any) {
    console.warn('⚠️ Performance issue detected:', issue);

    // Implement automatic fixes for common issues
    if (issue.type === 'slow_query') {
      // Could implement automatic query optimization
    }
  }

  // Graceful shutdown
  async shutdown() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    console.log('🛑 Shutting down database performance optimizer...');
  }
}

// Export factory function
export function createDatabasePerformanceOptimizer(pool: Pool) {
  return new DatabasePerformanceOptimizer(pool);
}
```

## Testing and Validation

### Performance Optimization Testing
```bash
# Run performance optimization tests
npm run test:performance:optimization

# Test scaling strategies
npm run test:scaling:horizontal

# Test database performance
npm run test:database:performance

# Run load tests with optimization
npm run test:load:optimized
```

### Scaling Validation
```bash
# Test horizontal scaling
npm run test:scaling:validation

# Test auto-scaling triggers
npm run test:autoscaling:triggers

# Validate scaling configuration
npm run validate:scaling:config
```

### Database Optimization
```bash
# Analyze database performance
npm run db:performance:analyze

# Generate index recommendations
npm run db:index:recommendations

# Apply performance optimizations
npm run db:optimize:apply
```

### Performance Monitoring
```bash
# Monitor performance metrics
npm run monitor:performance

# Generate performance reports
npm run report:performance

# Check scaling status
npm run scaling:status
```

### CI/CD Integration
```yaml
# .github/workflows/performance-optimization.yml
name: Performance Optimization
on: [push, pull_request]
jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:performance:optimization
      - run: npm run db:performance:analyze
      - run: npm run monitor:performance
```

## Next Steps
- Day 2 will focus on vertical scaling and resource optimization
- Day 3 will implement CDN integration and global distribution
- Day 4 will add performance monitoring and alerting systems
- Day 5 will complete Week 18 with comprehensive scaling documentation

This advanced performance optimization framework provides intelligent scaling, database optimization, and performance monitoring capabilities to ensure the Ableka Lumina platform can handle high-volume compliance processing across multiple jurisdictions.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 18\Day 1.md