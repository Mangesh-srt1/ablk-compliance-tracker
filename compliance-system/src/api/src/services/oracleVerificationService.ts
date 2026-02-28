/**
 * Oracle & Off-Chain Ownership Verification Service
 * Implements FR-401 to FR-403 from PE_RWA_Tokenization_FRD.md
 *
 * - Property valuation oracle integration (FR-401)
 * - Double-dipping prevention (FR-402)
 * - Source of funds verification (FR-403)
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OracleVerificationRequest {
  verificationId?: string;
  assetId: string;                       // Underlying real estate asset
  tokenContractAddress: string;
  tokenSupply: number;
  requestedTokenPriceUSD: number;        // USD per token
  jurisdiction: string;
  maxDiscrepancyPercent?: number;        // From jurisdiction config (default: 10%)
}

export interface OracleVerificationResult {
  verificationId: string;
  oracleNAV: number;                     // USD total NAV from oracle (mocked)
  impliedTokenNAV: number;               // Supply × price
  discrepancyPercent: number;
  lastValuationDate: Date;
  valuerName: string;
  compliant: boolean;
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  reasoning: string;
  timestamp: Date;
}

export interface AssetRegistrationRequest {
  assetId?: string;
  assetType: 'real_estate' | 'pe_fund' | 'reit' | 'private_credit';
  legalIdentifier: string;               // Title deed, fund reg number, land registry ID
  legalIdentifierType: 'title_deed' | 'fund_registration' | 'land_registry' | 'property_id';
  tokenContractAddress: string;
  issuerEntityId: string;
  jurisdiction: string;
  assetValueUSD: number;
  issuanceDateISO: string;
}

export interface AssetRegistrationResult {
  assetId: string;
  registered: boolean;
  status: 'REGISTERED' | 'DUPLICATE_DETECTED' | 'REJECTED';
  reasoning: string;
  uniquenessCertificateId?: string;
  timestamp: Date;
}

export interface SourceOfFundsRequest {
  verificationId?: string;
  investorId: string;
  investmentAmountUSD: number;
  jurisdiction: string;
  declaredSourceType: 'employment' | 'business' | 'investment' | 'inheritance' | 'other';
  declaredSourceDescription: string;
  bankStatementsProvided?: boolean;
  selfCertificationProvided?: boolean;
}

export interface SourceOfFundsResult {
  verificationId: string;
  confidenceScore: number;               // 0-100
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  reasoning: string;
  requiresEDD: boolean;
  flags: string[];
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory asset registry (replace with DB)
// ─────────────────────────────────────────────────────────────────────────────

const assetRegistry = new Map<string, AssetRegistrationRequest & { assetId: string; registeredAt: Date }>();

// ─────────────────────────────────────────────────────────────────────────────
// Oracle Verification Service
// ─────────────────────────────────────────────────────────────────────────────

export class OracleVerificationService {
  /**
   * FR-401: Verify on-chain token price/supply vs off-chain property valuation
   * Prevents inflated tokenization fraud
   */
  async verifyPropertyValuation(request: OracleVerificationRequest): Promise<OracleVerificationResult> {
    const verificationId = request.verificationId || uuidv4();
    const maxDiscrepancy = request.maxDiscrepancyPercent ?? 10;

    logger.info('Property valuation oracle verification started', {
      verificationId,
      assetId: request.assetId,
      tokenSupply: request.tokenSupply,
      requestedPriceUSD: request.requestedTokenPriceUSD,
    });

    // Query registered oracle NAV (in production, this calls client-provided oracle endpoint)
    const oracleNAV = await this.queryOracleNAV(request.assetId, request.jurisdiction);

    const impliedTokenNAV = request.tokenSupply * request.requestedTokenPriceUSD;
    const discrepancyPercent = oracleNAV > 0
      ? Math.abs((impliedTokenNAV - oracleNAV) / oracleNAV) * 100
      : 0;

    const compliant = discrepancyPercent <= maxDiscrepancy;

    let status: 'APPROVED' | 'REJECTED' | 'ESCALATED';
    let reasoning: string;

    if (!compliant) {
      if (discrepancyPercent > 25) {
        status = 'REJECTED';
        reasoning = `Token valuation exceeds oracle NAV by ${discrepancyPercent.toFixed(1)}% (max allowed: ${maxDiscrepancy}%). Possible inflated tokenization.`;
      } else {
        status = 'ESCALATED';
        reasoning = `Token valuation discrepancy of ${discrepancyPercent.toFixed(1)}% requires compliance officer review (threshold: ${maxDiscrepancy}%).`;
      }
    } else {
      status = 'APPROVED';
      reasoning = `Token valuation is within ${maxDiscrepancy}% of oracle NAV (actual discrepancy: ${discrepancyPercent.toFixed(1)}%).`;
    }

    const result: OracleVerificationResult = {
      verificationId,
      oracleNAV,
      impliedTokenNAV,
      discrepancyPercent,
      lastValuationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Mock: 7 days ago
      valuerName: 'JLL MENA Licensed Valuer', // Mock valuer name
      compliant,
      status,
      reasoning,
      timestamp: new Date(),
    };

    logger.info('Property valuation oracle verification completed', {
      verificationId,
      status,
      discrepancyPercent,
    });

    return result;
  }

  /**
   * FR-402: Register asset and check for duplicate tokenization (double-dipping prevention)
   */
  async registerAsset(request: AssetRegistrationRequest): Promise<AssetRegistrationResult> {
    const assetId = request.assetId || uuidv4();

    logger.info('Asset registration for double-dipping check', {
      assetId,
      legalIdentifier: request.legalIdentifier,
      tokenContractAddress: request.tokenContractAddress,
    });

    // Check for existing registration with same legal identifier
    const existingByLegalId = this.findByLegalIdentifier(request.legalIdentifier);

    if (existingByLegalId) {
      if (existingByLegalId.tokenContractAddress === request.tokenContractAddress) {
        // Same token contract - update
        return {
          assetId: existingByLegalId.assetId,
          registered: true,
          status: 'REGISTERED',
          reasoning: 'Asset already registered with this token contract. Updated registration.',
          uniquenessCertificateId: `CERT-${existingByLegalId.assetId}`,
          timestamp: new Date(),
        };
      }

      // DIFFERENT token contract - double-dipping detected!
      logger.warn('Double-dipping detected', {
        assetId,
        legalIdentifier: request.legalIdentifier,
        existingContract: existingByLegalId.tokenContractAddress,
        newContract: request.tokenContractAddress,
      });

      return {
        assetId,
        registered: false,
        status: 'DUPLICATE_DETECTED',
        reasoning: `DOUBLE-DIPPING DETECTED: Asset with legal identifier ${request.legalIdentifier} is already tokenized at contract ${existingByLegalId.tokenContractAddress}. Cannot create duplicate tokenization.`,
        timestamp: new Date(),
      };
    }

    // Check for existing registration with same token contract address
    const existingByContract = this.findByTokenContract(request.tokenContractAddress);
    if (existingByContract && existingByContract.legalIdentifier !== request.legalIdentifier) {
      return {
        assetId,
        registered: false,
        status: 'DUPLICATE_DETECTED',
        reasoning: `Token contract ${request.tokenContractAddress} is already linked to a different asset (${existingByContract.legalIdentifier}).`,
        timestamp: new Date(),
      };
    }

    // Register the asset
    assetRegistry.set(request.legalIdentifier, {
      ...request,
      assetId,
      registeredAt: new Date(),
    });

    logger.info('Asset registered successfully', { assetId, legalIdentifier: request.legalIdentifier });

    return {
      assetId,
      registered: true,
      status: 'REGISTERED',
      reasoning: `Asset ${request.legalIdentifier} successfully registered as tokenized asset. Uniqueness verified.`,
      uniquenessCertificateId: `CERT-${assetId}`,
      timestamp: new Date(),
    };
  }

  /**
   * FR-403: Verify source of funds for large investments
   * Triggered for investments > $500k USD
   */
  async verifySourceOfFunds(request: SourceOfFundsRequest): Promise<SourceOfFundsResult> {
    const verificationId = request.verificationId || uuidv4();
    const flags: string[] = [];
    let confidenceScore = 50; // Start at neutral

    logger.info('Source of funds verification', {
      verificationId,
      investorId: request.investorId,
      amountUSD: request.investmentAmountUSD,
    });

    // Check if documentation provided
    if (request.bankStatementsProvided) {
      confidenceScore += 25;
    } else {
      flags.push('BANK_STATEMENTS_NOT_PROVIDED');
      confidenceScore -= 10;
    }

    if (request.selfCertificationProvided) {
      confidenceScore += 15;
    } else {
      flags.push('SELF_CERTIFICATION_MISSING');
    }

    // Assess source type plausibility for investment amount
    const plausibilityScore = this.assessSourcePlausibility(
      request.declaredSourceType,
      request.investmentAmountUSD
    );
    confidenceScore += plausibilityScore;

    // High-value investment scrutiny
    if (request.investmentAmountUSD >= 5000000) {
      flags.push('VERY_LARGE_INVESTMENT');
      confidenceScore -= 10;
    }

    // Jurisdiction risk
    const jurisdictionRisk = this.getJurisdictionRisk(request.jurisdiction);
    confidenceScore -= jurisdictionRisk;
    if (jurisdictionRisk > 10) {
      flags.push(`HIGH_RISK_JURISDICTION_${request.jurisdiction}`);
    }

    confidenceScore = Math.max(0, Math.min(100, confidenceScore));

    let status: 'APPROVED' | 'REJECTED' | 'ESCALATED';
    let reasoning: string;
    const requiresEDD = confidenceScore < 75 || request.investmentAmountUSD >= 2000000;

    if (confidenceScore >= 75 && !requiresEDD) {
      status = 'APPROVED';
      reasoning = `Source of funds verified with confidence score ${confidenceScore}. Documentation adequate.`;
    } else if (confidenceScore >= 50) {
      status = 'ESCALATED';
      reasoning = `Source of funds verification confidence ${confidenceScore} requires Enhanced Due Diligence review.`;
    } else {
      status = 'REJECTED';
      reasoning = `Source of funds verification failed with confidence score ${confidenceScore}. Insufficient documentation for investment of $${request.investmentAmountUSD.toLocaleString()}.`;
    }

    return {
      verificationId,
      confidenceScore,
      status,
      reasoning,
      requiresEDD,
      flags,
      timestamp: new Date(),
    };
  }

  /**
   * Get registered asset by legal identifier
   */
  getRegisteredAsset(legalIdentifier: string) {
    return assetRegistry.get(legalIdentifier) || null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async queryOracleNAV(assetId: string, jurisdiction: string): Promise<number> {
    // In production: call client-provided oracle endpoint
    // e.g., Dubai Land Department API, India land registry, etc.
    // For now, return a mock value that simulates an oracle response
    // The test will mock this or use realistic values

    // Mock: return a NAV based on assetId hash (deterministic for testing)
    const mockNAV = parseInt(assetId.replace(/[^0-9]/g, '').slice(0, 8) || '1000000', 10);
    return Math.max(mockNAV, 1000000); // Minimum $1M for realistic test
  }

  private findByLegalIdentifier(legalIdentifier: string) {
    return assetRegistry.get(legalIdentifier) || null;
  }

  private findByTokenContract(tokenContractAddress: string) {
    for (const entry of assetRegistry.values()) {
      if (entry.tokenContractAddress.toLowerCase() === tokenContractAddress.toLowerCase()) {
        return entry;
      }
    }
    return null;
  }

  private assessSourcePlausibility(
    sourceType: SourceOfFundsRequest['declaredSourceType'],
    amountUSD: number
  ): number {
    // More favorable scores for naturally large sources
    const sourcePlausibility: Record<string, number> = {
      business: amountUSD < 10000000 ? 20 : 10,
      investment: amountUSD < 5000000 ? 20 : 15,
      inheritance: amountUSD < 2000000 ? 15 : 5,
      employment: amountUSD < 1000000 ? 15 : -10,
      other: -5,
    };
    return sourcePlausibility[sourceType] ?? 0;
  }

  private getJurisdictionRisk(jurisdiction: string): number {
    // Higher score = higher risk reduction
    const riskMap: Record<string, number> = {
      AE: 0, SA: 5, SG: 0, US: 0, EU: 0, IN: 5,
      RU: 30, CN: 10, NG: 20, PK: 15,
    };
    return riskMap[jurisdiction.toUpperCase()] ?? 5;
  }
}

export default new OracleVerificationService();
