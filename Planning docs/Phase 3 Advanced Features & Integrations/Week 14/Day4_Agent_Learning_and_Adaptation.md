# Day 4: Agent Learning and Adaptation

## Objective
Implement machine learning and adaptation capabilities for AI agents in the Ableka Lumina RegTech platform, enabling continuous improvement through experience accumulation, performance optimization, and adaptive reasoning strategies.

## Implementation Steps

1. **Experience collection and storage**
   - Capture agent interactions and outcomes
   - Store decision contexts and results
   - Build historical performance data

2. **Performance analysis and metrics**
   - Calculate success rates and confidence scores
   - Identify improvement opportunities
   - Generate performance reports

3. **Adaptive learning algorithms**
   - Reinforcement learning for decision optimization
   - Pattern recognition for similar scenarios
   - Strategy adaptation based on outcomes

4. **Model updating and versioning**
   - Update reasoning models with new data
   - Version control for learning models
   - Rollback capabilities for failed updates

## Code Snippets

### 1. Experience Collection System
```typescript
// src/agents/learning/experience-collector.ts
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { AgentMessage } from '../communication/protocols';
import { ReasoningResult } from '../reasoning/reasoning-engine';

export interface ExperienceRecord {
  id: string;
  agentId: string;
  taskId: string;
  timestamp: number;
  context: {
    domain: string;
    facts: Record<string, any>;
    assumptions: Record<string, any>;
    constraints: Record<string, any>;
    goals: string[];
    initialConfidence: number;
  };
  action: {
    type: string;
    strategy: string;
    parameters: Record<string, any>;
  };
  result: {
    success: boolean;
    confidence: number;
    outcome: any;
    reasoningChain: any[];
    executionTime: number;
  };
  feedback?: {
    humanRating?: number; // 1-5 scale
    automatedScore?: number;
    comments?: string;
    corrections?: any;
  };
  metadata: {
    version: string;
    environment: string;
    tags: string[];
  };
}

export interface ExperienceCollectionConfig {
  redisUrl: string;
  retentionPeriod: number; // in days
  samplingRate: number; // 0.0 to 1.0
  maxRecordsPerAgent: number;
  enableHumanFeedback: boolean;
}

export class ExperienceCollector extends EventEmitter {
  private redis: Redis;
  private config: ExperienceCollectionConfig;
  private activeExperiences: Map<string, Partial<ExperienceRecord>> = new Map();

  constructor(config: ExperienceCollectionConfig) {
    super();
    this.config = config;
    this.redis = new Redis(config.redisUrl);

    this.redis.on('error', (error) => {
      this.emit('redis-error', error);
    });
  }

  public async startExperience(
    agentId: string,
    taskId: string,
    context: ExperienceRecord['context']
  ): Promise<string> {
    const experienceId = `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const experience: Partial<ExperienceRecord> = {
      id: experienceId,
      agentId,
      taskId,
      timestamp: Date.now(),
      context,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        tags: [],
      },
    };

    this.activeExperiences.set(experienceId, experience);

    // Store initial experience
    await this.storeExperience(experience as ExperienceRecord);

    this.emit('experience-started', { experienceId, agentId, taskId });

    return experienceId;
  }

  public async completeExperience(
    experienceId: string,
    action: ExperienceRecord['action'],
    result: ExperienceRecord['result']
  ): Promise<void> {
    const experience = this.activeExperiences.get(experienceId);
    if (!experience) {
      throw new Error(`Experience ${experienceId} not found`);
    }

    // Complete the experience record
    const completeExperience: ExperienceRecord = {
      ...experience,
      action,
      result,
    } as ExperienceRecord;

    // Store completed experience
    await this.storeExperience(completeExperience);

    // Remove from active experiences
    this.activeExperiences.delete(experienceId);

    this.emit('experience-completed', {
      experienceId,
      agentId: completeExperience.agentId,
      success: result.success,
      confidence: result.confidence
    });
  }

  public async addFeedback(
    experienceId: string,
    feedback: ExperienceRecord['feedback']
  ): Promise<void> {
    const experienceData = await this.redis.get(`experience:${experienceId}`);
    if (!experienceData) {
      throw new Error(`Experience ${experienceId} not found`);
    }

    const experience: ExperienceRecord = JSON.parse(experienceData);
    experience.feedback = { ...experience.feedback, ...feedback };

    // Update stored experience
    await this.storeExperience(experience);

    this.emit('feedback-added', { experienceId, feedback });
  }

  public async getExperience(experienceId: string): Promise<ExperienceRecord | null> {
    const data = await this.redis.get(`experience:${experienceId}`);
    return data ? JSON.parse(data) : null;
  }

  public async getAgentExperiences(
    agentId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ExperienceRecord[]> {
    const pattern = `experience:*`;
    const keys = await this.redis.keys(pattern);
    const agentKeys = keys.filter(key => {
      const experienceId = key.replace('experience:', '');
      return experienceId.includes(agentId);
    });

    const experiences: ExperienceRecord[] = [];

    for (const key of agentKeys.slice(offset, offset + limit)) {
      const data = await this.redis.get(key);
      if (data) {
        experiences.push(JSON.parse(data));
      }
    }

    // Sort by timestamp (newest first)
    experiences.sort((a, b) => b.timestamp - a.timestamp);

    return experiences;
  }

  public async getExperiencesByDomain(
    domain: string,
    limit: number = 100
  ): Promise<ExperienceRecord[]> {
    const pattern = `experience:*`;
    const keys = await this.redis.keys(pattern);
    const domainExperiences: ExperienceRecord[] = [];

    for (const key of keys.slice(0, limit * 2)) { // Get more to filter
      const data = await this.redis.get(key);
      if (data) {
        const experience: ExperienceRecord = JSON.parse(data);
        if (experience.context.domain === domain) {
          domainExperiences.push(experience);
        }
      }
    }

    return domainExperiences
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  public async getSimilarExperiences(
    context: Partial<ExperienceRecord['context']>,
    limit: number = 10
  ): Promise<ExperienceRecord[]> {
    const allExperiences = await this.getExperiencesByDomain(context.domain || 'general', limit * 5);
    const similar: Array<{ experience: ExperienceRecord; similarity: number }> = [];

    for (const experience of allExperiences) {
      const similarity = this.calculateSimilarity(context, experience.context);
      if (similarity > 0.3) { // Minimum similarity threshold
        similar.push({ experience, similarity });
      }
    }

    // Sort by similarity
    similar.sort((a, b) => b.similarity - a.similarity);

    return similar.slice(0, limit).map(item => item.experience);
  }

  public async getExperienceStats(agentId?: string): Promise<{
    totalExperiences: number;
    successRate: number;
    averageConfidence: number;
    averageExecutionTime: number;
    domainBreakdown: Record<string, number>;
    strategyPerformance: Record<string, { successRate: number; count: number }>;
  }> {
    const pattern = agentId ? `experience:*${agentId}*` : `experience:*`;
    const keys = await this.redis.keys(pattern);

    let totalExperiences = 0;
    let successfulExperiences = 0;
    let totalConfidence = 0;
    let totalExecutionTime = 0;
    const domainBreakdown: Record<string, number> = {};
    const strategyPerformance: Record<string, { successRate: number; count: number; successes: number }> = {};

    for (const key of keys.slice(0, 1000)) { // Sample for performance
      const data = await this.redis.get(key);
      if (data) {
        const experience: ExperienceRecord = JSON.parse(data);
        totalExperiences++;

        if (experience.result.success) {
          successfulExperiences++;
        }

        totalConfidence += experience.result.confidence;
        totalExecutionTime += experience.result.executionTime;

        // Domain breakdown
        domainBreakdown[experience.context.domain] =
          (domainBreakdown[experience.context.domain] || 0) + 1;

        // Strategy performance
        const strategy = experience.action.strategy;
        if (!strategyPerformance[strategy]) {
          strategyPerformance[strategy] = { successRate: 0, count: 0, successes: 0 };
        }
        strategyPerformance[strategy].count++;
        if (experience.result.success) {
          strategyPerformance[strategy].successes++;
        }
      }
    }

    // Calculate final stats
    const successRate = totalExperiences > 0 ? successfulExperiences / totalExperiences : 0;
    const averageConfidence = totalExperiences > 0 ? totalConfidence / totalExperiences : 0;
    const averageExecutionTime = totalExperiences > 0 ? totalExecutionTime / totalExperiences : 0;

    // Calculate strategy success rates
    const finalStrategyPerformance: Record<string, { successRate: number; count: number }> = {};
    for (const [strategy, stats] of Object.entries(strategyPerformance)) {
      finalStrategyPerformance[strategy] = {
        successRate: stats.count > 0 ? stats.successes / stats.count : 0,
        count: stats.count,
      };
    }

    return {
      totalExperiences,
      successRate,
      averageConfidence,
      averageExecutionTime,
      domainBreakdown,
      strategyPerformance: finalStrategyPerformance,
    };
  }

  public async cleanupExpiredExperiences(): Promise<number> {
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 24 * 60 * 60 * 1000);
    const pattern = `experience:*`;
    const keys = await this.redis.keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const experience: ExperienceRecord = JSON.parse(data);
        if (experience.timestamp < cutoffTime) {
          await this.redis.del(key);
          deletedCount++;
        }
      }
    }

    this.emit('experiences-cleaned', { deletedCount });
    return deletedCount;
  }

  public async exportExperiences(
    agentId?: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const experiences = await this.getAgentExperiences(agentId || 'all', 10000);

    if (format === 'csv') {
      return this.convertToCSV(experiences);
    }

    return JSON.stringify(experiences, null, 2);
  }

  private async storeExperience(experience: ExperienceRecord): Promise<void> {
    const key = `experience:${experience.id}`;
    await this.redis.setex(key, this.config.retentionPeriod * 24 * 60 * 60, JSON.stringify(experience));

    // Also store in time-series index for efficient querying
    const timeKey = `experiences:by_time:${Math.floor(experience.timestamp / (60 * 60 * 1000))}`; // Hourly buckets
    await this.redis.sadd(timeKey, experience.id);
    await this.redis.expire(timeKey, this.config.retentionPeriod * 24 * 60 * 60);
  }

  private calculateSimilarity(
    context1: Partial<ExperienceRecord['context']>,
    context2: ExperienceRecord['context']
  ): number {
    let similarity = 0;
    let totalFactors = 0;

    // Domain similarity
    if (context1.domain && context2.domain) {
      totalFactors++;
      if (context1.domain === context2.domain) {
        similarity += 1;
      }
    }

    // Goals similarity
    if (context1.goals && context2.goals) {
      totalFactors++;
      const commonGoals = context1.goals.filter(goal => context2.goals.includes(goal));
      similarity += commonGoals.length / Math.max(context1.goals.length, context2.goals.length);
    }

    // Facts similarity (simplified)
    if (context1.facts && context2.facts) {
      totalFactors++;
      const factKeys1 = Object.keys(context1.facts);
      const factKeys2 = Object.keys(context2.facts);
      const commonFacts = factKeys1.filter(key => factKeys2.includes(key));
      similarity += commonFacts.length / Math.max(factKeys1.length, factKeys2.length);
    }

    return totalFactors > 0 ? similarity / totalFactors : 0;
  }

  private convertToCSV(experiences: ExperienceRecord[]): string {
    const headers = [
      'id', 'agentId', 'taskId', 'timestamp', 'domain', 'goals',
      'strategy', 'success', 'confidence', 'executionTime', 'humanRating'
    ];

    const rows = experiences.map(exp => [
      exp.id,
      exp.agentId,
      exp.taskId,
      exp.timestamp,
      exp.context.domain,
      exp.context.goals.join(';'),
      exp.action.strategy,
      exp.result.success,
      exp.result.confidence,
      exp.result.executionTime,
      exp.feedback?.humanRating || '',
    ]);

    return [headers, ...rows].map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createExperienceCollector(config: ExperienceCollectionConfig): ExperienceCollector {
  return new ExperienceCollector(config);
}
```

### 2. Performance Analysis Engine
```typescript
// src/agents/learning/performance-analyzer.ts
import { EventEmitter } from 'events';
import { ExperienceCollector, ExperienceRecord } from './experience-collector';

export interface PerformanceMetrics {
  agentId: string;
  timeRange: {
    start: number;
    end: number;
  };
  overall: {
    totalTasks: number;
    successRate: number;
    averageConfidence: number;
    averageExecutionTime: number;
    improvementTrend: number; // -1 to 1, negative = declining
  };
  byDomain: Record<string, {
    tasks: number;
    successRate: number;
    averageConfidence: number;
  }>;
  byStrategy: Record<string, {
    usage: number;
    successRate: number;
    averageConfidence: number;
    averageExecutionTime: number;
  }>;
  bottlenecks: Array<{
    type: 'strategy' | 'domain' | 'time';
    identifier: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  recommendations: Array<{
    type: 'strategy' | 'training' | 'optimization';
    description: string;
    priority: 'low' | 'medium' | 'high';
    expectedImpact: number; // 0-1
  }>;
}

export interface PerformanceAnalysisConfig {
  analysisWindow: number; // in days
  minSamplesForAnalysis: number;
  improvementThreshold: number; // minimum improvement to be considered significant
  bottleneckThreshold: number; // success rate below this is considered bottleneck
}

export class PerformanceAnalyzer extends EventEmitter {
  private experienceCollector: ExperienceCollector;
  private config: PerformanceAnalysisConfig;

  constructor(experienceCollector: ExperienceCollector, config: PerformanceAnalysisConfig) {
    super();
    this.experienceCollector = experienceCollector;
    this.config = config;
  }

  public async analyzeAgentPerformance(
    agentId: string,
    timeRange?: { start: number; end: number }
  ): Promise<PerformanceMetrics> {
    const endTime = timeRange?.end || Date.now();
    const startTime = timeRange?.start || (endTime - (this.config.analysisWindow * 24 * 60 * 60 * 1000));

    // Get experiences for the time range
    const experiences = await this.experienceCollector.getAgentExperiences(agentId, 10000);
    const filteredExperiences = experiences.filter(exp =>
      exp.timestamp >= startTime && exp.timestamp <= endTime
    );

    if (filteredExperiences.length < this.config.minSamplesForAnalysis) {
      throw new Error(`Insufficient data for analysis: ${filteredExperiences.length} samples`);
    }

    // Calculate overall metrics
    const overall = this.calculateOverallMetrics(filteredExperiences);

    // Calculate domain-specific metrics
    const byDomain = this.calculateDomainMetrics(filteredExperiences);

    // Calculate strategy-specific metrics
    const byStrategy = this.calculateStrategyMetrics(filteredExperiences);

    // Calculate improvement trend
    const improvementTrend = await this.calculateImprovementTrend(agentId, startTime, endTime);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(byDomain, byStrategy, overall);

    // Generate recommendations
    const recommendations = this.generateRecommendations(bottlenecks, byStrategy, improvementTrend);

    const metrics: PerformanceMetrics = {
      agentId,
      timeRange: { start: startTime, end: endTime },
      overall: {
        ...overall,
        improvementTrend,
      },
      byDomain,
      byStrategy,
      bottlenecks,
      recommendations,
    };

    this.emit('analysis-completed', { agentId, metrics });

    return metrics;
  }

  public async analyzeSystemPerformance(): Promise<{
    agentCount: number;
    totalTasks: number;
    systemSuccessRate: number;
    topPerformingAgents: Array<{ agentId: string; successRate: number }>;
    underPerformingAgents: Array<{ agentId: string; successRate: number }>;
    domainPerformance: Record<string, number>;
  }> {
    // Get all experiences (simplified - would need proper indexing)
    const allExperiences = await this.experienceCollector.getAgentExperiences('all', 50000);

    const agentStats: Record<string, { tasks: number; successes: number }> = {};
    const domainStats: Record<string, { tasks: number; successes: number }> = {};

    for (const exp of allExperiences) {
      // Agent stats
      if (!agentStats[exp.agentId]) {
        agentStats[exp.agentId] = { tasks: 0, successes: 0 };
      }
      agentStats[exp.agentId].tasks++;
      if (exp.result.success) {
        agentStats[exp.agentId].successes++;
      }

      // Domain stats
      if (!domainStats[exp.context.domain]) {
        domainStats[exp.context.domain] = { tasks: 0, successes: 0 };
      }
      domainStats[exp.context.domain].tasks++;
      if (exp.result.success) {
        domainStats[exp.context.domain].successes++;
      }
    }

    // Calculate agent performance
    const agentPerformance = Object.entries(agentStats).map(([agentId, stats]) => ({
      agentId,
      successRate: stats.tasks > 0 ? stats.successes / stats.tasks : 0,
    }));

    // Sort agents by performance
    agentPerformance.sort((a, b) => b.successRate - a.successRate);

    const topPerformingAgents = agentPerformance.slice(0, 5);
    const underPerformingAgents = agentPerformance.slice(-5).reverse();

    // Calculate domain performance
    const domainPerformance: Record<string, number> = {};
    for (const [domain, stats] of Object.entries(domainStats)) {
      domainPerformance[domain] = stats.tasks > 0 ? stats.successes / stats.tasks : 0;
    }

    const totalTasks = allExperiences.length;
    const totalSuccesses = allExperiences.filter(exp => exp.result.success).length;
    const systemSuccessRate = totalTasks > 0 ? totalSuccesses / totalTasks : 0;

    return {
      agentCount: Object.keys(agentStats).length,
      totalTasks,
      systemSuccessRate,
      topPerformingAgents,
      underPerformingAgents,
      domainPerformance,
    };
  }

  public async generatePerformanceReport(
    agentId: string,
    format: 'json' | 'html' | 'markdown' = 'json'
  ): Promise<string> {
    const metrics = await this.analyzeAgentPerformance(agentId);

    switch (format) {
      case 'html':
        return this.generateHTMLReport(metrics);
      case 'markdown':
        return this.generateMarkdownReport(metrics);
      default:
        return JSON.stringify(metrics, null, 2);
    }
  }

  private calculateOverallMetrics(experiences: ExperienceRecord[]): PerformanceMetrics['overall'] {
    const totalTasks = experiences.length;
    const successfulTasks = experiences.filter(exp => exp.result.success).length;
    const successRate = totalTasks > 0 ? successfulTasks / totalTasks : 0;

    const totalConfidence = experiences.reduce((sum, exp) => sum + exp.result.confidence, 0);
    const averageConfidence = totalTasks > 0 ? totalConfidence / totalTasks : 0;

    const totalExecutionTime = experiences.reduce((sum, exp) => sum + exp.result.executionTime, 0);
    const averageExecutionTime = totalTasks > 0 ? totalExecutionTime / totalTasks : 0;

    return {
      totalTasks,
      successRate,
      averageConfidence,
      averageExecutionTime,
      improvementTrend: 0, // Will be calculated separately
    };
  }

  private calculateDomainMetrics(experiences: ExperienceRecord[]): PerformanceMetrics['byDomain'] {
    const domainStats: Record<string, { tasks: number; successes: number; totalConfidence: number }> = {};

    for (const exp of experiences) {
      const domain = exp.context.domain;
      if (!domainStats[domain]) {
        domainStats[domain] = { tasks: 0, successes: 0, totalConfidence: 0 };
      }

      domainStats[domain].tasks++;
      if (exp.result.success) {
        domainStats[domain].successes++;
      }
      domainStats[domain].totalConfidence += exp.result.confidence;
    }

    const byDomain: Record<string, { tasks: number; successRate: number; averageConfidence: number }> = {};

    for (const [domain, stats] of Object.entries(domainStats)) {
      byDomain[domain] = {
        tasks: stats.tasks,
        successRate: stats.tasks > 0 ? stats.successes / stats.tasks : 0,
        averageConfidence: stats.tasks > 0 ? stats.totalConfidence / stats.tasks : 0,
      };
    }

    return byDomain;
  }

  private calculateStrategyMetrics(experiences: ExperienceRecord[]): PerformanceMetrics['byStrategy'] {
    const strategyStats: Record<string, {
      usage: number;
      successes: number;
      totalConfidence: number;
      totalExecutionTime: number;
    }> = {};

    for (const exp of experiences) {
      const strategy = exp.action.strategy;
      if (!strategyStats[strategy]) {
        strategyStats[strategy] = { usage: 0, successes: 0, totalConfidence: 0, totalExecutionTime: 0 };
      }

      strategyStats[strategy].usage++;
      if (exp.result.success) {
        strategyStats[strategy].successes++;
      }
      strategyStats[strategy].totalConfidence += exp.result.confidence;
      strategyStats[strategy].totalExecutionTime += exp.result.executionTime;
    }

    const byStrategy: Record<string, {
      usage: number;
      successRate: number;
      averageConfidence: number;
      averageExecutionTime: number;
    }> = {};

    for (const [strategy, stats] of Object.entries(strategyStats)) {
      byStrategy[strategy] = {
        usage: stats.usage,
        successRate: stats.usage > 0 ? stats.successes / stats.usage : 0,
        averageConfidence: stats.usage > 0 ? stats.totalConfidence / stats.usage : 0,
        averageExecutionTime: stats.usage > 0 ? stats.totalExecutionTime / stats.usage : 0,
      };
    }

    return byStrategy;
  }

  private async calculateImprovementTrend(
    agentId: string,
    startTime: number,
    endTime: number
  ): Promise<number> {
    const midPoint = startTime + (endTime - startTime) / 2;

    const firstHalf = await this.experienceCollector.getAgentExperiences(agentId, 1000);
    const firstHalfFiltered = firstHalf.filter(exp =>
      exp.timestamp >= startTime && exp.timestamp < midPoint
    );

    const secondHalf = await this.experienceCollector.getAgentExperiences(agentId, 1000);
    const secondHalfFiltered = secondHalf.filter(exp =>
      exp.timestamp >= midPoint && exp.timestamp <= endTime
    );

    const firstHalfSuccess = firstHalfFiltered.filter(exp => exp.result.success).length /
      Math.max(firstHalfFiltered.length, 1);
    const secondHalfSuccess = secondHalfFiltered.filter(exp => exp.result.success).length /
      Math.max(secondHalfFiltered.length, 1);

    return secondHalfSuccess - firstHalfSuccess;
  }

  private identifyBottlenecks(
    byDomain: PerformanceMetrics['byDomain'],
    byStrategy: PerformanceMetrics['byStrategy'],
    overall: PerformanceMetrics['overall']
  ): PerformanceMetrics['bottlenecks'] {
    const bottlenecks: PerformanceMetrics['bottlenecks'] = [];

    // Check domain bottlenecks
    for (const [domain, metrics] of Object.entries(byDomain)) {
      if (metrics.successRate < this.config.bottleneckThreshold) {
        bottlenecks.push({
          type: 'domain',
          identifier: domain,
          issue: `Low success rate in ${domain} domain`,
          severity: metrics.successRate < 0.5 ? 'high' : 'medium',
          recommendation: `Review ${domain} handling logic and consider additional training`,
        });
      }
    }

    // Check strategy bottlenecks
    for (const [strategy, metrics] of Object.entries(byStrategy)) {
      if (metrics.successRate < this.config.bottleneckThreshold) {
        bottlenecks.push({
          type: 'strategy',
          identifier: strategy,
          issue: `Poor performance with ${strategy} strategy`,
          severity: metrics.successRate < 0.5 ? 'high' : 'medium',
          recommendation: `Consider alternative strategies or optimize ${strategy} implementation`,
        });
      }
    }

    // Check execution time bottlenecks
    if (overall.averageExecutionTime > 30000) { // 30 seconds
      bottlenecks.push({
        type: 'time',
        identifier: 'execution_time',
        issue: 'High average execution time',
        severity: 'medium',
        recommendation: 'Optimize processing logic and consider caching strategies',
      });
    }

    return bottlenecks;
  }

  private generateRecommendations(
    bottlenecks: PerformanceMetrics['bottlenecks'],
    byStrategy: PerformanceMetrics['byStrategy'],
    improvementTrend: number
  ): PerformanceMetrics['recommendations'] {
    const recommendations: PerformanceMetrics['recommendations'] = [];

    // Recommendations based on bottlenecks
    for (const bottleneck of bottlenecks) {
      recommendations.push({
        type: bottleneck.type === 'strategy' ? 'strategy' : 'optimization',
        description: bottleneck.recommendation,
        priority: bottleneck.severity,
        expectedImpact: bottleneck.severity === 'high' ? 0.7 : 0.4,
      });
    }

    // Strategy recommendations
    const strategies = Object.entries(byStrategy);
    if (strategies.length > 1) {
      const bestStrategy = strategies.reduce((best, current) =>
        current[1].successRate > best[1].successRate ? current : best
      );

      const worstStrategy = strategies.reduce((worst, current) =>
        current[1].successRate < worst[1].successRate ? current : worst
      );

      if (bestStrategy[1].successRate - worstStrategy[1].successRate > 0.2) {
        recommendations.push({
          type: 'strategy',
          description: `Prefer ${bestStrategy[0]} strategy over ${worstStrategy[0]} for better performance`,
          priority: 'medium',
          expectedImpact: 0.3,
        });
      }
    }

    // Training recommendations based on improvement trend
    if (improvementTrend < this.config.improvementThreshold) {
      recommendations.push({
        type: 'training',
        description: 'Consider additional training data or model updates',
        priority: improvementTrend < -0.1 ? 'high' : 'medium',
        expectedImpact: 0.5,
      });
    }

    return recommendations;
  }

  private generateHTMLReport(metrics: PerformanceMetrics): string {
    return `
      <html>
        <head>
          <title>Agent Performance Report - ${metrics.agentId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .bottleneck { background: #ffebee; border-left: 4px solid #f44336; padding: 10px; margin: 10px 0; }
            .recommendation { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 10px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Agent Performance Report</h1>
          <h2>Agent: ${metrics.agentId}</h2>
          <p>Period: ${new Date(metrics.timeRange.start).toLocaleDateString()} - ${new Date(metrics.timeRange.end).toLocaleDateString()}</p>

          <div class="metric">
            <h3>Overall Performance</h3>
            <p>Total Tasks: ${metrics.overall.totalTasks}</p>
            <p>Success Rate: ${(metrics.overall.successRate * 100).toFixed(1)}%</p>
            <p>Average Confidence: ${(metrics.overall.averageConfidence * 100).toFixed(1)}%</p>
            <p>Average Execution Time: ${metrics.overall.averageExecutionTime.toFixed(0)}ms</p>
            <p>Improvement Trend: ${(metrics.overall.improvementTrend * 100).toFixed(1)}%</p>
          </div>

          <h3>Bottlenecks</h3>
          ${metrics.bottlenecks.map(b => `
            <div class="bottleneck">
              <strong>${b.type.toUpperCase()}: ${b.identifier}</strong>
              <p>${b.issue}</p>
              <p><em>Recommendation: ${b.recommendation}</em></p>
            </div>
          `).join('')}

          <h3>Recommendations</h3>
          ${metrics.recommendations.map(r => `
            <div class="recommendation">
              <strong>${r.type.toUpperCase()}</strong> (${r.priority} priority)
              <p>${r.description}</p>
              <p>Expected Impact: ${(r.expectedImpact * 100).toFixed(0)}%</p>
            </div>
          `).join('')}
        </body>
      </html>
    `;
  }

  private generateMarkdownReport(metrics: PerformanceMetrics): string {
    return `
# Agent Performance Report - ${metrics.agentId}

**Period:** ${new Date(metrics.timeRange.start).toLocaleDateString()} - ${new Date(metrics.timeRange.end).toLocaleDateString()}

## Overall Performance
- Total Tasks: ${metrics.overall.totalTasks}
- Success Rate: ${(metrics.overall.successRate * 100).toFixed(1)}%
- Average Confidence: ${(metrics.overall.averageConfidence * 100).toFixed(1)}%
- Average Execution Time: ${metrics.overall.averageExecutionTime.toFixed(0)}ms
- Improvement Trend: ${(metrics.overall.improvementTrend * 100).toFixed(1)}%

## Bottlenecks
${metrics.bottlenecks.map(b => `
### ${b.type.toUpperCase()}: ${b.identifier}
- **Issue:** ${b.issue}
- **Severity:** ${b.severity}
- **Recommendation:** ${b.recommendation}
`).join('')}

## Recommendations
${metrics.recommendations.map(r => `
### ${r.type.charAt(0).toUpperCase() + r.type.slice(1)} (${r.priority} priority)
${r.description}
*Expected Impact: ${(r.expectedImpact * 100).toFixed(0)}%*
`).join('')}
    `.trim();
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createPerformanceAnalyzer(
  experienceCollector: ExperienceCollector,
  config: PerformanceAnalysisConfig
): PerformanceAnalyzer {
  return new PerformanceAnalyzer(experienceCollector, config);
}
```

### 3. Adaptive Learning Engine
```typescript
// src/agents/learning/adaptive-learning.ts
import { EventEmitter } from 'events';
import { ExperienceCollector, ExperienceRecord } from './experience-collector';
import { PerformanceAnalyzer, PerformanceMetrics } from './performance-analyzer';
import { ReasoningEngine } from '../reasoning/reasoning-engine';

export interface LearningModel {
  id: string;
  version: string;
  type: 'strategy_weights' | 'decision_tree' | 'pattern_matching' | 'reinforcement';
  parameters: Record<string, any>;
  performance: {
    accuracy: number;
    confidence: number;
    lastUpdated: number;
    trainingSamples: number;
  };
  metadata: {
    createdAt: number;
    trainedOn: string[];
    validationScore: number;
  };
}

export interface AdaptationStrategy {
  name: string;
  description: string;
  canAdapt: (metrics: PerformanceMetrics) => boolean;
  adapt: (currentModel: LearningModel, experiences: ExperienceRecord[]) => Promise<LearningModel>;
  expectedImprovement: number;
}

export interface AdaptiveLearningConfig {
  learningRate: number;
  adaptationThreshold: number; // minimum performance drop to trigger adaptation
  minTrainingSamples: number;
  maxModelVersions: number;
  adaptationCooldown: number; // minimum time between adaptations (ms)
  enableOnlineLearning: boolean;
}

export class AdaptiveLearningEngine extends EventEmitter {
  private experienceCollector: ExperienceCollector;
  private performanceAnalyzer: PerformanceAnalyzer;
  private reasoningEngine: ReasoningEngine;
  private config: AdaptiveLearningConfig;

  private currentModels: Map<string, LearningModel> = new Map();
  private adaptationHistory: Array<{
    timestamp: number;
    modelId: string;
    oldVersion: string;
    newVersion: string;
    trigger: string;
    improvement: number;
  }> = new Map() as any;

  private lastAdaptationTime: number = 0;

  constructor(
    experienceCollector: ExperienceCollector,
    performanceAnalyzer: PerformanceAnalyzer,
    reasoningEngine: ReasoningEngine,
    config: AdaptiveLearningConfig
  ) {
    super();
    this.experienceCollector = experienceCollector;
    this.performanceAnalyzer = performanceAnalyzer;
    this.reasoningEngine = reasoningEngine;
    this.config = config;

    this.initializeDefaultModels();
    this.initializeAdaptationStrategies();
  }

  private initializeDefaultModels(): void {
    // Strategy selection model
    const strategyModel: LearningModel = {
      id: 'strategy-selection',
      version: '1.0.0',
      type: 'strategy_weights',
      parameters: {
        weights: {
          'chain-of-thought': 0.6,
          'decision-tree': 0.3,
          'bayesian': 0.1,
        },
        contextFactors: ['domain', 'complexity', 'time_pressure'],
      },
      performance: {
        accuracy: 0.75,
        confidence: 0.8,
        lastUpdated: Date.now(),
        trainingSamples: 0,
      },
      metadata: {
        createdAt: Date.now(),
        trainedOn: [],
        validationScore: 0.75,
      },
    };

    // Pattern matching model
    const patternModel: LearningModel = {
      id: 'pattern-matching',
      version: '1.0.0',
      type: 'pattern_matching',
      parameters: {
        patterns: new Map(),
        similarityThreshold: 0.7,
        maxPatterns: 1000,
      },
      performance: {
        accuracy: 0.7,
        confidence: 0.75,
        lastUpdated: Date.now(),
        trainingSamples: 0,
      },
      metadata: {
        createdAt: Date.now(),
        trainedOn: [],
        validationScore: 0.7,
      },
    };

    this.currentModels.set(strategyModel.id, strategyModel);
    this.currentModels.set(patternModel.id, patternModel);
  }

  private adaptationStrategies: AdaptationStrategy[] = [
    {
      name: 'strategy_reweighting',
      description: 'Adjust strategy selection weights based on performance',
      canAdapt: (metrics) => {
        const strategyVariance = this.calculateStrategyVariance(metrics);
        return strategyVariance > 0.2; // Significant performance differences
      },
      adapt: this.adaptStrategyWeights.bind(this),
      expectedImprovement: 0.15,
    },
    {
      name: 'pattern_learning',
      description: 'Learn new patterns from successful experiences',
      canAdapt: (metrics) => metrics.overall.totalTasks > this.config.minTrainingSamples,
      adapt: this.adaptPatternMatching.bind(this),
      expectedImprovement: 0.1,
    },
    {
      name: 'reinforcement_learning',
      description: 'Apply reinforcement learning to improve decision making',
      canAdapt: (metrics) => metrics.overall.improvementTrend < -this.config.adaptationThreshold,
      adapt: this.adaptReinforcementLearning.bind(this),
      expectedImprovement: 0.2,
    },
  ];

  private initializeAdaptationStrategies(): void {
    // Strategies are already initialized above
  }

  public async checkAndAdapt(agentId: string): Promise<boolean> {
    // Check cooldown
    if (Date.now() - this.lastAdaptationTime < this.config.adaptationCooldown) {
      return false;
    }

    try {
      // Analyze current performance
      const metrics = await this.performanceAnalyzer.analyzeAgentPerformance(agentId);

      // Check if adaptation is needed
      const needsAdaptation = this.needsAdaptation(metrics);
      if (!needsAdaptation) {
        return false;
      }

      // Select best adaptation strategy
      const adaptationStrategy = this.selectAdaptationStrategy(metrics);
      if (!adaptationStrategy) {
        return false;
      }

      // Get relevant experiences for training
      const experiences = await this.experienceCollector.getAgentExperiences(
        agentId,
        this.config.minTrainingSamples * 2
      );

      // Apply adaptation
      const adapted = await this.applyAdaptation(adaptationStrategy, experiences, metrics);

      if (adapted) {
        this.lastAdaptationTime = Date.now();
        this.emit('adaptation-completed', {
          agentId,
          strategy: adaptationStrategy.name,
          improvement: adaptationStrategy.expectedImprovement
        });
        return true;
      }

      return false;

    } catch (error) {
      this.emit('adaptation-error', { agentId, error: error.message });
      return false;
    }
  }

  public async forceAdaptation(
    agentId: string,
    strategyName: string
  ): Promise<boolean> {
    const strategy = this.adaptationStrategies.find(s => s.name === strategyName);
    if (!strategy) {
      throw new Error(`Unknown adaptation strategy: ${strategyName}`);
    }

    const metrics = await this.performanceAnalyzer.analyzeAgentPerformance(agentId);
    const experiences = await this.experienceCollector.getAgentExperiences(
      agentId,
      this.config.minTrainingSamples * 2
    );

    return await this.applyAdaptation(strategy, experiences, metrics);
  }

  public async getLearningModel(modelId: string): Promise<LearningModel | null> {
    return this.currentModels.get(modelId) || null;
  }

  public async updateModelWithFeedback(
    modelId: string,
    feedback: {
      accuracy: number;
      confidence: number;
      context: Record<string, any>;
    }
  ): Promise<void> {
    const model = this.currentModels.get(modelId);
    if (!model) return;

    // Update model performance metrics
    model.performance.accuracy = this.updateMetric(
      model.performance.accuracy,
      feedback.accuracy,
      this.config.learningRate
    );

    model.performance.confidence = this.updateMetric(
      model.performance.confidence,
      feedback.confidence,
      this.config.learningRate
    );

    model.performance.lastUpdated = Date.now();
    model.performance.trainingSamples++;

    // Store feedback context for future learning
    model.metadata.trainedOn.push(JSON.stringify(feedback.context));

    // Keep only recent training samples
    if (model.metadata.trainedOn.length > 100) {
      model.metadata.trainedOn = model.metadata.trainedOn.slice(-100);
    }

    this.emit('model-updated', { modelId, feedback });
  }

  public getAdaptationHistory(agentId?: string): Array<{
    timestamp: number;
    modelId: string;
    oldVersion: string;
    newVersion: string;
    trigger: string;
    improvement: number;
  }> {
    // In a real implementation, this would be stored persistently
    return Array.from(this.adaptationHistory.values()).filter(
      entry => !agentId || entry.modelId.includes(agentId)
    );
  }

  public async exportModels(): Promise<Record<string, LearningModel>> {
    const models: Record<string, LearningModel> = {};
    for (const [id, model] of this.currentModels) {
      models[id] = { ...model };
    }
    return models;
  }

  public async importModels(models: Record<string, LearningModel>): Promise<void> {
    for (const [id, model] of Object.entries(models)) {
      this.currentModels.set(id, { ...model });
    }
    this.emit('models-imported', { count: Object.keys(models).length });
  }

  private needsAdaptation(metrics: PerformanceMetrics): boolean {
    // Check if performance is below threshold
    if (metrics.overall.successRate < 0.7) return true;

    // Check for significant decline
    if (metrics.overall.improvementTrend < -this.config.adaptationThreshold) return true;

    // Check for strategy imbalances
    const strategyVariance = this.calculateStrategyVariance(metrics);
    if (strategyVariance > 0.3) return true;

    return false;
  }

  private selectAdaptationStrategy(metrics: PerformanceMetrics): AdaptationStrategy | null {
    for (const strategy of this.adaptationStrategies) {
      if (strategy.canAdapt(metrics)) {
        return strategy;
      }
    }
    return null;
  }

  private async applyAdaptation(
    strategy: AdaptationStrategy,
    experiences: ExperienceRecord[],
    metrics: PerformanceMetrics
  ): Promise<boolean> {
    try {
      // Find relevant model
      const modelId = this.getRelevantModelForStrategy(strategy.name);
      const currentModel = this.currentModels.get(modelId);

      if (!currentModel) return false;

      // Apply adaptation
      const adaptedModel = await strategy.adapt(currentModel, experiences);

      // Validate adaptation
      const validationScore = await this.validateAdaptation(adaptedModel, experiences);
      if (validationScore <= currentModel.metadata.validationScore) {
        // Adaptation didn't improve performance, revert
        return false;
      }

      // Update model version
      adaptedModel.version = this.incrementVersion(currentModel.version);
      adaptedModel.metadata.validationScore = validationScore;
      adaptedModel.performance.lastUpdated = Date.now();

      // Store old model for rollback
      await this.storeModelVersion(currentModel);

      // Update current model
      this.currentModels.set(modelId, adaptedModel);

      // Record adaptation
      this.recordAdaptation(modelId, currentModel.version, adaptedModel.version, strategy.name);

      return true;

    } catch (error) {
      this.emit('adaptation-failed', { strategy: strategy.name, error: error.message });
      return false;
    }
  }

  private async adaptStrategyWeights(
    currentModel: LearningModel,
    experiences: ExperienceRecord[]
  ): Promise<LearningModel> {
    const adaptedModel = { ...currentModel, parameters: { ...currentModel.parameters } };

    // Calculate new weights based on performance
    const strategyPerformance: Record<string, { success: number; total: number }> = {};

    for (const exp of experiences) {
      const strategy = exp.action.strategy;
      if (!strategyPerformance[strategy]) {
        strategyPerformance[strategy] = { success: 0, total: 0 };
      }
      strategyPerformance[strategy].total++;
      if (exp.result.success) {
        strategyPerformance[strategy].success++;
      }
    }

    // Update weights
    const newWeights: Record<string, number> = {};
    let totalWeight = 0;

    for (const [strategy, perf] of Object.entries(strategyPerformance)) {
      const successRate = perf.total > 0 ? perf.success / perf.total : 0;
      newWeights[strategy] = successRate;
      totalWeight += successRate;
    }

    // Normalize weights
    for (const strategy of Object.keys(newWeights)) {
      newWeights[strategy] = newWeights[strategy] / totalWeight;
    }

    adaptedModel.parameters.weights = newWeights;

    return adaptedModel;
  }

  private async adaptPatternMatching(
    currentModel: LearningModel,
    experiences: ExperienceRecord[]
  ): Promise<LearningModel> {
    const adaptedModel = { ...currentModel, parameters: { ...currentModel.parameters } };
    const patterns = new Map(adaptedModel.parameters.patterns);

    // Extract successful patterns
    for (const exp of experiences) {
      if (exp.result.success && exp.result.confidence > 0.8) {
        const patternKey = this.createPatternKey(exp.context);
        const outcome = exp.result.outcome;

        patterns.set(patternKey, {
          context: exp.context,
          outcome,
          confidence: exp.result.confidence,
          frequency: (patterns.get(patternKey)?.frequency || 0) + 1,
          lastSeen: Date.now(),
        });
      }
    }

    // Limit number of patterns
    if (patterns.size > adaptedModel.parameters.maxPatterns) {
      const sortedPatterns = Array.from(patterns.entries())
        .sort((a, b) => (b[1].frequency * b[1].confidence) - (a[1].frequency * a[1].confidence));

      const limitedPatterns = new Map(sortedPatterns.slice(0, adaptedModel.parameters.maxPatterns));
      adaptedModel.parameters.patterns = limitedPatterns;
    } else {
      adaptedModel.parameters.patterns = patterns;
    }

    return adaptedModel;
  }

  private async adaptReinforcementLearning(
    currentModel: LearningModel,
    experiences: ExperienceRecord[]
  ): Promise<LearningModel> {
    // Simplified reinforcement learning adaptation
    const adaptedModel = { ...currentModel, parameters: { ...currentModel.parameters } };

    // Implement Q-learning style updates
    const qTable = adaptedModel.parameters.qTable || new Map();

    for (const exp of experiences) {
      const state = this.extractState(exp.context);
      const action = exp.action.type;
      const reward = exp.result.success ? 1 : -1;

      const stateActionKey = `${state}:${action}`;
      const currentQ = qTable.get(stateActionKey) || 0;

      // Q-learning update rule
      const newQ = currentQ + this.config.learningRate * (reward - currentQ);
      qTable.set(stateActionKey, newQ);
    }

    adaptedModel.parameters.qTable = qTable;

    return adaptedModel;
  }

  private async validateAdaptation(
    model: LearningModel,
    experiences: ExperienceRecord[]
  ): Promise<number> {
    // Cross-validation on held-out data
    const testSize = Math.floor(experiences.length * 0.2);
    const testExperiences = experiences.slice(-testSize);
    const trainingExperiences = experiences.slice(0, -testSize);

    // Simple validation - check if model performs better on test set
    let correctPredictions = 0;

    for (const exp of testExperiences) {
      const prediction = await this.predictWithModel(model, exp.context);
      if (prediction === exp.result.success) {
        correctPredictions++;
      }
    }

    return testSize > 0 ? correctPredictions / testSize : 0;
  }

  private async predictWithModel(model: LearningModel, context: any): Promise<boolean> {
    // Simplified prediction logic
    switch (model.type) {
      case 'strategy_weights':
        return Math.random() < 0.75; // Placeholder
      case 'pattern_matching':
        return this.matchPattern(model, context);
      default:
        return Math.random() < 0.7;
    }
  }

  private matchPattern(model: LearningModel, context: any): boolean {
    const patterns = model.parameters.patterns;
    const contextKey = this.createPatternKey(context);

    const pattern = patterns.get(contextKey);
    return pattern && pattern.confidence > model.parameters.similarityThreshold;
  }

  private calculateStrategyVariance(metrics: PerformanceMetrics): number {
    const strategies = Object.values(metrics.byStrategy);
    if (strategies.length < 2) return 0;

    const successRates = strategies.map(s => s.successRate);
    const mean = successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;

    const variance = successRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / successRates.length;
    return Math.sqrt(variance);
  }

  private getRelevantModelForStrategy(strategyName: string): string {
    const strategyModelMap: Record<string, string> = {
      'strategy_reweighting': 'strategy-selection',
      'pattern_learning': 'pattern-matching',
      'reinforcement_learning': 'reinforcement',
    };

    return strategyModelMap[strategyName] || 'strategy-selection';
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  private async storeModelVersion(model: LearningModel): Promise<void> {
    // In production, this would store in persistent storage
    // For now, just keep in memory with version history
  }

  private recordAdaptation(
    modelId: string,
    oldVersion: string,
    newVersion: string,
    trigger: string
  ): void {
    const record = {
      timestamp: Date.now(),
      modelId,
      oldVersion,
      newVersion,
      trigger,
      improvement: 0, // Would be calculated
    };

    this.adaptationHistory.set(`${modelId}-${Date.now()}`, record);
  }

  private updateMetric(current: number, newValue: number, learningRate: number): number {
    return current + learningRate * (newValue - current);
  }

  private createPatternKey(context: any): string {
    // Create a hashable key from context
    const keyString = JSON.stringify({
      domain: context.domain,
      goals: context.goals?.sort(),
      facts: Object.keys(context.facts || {}).sort(),
    });
    return require('crypto').createHash('md5').update(keyString).digest('hex');
  }

  private extractState(context: any): string {
    // Extract state representation for reinforcement learning
    return `${context.domain}-${context.goals?.join(',') || 'none'}`;
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }
}

// Factory function
export function createAdaptiveLearningEngine(
  experienceCollector: ExperienceCollector,
  performanceAnalyzer: PerformanceAnalyzer,
  reasoningEngine: ReasoningEngine,
  config: AdaptiveLearningConfig
): AdaptiveLearningEngine {
  return new AdaptiveLearningEngine(
    experienceCollector,
    performanceAnalyzer,
    reasoningEngine,
    config
  );
}
```

### 4. Learning Service Integration
```typescript
// src/services/agent-learning.service.ts
import { ExperienceCollector, createExperienceCollector } from '../agents/learning/experience-collector';
import { PerformanceAnalyzer, createPerformanceAnalyzer } from '../agents/learning/performance-analyzer';
import { AdaptiveLearningEngine, createAdaptiveLearningEngine } from '../agents/learning/adaptive-learning';
import { ReasoningEngine } from '../agents/reasoning/reasoning-engine';

export interface AgentLearningConfig {
  redisUrl: string;
  retentionPeriod: number;
  samplingRate: number;
  maxRecordsPerAgent: number;
  enableHumanFeedback: boolean;
  analysisWindow: number;
  minSamplesForAnalysis: number;
  improvementThreshold: number;
  bottleneckThreshold: number;
  learningRate: number;
  adaptationThreshold: number;
  minTrainingSamples: number;
  maxModelVersions: number;
  adaptationCooldown: number;
  enableOnlineLearning: boolean;
}

export class AgentLearningService {
  private experienceCollector: ExperienceCollector;
  private performanceAnalyzer: PerformanceAnalyzer;
  private adaptiveLearning: AdaptiveLearningEngine;

  constructor(
    private reasoningEngine: ReasoningEngine,
    private config: AgentLearningConfig
  ) {
    // Initialize experience collection
    this.experienceCollector = createExperienceCollector({
      redisUrl: config.redisUrl,
      retentionPeriod: config.retentionPeriod,
      samplingRate: config.samplingRate,
      maxRecordsPerAgent: config.maxRecordsPerAgent,
      enableHumanFeedback: config.enableHumanFeedback,
    });

    // Initialize performance analysis
    this.performanceAnalyzer = createPerformanceAnalyzer(this.experienceCollector, {
      analysisWindow: config.analysisWindow,
      minSamplesForAnalysis: config.minSamplesForAnalysis,
      improvementThreshold: config.improvementThreshold,
      bottleneckThreshold: config.bottleneckThreshold,
    });

    // Initialize adaptive learning
    this.adaptiveLearning = createAdaptiveLearningEngine(
      this.experienceCollector,
      this.performanceAnalyzer,
      this.reasoningEngine,
      {
        learningRate: config.learningRate,
        adaptationThreshold: config.adaptationThreshold,
        minTrainingSamples: config.minTrainingSamples,
        maxModelVersions: config.maxModelVersions,
        adaptationCooldown: config.adaptationCooldown,
        enableOnlineLearning: config.enableOnlineLearning,
      }
    );
  }

  public async start(): Promise<void> {
    // Start background learning processes
    if (this.config.enableOnlineLearning) {
      this.startOnlineLearning();
    }
  }

  public async stop(): Promise<void> {
    // Cleanup if needed
  }

  // Experience management
  public async recordExperience(
    agentId: string,
    taskId: string,
    context: any,
    action: any,
    result: any
  ): Promise<string> {
    const experienceId = await this.experienceCollector.startExperience(agentId, taskId, context);
    await this.experienceCollector.completeExperience(experienceId, action, result);
    return experienceId;
  }

  public async addFeedback(experienceId: string, feedback: any): Promise<void> {
    await this.experienceCollector.addFeedback(experienceId, feedback);
  }

  public async getExperience(experienceId: string): Promise<any> {
    return await this.experienceCollector.getExperience(experienceId);
  }

  public async getAgentExperiences(agentId: string, limit?: number): Promise<any[]> {
    return await this.experienceCollector.getAgentExperiences(agentId, limit);
  }

  // Performance analysis
  public async analyzeAgentPerformance(agentId: string, timeRange?: any): Promise<any> {
    return await this.performanceAnalyzer.analyzeAgentPerformance(agentId, timeRange);
  }

  public async analyzeSystemPerformance(): Promise<any> {
    return await this.performanceAnalyzer.analyzeSystemPerformance();
  }

  public async generatePerformanceReport(agentId: string, format?: string): Promise<string> {
    return await this.performanceAnalyzer.generatePerformanceReport(agentId, format as any);
  }

  // Adaptive learning
  public async checkAndAdapt(agentId: string): Promise<boolean> {
    return await this.adaptiveLearning.checkAndAdapt(agentId);
  }

  public async forceAdaptation(agentId: string, strategy: string): Promise<boolean> {
    return await this.adaptiveLearning.forceAdaptation(agentId, strategy);
  }

  public async getLearningModel(modelId: string): Promise<any> {
    return await this.adaptiveLearning.getLearningModel(modelId);
  }

  public async updateModelWithFeedback(modelId: string, feedback: any): Promise<void> {
    await this.adaptiveLearning.updateModelWithFeedback(modelId, feedback);
  }

  public getAdaptationHistory(agentId?: string): any[] {
    return this.adaptiveLearning.getAdaptationHistory(agentId);
  }

  // Learning management
  public async exportLearningState(): Promise<any> {
    const models = await this.adaptiveLearning.exportModels();
    const experiences = await this.experienceCollector.exportExperiences();

    return {
      models,
      experiences,
      exportTime: Date.now(),
      version: '1.0.0',
    };
  }

  public async importLearningState(state: any): Promise<void> {
    if (state.models) {
      await this.adaptiveLearning.importModels(state.models);
    }

    // Note: Experience import would require careful handling to avoid duplicates
    this.emit('learning-state-imported', { version: state.version });
  }

  // Background learning processes
  private startOnlineLearning(): void {
    // Periodic performance checks and adaptations
    setInterval(async () => {
      try {
        // Get all agents (simplified - would need proper agent registry)
        const agents = ['compliance-agent-1', 'risk-agent-1']; // Placeholder

        for (const agentId of agents) {
          await this.checkAndAdapt(agentId);
        }
      } catch (error) {
        console.error('Online learning error:', error);
      }
    }, 3600000); // Check every hour

    // Periodic cleanup
    setInterval(async () => {
      try {
        await this.experienceCollector.cleanupExpiredExperiences();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, 86400000); // Daily cleanup
  }

  // Learning metrics
  public async getLearningMetrics(): Promise<{
    totalExperiences: number;
    activeModels: number;
    adaptationCount: number;
    averageImprovement: number;
    learningEfficiency: number;
  }> {
    const stats = await this.experienceCollector.getExperienceStats();
    const adaptationHistory = this.getAdaptationHistory();

    const totalAdaptations = adaptationHistory.length;
    const averageImprovement = adaptationHistory.length > 0
      ? adaptationHistory.reduce((sum, entry) => sum + entry.improvement, 0) / totalAdaptations
      : 0;

    return {
      totalExperiences: stats.totalExperiences,
      activeModels: 2, // Placeholder - would count actual models
      adaptationCount: totalAdaptations,
      averageImprovement,
      learningEfficiency: stats.successRate, // Simplified
    };
  }

  // Event handling
  private emit(event: string, data: any): void {
    // Implementation would use proper event emission
    console.log(`Learning Service Event: ${event}`, data);
  }

  public on(event: string, listener: (...args: any[]) => void): this {
    // Register event listeners
    return this;
  }
}

// Export singleton instance
export const agentLearning = new AgentLearningService(
  // reasoningEngine would be injected
  {} as any,
  {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    retentionPeriod: parseInt(process.env.EXPERIENCE_RETENTION_DAYS || '30'),
    samplingRate: parseFloat(process.env.EXPERIENCE_SAMPLING_RATE || '0.1'),
    maxRecordsPerAgent: parseInt(process.env.MAX_RECORDS_PER_AGENT || '10000'),
    enableHumanFeedback: process.env.ENABLE_HUMAN_FEEDBACK === 'true',
    analysisWindow: parseInt(process.env.ANALYSIS_WINDOW_DAYS || '7'),
    minSamplesForAnalysis: parseInt(process.env.MIN_SAMPLES_FOR_ANALYSIS || '100'),
    improvementThreshold: parseFloat(process.env.IMPROVEMENT_THRESHOLD || '0.05'),
    bottleneckThreshold: parseFloat(process.env.BOTTLENECK_THRESHOLD || '0.6'),
    learningRate: parseFloat(process.env.LEARNING_RATE || '0.1'),
    adaptationThreshold: parseFloat(process.env.ADAPTATION_THRESHOLD || '0.1'),
    minTrainingSamples: parseInt(process.env.MIN_TRAINING_SAMPLES || '500'),
    maxModelVersions: parseInt(process.env.MAX_MODEL_VERSIONS || '10'),
    adaptationCooldown: parseInt(process.env.ADAPTATION_COOLDOWN_MS || '3600000'),
    enableOnlineLearning: process.env.ENABLE_ONLINE_LEARNING === 'true',
  }
);
```

## Notes
- Comprehensive experience collection system with structured data capture and feedback integration
- Advanced performance analysis with bottleneck detection and automated recommendations
- Adaptive learning engine with multiple strategies (strategy reweighting, pattern learning, reinforcement learning)
- Model versioning and validation with rollback capabilities
- Integration service providing high-level learning management APIs
- Production-ready background learning processes and cleanup mechanisms