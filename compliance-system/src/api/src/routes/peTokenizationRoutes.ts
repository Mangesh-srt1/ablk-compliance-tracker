/**
 * PE & RWA Tokenization Compliance API Routes
 * Implements FR-201 to FR-204 and FR-401 to FR-403
 *
 * Endpoints:
 *   POST /api/pe/token/transfer-check       FR-201: Transfer whitelist & compliance
 *   POST /api/pe/token/register             FR-203: Register token lifecycle
 *   POST /api/pe/corporate-action           FR-204: Corporate action compliance
 *   POST /api/pe/asset/register             FR-402: Asset registration (double-dip prevention)
 *   POST /api/pe/asset/valuation-check      FR-401: Oracle property valuation verification
 *   POST /api/pe/source-of-funds            FR-403: Source of funds verification
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { requirePermission } from '../middleware/authMiddleware';
import peTokenizationService from '../services/peTokenizationService';
import oracleVerificationService from '../services/oracleVerificationService';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format validation errors
// ─────────────────────────────────────────────────────────────────────────────

function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      code: 'INVALID_INPUT',
      category: 'VALIDATION',
      message: 'Invalid request parameters',
      details: errors.array(),
      httpStatus: 400,
      requestId: (req as any).id || 'unknown',
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// FR-201: Token Transfer Compliance Check
// ─────────────────────────────────────────────────────────────────────────────

const transferCheckValidation = [
  body('fromAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('fromAddress must be a valid Ethereum address (0x...)'),
  body('toAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('toAddress must be a valid Ethereum address (0x...)'),
  body('tokenId')
    .isString()
    .notEmpty()
    .withMessage('tokenId is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('amount must be a positive number'),
  body('amountUSD')
    .isFloat({ min: 0 })
    .withMessage('amountUSD must be a positive number'),
  body('jurisdiction')
    .isLength({ min: 2, max: 3 })
    .withMessage('jurisdiction must be a 2-3 character ISO code'),
];

router.post(
  '/token/transfer-check',
  requirePermission('compliance:execute'),
  transferCheckValidation,
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const result = await peTokenizationService.checkTransferCompliance({
        fromAddress: req.body.fromAddress,
        toAddress: req.body.toAddress,
        tokenId: req.body.tokenId,
        amount: req.body.amount,
        amountUSD: req.body.amountUSD,
        currency: req.body.currency || 'USD',
        jurisdiction: req.body.jurisdiction,
        transactionHash: req.body.transactionHash,
        timestamp: new Date(),
      });

      const statusCode = result.status === 'APPROVED' ? 200
        : result.status === 'ESCALATED' ? 202
        : 403;

      res.status(statusCode).json({
        success: result.status === 'APPROVED',
        transferId: result.requestId,
        status: result.status,
        riskScore: result.riskScore,
        reasoning: result.reasoning,
        checks: result.checks,
        timestamp: result.timestamp.toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Transfer compliance check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FR-203: Register Token Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/token/register',
  requirePermission('compliance:write'),
  [
    body('tokenId').isString().notEmpty().withMessage('tokenId is required'),
    body('fundId').isString().notEmpty().withMessage('fundId is required'),
    body('totalSupply').isNumeric().withMessage('totalSupply must be a number'),
    body('jurisdiction').isLength({ min: 2, max: 3 }).withMessage('jurisdiction required'),
  ],
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      peTokenizationService.registerTokenLifecycle({
        tokenId: req.body.tokenId,
        fundId: req.body.fundId,
        issuanceDate: new Date(req.body.issuanceDate || Date.now()),
        lockupEndDate: req.body.lockupEndDate ? new Date(req.body.lockupEndDate) : undefined,
        vestingScheduleType: req.body.vestingScheduleType,
        vestingStartDate: req.body.vestingStartDate ? new Date(req.body.vestingStartDate) : undefined,
        vestingEndDate: req.body.vestingEndDate ? new Date(req.body.vestingEndDate) : undefined,
        cliffDate: req.body.cliffDate ? new Date(req.body.cliffDate) : undefined,
        status: 'active',
        jurisdiction: req.body.jurisdiction,
        holdingLimitPercent: req.body.holdingLimitPercent,
        totalSupply: BigInt(req.body.totalSupply),
        maxTransferUSD: req.body.maxTransferUSD,
      });

      res.status(201).json({
        success: true,
        tokenId: req.body.tokenId,
        message: 'Token lifecycle registered successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Token registration failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FR-204: Corporate Action Compliance
// ─────────────────────────────────────────────────────────────────────────────

const corporateActionValidation = [
  body('actionType')
    .isIn(['dividend', 'redemption', 'capital_call'])
    .withMessage('actionType must be dividend, redemption, or capital_call'),
  body('tokenId').isString().notEmpty().withMessage('tokenId is required'),
  body('jurisdiction').isLength({ min: 2, max: 3 }).withMessage('jurisdiction required'),
  body('initiatedBy').isString().notEmpty().withMessage('initiatedBy is required'),
];

router.post(
  '/corporate-action',
  requirePermission('compliance:execute'),
  corporateActionValidation,
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const result = await peTokenizationService.checkCorporateAction({
        actionType: req.body.actionType,
        tokenId: req.body.tokenId,
        jurisdiction: req.body.jurisdiction,
        initiatedBy: req.body.initiatedBy,
        amount: req.body.amount,
        amountUSD: req.body.amountUSD,
        capitalCallPercent: req.body.capitalCallPercent,
        noticeSentDate: req.body.noticeSentDate ? new Date(req.body.noticeSentDate) : undefined,
        executionDate: req.body.executionDate ? new Date(req.body.executionDate) : undefined,
        targetInvestorId: req.body.targetInvestorId,
      });

      const statusCode = result.status === 'APPROVED' ? 200
        : result.status === 'ESCALATED' ? 202
        : 403;

      res.status(statusCode).json({
        success: result.approved,
        actionId: result.actionId,
        status: result.status,
        reasoning: result.reasoning,
        checks: result.checks,
        netAmount: result.netAmount,
        withholdingTax: result.withholdingTax,
        complianceNotes: result.complianceNotes,
        timestamp: result.timestamp.toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Corporate action check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FR-402: Asset Registration (Double-Dipping Prevention)
// ─────────────────────────────────────────────────────────────────────────────

const assetRegisterValidation = [
  body('assetType')
    .isIn(['real_estate', 'pe_fund', 'reit', 'private_credit'])
    .withMessage('assetType must be real_estate, pe_fund, reit, or private_credit'),
  body('legalIdentifier').isString().notEmpty().withMessage('legalIdentifier required'),
  body('legalIdentifierType')
    .isIn(['title_deed', 'fund_registration', 'land_registry', 'property_id'])
    .withMessage('Invalid legalIdentifierType'),
  body('tokenContractAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('tokenContractAddress must be a valid Ethereum address'),
  body('issuerEntityId').isString().notEmpty().withMessage('issuerEntityId required'),
  body('jurisdiction').isLength({ min: 2, max: 3 }).withMessage('jurisdiction required'),
  body('assetValueUSD').isFloat({ min: 0 }).withMessage('assetValueUSD must be positive'),
];

router.post(
  '/asset/register',
  requirePermission('compliance:write'),
  assetRegisterValidation,
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const result = await oracleVerificationService.registerAsset({
        assetType: req.body.assetType,
        legalIdentifier: req.body.legalIdentifier,
        legalIdentifierType: req.body.legalIdentifierType,
        tokenContractAddress: req.body.tokenContractAddress,
        issuerEntityId: req.body.issuerEntityId,
        jurisdiction: req.body.jurisdiction,
        assetValueUSD: req.body.assetValueUSD,
        issuanceDateISO: req.body.issuanceDateISO || new Date().toISOString(),
      });

      const statusCode = result.status === 'REGISTERED' ? 201
        : result.status === 'DUPLICATE_DETECTED' ? 409
        : 400;

      res.status(statusCode).json({
        success: result.registered,
        assetId: result.assetId,
        status: result.status,
        reasoning: result.reasoning,
        uniquenessCertificateId: result.uniquenessCertificateId,
        timestamp: result.timestamp.toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Asset registration failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FR-401: Property Valuation Oracle Check
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/asset/valuation-check',
  requirePermission('compliance:execute'),
  [
    body('assetId').isString().notEmpty().withMessage('assetId required'),
    body('tokenContractAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('tokenContractAddress must be valid'),
    body('tokenSupply').isFloat({ min: 1 }).withMessage('tokenSupply must be positive'),
    body('requestedTokenPriceUSD').isFloat({ min: 0 }).withMessage('requestedTokenPriceUSD must be positive'),
    body('jurisdiction').isLength({ min: 2, max: 3 }).withMessage('jurisdiction required'),
  ],
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const result = await oracleVerificationService.verifyPropertyValuation({
        assetId: req.body.assetId,
        tokenContractAddress: req.body.tokenContractAddress,
        tokenSupply: req.body.tokenSupply,
        requestedTokenPriceUSD: req.body.requestedTokenPriceUSD,
        jurisdiction: req.body.jurisdiction,
        maxDiscrepancyPercent: req.body.maxDiscrepancyPercent,
      });

      const statusCode = result.status === 'APPROVED' ? 200
        : result.status === 'ESCALATED' ? 202
        : 403;

      res.status(statusCode).json({
        success: result.compliant,
        verificationId: result.verificationId,
        status: result.status,
        oracleNAV: result.oracleNAV,
        impliedTokenNAV: result.impliedTokenNAV,
        discrepancyPercent: result.discrepancyPercent,
        lastValuationDate: result.lastValuationDate.toISOString(),
        valuerName: result.valuerName,
        reasoning: result.reasoning,
        timestamp: result.timestamp.toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Valuation check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FR-403: Source of Funds Verification
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/source-of-funds',
  requirePermission('compliance:execute'),
  [
    body('investorId').isString().notEmpty().withMessage('investorId required'),
    body('investmentAmountUSD').isFloat({ min: 0 }).withMessage('investmentAmountUSD required'),
    body('jurisdiction').isLength({ min: 2, max: 3 }).withMessage('jurisdiction required'),
    body('declaredSourceType')
      .isIn(['employment', 'business', 'investment', 'inheritance', 'other'])
      .withMessage('Invalid declaredSourceType'),
    body('declaredSourceDescription').isString().notEmpty().withMessage('Description required'),
  ],
  async (req: Request, res: Response) => {
    if (handleValidationErrors(req, res)) return;

    try {
      const result = await oracleVerificationService.verifySourceOfFunds({
        investorId: req.body.investorId,
        investmentAmountUSD: req.body.investmentAmountUSD,
        jurisdiction: req.body.jurisdiction,
        declaredSourceType: req.body.declaredSourceType,
        declaredSourceDescription: req.body.declaredSourceDescription,
        bankStatementsProvided: req.body.bankStatementsProvided,
        selfCertificationProvided: req.body.selfCertificationProvided,
      });

      const statusCode = result.status === 'APPROVED' ? 200
        : result.status === 'ESCALATED' ? 202
        : 403;

      res.status(statusCode).json({
        success: result.status === 'APPROVED',
        verificationId: result.verificationId,
        status: result.status,
        confidenceScore: result.confidenceScore,
        reasoning: result.reasoning,
        requiresEDD: result.requiresEDD,
        flags: result.flags,
        timestamp: result.timestamp.toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Source of funds verification failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
