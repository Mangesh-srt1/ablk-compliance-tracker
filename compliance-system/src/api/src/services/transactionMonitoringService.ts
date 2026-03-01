/**
 * Transaction Monitoring Service (KYT)
 * Provides anomaly detection and risk scoring for transaction streams.
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import {
  KytAlert,
  KytAlertType,
  KytBaselineProfile,
  KytCheckRequest,
  KytCheckResult,
  KytRiskLevel,
  KytTransaction,
} from '../types/kyt';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/kyt.log' }),
  ],
});

export class TransactionMonitoringService {
  async analyzeTransactions(request: KytCheckRequest): Promise<KytCheckResult> {
    const startTime = Date.now();
    const checkId = uuidv4();

    const baseline = request.baseline || this.buildBaselineFromTransactions(request.transactions);
    const alerts: KytAlert[] = [];

    alerts.push(...this.detectAmountAnomalies(request.transactions, baseline));
    alerts.push(...this.detectVelocityAnomalies(request.transactions, baseline));
    alerts.push(...this.detectCounterpartyAnomalies(request.transactions, baseline));
    alerts.push(...this.detectGeoAnomalies(request.transactions, baseline));
    alerts.push(...this.detectStructuringPattern(request.transactions));
    alerts.push(...this.detectRoundTripPatterns(request.transactions));
    alerts.push(...this.detectBehavioralShift(request.transactions, baseline));

    const score = this.calculateRiskScore(alerts);
    const riskLevel = this.determineRiskLevel(score);
    const recommendations = this.generateRecommendations(alerts, riskLevel);

    const result: KytCheckResult = {
      checkId,
      entityId: request.entityId,
      jurisdiction: request.jurisdiction,
      score,
      riskLevel,
      alerts,
      recommendations,
      analyzedTransactions: request.transactions.length,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    logger.info('KYT analysis complete', {
      checkId,
      entityId: request.entityId,
      score,
      riskLevel,
      alertCount: alerts.length,
    });

    return result;
  }

  private buildBaselineFromTransactions(transactions: KytTransaction[]): KytBaselineProfile {
    if (transactions.length === 0) {
      return {
        avgAmount: 0,
        stdDevAmount: 0,
        avgDailyCount: 0,
        commonCountries: [],
        knownCounterparties: [],
      };
    }

    const amounts = transactions.map((tx) => tx.amount);
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, amount) => sum + Math.pow(amount - avgAmount, 2), 0) / amounts.length;
    const stdDevAmount = Math.sqrt(variance);

    const dailyBuckets = new Map<string, number>();
    for (const tx of transactions) {
      const day = new Date(tx.timestamp).toISOString().split('T')[0];
      dailyBuckets.set(day, (dailyBuckets.get(day) || 0) + 1);
    }

    const avgDailyCount =
      dailyBuckets.size > 0
        ? Array.from(dailyBuckets.values()).reduce((sum, count) => sum + count, 0) /
          dailyBuckets.size
        : 0;

    const countryFrequency = new Map<string, number>();
    const counterpartyFrequency = new Map<string, number>();

    for (const tx of transactions) {
      if (tx.country) {
        countryFrequency.set(tx.country, (countryFrequency.get(tx.country) || 0) + 1);
      }
      if (tx.counterparty) {
        counterpartyFrequency.set(tx.counterparty, (counterpartyFrequency.get(tx.counterparty) || 0) + 1);
      }
    }

    const commonCountries = Array.from(countryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country]) => country);

    const knownCounterparties = Array.from(counterpartyFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([counterparty]) => counterparty);

    return {
      avgAmount,
      stdDevAmount,
      avgDailyCount,
      commonCountries,
      knownCounterparties,
    };
  }

  private detectAmountAnomalies(
    transactions: KytTransaction[],
    baseline: KytBaselineProfile
  ): KytAlert[] {
    const alerts: KytAlert[] = [];
    if (transactions.length === 0 || baseline.stdDevAmount === 0) {
      return alerts;
    }

    const threshold = baseline.avgAmount + baseline.stdDevAmount * 3;
    const outliers = transactions.filter((tx) => tx.amount > threshold);

    if (outliers.length > 0) {
      alerts.push({
        type: KytAlertType.AMOUNT_ANOMALY,
        severity: outliers.length >= 3 ? 'HIGH' : 'MEDIUM',
        message: 'Unusual high-value transaction amounts detected',
        confidence: 0.82,
        evidence: {
          threshold,
          outlierCount: outliers.length,
          samples: outliers.slice(0, 5).map((tx) => ({ id: tx.id, amount: tx.amount })),
        },
      });
    }

    return alerts;
  }

  private detectVelocityAnomalies(
    transactions: KytTransaction[],
    baseline: KytBaselineProfile
  ): KytAlert[] {
    const alerts: KytAlert[] = [];
    if (transactions.length < 3) {
      return alerts;
    }

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let spikes = 0;
    for (let i = 0; i < sorted.length - 2; i++) {
      const start = new Date(sorted[i]!.timestamp).getTime();
      const end = new Date(sorted[i + 2]!.timestamp).getTime();
      if (end - start <= 60 * 60 * 1000) {
        spikes += 1;
      }
    }

    if (spikes > 0 || transactions.length > baseline.avgDailyCount * 3) {
      alerts.push({
        type: KytAlertType.VELOCITY_ANOMALY,
        severity: spikes >= 2 ? 'HIGH' : 'MEDIUM',
        message: 'Rapid transaction velocity spike detected',
        confidence: 0.78,
        evidence: {
          spikes,
          transactionCount: transactions.length,
          avgDailyCount: baseline.avgDailyCount,
        },
      });
    }

    return alerts;
  }

  private detectCounterpartyAnomalies(
    transactions: KytTransaction[],
    baseline: KytBaselineProfile
  ): KytAlert[] {
    const alerts: KytAlert[] = [];
    const unknownCounterpartyTxs = transactions.filter(
      (tx) => tx.counterparty && !baseline.knownCounterparties.includes(tx.counterparty)
    );

    if (unknownCounterpartyTxs.length >= 3) {
      alerts.push({
        type: KytAlertType.COUNTERPARTY_RISK,
        severity: 'MEDIUM',
        message: 'Multiple transactions with unfamiliar counterparties',
        confidence: 0.7,
        evidence: {
          unknownCounterpartyCount: unknownCounterpartyTxs.length,
          counterparties: Array.from(
            new Set(unknownCounterpartyTxs.map((tx) => tx.counterparty).filter(Boolean))
          ).slice(0, 10),
        },
      });
    }

    return alerts;
  }

  private detectGeoAnomalies(
    transactions: KytTransaction[],
    baseline: KytBaselineProfile
  ): KytAlert[] {
    const alerts: KytAlert[] = [];
    const uncommonCountryTxs = transactions.filter(
      (tx) => tx.country && !baseline.commonCountries.includes(tx.country)
    );

    if (uncommonCountryTxs.length >= 2) {
      alerts.push({
        type: KytAlertType.GEO_ANOMALY,
        severity: 'MEDIUM',
        message: 'Transactions detected from uncommon geographies',
        confidence: 0.68,
        evidence: {
          uncommonCountryCount: uncommonCountryTxs.length,
          countries: Array.from(new Set(uncommonCountryTxs.map((tx) => tx.country).filter(Boolean))),
        },
      });
    }

    return alerts;
  }

  private detectStructuringPattern(transactions: KytTransaction[]): KytAlert[] {
    const alerts: KytAlert[] = [];
    const suspiciousBand = transactions.filter((tx) => tx.amount >= 9000 && tx.amount <= 9999);

    if (suspiciousBand.length >= 3) {
      alerts.push({
        type: KytAlertType.STRUCTURING_PATTERN,
        severity: 'HIGH',
        message: 'Potential structuring pattern detected near reporting threshold',
        confidence: 0.85,
        evidence: {
          count: suspiciousBand.length,
          samples: suspiciousBand.slice(0, 5).map((tx) => ({ id: tx.id, amount: tx.amount })),
        },
      });
    }

    return alerts;
  }

  private detectRoundTripPatterns(transactions: KytTransaction[]): KytAlert[] {
    const alerts: KytAlert[] = [];

    let pairCount = 0;
    for (let i = 0; i < transactions.length - 1; i++) {
      const txA = transactions[i]!;
      for (let j = i + 1; j < transactions.length; j++) {
        const txB = transactions[j]!;

        if (
          txA.fromAddress &&
          txA.toAddress &&
          txB.fromAddress &&
          txB.toAddress &&
          txA.fromAddress === txB.toAddress &&
          txA.toAddress === txB.fromAddress
        ) {
          pairCount += 1;
        }
      }
    }

    if (pairCount > 0) {
      alerts.push({
        type: KytAlertType.ROUND_TRIP_PATTERN,
        severity: pairCount >= 2 ? 'HIGH' : 'MEDIUM',
        message: 'Circular fund movement pattern detected',
        confidence: 0.8,
        evidence: { pairCount },
      });
    }

    return alerts;
  }

  private detectBehavioralShift(
    transactions: KytTransaction[],
    baseline: KytBaselineProfile
  ): KytAlert[] {
    const alerts: KytAlert[] = [];
    if (transactions.length < 4) {
      return alerts;
    }

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const midpoint = Math.floor(sorted.length / 2);
    const early = sorted.slice(0, midpoint);
    const late = sorted.slice(midpoint);

    const earlyAvg = early.reduce((sum, tx) => sum + tx.amount, 0) / Math.max(1, early.length);
    const lateAvg = late.reduce((sum, tx) => sum + tx.amount, 0) / Math.max(1, late.length);

    const delta = baseline.avgAmount > 0 ? ((lateAvg - earlyAvg) / baseline.avgAmount) * 100 : 0;

    if (Math.abs(delta) > 50) {
      alerts.push({
        type: KytAlertType.BEHAVIORAL_SHIFT,
        severity: Math.abs(delta) > 100 ? 'HIGH' : 'MEDIUM',
        message: 'Significant behavioral shift in transaction amounts',
        confidence: 0.73,
        evidence: {
          earlyAvg,
          lateAvg,
          baselineAvg: baseline.avgAmount,
          percentShift: delta,
        },
      });
    }

    return alerts;
  }

  private calculateRiskScore(alerts: KytAlert[]): number {
    let score = 0;

    for (const alert of alerts) {
      switch (alert.severity) {
        case 'CRITICAL':
          score += 25;
          break;
        case 'HIGH':
          score += 18;
          break;
        case 'MEDIUM':
          score += 10;
          break;
        case 'LOW':
          score += 5;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineRiskLevel(score: number): KytRiskLevel {
    if (score < 30) {
      return KytRiskLevel.LOW;
    }
    if (score < 60) {
      return KytRiskLevel.MEDIUM;
    }
    if (score < 85) {
      return KytRiskLevel.HIGH;
    }
    return KytRiskLevel.CRITICAL;
  }

  private generateRecommendations(alerts: KytAlert[], riskLevel: KytRiskLevel): string[] {
    const recommendations: string[] = [];

    if (alerts.some((alert) => alert.type === KytAlertType.STRUCTURING_PATTERN)) {
      recommendations.push('Investigate potential threshold-avoidance structuring behavior.');
      recommendations.push('Prepare SAR draft if corroborating signals are confirmed.');
    }

    if (alerts.some((alert) => alert.type === KytAlertType.ROUND_TRIP_PATTERN)) {
      recommendations.push('Review circular fund flows for layering indicators.');
    }

    if (alerts.some((alert) => alert.type === KytAlertType.VELOCITY_ANOMALY)) {
      recommendations.push('Increase monitoring cadence for short-window transaction bursts.');
    }

    switch (riskLevel) {
      case KytRiskLevel.CRITICAL:
        recommendations.push('Escalate immediately to compliance operations and freeze pending review.');
        break;
      case KytRiskLevel.HIGH:
        recommendations.push('Apply enhanced due diligence and manual analyst review.');
        break;
      case KytRiskLevel.MEDIUM:
        recommendations.push('Continue heightened monitoring for the next review cycle.');
        break;
      default:
        recommendations.push('Maintain standard monitoring cadence.');
        break;
    }

    return Array.from(new Set(recommendations));
  }
}

export const transactionMonitoringService = new TransactionMonitoringService();
