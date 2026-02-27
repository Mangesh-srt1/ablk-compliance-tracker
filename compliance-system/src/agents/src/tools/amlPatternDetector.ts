/**
 * AML Pattern Detector - Analyzes transaction patterns for anomalies
 * Provides velocity scoring, temporal analysis, and behavior clustering
 */

import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/aml-pattern-detector.log' })
  ]
});

/**
 * Helper to parse timestamps safely
 */
function getTimestampMs(timestamp: number | Date): number {
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  return new Date(timestamp).getTime();
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number | Date;
  type: string;
  currency?: string;
}

export interface VelocityProfile {
  transactionsPerHour: number;
  transactionsPerDay: number;
  transactionsPerWeek: number;
  averageAmount: number;
  totalVolume: number;
  peakHour: number | null;
  peakDay: string | null;
}

export interface TemporalPattern {
  type: 'CLUSTERING' | 'SPIKES' | 'RHYTHMIC' | 'IRREGULAR';
  confidence: number;
  description: string;
}

export interface AnomalyFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  confidence: number;
}

export interface PatternAnalysisResult {
  hasAnomalies: boolean;
  velocityRiskAdjustment: number; // -20 to +50 points
  velocityProfile: VelocityProfile;
  temporalPatterns: TemporalPattern[];
  anomalyFlags: AnomalyFlag[];
  normalBehavior: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
}

/**
 * AMLPatternDetector: Analyzes transaction patterns for compliance
 */
export class AMLPatternDetector {
  private readonly NORMAL_TX_PER_HOUR = 5; // Normal baseline
  private readonly NORMAL_TX_PER_DAY = 50;
  private readonly NORMAL_TX_PER_WEEK = 350;
  private readonly SPIKE_MULTIPLIER = 3; // 3x normal = spike
  private readonly CRITICAL_MULTIPLIER = 10; // 10x normal = critical

  /**
   * Analyze transaction history for patterns
   */
  analyzePatterns(transactions: Transaction[]): PatternAnalysisResult {
    if (!transactions || transactions.length === 0) {
      return this.getDefaultAnalysis();
    }

    try {
      logger.info('AMLPatternDetector: Starting pattern analysis', {
        transactionCount: transactions.length
      });

      // Calculate velocity metrics
      const velocityProfile = this.calculateVelocityProfile(transactions);

      // Detect temporal patterns
      const temporalPatterns = this.detectTemporalPatterns(transactions);

      // Identify anomalies
      const anomalyFlags = this.identifyAnomalies(transactions, velocityProfile);

      // Calculate risk adjustments
      const velocityRiskAdjustment = this.calculateVelocityRiskAdjustment(
        velocityProfile,
        anomalyFlags
      );

      // Determine normal behavior
      const normalBehavior = anomalyFlags.length === 0;

      // Determine overall risk level
      const riskLevel = this.determineRiskLevel(velocityProfile, anomalyFlags);

      // Calculate confidence (based on data quality and pattern significance)
      const confidence = this.calculateConfidence(transactions.length, anomalyFlags);

      const result: PatternAnalysisResult = {
        hasAnomalies: anomalyFlags.length > 0,
        velocityRiskAdjustment,
        velocityProfile,
        temporalPatterns,
        anomalyFlags,
        normalBehavior,
        riskLevel,
        confidence
      };

      logger.info('AMLPatternDetector: Pattern analysis complete', {
        hasAnomalies: result.hasAnomalies,
        anomalyCount: anomalyFlags.length,
        velocityRiskAdjustment,
        riskLevel,
        confidence
      });

      return result;
    } catch (error) {
      logger.error('AMLPatternDetector: Analysis failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Calculate velocity profile from transactions
   */
  private calculateVelocityProfile(transactions: Transaction[]): VelocityProfile {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Parse timestamps
    const txWithDates = transactions.map(tx => ({
      ...tx,
      timestamp: getTimestampMs(tx.timestamp)
    }));

    // Count transactions in time windows
    const txLastHour = txWithDates.filter(tx => tx.timestamp > oneHourAgo).length;
    const txLastDay = txWithDates.filter(tx => tx.timestamp > oneDayAgo).length;
    const txLastWeek = txWithDates.filter(tx => tx.timestamp > oneWeekAgo).length;

    // Calculate amounts
    const amounts = txWithDates.map(tx => tx.amount);
    const totalVolume = amounts.reduce((a, b) => a + b, 0);
    const averageAmount = amounts.length > 0 ? totalVolume / amounts.length : 0;

    // Find peak hour
    const hourBuckets = new Map<number, number>();
    txWithDates.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + 1);
    });
    const peakHour =
      hourBuckets.size > 0
        ? Array.from(hourBuckets.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    // Find peak day
    const dayBuckets = new Map<string, number>();
    txWithDates.forEach(tx => {
      const day = new Date(tx.timestamp).toLocaleDateString();
      dayBuckets.set(day, (dayBuckets.get(day) || 0) + 1);
    });
    const peakDay =
      dayBuckets.size > 0
        ? Array.from(dayBuckets.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    return {
      transactionsPerHour: txLastHour,
      transactionsPerDay: txLastDay,
      transactionsPerWeek: txLastWeek,
      averageAmount,
      totalVolume,
      peakHour,
      peakDay
    };
  }

  /**
   * Detect temporal patterns in transactions
   */
  private detectTemporalPatterns(transactions: Transaction[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];

    if (transactions.length < 2) {
      return patterns;
    }

    // Sort by timestamp
    const sorted = transactions.sort((a, b) => {
      const aTime = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const bTime = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });

    // Calculate time gaps between transactions
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const curr = getTimestampMs(sorted[i].timestamp);
      const prev = getTimestampMs(sorted[i - 1].timestamp);
      gaps.push(curr - prev);
    }

    if (gaps.length === 0) return patterns;

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const gapVariance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
    const gapStdDev = Math.sqrt(gapVariance);

    // Detect clustering (small gaps)
    const smallGaps = gaps.filter(g => g < avgGap * 0.5).length;
    if (smallGaps > gaps.length * 0.3) {
      patterns.push({
        type: 'CLUSTERING',
        confidence: Math.min(0.95, smallGaps / gaps.length),
        description: 'Transactions clustered in short time windows'
      });
    }

    // Detect spikes (large gaps followed by rapid activity)
    const largeGaps = gaps.filter(g => g > avgGap * 3).length;
    if (largeGaps > gaps.length * 0.2) {
      patterns.push({
        type: 'SPIKES',
        confidence: Math.min(0.95, largeGaps / gaps.length),
        description: 'Activity spikes after idle periods'
      });
    }

    // Detect rhythmic pattern (consistent gaps)
    if (gapStdDev < avgGap * 0.3) {
      patterns.push({
        type: 'RHYTHMIC',
        confidence: Math.min(0.95, 1 - gapStdDev / avgGap),
        description: 'Regular transaction timing pattern'
      });
    }

    // Default to irregular if no patterns detected
    if (patterns.length === 0) {
      patterns.push({
        type: 'IRREGULAR',
        confidence: 0.5,
        description: 'Transaction timing pattern is irregular/random'
      });
    }

    return patterns;
  }

  /**
   * Identify anomalies in transaction patterns
   */
  private identifyAnomalies(
    transactions: Transaction[],
    profile: VelocityProfile
  ): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];

    // Check velocity anomalies
    if (profile.transactionsPerHour > this.CRITICAL_MULTIPLIER * this.NORMAL_TX_PER_HOUR) {
      flags.push({
        type: 'CRITICAL_VELOCITY',
        severity: 'CRITICAL',
        description: `Critical transaction velocity: ${profile.transactionsPerHour} per hour`,
        confidence: 0.95
      });
    } else if (profile.transactionsPerHour > this.SPIKE_MULTIPLIER * this.NORMAL_TX_PER_HOUR) {
      flags.push({
        type: 'VELOCITY_SPIKE',
        severity: 'HIGH',
        description: `Unusual transaction velocity: ${profile.transactionsPerHour} per hour`,
        confidence: 0.9
      });
    }

    // Check for large transfers
    const largeTransfers = transactions.filter(
      tx => tx.amount > profile.averageAmount * 5
    );
    if (largeTransfers.length > transactions.length * 0.1) {
      flags.push({
        type: 'LARGE_TRANSFERS',
        severity: 'MEDIUM',
        description: `${largeTransfers.length} transfers significantly above average amount`,
        confidence: 0.85
      });
    }

    // Check for rapid consecutive transfers
    const rapid = this.detectRapidConsecutiveTransfers(transactions);
    if (rapid.count > 0) {
      flags.push({
        type: 'RAPID_CONSECUTIVE_TRANSFERS',
        severity: rapid.count > 5 ? 'HIGH' : 'MEDIUM',
        description: `${rapid.count} rapid consecutive transfers detected`,
        confidence: rapid.confidence
      });
    }

    // Check for unusual counterparty patterns
    const counterparties = new Map<string, number>();
    transactions.forEach(tx => {
      counterparties.set(tx.to, (counterparties.get(tx.to) || 0) + 1);
    });

    const topCounterparty = Math.max(...counterparties.values());
    const uniqueCounterparties = counterparties.size;
    const concentrationRatio = topCounterparty / transactions.length;

    if (concentrationRatio > 0.8 && uniqueCounterparties < 3) {
      flags.push({
        type: 'COUNTERPARTY_CONCENTRATION',
        severity: 'MEDIUM',
        description: `High concentration to few counterparties: ${uniqueCounterparties} unique destinations`,
        confidence: 0.85
      });
    }

    return flags;
  }

  /**
   * Detect rapid consecutive transfers
   */
  private detectRapidConsecutiveTransfers(transactions: Transaction[]): { count: number; confidence: number } {
    if (transactions.length < 2) {
      return { count: 0, confidence: 0 };
    }

    // Sort by timestamp
    const sorted = transactions.sort((a, b) => {
      const aTime = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const bTime = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });

    // Find sequences with <5 minute gaps
    let rapidCount = 0;
    const RAPID_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (let i = 1; i < sorted.length; i++) {
      const curr = getTimestampMs(sorted[i].timestamp);
      const prev = getTimestampMs(sorted[i - 1].timestamp);
      
      if (curr - prev < RAPID_THRESHOLD) {
        rapidCount++;
      }
    }

    const ratio = rapidCount / transactions.length;
    const confidence = Math.min(0.95, ratio);

    return { count: rapidCount, confidence };
  }

  /**
   * Calculate risk adjustment based on velocity patterns
   */
  private calculateVelocityRiskAdjustment(
    profile: VelocityProfile,
    anomalies: AnomalyFlag[]
  ): number {
    let adjustment = 0;

    // Base adjustment for normal velocity
    const velocityNormal = profile.transactionsPerDay <= this.NORMAL_TX_PER_DAY;
    if (velocityNormal) {
      adjustment -= 10; // Reduce risk for normal velocity
    }

    // Penalize high velocity
    const velocityRatio = profile.transactionsPerDay / this.NORMAL_TX_PER_DAY;
    if (velocityRatio > 1) {
      adjustment += Math.min(40, (velocityRatio - 1) * 20);
    }

    // Add anomaly penalties
    anomalies.forEach(flag => {
      switch (flag.severity) {
        case 'CRITICAL':
          adjustment += 50;
          break;
        case 'HIGH':
          adjustment += 30;
          break;
        case 'MEDIUM':
          adjustment += 15;
          break;
        case 'LOW':
          adjustment += 5;
          break;
      }
    });

    // Cap adjustment between -20 and +50
    return Math.max(-20, Math.min(50, adjustment));
  }

  /**
   * Determine overall risk level
   */
  private determineRiskLevel(
    profile: VelocityProfile,
    anomalies: AnomalyFlag[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Check for critical anomalies
    if (anomalies.some(a => a.severity === 'CRITICAL')) {
      return 'CRITICAL';
    }

    // Check for multiple high severity anomalies
    const highSevere = anomalies.filter(a => a.severity === 'HIGH').length;
    if (highSevere >= 2) {
      return 'HIGH';
    }

    // Check velocity
    if (profile.transactionsPerDay > this.CRITICAL_MULTIPLIER * this.NORMAL_TX_PER_DAY) {
      return 'CRITICAL';
    }

    if (profile.transactionsPerDay > this.SPIKE_MULTIPLIER * this.NORMAL_TX_PER_DAY) {
      return 'HIGH';
    }

    // Check for any medium severity anomalies
    if (anomalies.some(a => a.severity === 'MEDIUM')) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(transactionCount: number, anomalies: AnomalyFlag[]): number {
    // More data = higher confidence
    const dataConfidence = Math.min(1.0, transactionCount / 100);

    // Anomalies with high confidence increase overall confidence
    const anomalyConfidence =
      anomalies.length > 0 ? anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length : 0.5;

    // Weighted average
    return dataConfidence * 0.6 + anomalyConfidence * 0.4;
  }

  /**
   * Get default analysis (no transactions)
   */
  private getDefaultAnalysis(): PatternAnalysisResult {
    return {
      hasAnomalies: false,
      velocityRiskAdjustment: 0,
      velocityProfile: {
        transactionsPerHour: 0,
        transactionsPerDay: 0,
        transactionsPerWeek: 0,
        averageAmount: 0,
        totalVolume: 0,
        peakHour: null,
        peakDay: null
      },
      temporalPatterns: [],
      anomalyFlags: [],
      normalBehavior: true,
      riskLevel: 'LOW',
      confidence: 0
    };
  }
}

/**
 * Initialize pattern detector
 */
export function initializePatternDetector(): AMLPatternDetector {
  return new AMLPatternDetector();
}
