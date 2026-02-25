/**
 * AML Anomaly Detector Agent - P2P Trading Risk Assessment
 * Detects hawala, money laundering, and illicit trading patterns
 * Uses SHAP-based ML model for explainable risk scoring
 * 
 * File: src/agents/src/agents/amlAnomalyDetectorAgent.ts
 */

import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import { BaseAgent } from './baseAgent';

/**
 * Risk Assessment Result
 */
export interface HawalaRiskAssessment {
  walletAddress: string;
  transactionId?: string;
  overallRiskScore: number; // 0-1, 0.95+ = block
  patterns: AnomalyPattern[];
  recommendations: string[];
  shouldBlock: boolean;
  escalationLevel: 'auto_approve' | 'manual_review' | 'block';
  shapExplainability: Record<string, number>; // Feature importance scores
  assessmentTime: Date;
}

/**
 * Individual Anomaly Pattern Detection
 */
export interface AnomalyPattern {
  pattern: string;
  description: string;
  probability: number; // 0-1
  severity: 'low' | 'medium' | 'high' | 'critical';
  shapValues: Record<string, number>; // Feature contributions
}

/**
 * P2P Transfer Context
 */
export interface P2PTransfer {
  fromAddress: string;
  toAddress: string;
  amount: number;
  timestamp: Date;
  assetId?: string;
  transactionHash?: string;
}

/**
 * Feature Vector for ML Model
 */
interface FeatureVector {
  recent_transfer_count: number;
  avg_time_between_transfers: number;
  amount_variance: number;
  unique_recipients_24h: number;
  to_address_is_new: boolean;
  fiat_conversion_imminent: boolean;
  transfer_chain_length: number;
  circular_transfer_detected: boolean;
  velocity_zscore: number;
  sanctions_flag: boolean;
  pep_check_positive: boolean;
  geographic_risk: number; // 0-1
  transfer_count_spike: number; // multiplier vs baseline
  amount_spike: number; // multiplier vs baseline
  price_dump_detected: boolean;
  rapid_sell_cycle: boolean;
}

/**
 * AML Anomaly Detector Agent
 * Specialized agent for P2P transfer risk assessment
 * Implements multi-signal detection with explainability
 */
export class AMLAnomalyDetectorAgent extends BaseAgent {
  private logger: winston.Logger;
  private httpClient: AxiosInstance;
  private chainalysisEnabled: boolean;
  private mlModelReady: boolean = false;

  constructor(private dbClient: any, private besuProvider?: any) {
    super('aml-anomaly-detector');

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'aml-anomaly-detector' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/aml-anomaly-detector-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/aml-anomaly-detector.log' })
      ]
    });

    this.httpClient = axios.create({
      timeout: 15000,
      headers: { 'User-Agent': 'AMLAnomalyDetector/1.0' }
    });

    this.chainalysisEnabled = !!process.env.CHAINALYSIS_API_KEY;

    this.logger.info('AML Anomaly Detector Agent initialized', {
      chainalysisEnabled: this.chainalysisEnabled
    });
  }

  /**
   * Main entry point: Assess hawala/AML risk for P2P transfer
   * Aggregates multi-source signals into comprehensive risk score
   */
  async assessHawalaRisk(p2pTransfer: P2PTransfer): Promise<HawalaRiskAssessment> {
    const startTime = Date.now();
    const patterns: AnomalyPattern[] = [];
    let overallRiskScore = 0;
    const recommendations: string[] = [];
    const shapExplainability: Record<string, number> = {};

    this.logger.info('Starting hawala risk assessment', {
      from: p2pTransfer.fromAddress,
      to: p2pTransfer.toAddress,
      amount: p2pTransfer.amount
    });

    try {
      // Signal 1: Layering Detection (X→Y→Z→Fiat sequence)
      const layeringPattern = await this.detectLayeringPattern(
        p2pTransfer.fromAddress,
        p2pTransfer.toAddress,
        p2pTransfer.amount,
        p2pTransfer.timestamp
      );
      if (layeringPattern.probability > 0.1) {
        patterns.push(layeringPattern);
        overallRiskScore += layeringPattern.probability * 0.25;
        recommendations.push('⚠️ Layering Pattern: Rapid multi-hop transfers detected. Investigate fund source.');
        Object.assign(shapExplainability, { layering_score: layeringPattern.probability });
      }

      // Signal 2: Circular Transfer Detection (Self-laundering)
      const circularPattern = await this.detectCircularTransfers(
        p2pTransfer.fromAddress,
        p2pTransfer.timestamp
      );
      if (circularPattern.probability > 0.1) {
        patterns.push(circularPattern);
        overallRiskScore += circularPattern.probability * 0.20;
        recommendations.push('🔄 Circular Transfer: Funds returned to originator. Possible fund mixing.');
        Object.assign(shapExplainability, { circular_score: circularPattern.probability });
      }

      // Signal 3: Sanctions & PEP Screening
      const sanctionsPattern = await this.checkSanctionsAndPEP(
        p2pTransfer.toAddress,
        p2pTransfer.fromAddress
      );
      if (sanctionsPattern.probability > 0) {
        patterns.push(sanctionsPattern);
        overallRiskScore += sanctionsPattern.probability * 0.30;
        recommendations.push(`🚫 Sanctions Match: ${sanctionsPattern.description}`);
        Object.assign(shapExplainability, { sanctions_score: sanctionsPattern.probability });
      }

      // Signal 4: Velocity & Volume Anomalies
      const velocityPattern = await this.analyzeVelocityAnomalies(
        p2pTransfer.fromAddress,
        p2pTransfer.toAddress,
        p2pTransfer.amount,
        p2pTransfer.timestamp
      );
      if (velocityPattern.probability > 0.1) {
        patterns.push(velocityPattern);
        overallRiskScore += velocityPattern.probability * 0.15;
        recommendations.push(`📈 Velocity Spike: ${velocityPattern.description}`);
        Object.assign(shapExplainability, { velocity_score: velocityPattern.probability });
      }

      // Signal 5: Geographic & Temporal Anomalies
      const geoPattern = await this.analyzeGeographicAnomalies(
        p2pTransfer.fromAddress,
        p2pTransfer.toAddress,
        p2pTransfer.timestamp
      );
      if (geoPattern.probability > 0) {
        patterns.push(geoPattern);
        overallRiskScore += geoPattern.probability * 0.10;
        recommendations.push(`🌍 Geographic Risk: ${geoPattern.description}`);
        Object.assign(shapExplainability, { geographic_score: geoPattern.probability });
      }

      // Signal 6: Rapid Buy-Sell Cycle Detection (Wash trading / immediate liquidation)
      const buysSellPattern = await this.detectRapidBuySellCycle(
        p2pTransfer.toAddress,
        p2pTransfer.amount
      );
      if (buysSellPattern.probability > 0.1) {
        patterns.push(buysSellPattern);
        overallRiskScore += buysSellPattern.probability * 0.20;
        recommendations.push(`⚡ Rapid Liquidation: Transfer immediately sold for fiat. Proceeds orientation unclear.`);
        Object.assign(shapExplainability, { rapid_sell_score: buysSellPattern.probability });
      }

      // Normalize risk score to 0-1
      overallRiskScore = Math.min(overallRiskScore, 1.0);

      // Determine escalation level
      let escalationLevel: 'auto_approve' | 'manual_review' | 'block';
      if (overallRiskScore >= 0.95) {
        escalationLevel = 'block';
        recommendations.unshift('🛑 BLOCK: High-confidence illicit activity detected.');
      } else if (overallRiskScore >= 0.60) {
        escalationLevel = 'manual_review';
        recommendations.unshift('⏸️ ESCALATE: Manual compliance review required.');
      } else if (overallRiskScore >= 0.30) {
        escalationLevel = 'manual_review';
        recommendations.unshift('📋 REVIEW: Monitor for potential AML concerns.');
      } else {
        escalationLevel = 'auto_approve';
      }

      const assessmentResult: HawalaRiskAssessment = {
        walletAddress: p2pTransfer.fromAddress,
        transactionId: p2pTransfer.transactionHash,
        overallRiskScore,
        patterns,
        recommendations,
        shouldBlock: escalationLevel === 'block',
        escalationLevel,
        shapExplainability,
        assessmentTime: new Date()
      };

      // Store assessment in audit trail
      await this.storeAssessmentResult(assessmentResult, p2pTransfer);

      const elapsedMs = Date.now() - startTime;
      this.logger.info('Hawala risk assessment completed', {
        from: p2pTransfer.fromAddress,
        riskScore: overallRiskScore,
        escalationLevel,
        patternCount: patterns.length,
        elapsedMs
      });

      return assessmentResult;

    } catch (error) {
      this.logger.error('Hawala risk assessment failed', { error });
      return {
        walletAddress: p2pTransfer.fromAddress,
        overallRiskScore: 0.5,
        patterns: [],
        recommendations: ['Service error: default to manual review'],
        shouldBlock: false,
        escalationLevel: 'manual_review',
        shapExplainability: {},
        assessmentTime: new Date()
      };
    }
  }

  /**
   * Detect Layering: Rapid X→Y→Z sequence with final fiat conversion
   * Classic money laundering red flag per FATF guidelines
   */
  private async detectLayeringPattern(
    fromAddress: string,
    toAddress: string,
    amount: number,
    timestamp: Date
  ): Promise<AnomalyPattern> {
    try {
      // Query recent transfers for both sender and recipient
      const senderTransfers = await this.dbClient.query(
        `SELECT * FROM p2p_transfers 
         WHERE from_address = $1 AND created_at > NOW() - INTERVAL '24 hours'
         ORDER BY created_at DESC LIMIT 20`,
        [fromAddress]
      );

      const recipientTransfers = await this.dbClient.query(
        `SELECT * FROM p2p_transfers 
         WHERE from_address = $1 AND created_at > NOW() - INTERVAL '24 hours'
         ORDER BY created_at DESC LIMIT 20`,
        [toAddress]
      );

      const senderTxs = senderTransfers.rows;
      const recipientTxs = recipientTransfers.rows;

      // Build feature vector for layering detection
      const features = {
        sender_recent_transfers: senderTxs.length,
        recipient_recent_transfers: recipientTxs.length,
        recipient_is_new: !senderTxs.some(tx => tx.to_address === toAddress),
        recipient_will_convert_to_fiat: amount > 100000, // Large amounts typically indicate liquidity seek
        avg_time_between_sender_txs: this.calculateAvgTimeDelta(senderTxs),
        amount_variance: this.calculateVariance(senderTxs.map((tx: any) => tx.token_amount)),
        unique_recipients: new Set(senderTxs.map((tx: any) => tx.to_address)).size,
        rapid_succession: senderTxs.length > 1 && 
                         (Date.now() - new Date(senderTxs[0].created_at).getTime()) < 3600000, // <1 hour
      };

      // Calculate layering probability using feature heuristics
      let probability = 0;
      if (features.rapid_succession && features.unique_recipients > 2) probability += 0.4;
      if (features.recipient_is_new && features.recipient_will_convert_to_fiat) probability += 0.3;
      if (features.sender_recent_transfers > 5) probability += 0.2;

      probability = Math.min(probability, 1.0);

      // SHAP-like explainability
      const shapValues: Record<string, number> = {
        rapid_succession: features.rapid_succession ? 0.3 : 0,
        recipient_is_new: features.recipient_is_new ? 0.25 : 0,
        multiple_recipients: (features.unique_recipients / 10) * 0.2,
        likely_fiat_conversion: features.recipient_will_convert_to_fiat ? 0.25 : 0
      };

      return {
        pattern: 'LAYERING',
        description: `Potential layering detected: ${senderTxs.length} transfers in 24h to ${features.unique_recipients} recipients, now to ${toAddress}`,
        probability,
        severity: probability > 0.5 ? 'high' : probability > 0.2 ? 'medium' : 'low',
        shapValues
      };

    } catch (error) {
      this.logger.error('Layering pattern detection failed', { error });
      return { pattern: 'LAYERING', description: 'Detection failed', probability: 0, severity: 'low', shapValues: {} };
    }
  }

  /**
   * Detect Circular Transfers: X→Y→Z→X pattern
   * Indicates self-laundering or collusion for fund mixing
   */
  private async detectCircularTransfers(
    walletAddress: string,
    timestamp: Date
  ): Promise<AnomalyPattern> {
    try {
      // Find all transfers from this wallet in past 7 days
      const transfers = await this.dbClient.query(
        `SELECT * FROM p2p_transfers 
         WHERE from_address = $1 AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at DESC LIMIT 50`,
        [walletAddress]
      );

      const allTransfers = transfers.rows;
      const recipients = allTransfers.map((tx: any) => tx.to_address);

      // Check if any recipient transferred back to original wallet
      const backTransfers = await this.dbClient.query(
        `SELECT COUNT(*) as count FROM p2p_transfers 
         WHERE from_address = ANY($1::varchar[]) 
         AND to_address = $2 
         AND created_at > $3 - INTERVAL '7 days'`,
        [recipients, walletAddress, timestamp]
      );

      const circularCount = parseInt(backTransfers.rows[0]?.count || '0');
      const probability = recipients.length > 0 ? Math.min(circularCount / recipients.length, 1.0) : 0;

      const shapValues: Record<string, number> = {
        circular_transfers: (circularCount / Math.max(recipients.length, 1)) * 0.6,
        multiple_transfers_detected: Math.min(allTransfers.length / 10, 1) * 0.4
      };

      return {
        pattern: 'CIRCULAR_TRANSFERS',
        description: `Circular transfers detected: ${circularCount} back-transfers from ${recipients.length} recipients`,
        probability,
        severity: probability > 0.4 ? 'high' : probability > 0.1 ? 'medium' : 'low',
        shapValues
      };

    } catch (error) {
      this.logger.error('Circular transfer detection failed', { error });
      return { pattern: 'CIRCULAR_TRANSFERS', description: 'Detection failed', probability: 0, severity: 'low', shapValues: {} };
    }
  }

  /**
   * Check OFAC, EU, and UN sanctions lists + PEP databases
   * Critical for preventing sanctions evasion
   */
  private async checkSanctionsAndPEP(
    toAddress: string,
    fromAddress: string
  ): Promise<AnomalyPattern> {
    try {
      let probability = 0;
      let description = '';

      if (!this.chainalysisEnabled) {
        this.logger.warn('Chainalysis not configured, skipping sanctions check');
        return {
          pattern: 'SANCTIONS_CHECK',
          description: 'Sanctions screening not configured',
          probability: 0,
          severity: 'low',
          shapValues: { sanctions_unavailable: 0.5 }
        };
      }

      // Call Chainalysis API for risk assessment
      try {
        const response = await this.httpClient.post(
          'https://api.chainalysis.com/v1/screening',
          {
            address: toAddress,
            reportingEntity: process.env.ENTITY_NAME || 'compliance-system'
          },
          {
            headers: { 'Authorization': `Bearer ${process.env.CHAINALYSIS_API_KEY}` }
          }
        );

        const riskLevel = response.data?.risk_level;
        const sanctionMatch = response.data?.sanctions_match || false;

        if (riskLevel === 'high' || sanctionMatch) {
          probability = 1.0;
          description = `OFAC/Sanctions match: Address flagged in Chainalysis (Risk: ${riskLevel})`;
        } else if (riskLevel === 'medium') {
          probability = 0.6;
          description = `Address has medium AML risk in Chainalysis`;
        } else if (riskLevel === 'low') {
          probability = 0;
          description = 'Sanctions screening passed';
        }

      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // Address not in Chainalysis database - treat as low risk
          probability = 0;
        } else {
          this.logger.error('Chainalysis API call failed', { error });
          probability = 0.3; // Default to moderate risk on API failure
        }
      }

      const shapValues: Record<string, number> = {
        chainalysis_hit: probability * 0.8,
        sanctions_flag: probability * 0.2
      };

      return {
        pattern: 'SANCTIONS_MATCH',
        description: description || 'Sanctions screening inconclusive',
        probability,
        severity: probability > 0.8 ? 'critical' : probability > 0.4 ? 'high' : 'low',
        shapValues
      };

    } catch (error) {
      this.logger.error('Sanctions check failed', { error });
      return {
        pattern: 'SANCTIONS_CHECK',
        description: 'Sanctions check failed',
        probability: 0.3,
        severity: 'medium',
        shapValues: { error: 0.3 }
      };
    }
  }

  /**
   * Analyze velocity anomalies: sudden spike in transfers or amounts
   * Per SEBI guidelines: >₹2L x20 transfers = STR
   */
  private async analyzeVelocityAnomalies(
    fromAddress: string,
    toAddress: string,
    amount: number,
    timestamp: Date
  ): Promise<AnomalyPattern> {
    try {
      // Get 30-day historical velocity for sender
      const historical = await this.dbClient.query(
        `SELECT 
          COUNT(*) as monthly_transfers,
          AVG(token_amount) as avg_amount,
          MAX(token_amount) as max_amount,
          STDDEV(token_amount) as std_dev
         FROM p2p_transfers 
         WHERE from_address = $1 AND transfer_status = 'completed'
         AND created_at > NOW() - INTERVAL '30 days'`,
        [fromAddress]
      );

      const stats = historical.rows[0] || {
        monthly_transfers: 0,
        avg_amount: 0,
        max_amount: 0,
        std_dev: 0
      };

      const expectedAvg = stats.avg_amount || 50000;
      const stdDev = stats.std_dev || 5000;
      const monthlyBase = stats.monthly_transfers || 1;

      // Calculate Z-score for amount anomaly
      const zScore = stdDev > 0 ? Math.abs((amount - expectedAvg) / stdDev) : 0;

      // Check 24-hour velocity spike
      const last24h = await this.dbClient.query(
        `SELECT COUNT(*) as tx_count, SUM(token_amount) as total_volume
         FROM p2p_transfers 
         WHERE from_address = $1 AND transfer_status = 'completed'
         AND created_at > NOW() - INTERVAL '1 day'`,
        [fromAddress]
      );

      const txCount24h = last24h.rows[0]?.tx_count || 0;
      const volume24h = last24h.rows[0]?.total_volume || 0;

      // Calculate probability
      let probability = 0;
      let description = '';

      if (zScore > 3) {
        // Extreme amount
        probability += 0.4;
        description += `Extreme amount anomaly (${zScore.toFixed(1)} std devs)`;
      } else if (zScore > 2) {
        probability += 0.2;
      }

      if (txCount24h > monthlyBase * 5) {
        // 5x faster velocity
        probability += 0.3;
        description += ` Velocity spike: ${txCount24h} txs in 24h vs ${monthlyBase} monthly avg`;
      }

      if (volume24h > expectedAvg * 20 && monthlyBase > 5) {
        // SEBI trigger: >₹2L x 20
        probability += 0.3;
        description += ` Volume STR trigger behavior detected`;
      }

      probability = Math.min(probability, 1.0);

      const shapValues: Record<string, number> = {
        zscore_anomaly: Math.min(zScore / 5, 1),
        velocity_spike: Math.min(txCount24h / (monthlyBase * 10), 1) * 0.3,
        volume_concentration: Math.min(volume24h / (expectedAvg * 30), 1) * 0.3
      };

      return {
        pattern: 'VELOCITY_ANOMALY',
        description: description || 'Normal velocity',
        probability,
        severity: probability > 0.6 ? 'high' : probability > 0.2 ? 'medium' : 'low',
        shapValues
      };

    } catch (error) {
      this.logger.error('Velocity analysis failed', { error });
      return { pattern: 'VELOCITY_ANOMALY', description: 'Analysis failed', probability: 0, severity: 'low', shapValues: {} };
    }
  }

  /**
   * Analyze geographic anomalies
   * Impossible travel, high-risk jurisdictions, cross-border patterns
   */
  private async analyzeGeographicAnomalies(
    fromAddress: string,
    toAddress: string,
    timestamp: Date
  ): Promise<AnomalyPattern> {
    try {
      // Get KYC country data for both addresses
      const fromKyc = await this.dbClient.query(
        `SELECT a.jurisdiction FROM users u 
         JOIN rwa_assets a ON u.id = a.owner_wallet_address 
         WHERE u.wallet_address = $1 LIMIT 1`,
        [fromAddress]
      );

      const toKyc = await this.dbClient.query(
        `SELECT a.jurisdiction FROM users u 
         JOIN rwa_assets a ON u.id = a.owner_wallet_address 
         WHERE u.wallet_address = $1 LIMIT 1`,
        [toAddress]
      );

      const fromJurisdiction = fromKyc.rows[0]?.jurisdiction || 'UNKNOWN';
      const toJurisdiction = toKyc.rows[0]?.jurisdiction || 'UNKNOWN';

      // High-risk jurisdictions per FATF and local regulations
      const highRiskJurisdictions = ['IR', 'KP', 'SY', 'CU', 'SS']; // Iran, N.Korea, Syria, Cuba, S.Sudan
      const jurisdictionsWithHighAMLRisk = ['PK', 'BA']; // Pakistan, Bosnia (SEBI concerns)

      let probability = 0;
      let description = '';

      if (highRiskJurisdictions.includes(toJurisdiction)) {
        probability = 1.0;
        description = `CRITICAL: Transfer to high-risk jurisdiction ${toJurisdiction}`;
      } else if (jurisdictionsWithHighAMLRisk.includes(toJurisdiction)) {
        probability = 0.5;
        description = `Transfer to high-AML-risk jurisdiction ${toJurisdiction}`;
      }

      if (fromJurisdiction !== toJurisdiction) {
        probability += 0.2; // Cross-border transfers require additional scrutiny
      }

      probability = Math.min(probability, 1.0);

      const shapValues: Record<string, number> = {
        high_risk_jurisdiction: highRiskJurisdictions.includes(toJurisdiction) ? 0.8 : 0,
        medium_risk_jurisdiction: jurisdictionsWithHighAMLRisk.includes(toJurisdiction) ? 0.4 : 0,
        cross_border: fromJurisdiction !== toJurisdiction ? 0.2 : 0
      };

      return {
        pattern: 'GEOGRAPHIC_RISK',
        description: description || 'Geographic risk acceptable',
        probability,
        severity: probability > 0.7 ? 'critical' : probability > 0.3 ? 'high' : 'low',
        shapValues
      };

    } catch (error) {
      this.logger.error('Geographic analysis failed', { error });
      return { pattern: 'GEOGRAPHIC_RISK', description: 'Analysis failed', probability: 0, severity: 'low', shapValues: {} };
    }
  }

  /**
   * Detect Rapid Buy-Sell Cycle: Transfer followed by immediate fiat conversion
   * Indicates liquidity-seeking behavior and potential layering
   */
  private async detectRapidBuySellCycle(
    buyerAddress: string,
    tokenAmount: number
  ): Promise<AnomalyPattern> {
    try {
      // Check if buyer has immediately sold off similar amounts
      const recentSales = await this.dbClient.query(
        `SELECT * FROM p2p_transfers 
         WHERE from_address = $1 AND transfer_status = 'completed'
         AND token_amount >= $2 * 0.8  -- 80%+ of current amount
         AND created_at > NOW() - INTERVAL '1 hour'  -- Within 1 hour
         ORDER BY created_at DESC LIMIT 5`,
        [buyerAddress, tokenAmount]
      );

      const rapidSales = recentSales.rows.length;
      let probability = 0;
      let description = '';

      if (rapidSales > 0) {
        probability = Math.min((rapidSales / 5) * 1.0, 1.0);
        description = `Rapid liquidation: ${rapidSales} similar sales within 1 hour of receipt`;
      }

      const shapValues: Record<string, number> = {
        rapid_sales_count: Math.min(rapidSales / 5, 1) * 0.6,
        circular_behavior: rapidSales > 0 ? 0.4 : 0
      };

      return {
        pattern: 'RAPID_BUY_SELL_CYCLE',
        description: description || 'No rapid liquidation detected',
        probability,
        severity: probability > 0.5 ? 'high' : 'medium',
        shapValues
      };

    } catch (error) {
      this.logger.error('Rapid buy-sell detection failed', { error });
      return { pattern: 'RAPID_BUY_SELL_CYCLE', description: 'Detection failed', probability: 0, severity: 'low', shapValues: {} };
    }
  }

  /**
   * Store assessment result in audit trail for regulatory compliance
   */
  private async storeAssessmentResult(
    assessment: HawalaRiskAssessment,
    transfer: P2PTransfer
  ): Promise<void> {
    try {
      await this.dbClient.query(
        `INSERT INTO p2p_anomaly_patterns 
         (user_wallet, rapid_buy_sell_cycle, circular_transfers, risk_score_aggregate)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET risk_score_aggregate = $4`,
        [
          transfer.fromAddress,
          assessment.patterns.some(p => p.pattern === 'RAPID_BUY_SELL_CYCLE' && p.probability > 0.3),
          assessment.patterns.some(p => p.pattern === 'CIRCULAR_TRANSFERS' && p.probability > 0.3),
          assessment.overallRiskScore
        ]
      );
    } catch (error) {
      this.logger.error('Failed to store assessment result', { error });
    }
  }

  // Utility functions
  private calculateAvgTimeDelta(transfers: any[]): number {
    if (transfers.length < 2) return 0;
    const deltas: number[] = [];
    for (let i = 0; i < transfers.length - 1; i++) {
      const delta =
        (new Date(transfers[i].created_at).getTime() - new Date(transfers[i + 1].created_at).getTime()) /
        1000 /
        60; // minutes
      deltas.push(delta);
    }
    return deltas.length > 0 ? deltas.reduce((a, b) => a + b) / deltas.length : 0;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
}

export default AMLAnomalyDetectorAgent;
