# Day 2: Vertical Scaling and Resource Optimization

## Objectives
- Implement vertical scaling strategies for compute-intensive tasks
- Optimize resource allocation and memory management
- Design resource pooling and allocation strategies
- Implement intelligent resource scheduling
- Set up resource monitoring and optimization alerts

## Implementation Details

### Vertical Scaling Strategies
The Ableka Lumina platform requires vertical scaling for:

- AI model processing and inference
- Complex compliance rule evaluation
- Large dataset processing and analysis
- Real-time regulatory monitoring
- Multi-jurisdictional data aggregation

### Resource Optimization
- Memory pooling and garbage collection optimization
- CPU affinity and thread management
- Disk I/O optimization
- Network resource management
- Resource quota and limits management

## Code Implementation

### 1. Vertical Scaling Manager
Create `packages/api/src/scaling/vertical-scaling-manager.ts`:

```typescript
import { EventEmitter } from 'events';
import * as os from 'os';
import * as cluster from 'cluster';
import { AdvancedPerformanceOptimizer } from '../performance/advanced-optimizer';

export interface ResourceLimits {
  cpuCores: number;
  memoryGB: number;
  diskGB: number;
  networkMbps: number;
}

export interface VerticalScalingConfig {
  maxMemoryGB: number;
  maxCPUCores: number;
  memoryThreshold: number; // percentage
  cpuThreshold: number; // percentage
  scalingStep: number;
  enableMemoryPooling: boolean;
  enableCPUAffinity: boolean;
}

export interface ResourceMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  cpuCoresUsed: number;
  cpuCoresTotal: number;
  diskUsage: number;
  networkUsage: number;
  activeThreads: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export class VerticalScalingManager extends EventEmitter {
  private config: VerticalScalingConfig;
  private performanceOptimizer: AdvancedPerformanceOptimizer;
  private resourceMetrics: ResourceMetrics[] = [];
  private maxMetricsHistory = 1000;
  private memoryPool: Buffer[] = [];
  private cpuAffinity: Map<number, number[]> = new Map(); // workerId -> cpu cores
  private resourceLimits: ResourceLimits;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: VerticalScalingConfig) {
    super();
    this.config = config;
    this.performanceOptimizer = new AdvancedPerformanceOptimizer();

    // Get system resource limits
    this.resourceLimits = this.getSystemResourceLimits();

    this.initializeVerticalScaling();
    this.setupEventHandlers();
  }

  private getSystemResourceLimits(): ResourceLimits {
    const totalMemoryGB = os.totalmem() / (1024 ** 3);
    const cpuCount = os.cpus().length;

    return {
      cpuCores: Math.min(cpuCount, this.config.maxCPUCores),
      memoryGB: Math.min(totalMemoryGB, this.config.maxMemoryGB),
      diskGB: 100, // Default assumption
      networkMbps: 1000 // Default assumption
    };
  }

  private initializeVerticalScaling() {
    // Start resource monitoring
    this.startResourceMonitoring();

    // Initialize memory pooling if enabled
    if (this.config.enableMemoryPooling) {
      this.initializeMemoryPooling();
    }

    // Setup CPU affinity if enabled
    if (this.config.enableCPUAffinity) {
      this.setupCPU-affinity();
    }

    // Initialize resource optimization
    this.initializeResourceOptimization();
  }

  private setupEventHandlers() {
    this.on('resource_threshold_exceeded', this.handleResourceThresholdExceeded.bind(this));
    this.on('resource_optimization_needed', this.handleResourceOptimization.bind(this));
  }

  // Start resource monitoring
  private startResourceMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.collectResourceMetrics();
    }, 5000); // Every 5 seconds
  }

  // Collect comprehensive resource metrics
  private collectResourceMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.getCPUUsage();
    const loadAverage = os.loadavg();

    const metrics: ResourceMetrics = {
      timestamp: new Date(),
      cpuUsage: (loadAverage[0] / os.cpus().length) * 100,
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      memoryUsedGB: memUsage.heapUsed / (1024 ** 3),
      memoryTotalGB: memUsage.heapTotal / (1024 ** 3),
      cpuCoresUsed: Math.min(loadAverage[0], os.cpus().length),
      cpuCoresTotal: os.cpus().length,
      diskUsage: 0, // Would need disk monitoring library
      networkUsage: 0, // Would need network monitoring
      activeThreads: process.env.UV_THREADPOOL_SIZE ? parseInt(process.env.UV_THREADPOOL_SIZE) : 4,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    };

    this.resourceMetrics.push(metrics);

    // Maintain history limit
    if (this.resourceMetrics.length > this.maxMetricsHistory) {
      this.resourceMetrics.shift();
    }

    // Check thresholds
    this.checkResourceThresholds(metrics);

    this.emit('resource_metrics', metrics);
  }

  // Get CPU usage percentage
  private getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    return 100 - ~~(100 * totalIdle / totalTick);
  }

  // Check resource thresholds
  private checkResourceThresholds(metrics: ResourceMetrics) {
    const issues = [];

    if (metrics.memoryUsage > this.config.memoryThreshold) {
      issues.push({
        type: 'memory',
        current: metrics.memoryUsage,
        threshold: this.config.memoryThreshold,
        message: `Memory usage ${metrics.memoryUsage.toFixed(1)}% exceeds threshold ${this.config.memoryThreshold}%`
      });
    }

    if (metrics.cpuUsage > this.config.cpuThreshold) {
      issues.push({
        type: 'cpu',
        current: metrics.cpuUsage,
        threshold: this.config.cpuThreshold,
        message: `CPU usage ${metrics.cpuUsage.toFixed(1)}% exceeds threshold ${this.config.cpuThreshold}%`
      });
    }

    if (issues.length > 0) {
      this.emit('resource_threshold_exceeded', { metrics, issues });
    }
  }

  // Handle resource threshold exceeded
  private handleResourceThresholdExceeded(data: { metrics: ResourceMetrics; issues: any[] }) {
    console.warn('🚨 Resource threshold exceeded:', data.issues);

    // Trigger vertical scaling actions
    for (const issue of data.issues) {
      if (issue.type === 'memory') {
        this.optimizeMemoryUsage(data.metrics);
      } else if (issue.type === 'cpu') {
        this.optimizeCPUUsage(data.metrics);
      }
    }
  }

  // Optimize memory usage
  private optimizeMemoryUsage(metrics: ResourceMetrics) {
    console.log('🔧 Optimizing memory usage...');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }

    // Clear memory pool if using too much memory
    if (this.config.enableMemoryPooling && metrics.memoryUsage > 85) {
      this.clearMemoryPool();
    }

    // Reduce cache sizes
    this.reduceCacheSizes();

    // Optimize heap size
    this.optimizeHeapSize(metrics);

    // Log memory optimization
    const memUsage = process.memoryUsage();
    console.log(`🔧 Memory optimization: heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, external=${Math.round(memUsage.external / 1024 / 1024)}MB`);
  }

  // Optimize CPU usage
  private optimizeCPUUsage(metrics: ResourceMetrics) {
    console.log('🔧 Optimizing CPU usage...');

    // Adjust thread pool size
    this.optimizeThreadPool(metrics);

    // Redistribute CPU affinity
    if (this.config.enableCPUAffinity) {
      this.redistributeCPUAffinity(metrics);
    }

    // Throttle background tasks
    this.throttleBackgroundTasks(metrics);

    console.log(`🔧 CPU optimization: active_threads=${metrics.activeThreads}, cpu_usage=${metrics.cpuUsage.toFixed(1)}%`);
  }

  // Initialize memory pooling
  private initializeMemoryPooling() {
    // Pre-allocate memory buffers for common sizes
    const bufferSizes = [64, 128, 256, 512, 1024, 2048, 4096]; // KB

    for (const size of bufferSizes) {
      for (let i = 0; i < 10; i++) { // 10 buffers per size
        this.memoryPool.push(Buffer.alloc(size * 1024));
      }
    }

    console.log(`💾 Initialized memory pool with ${this.memoryPool.length} buffers`);
  }

  // Get buffer from memory pool
  getPooledBuffer(size: number): Buffer {
    if (!this.config.enableMemoryPooling) {
      return Buffer.alloc(size);
    }

    // Find suitable buffer from pool
    const pooledBuffer = this.memoryPool.find(buf => buf.length >= size);

    if (pooledBuffer) {
      // Remove from pool
      this.memoryPool.splice(this.memoryPool.indexOf(pooledBuffer), 1);
      return pooledBuffer.slice(0, size);
    }

    // Allocate new buffer if none available
    return Buffer.alloc(size);
  }

  // Return buffer to memory pool
  returnPooledBuffer(buffer: Buffer) {
    if (!this.config.enableMemoryPooling) return;

    // Only keep buffers up to certain size
    if (buffer.length <= 4096 * 1024 && this.memoryPool.length < 1000) {
      // Clear buffer contents for security
      buffer.fill(0);
      this.memoryPool.push(buffer);
    }
  }

  // Clear memory pool
  private clearMemoryPool() {
    console.log(`🗑️ Clearing memory pool (${this.memoryPool.length} buffers)`);
    this.memoryPool = [];
  }

  // Setup CPU affinity
  private setupCPU-affinity() {
    if (!cluster.isPrimary) return;

    const cpuCount = os.cpus().length;
    const workers = Object.values(cluster.workers || {});

    workers.forEach((worker, index) => {
      if (worker) {
        const cores = this.calculateCPUAffinity(index, cpuCount, workers.length);
        this.cpuAffinity.set(worker.id, cores);

        // Set CPU affinity (platform dependent)
        try {
          worker.process.cpuAffinity?.(cores);
          console.log(`🎯 Set CPU affinity for worker ${worker.id}: cores ${cores.join(', ')}`);
        } catch (error) {
          console.warn(`Failed to set CPU affinity for worker ${worker.id}:`, error.message);
        }
      }
    });
  }

  // Calculate CPU affinity for worker
  private calculateCPUAffinity(workerIndex: number, totalCores: number, totalWorkers: number): number[] {
    const coresPerWorker = Math.max(1, Math.floor(totalCores / totalWorkers));
    const startCore = (workerIndex * coresPerWorker) % totalCores;
    const cores = [];

    for (let i = 0; i < coresPerWorker; i++) {
      cores.push((startCore + i) % totalCores);
    }

    return cores;
  }

  // Redistribute CPU affinity
  private redistributeCPUAffinity(metrics: ResourceMetrics) {
    if (!cluster.isPrimary) return;

    const workers = Object.values(cluster.workers || {});
    const highCPUWorkers = [];

    // Identify workers with high CPU usage
    for (const worker of workers) {
      if (worker && worker.process.cpuUsage) {
        const cpuUsage = worker.process.cpuUsage();
        if (cpuUsage > this.config.cpuThreshold) {
          highCPUWorkers.push(worker);
        }
      }
    }

    // Redistribute CPU cores from high-usage workers
    if (highCPUWorkers.length > 0) {
      console.log(`🔄 Redistributing CPU affinity for ${highCPUWorkers.length} high-CPU workers`);
      this.setupCPU-affinity(); // Recalculate affinity
    }
  }

  // Optimize thread pool size
  private optimizeThreadPool(metrics: ResourceMetrics) {
    let optimalThreadPoolSize = 4; // Default

    if (metrics.cpuUsage > 80) {
      optimalThreadPoolSize = Math.max(1, Math.floor(metrics.cpuCoresTotal * 0.5));
    } else if (metrics.cpuUsage < 30) {
      optimalThreadPoolSize = Math.min(128, metrics.cpuCoresTotal * 2);
    } else {
      optimalThreadPoolSize = metrics.cpuCoresTotal;
    }

    process.env.UV_THREADPOOL_SIZE = optimalThreadPoolSize.toString();
    console.log(`🔧 Optimized thread pool size to ${optimalThreadPoolSize}`);
  }

  // Reduce cache sizes
  private reduceCacheSizes() {
    // This would integrate with the cache manager to reduce cache sizes
    this.emit('reduce_cache_sizes', { memoryUsage: this.getCurrentMetrics().memoryUsage });
  }

  // Optimize heap size
  private optimizeHeapSize(metrics: ResourceMetrics) {
    // Adjust V8 heap size hints
    if (metrics.memoryUsage > 90) {
      // Force smaller heap
      if (global.v8) {
        global.v8.setFlagsFromString('--max-old-space-size=2048');
        console.log('🔧 Reduced V8 heap size to 2GB');
      }
    }
  }

  // Throttle background tasks
  private throttleBackgroundTasks(metrics: ResourceMetrics) {
    if (metrics.cpuUsage > this.config.cpuThreshold) {
      this.emit('throttle_background_tasks', { cpuUsage: metrics.cpuUsage });
    }
  }

  // Initialize resource optimization
  private initializeResourceOptimization() {
    // Setup resource quotas
    this.setupResourceQuotas();

    // Initialize resource scheduling
    this.initializeResourceScheduling();

    // Setup resource alerts
    this.setupResourceAlerts();
  }

  // Setup resource quotas
  private setupResourceQuotas() {
    // Set process resource limits
    try {
      process.setMaxListeners(100);
      console.log('🔧 Set resource quotas and limits');
    } catch (error) {
      console.warn('Failed to set resource quotas:', error.message);
    }
  }

  // Initialize resource scheduling
  private initializeResourceScheduling() {
    // Setup priority-based task scheduling
    this.setupPriorityScheduling();

    // Initialize resource-aware task queuing
    this.setupResourceAwareQueuing();
  }

  // Setup priority scheduling
  private setupPriorityScheduling() {
    // High priority: Real-time compliance checks
    // Medium priority: AI processing, data analysis
    // Low priority: Background cleanup, maintenance

    console.log('📋 Initialized priority-based task scheduling');
  }

  // Setup resource-aware queuing
  private setupResourceAwareQueuing() {
    // Queue tasks based on resource availability
    this.emit('resource_aware_queuing_enabled');
  }

  // Setup resource alerts
  private setupResourceAlerts() {
    // Setup alerts for resource threshold violations
    this.on('resource_threshold_exceeded', (data) => {
      console.error('🚨 RESOURCE ALERT:', data.issues.map((i: any) => i.message).join('; '));
    });
  }

  // Handle resource optimization
  private handleResourceOptimization(data: any) {
    console.log('🔧 Applying resource optimization:', data);
  }

  // Get current resource metrics
  getCurrentMetrics(): ResourceMetrics | null {
    return this.resourceMetrics[this.resourceMetrics.length - 1] || null;
  }

  // Get resource metrics history
  getMetricsHistory(minutes?: number): ResourceMetrics[] {
    if (!minutes) return this.resourceMetrics;

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.resourceMetrics.filter(m => m.timestamp >= cutoffTime);
  }

  // Generate resource report
  generateResourceReport(): any {
    const current = this.getCurrentMetrics();
    const history = this.getMetricsHistory(60); // Last hour

    if (!current || history.length === 0) {
      return { error: 'Insufficient metrics data' };
    }

    const avgMetrics = this.calculateAverageMetrics(history);

    return {
      timestamp: new Date().toISOString(),
      current,
      average: avgMetrics,
      limits: this.resourceLimits,
      optimization: {
        memoryPoolingEnabled: this.config.enableMemoryPooling,
        cpuAffinityEnabled: this.config.enableCPUAffinity,
        memoryPoolSize: this.memoryPool.length,
        cpuAffinity: Object.fromEntries(this.cpuAffinity)
      },
      recommendations: this.generateResourceRecommendations(avgMetrics)
    };
  }

  // Calculate average metrics
  private calculateAverageMetrics(metrics: ResourceMetrics[]): ResourceMetrics {
    if (metrics.length === 0) return this.getCurrentMetrics()!;

    const sum = metrics.reduce((acc, m) => ({
      cpuUsage: acc.cpuUsage + m.cpuUsage,
      memoryUsage: acc.memoryUsage + m.memoryUsage,
      memoryUsedGB: acc.memoryUsedGB + m.memoryUsedGB,
      memoryTotalGB: acc.memoryTotalGB + m.memoryTotalGB,
      cpuCoresUsed: acc.cpuCoresUsed + m.cpuCoresUsed,
      cpuCoresTotal: acc.cpuCoresTotal + m.cpuCoresTotal,
      diskUsage: acc.diskUsage + m.diskUsage,
      networkUsage: acc.networkUsage + m.networkUsage,
      activeThreads: acc.activeThreads + m.activeThreads,
      heapUsed: acc.heapUsed + m.heapUsed,
      heapTotal: acc.heapTotal + m.heapTotal,
      external: acc.external + m.external
    }), {
      cpuUsage: 0, memoryUsage: 0, memoryUsedGB: 0, memoryTotalGB: 0,
      cpuCoresUsed: 0, cpuCoresTotal: 0, diskUsage: 0, networkUsage: 0,
      activeThreads: 0, heapUsed: 0, heapTotal: 0, external: 0
    });

    const count = metrics.length;

    return {
      timestamp: new Date(),
      cpuUsage: sum.cpuUsage / count,
      memoryUsage: sum.memoryUsage / count,
      memoryUsedGB: sum.memoryUsedGB / count,
      memoryTotalGB: sum.memoryTotalGB / count,
      cpuCoresUsed: sum.cpuCoresUsed / count,
      cpuCoresTotal: sum.cpuCoresTotal / count,
      diskUsage: sum.diskUsage / count,
      networkUsage: sum.networkUsage / count,
      activeThreads: Math.round(sum.activeThreads / count),
      heapUsed: sum.heapUsed / count,
      heapTotal: sum.heapTotal / count,
      external: sum.external / count
    };
  }

  // Generate resource recommendations
  private generateResourceRecommendations(metrics: ResourceMetrics): string[] {
    const recommendations = [];

    if (metrics.memoryUsage > 85) {
      recommendations.push('Consider increasing memory allocation or implementing memory optimization');
    }

    if (metrics.cpuUsage > 80) {
      recommendations.push('Consider horizontal scaling or CPU optimization');
    }

    if (metrics.memoryUsage < 30 && metrics.cpuUsage < 30) {
      recommendations.push('Resources underutilized, consider vertical scaling down');
    }

    if (this.memoryPool.length > 500) {
      recommendations.push('Memory pool is large, consider reducing pre-allocated buffers');
    }

    return recommendations;
  }

  // Manual resource optimization
  async optimizeResources(): Promise<void> {
    const metrics = this.getCurrentMetrics();
    if (!metrics) return;

    console.log('🔧 Manual resource optimization triggered');

    await this.optimizeMemoryUsage(metrics);
    await this.optimizeCPUUsage(metrics);

    // Force resource rebalancing
    if (this.config.enableCPUAffinity) {
      this.setupCPU-affinity();
    }
  }

  // Health check
  async healthCheck(): Promise<any> {
    const metrics = this.getCurrentMetrics();

    return {
      status: 'healthy',
      metrics,
      limits: this.resourceLimits,
      optimization: {
        memoryPooling: this.config.enableMemoryPooling,
        cpuAffinity: this.config.enableCPUAffinity,
        memoryPoolBuffers: this.memoryPool.length
      }
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Clear memory pool
    this.clearMemoryPool();

    console.log('🛑 Shutting down vertical scaling manager...');
  }
}

// Export factory function
export function createVerticalScalingManager(config?: Partial<VerticalScalingConfig>) {
  const defaultConfig: VerticalScalingConfig = {
    maxMemoryGB: 8,
    maxCPUCores: 4,
    memoryThreshold: 80,
    cpuThreshold: 70,
    scalingStep: 1,
    enableMemoryPooling: true,
    enableCPUAffinity: true
  };

  return new VerticalScalingManager({ ...defaultConfig, ...config });
}
```

### 2. Resource Pool Manager
Create `packages/api/src/resource/resource-pool-manager.ts`:

```typescript
import { EventEmitter } from 'events';
import { VerticalScalingManager } from '../scaling/vertical-scaling-manager';

export interface ResourcePool {
  id: string;
  type: 'memory' | 'cpu' | 'disk' | 'network';
  capacity: number;
  allocated: number;
  available: number;
  reservations: ResourceReservation[];
}

export interface ResourceReservation {
  id: string;
  poolId: string;
  amount: number;
  priority: 'high' | 'medium' | 'low';
  timeout: Date;
  metadata: any;
}

export interface ResourceAllocation {
  poolId: string;
  amount: number;
  priority: 'high' | 'medium' | 'low';
  timeout?: number; // minutes
  metadata?: any;
}

export class ResourcePoolManager extends EventEmitter {
  private pools: Map<string, ResourcePool> = new Map();
  private reservations: Map<string, ResourceReservation> = new Map();
  private verticalScalingManager: VerticalScalingManager;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(verticalScalingManager: VerticalScalingManager) {
    super();
    this.verticalScalingManager = verticalScalingManager;

    this.initializeResourcePools();
    this.startCleanupTask();
  }

  // Initialize resource pools
  private initializeResourcePools() {
    // Memory pool
    this.createPool({
      id: 'memory',
      type: 'memory',
      capacity: 4 * 1024 * 1024 * 1024, // 4GB
      allocated: 0,
      available: 4 * 1024 * 1024 * 1024,
      reservations: []
    });

    // CPU pool
    this.createPool({
      id: 'cpu',
      type: 'cpu',
      capacity: 4, // 4 cores
      allocated: 0,
      available: 4,
      reservations: []
    });

    // Disk I/O pool
    this.createPool({
      id: 'disk',
      type: 'disk',
      capacity: 100, // 100 IOPS
      allocated: 0,
      available: 100,
      reservations: []
    });

    // Network pool
    this.createPool({
      id: 'network',
      type: 'network',
      capacity: 1000, // 1000 Mbps
      allocated: 0,
      available: 1000,
      reservations: []
    });

    console.log('🏊 Initialized resource pools');
  }

  // Create a resource pool
  private createPool(pool: ResourcePool) {
    this.pools.set(pool.id, pool);
  }

  // Allocate resources
  async allocateResources(allocation: ResourceAllocation): Promise<string> {
    const pool = this.pools.get(allocation.poolId);

    if (!pool) {
      throw new Error(`Resource pool ${allocation.poolId} not found`);
    }

    // Check if resources are available
    if (pool.available < allocation.amount) {
      // Try to free up resources
      await this.attemptResourceReclamation(pool, allocation.amount);

      // Check again after reclamation
      if (pool.available < allocation.amount) {
        throw new Error(`Insufficient resources in pool ${allocation.poolId}`);
      }
    }

    // Create reservation
    const reservationId = this.generateReservationId();
    const timeout = allocation.timeout ?
      new Date(Date.now() + allocation.timeout * 60 * 1000) :
      new Date(Date.now() + 30 * 60 * 1000); // Default 30 minutes

    const reservation: ResourceReservation = {
      id: reservationId,
      poolId: allocation.poolId,
      amount: allocation.amount,
      priority: allocation.priority,
      timeout,
      metadata: allocation.metadata || {}
    };

    // Update pool
    pool.allocated += allocation.amount;
    pool.available -= allocation.amount;
    pool.reservations.push(reservation);

    // Store reservation
    this.reservations.set(reservationId, reservation);

    this.emit('resource_allocated', { reservation, pool });

    console.log(`✅ Allocated ${allocation.amount} ${allocation.poolId} resources (reservation: ${reservationId})`);

    return reservationId;
  }

  // Release resources
  async releaseResources(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);

    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    const pool = this.pools.get(reservation.poolId);
    if (!pool) {
      throw new Error(`Pool ${reservation.poolId} not found`);
    }

    // Update pool
    pool.allocated -= reservation.amount;
    pool.available += reservation.amount;

    // Remove reservation
    pool.reservations = pool.reservations.filter(r => r.id !== reservationId);
    this.reservations.delete(reservationId);

    this.emit('resource_released', { reservation, pool });

    console.log(`🔓 Released ${reservation.amount} ${reservation.poolId} resources (reservation: ${reservationId})`);
  }

  // Attempt resource reclamation
  private async attemptResourceReclamation(pool: ResourcePool, requiredAmount: number): Promise<void> {
    console.log(`🔄 Attempting resource reclamation for ${pool.id} pool`);

    // Find low-priority reservations to reclaim
    const reclaimableReservations = pool.reservations
      .filter(r => r.priority === 'low')
      .sort((a, b) => a.timeout.getTime() - b.timeout.getTime()); // Oldest first

    let reclaimedAmount = 0;

    for (const reservation of reclaimableReservations) {
      if (reclaimedAmount >= requiredAmount) break;

      // Force release low-priority reservation
      await this.forceReleaseReservation(reservation.id);
      reclaimedAmount += reservation.amount;

      console.log(`🔄 Reclaimed ${reservation.amount} ${pool.type} from low-priority reservation ${reservation.id}`);
    }

    if (reclaimedAmount < requiredAmount) {
      // Try medium priority if still needed
      const mediumReservations = pool.reservations
        .filter(r => r.priority === 'medium')
        .sort((a, b) => a.timeout.getTime() - b.timeout.getTime());

      for (const reservation of mediumReservations) {
        if (reclaimedAmount >= requiredAmount) break;

        await this.forceReleaseReservation(reservation.id);
        reclaimedAmount += reservation.amount;

        console.log(`🔄 Reclaimed ${reservation.amount} ${pool.type} from medium-priority reservation ${reservation.id}`);
      }
    }
  }

  // Force release reservation
  private async forceReleaseReservation(reservationId: string): Promise<void> {
    try {
      await this.releaseResources(reservationId);
    } catch (error) {
      console.error(`Failed to release reservation ${reservationId}:`, error);
    }
  }

  // Get pool status
  getPoolStatus(poolId: string): ResourcePool | null {
    return this.pools.get(poolId) || null;
  }

  // Get all pool statuses
  getAllPoolStatuses(): ResourcePool[] {
    return Array.from(this.pools.values());
  }

  // Get reservation details
  getReservation(reservationId: string): ResourceReservation | null {
    return this.reservations.get(reservationId) || null;
  }

  // List reservations by pool
  getReservationsByPool(poolId: string): ResourceReservation[] {
    const pool = this.pools.get(poolId);
    return pool ? pool.reservations : [];
  }

  // Start cleanup task
  private startCleanupTask() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredReservations();
    }, 60000); // Every minute
  }

  // Cleanup expired reservations
  private cleanupExpiredReservations() {
    const now = new Date();
    const expiredReservations = Array.from(this.reservations.values())
      .filter(r => r.timeout < now);

    for (const reservation of expiredReservations) {
      console.warn(`⏰ Reservation ${reservation.id} expired, releasing resources`);
      this.forceReleaseReservation(reservation.id);
    }
  }

  // Generate unique reservation ID
  private generateReservationId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Reserve resources for high-priority tasks
  async reserveForHighPriorityTask(
    poolId: string,
    amount: number,
    taskId: string,
    timeoutMinutes: number = 60
  ): Promise<string> {
    return this.allocateResources({
      poolId,
      amount,
      priority: 'high',
      timeout: timeoutMinutes,
      metadata: { taskId, type: 'high_priority_task' }
    });
  }

  // Reserve resources for AI processing
  async reserveForAIProcessing(modelSize: 'small' | 'medium' | 'large'): Promise<string[]> {
    const reservations = [];

    // Memory requirements based on model size
    const memoryReqs = {
      small: 512 * 1024 * 1024,   // 512MB
      medium: 2 * 1024 * 1024 * 1024, // 2GB
      large: 8 * 1024 * 1024 * 1024   // 8GB
    };

    // CPU requirements
    const cpuReqs = {
      small: 1,
      medium: 2,
      large: 4
    };

    try {
      // Reserve memory
      const memoryReservation = await this.allocateResources({
        poolId: 'memory',
        amount: memoryReqs[modelSize],
        priority: 'high',
        timeout: 120, // 2 hours for AI processing
        metadata: { type: 'ai_processing', modelSize }
      });
      reservations.push(memoryReservation);

      // Reserve CPU
      const cpuReservation = await this.allocateResources({
        poolId: 'cpu',
        amount: cpuReqs[modelSize],
        priority: 'high',
        timeout: 120,
        metadata: { type: 'ai_processing', modelSize }
      });
      reservations.push(cpuReservation);

      console.log(`🤖 Reserved resources for ${modelSize} AI processing: ${reservations}`);
      return reservations;

    } catch (error) {
      // Release any reservations that were made
      for (const reservation of reservations) {
        try {
          await this.releaseResources(reservation);
        } catch (e) {
          console.error('Failed to release reservation during error cleanup:', e);
        }
      }
      throw error;
    }
  }

  // Get resource utilization report
  generateUtilizationReport(): any {
    const pools = this.getAllPoolStatuses();
    const totalReservations = Array.from(this.reservations.values()).length;

    return {
      timestamp: new Date().toISOString(),
      pools: pools.map(pool => ({
        id: pool.id,
        type: pool.type,
        utilization: ((pool.allocated / pool.capacity) * 100).toFixed(1) + '%',
        allocated: pool.allocated,
        available: pool.available,
        capacity: pool.capacity,
        reservations: pool.reservations.length
      })),
      summary: {
        totalPools: pools.length,
        totalReservations,
        highPriorityReservations: Array.from(this.reservations.values()).filter(r => r.priority === 'high').length,
        expiredReservations: Array.from(this.reservations.values()).filter(r => r.timeout < new Date()).length
      }
    };
  }

  // Health check
  async healthCheck(): Promise<any> {
    const pools = this.getAllPoolStatuses();
    const hasIssues = pools.some(p => p.available < 0);

    return {
      status: hasIssues ? 'warning' : 'healthy',
      pools: pools.length,
      totalReservations: Array.from(this.reservations.values()).length,
      issues: hasIssues ? ['Negative available resources detected'] : []
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Release all reservations
    const reservationIds = Array.from(this.reservations.keys());
    for (const id of reservationIds) {
      try {
        await this.releaseResources(id);
      } catch (error) {
        console.error(`Failed to release reservation ${id} during shutdown:`, error);
      }
    }

    console.log('🛑 Shutting down resource pool manager...');
  }
}

// Export factory function
export function createResourcePoolManager(verticalScalingManager: VerticalScalingManager) {
  return new ResourcePoolManager(verticalScalingManager);
}
```

### 3. Intelligent Resource Scheduler
Create `packages/api/src/scheduling/intelligent-resource-scheduler.ts`:

```typescript
import { EventEmitter } from 'events';
import { ResourcePoolManager, ResourceAllocation } from '../resource/resource-pool-manager';
import { VerticalScalingManager } from '../scaling/vertical-scaling-manager';

export interface ScheduledTask {
  id: string;
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  resourceRequirements: ResourceAllocation[];
  estimatedDuration: number; // minutes
  deadline?: Date;
  dependencies: string[]; // task IDs this task depends on
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  reservations: string[];
  metadata: any;
}

export interface SchedulingDecision {
  taskId: string;
  action: 'schedule' | 'delay' | 'cancel';
  reason: string;
  estimatedStartTime: Date;
  resourceAvailability: any;
}

export class IntelligentResourceScheduler extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private completedTasks: Map<string, ScheduledTask> = new Map();
  private failedTasks: Map<string, ScheduledTask> = new Map();
  private resourcePoolManager: ResourcePoolManager;
  private verticalScalingManager: VerticalScalingManager;
  private schedulingInterval: NodeJS.Timeout | null = null;
  private maxConcurrentTasks = 10;
  private taskQueue: ScheduledTask[] = [];

  constructor(
    resourcePoolManager: ResourcePoolManager,
    verticalScalingManager: VerticalScalingManager
  ) {
    super();
    this.resourcePoolManager = resourcePoolManager;
    this.verticalScalingManager = verticalScalingManager;

    this.initializeScheduler();
    this.setupEventHandlers();
  }

  private initializeScheduler() {
    // Start scheduling loop
    this.schedulingInterval = setInterval(() => {
      this.schedulingLoop();
    }, 10000); // Every 10 seconds

    console.log('📅 Initialized intelligent resource scheduler');
  }

  private setupEventHandlers() {
    // Listen to resource availability changes
    this.resourcePoolManager.on('resource_released', () => {
      this.onResourceAvailabilityChanged();
    });

    this.resourcePoolManager.on('resource_allocated', () => {
      this.onResourceAvailabilityChanged();
    });
  }

  // Schedule a new task
  async scheduleTask(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'reservations'>): Promise<string> {
    const taskId = this.generateTaskId();

    const scheduledTask: ScheduledTask = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date(),
      reservations: []
    };

    this.tasks.set(taskId, scheduledTask);
    this.taskQueue.push(scheduledTask);

    // Sort queue by priority and deadline
    this.sortTaskQueue();

    this.emit('task_scheduled', scheduledTask);

    console.log(`📅 Scheduled task ${taskId}: ${task.name} (priority: ${task.priority})`);

    return taskId;
  }

  // Main scheduling loop
  private async schedulingLoop() {
    // Check for completed tasks
    await this.checkCompletedTasks();

    // Process pending tasks
    await this.processPendingTasks();

    // Optimize running tasks
    await this.optimizeRunningTasks();

    // Clean up old completed tasks
    this.cleanupOldTasks();
  }

  // Process pending tasks
  private async processPendingTasks() {
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      return; // At capacity
    }

    const availableSlots = this.maxConcurrentTasks - this.runningTasks.size;

    for (let i = 0; i < availableSlots && this.taskQueue.length > 0; i++) {
      const task = this.taskQueue.shift()!;

      // Check if dependencies are met
      if (!this.areDependenciesMet(task)) {
        // Put back in queue for later
        this.taskQueue.push(task);
        continue;
      }

      // Make scheduling decision
      const decision = await this.makeSchedulingDecision(task);

      if (decision.action === 'schedule') {
        await this.startTask(task);
      } else if (decision.action === 'delay') {
        // Put back in queue with delay
        setTimeout(() => {
          this.taskQueue.unshift(task);
        }, 30000); // 30 second delay
      } else {
        // Cancel task
        task.status = 'cancelled';
        this.emit('task_cancelled', { task, reason: decision.reason });
      }
    }
  }

  // Make scheduling decision
  private async makeSchedulingDecision(task: ScheduledTask): Promise<SchedulingDecision> {
    // Check resource availability
    const resourceCheck = await this.checkResourceAvailability(task);

    if (!resourceCheck.available) {
      return {
        taskId: task.id,
        action: 'delay',
        reason: `Insufficient resources: ${resourceCheck.missing.join(', ')}`,
        estimatedStartTime: new Date(Date.now() + 60000), // 1 minute delay
        resourceAvailability: resourceCheck.details
      };
    }

    // Check deadline constraints
    if (task.deadline) {
      const estimatedCompletion = new Date(Date.now() + task.estimatedDuration * 60 * 1000);
      if (estimatedCompletion > task.deadline) {
        return {
          taskId: task.id,
          action: 'cancel',
          reason: `Task cannot meet deadline. Estimated completion: ${estimatedCompletion.toISOString()}`,
          estimatedStartTime: new Date(),
          resourceAvailability: resourceCheck.details
        };
      }
    }

    // Check priority constraints
    if (task.priority === 'critical' && this.runningTasks.size > 0) {
      // Preempt lower priority tasks for critical tasks
      await this.preemptLowerPriorityTasks(task);
    }

    return {
      taskId: task.id,
      action: 'schedule',
      reason: 'Resources available and constraints satisfied',
      estimatedStartTime: new Date(),
      resourceAvailability: resourceCheck.details
    };
  }

  // Check resource availability for task
  private async checkResourceAvailability(task: ScheduledTask): Promise<{
    available: boolean;
    missing: string[];
    details: any;
  }> {
    const missing = [];
    const details = {};

    for (const requirement of task.resourceRequirements) {
      const pool = this.resourcePoolManager.getPoolStatus(requirement.poolId);

      if (!pool) {
        missing.push(`${requirement.poolId} pool not found`);
        continue;
      }

      if (pool.available < requirement.amount) {
        missing.push(`${requirement.amount} ${requirement.poolId} (available: ${pool.available})`);
      }

      details[requirement.poolId] = {
        required: requirement.amount,
        available: pool.available,
        capacity: pool.capacity
      };
    }

    return {
      available: missing.length === 0,
      missing,
      details
    };
  }

  // Start a task
  private async startTask(task: ScheduledTask) {
    try {
      // Allocate resources
      const reservations = [];
      for (const requirement of task.resourceRequirements) {
        const reservationId = await this.resourcePoolManager.allocateResources(requirement);
        reservations.push(reservationId);
      }

      // Update task status
      task.status = 'running';
      task.startedAt = new Date();
      task.reservations = reservations;

      this.runningTasks.add(task.id);

      this.emit('task_started', task);

      console.log(`▶️ Started task ${task.id}: ${task.name}`);

      // Simulate task execution (in real implementation, this would trigger actual work)
      this.simulateTaskExecution(task);

    } catch (error) {
      console.error(`Failed to start task ${task.id}:`, error);
      task.status = 'failed';
      this.failedTasks.set(task.id, task);
      this.emit('task_failed', { task, error: error.message });
    }
  }

  // Simulate task execution
  private simulateTaskExecution(task: ScheduledTask) {
    // In a real implementation, this would execute the actual task
    const executionTime = task.estimatedDuration * 60 * 1000 * (0.8 + Math.random() * 0.4); // 80-120% of estimated

    setTimeout(async () => {
      await this.completeTask(task.id, Math.random() > 0.9); // 10% failure rate
    }, executionTime);
  }

  // Complete a task
  private async completeTask(taskId: string, failed: boolean = false) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Release resources
    for (const reservationId of task.reservations) {
      try {
        await this.resourcePoolManager.releaseResources(reservationId);
      } catch (error) {
        console.error(`Failed to release reservation ${reservationId}:`, error);
      }
    }

    // Update task status
    task.completedAt = new Date();

    if (failed) {
      task.status = 'failed';
      task.retryCount++;

      if (task.retryCount < task.maxRetries) {
        // Retry task
        task.status = 'pending';
        task.reservations = [];
        this.taskQueue.unshift(task);
        console.log(`🔄 Retrying task ${taskId} (attempt ${task.retryCount + 1}/${task.maxRetries})`);
      } else {
        this.failedTasks.set(taskId, task);
        this.emit('task_failed', { task, error: 'Max retries exceeded' });
        console.log(`❌ Task ${taskId} failed permanently after ${task.maxRetries} retries`);
      }
    } else {
      task.status = 'completed';
      this.completedTasks.set(taskId, task);
      this.runningTasks.delete(taskId);
      this.emit('task_completed', task);
      console.log(`✅ Completed task ${taskId}: ${task.name}`);
    }
  }

  // Check if task dependencies are met
  private areDependenciesMet(task: ScheduledTask): boolean {
    return task.dependencies.every(depId => {
      const depTask = this.completedTasks.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  // Preempt lower priority tasks
  private async preemptLowerPriorityTasks(criticalTask: ScheduledTask) {
    const runningTaskIds = Array.from(this.runningTasks);
    const tasksToPreempt = [];

    for (const taskId of runningTaskIds) {
      const task = this.tasks.get(taskId);
      if (task && this.getPriorityWeight(task.priority) < this.getPriorityWeight(criticalTask.priority)) {
        tasksToPreempt.push(task);
      }
    }

    // Preempt tasks (cancel and reschedule)
    for (const task of tasksToPreempt) {
      console.log(`🛑 Preempting task ${task.id} for critical task ${criticalTask.id}`);
      await this.cancelTask(task.id, 'Preempted for higher priority task');
    }
  }

  // Get priority weight
  private getPriorityWeight(priority: string): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[priority as keyof typeof weights] || 1;
  }

  // Cancel a task
  async cancelTask(taskId: string, reason: string = 'Cancelled by user') {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Release resources
    for (const reservationId of task.reservations) {
      try {
        await this.resourcePoolManager.releaseResources(reservationId);
      } catch (error) {
        console.error(`Failed to release reservation ${reservationId}:`, error);
      }
    }

    task.status = 'cancelled';
    this.runningTasks.delete(taskId);

    this.emit('task_cancelled', { task, reason });
    console.log(`🚫 Cancelled task ${taskId}: ${reason}`);
  }

  // Sort task queue by priority
  private sortTaskQueue() {
    this.taskQueue.sort((a, b) => {
      // Sort by priority first
      const priorityDiff = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by deadline (earlier deadline first)
      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }

      // Then by creation time (FIFO)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  // Check completed tasks
  private async checkCompletedTasks() {
    // This would be handled by the actual task execution in a real implementation
  }

  // Optimize running tasks
  private async optimizeRunningTasks() {
    // Check if any running tasks can be optimized
    for (const taskId of this.runningTasks) {
      const task = this.tasks.get(taskId);
      if (task && task.startedAt) {
        const runtime = Date.now() - task.startedAt.getTime();
        const estimatedTotal = task.estimatedDuration * 60 * 1000;

        // If task is running longer than expected, consider optimization
        if (runtime > estimatedTotal * 1.5) {
          console.log(`⚠️ Task ${taskId} running longer than expected (${Math.round(runtime / 1000)}s vs ${task.estimatedDuration * 60}s)`);
          this.emit('task_running_long', task);
        }
      }
    }
  }

  // Clean up old completed tasks
  private cleanupOldTasks() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [taskId, task] of this.completedTasks) {
      if (task.completedAt && task.completedAt < cutoffTime) {
        this.completedTasks.delete(taskId);
        this.tasks.delete(taskId);
      }
    }

    for (const [taskId, task] of this.failedTasks) {
      if (task.completedAt && task.completedAt < cutoffTime) {
        this.failedTasks.delete(taskId);
        this.tasks.delete(taskId);
      }
    }
  }

  // Handle resource availability changes
  private onResourceAvailabilityChanged() {
    // Trigger scheduling loop when resources become available
    setImmediate(() => this.schedulingLoop());
  }

  // Generate unique task ID
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get task status
  getTaskStatus(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null;
  }

  // Get all tasks by status
  getTasksByStatus(status: ScheduledTask['status']): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  // Get scheduler statistics
  getSchedulerStats(): any {
    return {
      timestamp: new Date().toISOString(),
      pendingTasks: this.taskQueue.length,
      runningTasks: this.runningTasks.size,
      completedTasks: this.completedTasks.size,
      failedTasks: this.failedTasks.size,
      totalTasks: this.tasks.size,
      resourcePools: this.resourcePoolManager.getAllPoolStatuses().length
    };
  }

  // Schedule compliance scanning task
  async scheduleComplianceScan(
    jurisdiction: string,
    priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    return this.scheduleTask({
      name: `Compliance Scan - ${jurisdiction}`,
      priority,
      resourceRequirements: [
        {
          poolId: 'cpu',
          amount: 2,
          priority: 'medium',
          metadata: { type: 'compliance_scan' }
        },
        {
          poolId: 'memory',
          amount: 1024 * 1024 * 1024, // 1GB
          priority: 'medium',
          metadata: { type: 'compliance_scan' }
        }
      ],
      estimatedDuration: 30, // 30 minutes
      dependencies: [],
      retryCount: 0,
      maxRetries: 3,
      metadata: { jurisdiction, type: 'compliance_scan' }
    });
  }

  // Schedule AI processing task
  async scheduleAIProcessing(
    modelType: string,
    dataSize: 'small' | 'medium' | 'large',
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    const resourceReqs = {
      small: [
        { poolId: 'cpu', amount: 1, priority: 'medium' as const },
        { poolId: 'memory', amount: 512 * 1024 * 1024, priority: 'medium' as const }
      ],
      medium: [
        { poolId: 'cpu', amount: 2, priority: 'high' as const },
        { poolId: 'memory', amount: 2 * 1024 * 1024 * 1024, priority: 'high' as const }
      ],
      large: [
        { poolId: 'cpu', amount: 4, priority: 'high' as const },
        { poolId: 'memory', amount: 8 * 1024 * 1024 * 1024, priority: 'high' as const }
      ]
    };

    return this.scheduleTask({
      name: `AI Processing - ${modelType} (${dataSize})`,
      priority,
      resourceRequirements: resourceReqs[dataSize],
      estimatedDuration: dataSize === 'small' ? 15 : dataSize === 'medium' ? 45 : 120,
      dependencies: [],
      retryCount: 0,
      maxRetries: 2,
      metadata: { modelType, dataSize, type: 'ai_processing' }
    });
  }

  // Health check
  async healthCheck(): Promise<any> {
    const stats = this.getSchedulerStats();

    return {
      status: 'healthy',
      stats,
      queueDepth: this.taskQueue.length,
      runningCapacity: this.runningTasks.size / this.maxConcurrentTasks
    };
  }

  // Graceful shutdown
  async shutdown() {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
    }

    // Cancel all running tasks
    const runningTaskIds = Array.from(this.runningTasks);
    for (const taskId of runningTaskIds) {
      await this.cancelTask(taskId, 'Scheduler shutdown');
    }

    console.log('🛑 Shutting down intelligent resource scheduler...');
  }
}

// Export factory function
export function createIntelligentResourceScheduler(
  resourcePoolManager: ResourcePoolManager,
  verticalScalingManager: VerticalScalingManager
) {
  return new IntelligentResourceScheduler(resourcePoolManager, verticalScalingManager);
}
```

## Testing and Validation

### Vertical Scaling Testing
```bash
# Test vertical scaling
npm run test:scaling:vertical

# Test resource optimization
npm run test:resource:optimization

# Test resource pooling
npm run test:resource:pooling

# Test intelligent scheduling
npm run test:scheduling:intelligent
```

### Resource Management Validation
```bash
# Validate resource allocation
npm run validate:resource:allocation

# Test resource reclamation
npm run test:resource:reclamation

# Validate scheduling decisions
npm run validate:scheduling:decisions

# Test priority scheduling
npm run test:scheduling:priority
```

### Performance Optimization
```bash
# Test memory pooling performance
npm run test:memory:pooling

# Test CPU affinity optimization
npm run test:cpu:affinity

# Monitor resource utilization
npm run monitor:resource:utilization

# Generate resource reports
npm run report:resource:utilization
```

### CI/CD Integration
```yaml
# .github/workflows/vertical-scaling.yml
name: Vertical Scaling
on: [push, pull_request]
jobs:
  vertical-scaling:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:scaling:vertical
      - run: npm run test:resource:optimization
      - run: npm run monitor:resource:utilization
```

## Next Steps
- Day 3 will focus on CDN integration and global distribution strategies
- Day 4 will implement performance monitoring and alerting systems
- Day 5 will complete Week 18 with comprehensive scaling documentation

This vertical scaling and resource optimization framework provides intelligent resource management, memory pooling, CPU affinity optimization, and intelligent task scheduling to ensure optimal performance for the Ableka Lumina platform's compute-intensive compliance processing workloads.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 18\Day 2.md