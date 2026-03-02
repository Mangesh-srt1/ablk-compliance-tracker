/**
 * P2P Trading Compliance Service
 * Addresses risks from custodian-bypassing P2P token transfers on PE/RWA platforms
 *
 * Problem: When Company X transfers tokens to Company Y and Company Y sells on the
 * platform, converting to fiat - this enables hawala-style laundering, terrorism
 * financing, trafficking, and sanctions evasion.
 *
 * Mitigation approach (per compliance Q&A):
 * - Token layering detection (rapid hop chains: X → Y → Z → sell)
 * - Custodian bypass flagging
 * - Real-time AML screening on P2P transfers
 * - Fiat ramp enforcement (all settlements routed through platform)
 * - ERC-1400 compliant transfer restriction hooks
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface P2PTransferRequest {
  requestId?: string;
  fromAddress: string;
  toAddress: string;
  tokenId: string;
  amount: number;
  amountUSD: number;
  jurisdiction: string;
  isCustodianInvolved: boolean;        // Whether custodian is routing this transfer
  transactionHash?: string;
  timestamp?: Date;
}

export interface P2PScreeningResult {
  requestId: string;
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  riskScore: number;
  custodianBypassed: boolean;
  layeringRisk: LayeringRiskResult;
  hawalaSuspicion: HawalaRiskResult;
  sanctionsRisk: SanctionsRiskResult;
  reasoning: string;
  requiredActions: string[];
  timestamp: Date;
}

export interface LayeringRiskResult {
  detected: boolean;
  hopCount: number;          // Number of hops in the chain for this token
  rapidResaleRisk: boolean;  // Recipient has pattern of quick reselling
  score: number;
  details: string;
}

export interface HawalaRiskResult {
  detected: boolean;
  score: number;
  flags: string[];
  details: string;
}

export interface SanctionsRiskResult {
  senderFlagged: boolean;
  recipientFlagged: boolean;
  score: number;
  details: string;
}

export interface TransferRecord {
  fromAddress: string;
  toAddress: string;
  tokenId: string;
  amount: number;
  amountUSD: number;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory transfer history (replace with DB in production)
// ─────────────────────────────────────────────────────────────────────────────

// Note: These are instance properties (see constructor) so each service instance
// has isolated state - enabling proper unit test isolation and DI patterns.

// ─────────────────────────────────────────────────────────────────────────────
// P2P Trading Compliance Service
// ─────────────────────────────────────────────────────────────────────────────

export class P2PTradingComplianceService {
  private transferHistory: Map<string, TransferRecord[]>;
  private knownSanctionedAddresses: Set<string>;
  private custodianWhitelist: Set<string>;

  constructor() {
    this.transferHistory = new Map<string, TransferRecord[]>();
    this.knownSanctionedAddresses = new Set<string>();
    this.custodianWhitelist = new Set<string>();
  }
  /**
   * Screen a P2P transfer for compliance risks
   *
   * Key scenario (from compliance Q&A):
   * Company X transfers tokens to Company Y → Company Y sells on platform → fiat proceeds
   * This pattern enables hawala, trafficking, sanctions evasion
   */
  async screenP2PTransfer(request: P2PTransferRequest): Promise<P2PScreeningResult> {
    const requestId = request.requestId || uuidv4();
    const startTime = Date.now();

    logger.info('P2P transfer screening started', {
      requestId,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
      tokenId: request.tokenId,
      isCustodianInvolved: request.isCustodianInvolved,
    });

    // Run all screening checks in parallel for performance
    const [layeringRisk, hawalaSuspicion, sanctionsRisk] = await Promise.all([
      this.detectLayeringPattern(request),
      this.detectHawalaPattern(request),
      this.checkSanctionsRisk(request),
    ]);

    const custodianBypassed = !request.isCustodianInvolved;

    // Calculate composite risk score
    const riskScore = this.calculateP2PRiskScore({
      custodianBypassed,
      layeringRisk,
      hawalaSuspicion,
      sanctionsRisk,
    });

    // Determine decision and required actions
    const { status, reasoning, requiredActions } = this.makeP2PDecision(riskScore, {
      custodianBypassed,
      layeringRisk,
      hawalaSuspicion,
      sanctionsRisk,
    });

    const result: P2PScreeningResult = {
      requestId,
      status,
      riskScore,
      custodianBypassed,
      layeringRisk,
      hawalaSuspicion,
      sanctionsRisk,
      reasoning,
      requiredActions,
      timestamp: new Date(),
    };

    // Record the transfer in history for future layering detection
    this.recordTransfer(request);

    logger.info('P2P transfer screening completed', {
      requestId,
      status,
      riskScore,
      custodianBypassed,
      layeringDetected: layeringRisk.detected,
      hawalaDetected: hawalaSuspicion.detected,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Detect token layering patterns
   * Classic pattern: X → Y → Z → sell platform
   * Red flags: recipient immediately resells, multiple hops in short time, no economic purpose
   */
  async detectLayeringPattern(request: P2PTransferRequest): Promise<LayeringRiskResult> {
    const recipientHistory = this.transferHistory.get(request.toAddress.toLowerCase()) || [];
    const now = request.timestamp || new Date();

    // Count recent outbound transfers (suggesting rapid resale)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentResales = recipientHistory.filter(
      (tx) => tx.fromAddress.toLowerCase() === request.toAddress.toLowerCase() &&
        tx.timestamp > oneHourAgo
    );

    const rapidResaleRisk = recentResales.length > 0;

    // Count inbound transfers to sender (how many hops before this)
    const senderHistory = this.transferHistory.get(request.fromAddress.toLowerCase()) || [];
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentInboundToSender = senderHistory.filter(
      (tx) => tx.toAddress.toLowerCase() === request.fromAddress.toLowerCase() &&
        tx.tokenId === request.tokenId &&
        tx.timestamp > twentyFourHoursAgo
    );

    // Hop count: how many recent receives before this transfer
    const hopCount = recentInboundToSender.length;

    // Risk increases with more hops and rapid resale
    let score = 0;
    if (hopCount >= 3) score += 40;
    else if (hopCount >= 1) score += 20;
    if (rapidResaleRisk) score += 35;

    // Flag if no economic holding period (received and forwarding immediately)
    const receivedRecently = senderHistory.some(
      (tx) => tx.toAddress.toLowerCase() === request.fromAddress.toLowerCase() &&
        tx.tokenId === request.tokenId &&
        tx.timestamp > new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes
    );
    if (receivedRecently) score += 25;

    const detected = score >= 30;

    return {
      detected,
      hopCount,
      rapidResaleRisk,
      score: Math.min(100, score),
      details: detected
        ? `Token layering suspected: ${hopCount} inbound hop(s) before transfer, rapid resale: ${rapidResaleRisk}`
        : `No layering pattern detected (${hopCount} recent hops)`,
    };
  }

  /**
   * Detect hawala-style money laundering via token transfers
   * Pattern: Dirty fiat → tokens → sell tokens → clean fiat
   * Also: token transfers to avoid fiat trail (terrorism financing, trafficking)
   */
  async detectHawalaPattern(request: P2PTransferRequest): Promise<HawalaRiskResult> {
    const flags: string[] = [];
    let score = 0;

    // Custodian bypass is the primary enabler of hawala via tokens
    if (!request.isCustodianInvolved) {
      flags.push('CUSTODIAN_BYPASSED');
      score += 25;
    }

    // Large P2P transfers without custodian: high structuring risk
    if (request.amountUSD >= 10000 && !request.isCustodianInvolved) {
      flags.push('LARGE_P2P_TRANSFER_NO_CUSTODIAN');
      score += 20;
    }

    // Very large transfers to different jurisdiction (cross-border hawala)
    if (request.amountUSD >= 50000) {
      flags.push('HIGH_VALUE_P2P_TRANSFER');
      score += 15;
    }

    // Check for velocity: multiple transfers to same recipient (structuring below threshold)
    const recipientHistory = this.transferHistory.get(request.toAddress.toLowerCase()) || [];
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransfersToSameRecipient = recipientHistory.filter(
      (tx) => tx.fromAddress.toLowerCase() === request.fromAddress.toLowerCase() &&
        tx.timestamp > last24h
    );
    if (recentTransfersToSameRecipient.length >= 3) {
      flags.push('VELOCITY_STRUCTURING_PATTERN');
      score += 30;
    }

    // Check for round-number amounts (often used in hawala)
    const amountUSD = request.amountUSD;
    const isRoundNumber = amountUSD > 0 && amountUSD % 1000 === 0;
    if (isRoundNumber && amountUSD >= 5000 && !request.isCustodianInvolved) {
      flags.push('ROUND_NUMBER_P2P_TRANSFER');
      score += 10;
    }

    const detected = score >= 25 || flags.includes('CUSTODIAN_BYPASSED') && flags.length >= 2;

    return {
      detected,
      score: Math.min(100, score),
      flags,
      details: detected
        ? `Hawala/illicit pattern suspected. Flags: ${flags.join(', ')}`
        : 'No hawala pattern detected',
    };
  }

  /**
   * Check sender and recipient against sanctions lists
   * P2P transfers enable sanctions evasion (flagged entity transfers to nominee, nominee sells)
   */
  async checkSanctionsRisk(request: P2PTransferRequest): Promise<SanctionsRiskResult> {
    const senderFlagged = this.knownSanctionedAddresses.has(request.fromAddress.toLowerCase());
    const recipientFlagged = this.knownSanctionedAddresses.has(request.toAddress.toLowerCase());

    let score = 0;
    if (senderFlagged) score += 100;
    if (recipientFlagged) score += 100;

    return {
      senderFlagged,
      recipientFlagged,
      score: Math.min(100, score),
      details: senderFlagged || recipientFlagged
        ? `Sanctions match: sender=${senderFlagged}, recipient=${recipientFlagged}`
        : 'No sanctions matches',
    };
  }

  /**
   * Add address to known sanctioned list
   * In production, this is populated from OFAC/UN/DFSA feeds
   */
  addSanctionedAddress(address: string): void {
    this.knownSanctionedAddresses.add(address.toLowerCase());
  }

  /**
   * Register a custodian address (custodian-routed transfers are lower risk)
   */
  addCustodianAddress(address: string): void {
    this.custodianWhitelist.add(address.toLowerCase());
    logger.info('Custodian address registered', { address });
  }

  /**
   * Check if an address is a registered custodian
   */
  isCustodian(address: string): boolean {
    return this.custodianWhitelist.has(address.toLowerCase());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private recordTransfer(request: P2PTransferRequest): void {
    const record: TransferRecord = {
      fromAddress: request.fromAddress.toLowerCase(),
      toAddress: request.toAddress.toLowerCase(),
      tokenId: request.tokenId,
      amount: request.amount,
      amountUSD: request.amountUSD,
      timestamp: request.timestamp || new Date(),
    };

    // Record for sender's outbound history
    const fromKey = request.fromAddress.toLowerCase();
    if (!this.transferHistory.has(fromKey)) {
      this.transferHistory.set(fromKey, []);
    }
    this.transferHistory.get(fromKey)!.push(record);

    // Record for recipient's inbound history
    const toKey = request.toAddress.toLowerCase();
    if (!this.transferHistory.has(toKey)) {
      this.transferHistory.set(toKey, []);
    }
    this.transferHistory.get(toKey)!.push(record);
  }

  private calculateP2PRiskScore(factors: {
    custodianBypassed: boolean;
    layeringRisk: LayeringRiskResult;
    hawalaSuspicion: HawalaRiskResult;
    sanctionsRisk: SanctionsRiskResult;
  }): number {
    // Sanctions match is a hard maximum - always return 100
    if (factors.sanctionsRisk.senderFlagged || factors.sanctionsRisk.recipientFlagged) {
      return 100;
    }

    const weights = {
      custodianBypass: 0.15,
      layering: 0.30,
      hawala: 0.30,
      sanctions: 0.25,
    };

    let score = 0;
    if (factors.custodianBypassed) score += 30 * weights.custodianBypass;
    score += factors.layeringRisk.score * weights.layering;
    score += factors.hawalaSuspicion.score * weights.hawala;
    score += factors.sanctionsRisk.score * weights.sanctions;

    return Math.min(100, Math.round(score));
  }

  private makeP2PDecision(
    riskScore: number,
    factors: {
      custodianBypassed: boolean;
      layeringRisk: LayeringRiskResult;
      hawalaSuspicion: HawalaRiskResult;
      sanctionsRisk: SanctionsRiskResult;
    }
  ): { status: 'APPROVED' | 'REJECTED' | 'ESCALATED'; reasoning: string; requiredActions: string[] } {
    const requiredActions: string[] = [];

    // Hard rejection: sanctions match
    if (factors.sanctionsRisk.senderFlagged || factors.sanctionsRisk.recipientFlagged) {
      requiredActions.push('File SAR immediately');
      requiredActions.push('Freeze token transfer');
      requiredActions.push('Notify compliance officer');
      return {
        status: 'REJECTED',
        reasoning: 'Transfer rejected: sanctions match detected. Possible sanctions evasion via P2P token transfer.',
        requiredActions,
      };
    }

    // Hard rejection: confirmed layering with hawala pattern
    if (factors.layeringRisk.detected && factors.hawalaSuspicion.detected && riskScore >= 70) {
      requiredActions.push('File SAR');
      requiredActions.push('Escalate to AML compliance team');
      requiredActions.push('Block token transfer pending investigation');
      return {
        status: 'REJECTED',
        reasoning: `Transfer rejected: combined layering and hawala pattern detected. Risk score: ${riskScore}. This matches the token-based money laundering pattern where entities transfer tokens to nominees for fiat conversion.`,
        requiredActions,
      };
    }

    // Escalation: custodian bypass + elevated risk
    if (factors.custodianBypassed && riskScore >= 25) {
      requiredActions.push('Route settlement through custodian platform');
      requiredActions.push('Require enhanced KYC documentation from both parties');
      requiredActions.push('Document transfer purpose with compliance officer');
      return {
        status: 'ESCALATED',
        reasoning: `Transfer escalated: custodian bypass detected with elevated risk score ${riskScore}. Per platform policy, high-value P2P transfers must route fiat settlements through custodian for AML oversight.`,
        requiredActions,
      };
    }

    // Escalation: medium risk
    if (riskScore >= 30) {
      if (factors.custodianBypassed) {
        requiredActions.push('Recommend routing through custodian for settlement');
      }
      requiredActions.push('Enhanced monitoring for 30 days');
      return {
        status: 'ESCALATED',
        reasoning: `Transfer escalated for compliance review. Risk score: ${riskScore}. Requires manual compliance officer review before settlement.`,
        requiredActions,
      };
    }

    // Approval: low risk
    if (factors.custodianBypassed) {
      requiredActions.push('Log transfer for 90-day monitoring window');
    }
    return {
      status: 'APPROVED',
      reasoning: `Transfer approved. Risk score ${riskScore} is within acceptable range. ${factors.custodianBypassed ? 'Note: transfer does not involve custodian - enhanced monitoring applied.' : 'Custodian-routed transfer.'}`,
      requiredActions,
    };
  }
}

export default new P2PTradingComplianceService();
