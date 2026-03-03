/**
 * Document & Asset Validation Routes
 *
 * REST API endpoints for AI-powered document authenticity and
 * Real-World Asset (RWA) validation.
 *
 * Endpoints:
 *   POST /api/v1/documents/validate   – validate a compliance document
 *   POST /api/v1/assets/validate      – validate an RWA asset
 *   POST /api/v1/validation/combined  – validate document + asset together
 *
 * Follows the same pattern as kycRoutes.ts and amlRoutes.ts.
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { requirePermission } from '../middleware/authMiddleware';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory } from '../types/errors';
import { documentValidationService, DOCUMENT_TYPES, ASSET_TYPES } from '../services/documentValidationService';

const router = Router();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/document-validation-routes.log' }),
  ],
});

// Singleton service instance (created once per process)
let validationService: typeof documentValidationService | null = null;

function getAgent(): typeof documentValidationService {
  if (!validationService) {
    validationService = documentValidationService;
  }
  return validationService;
}

// ─── POST /api/v1/documents/validate ─────────────────────────────────────────

/**
 * Validate a compliance document for authenticity.
 *
 * Body parameters:
 *   - documentType  (required) one of DOCUMENT_TYPES
 *   - content       (required) extracted text or base-64 document content
 *   - issuerName    (optional)
 *   - issuerJurisdiction (optional)
 *   - entityName    (optional)
 *   - issuedDate    (optional) ISO-8601
 *   - expiryDate    (optional) ISO-8601
 *   - documentHash  (optional) SHA-256 hash for integrity check
 */
router.post(
  '/documents/validate',
  requirePermission('compliance:execute'),
  [
    body('documentType')
      .isIn(DOCUMENT_TYPES as unknown as string[])
      .withMessage(`documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`),
    body('content')
      .isString()
      .isLength({ min: 1 })
      .withMessage('content is required and must be a non-empty string'),
    body('issuerJurisdiction')
      .optional()
      .isString()
      .isLength({ min: 2, max: 10 })
      .withMessage('issuerJurisdiction must be a 2-10 character string'),
    body('issuedDate')
      .optional()
      .isISO8601()
      .withMessage('issuedDate must be a valid ISO-8601 date'),
    body('expiryDate')
      .optional()
      .isISO8601()
      .withMessage('expiryDate must be a valid ISO-8601 date'),
    body('documentHash')
      .optional()
      .isHexadecimal()
      .isLength({ min: 64, max: 64 })
      .withMessage('documentHash must be a 64-character hex string (SHA-256)'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Validation failed',
          400,
          errors.array()
        )
      );
    }

    const documentId = req.body.documentId || uuidv4();

    try {
      logger.info('Document validation request received', {
        documentId,
        documentType: req.body.documentType,
        userId: req.user?.id,
      });

      const result = await getAgent().validateDocument({
        documentId,
        documentType: req.body.documentType,
        content: req.body.content,
        issuerName: req.body.issuerName,
        issuerJurisdiction: req.body.issuerJurisdiction,
        entityName: req.body.entityName,
        issuedDate: req.body.issuedDate,
        expiryDate: req.body.expiryDate,
        documentHash: req.body.documentHash,
        metadata: req.body.metadata,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Document validation endpoint error', {
        documentId,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });

      return res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Document validation failed'
        )
      );
    }
  }
);

// ─── POST /api/v1/assets/validate ─────────────────────────────────────────────

/**
 * Validate a Real-World Asset for authenticity and genuineness.
 *
 * Body parameters:
 *   - assetType          (required) one of ASSET_TYPES
 *   - assetDescription   (required) textual description of the asset
 *   - ownerName          (optional)
 *   - ownerJurisdiction  (optional)
 *   - registryReference  (optional)
 *   - registrationDate   (optional) ISO-8601
 *   - valuationAmount    (optional) numeric USD amount
 *   - ownershipChain     (optional) array of { owner, transferDate, registryRef }
 *   - contentHash        (optional) SHA-256 of supporting document
 *   - contentForHashing  (optional) raw content to verify against contentHash
 */
router.post(
  '/assets/validate',
  requirePermission('compliance:execute'),
  [
    body('assetType')
      .isIn(ASSET_TYPES as unknown as string[])
      .withMessage(`assetType must be one of: ${ASSET_TYPES.join(', ')}`),
    body('assetDescription')
      .isString()
      .isLength({ min: 1 })
      .withMessage('assetDescription is required and must be a non-empty string'),
    body('ownerJurisdiction')
      .optional()
      .isString()
      .isLength({ min: 2, max: 10 })
      .withMessage('ownerJurisdiction must be a 2-10 character string'),
    body('registrationDate')
      .optional()
      .isISO8601()
      .withMessage('registrationDate must be a valid ISO-8601 date'),
    body('valuationAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('valuationAmount must be a non-negative number'),
    body('ownershipChain')
      .optional()
      .isArray()
      .withMessage('ownershipChain must be an array'),
    body('ownershipChain.*.owner')
      .optional()
      .isString()
      .withMessage('Each ownershipChain entry must have an owner string'),
    body('contentHash')
      .optional()
      .isHexadecimal()
      .isLength({ min: 64, max: 64 })
      .withMessage('contentHash must be a 64-character hex string (SHA-256)'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Validation failed',
          400,
          errors.array()
        )
      );
    }

    const assetId = req.body.assetId || uuidv4();

    try {
      logger.info('Asset validation request received', {
        assetId,
        assetType: req.body.assetType,
        userId: req.user?.id,
      });

      const result = await getAgent().validateAsset({
        assetId,
        assetType: req.body.assetType,
        assetDescription: req.body.assetDescription,
        ownerName: req.body.ownerName,
        ownerJurisdiction: req.body.ownerJurisdiction,
        registryReference: req.body.registryReference,
        registrationDate: req.body.registrationDate,
        valuationAmount: req.body.valuationAmount,
        valuationCurrency: req.body.valuationCurrency,
        ownershipChain: req.body.ownershipChain,
        contentHash: req.body.contentHash,
        contentForHashing: req.body.contentForHashing,
        metadata: req.body.metadata,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Asset validation endpoint error', {
        assetId,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });

      return res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Asset validation failed'
        )
      );
    }
  }
);

// ─── POST /api/v1/validation/combined ────────────────────────────────────────

/**
 * Run document + asset validation together in a single request.
 * At least one of `document` or `asset` must be provided.
 *
 * Body:
 *   { document?: DocumentValidationInput, asset?: AssetValidationInput }
 */
router.post(
  '/validation/combined',
  requirePermission('compliance:execute'),
  [
    body()
      .custom((value: any) => {
        if (!value.document && !value.asset) {
          throw new Error('At least one of document or asset must be provided');
        }
        return true;
      }),
    body('document.documentType')
      .optional()
      .isIn(DOCUMENT_TYPES as unknown as string[])
      .withMessage(`document.documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`),
    body('document.content')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('document.content must be a non-empty string when document is provided'),
    body('asset.assetType')
      .optional()
      .isIn(ASSET_TYPES as unknown as string[])
      .withMessage(`asset.assetType must be one of: ${ASSET_TYPES.join(', ')}`),
    body('asset.assetDescription')
      .optional()
      .isString()
      .isLength({ min: 1 })
      .withMessage('asset.assetDescription must be a non-empty string when asset is provided'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Validation failed',
          400,
          errors.array()
        )
      );
    }

    const requestId = req.body.requestId || uuidv4();

    try {
      logger.info('Combined validation request received', {
        requestId,
        hasDocument: !!req.body.document,
        hasAsset: !!req.body.asset,
        userId: req.user?.id,
      });

      const docInput = req.body.document
        ? { ...req.body.document, documentId: req.body.document.documentId || uuidv4() }
        : undefined;
      const assetInput = req.body.asset
        ? { ...req.body.asset, assetId: req.body.asset.assetId || uuidv4() }
        : undefined;

      const result = await getAgent().validateCombined({
        requestId,
        document: docInput,
        asset: assetInput,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Combined validation endpoint error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });

      return res.status(500).json(
        createErrorResponseFromDetails(
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorCategory.INTERNAL,
          'Combined validation failed'
        )
      );
    }
  }
);

export default router;
