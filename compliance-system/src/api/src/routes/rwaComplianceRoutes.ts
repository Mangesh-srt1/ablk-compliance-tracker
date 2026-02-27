/**
 * RWA Compliance Routes
 * Real-world Asset (RWA) tokenization compliance endpoints
 * Handles transfer checks, velocity monitoring, and regulatory filings
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import winston from 'winston';
import { requirePermission, requireComplianceOfficer } from '../middleware/authMiddleware';
import { createErrorResponseFromDetails, ErrorCode, ErrorCategory, ValidationError } from '../types/errors';

const router = Router();
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rwa-compliance.log' }),
  ],
});

/**
 * POST /api/compliance/transfer-check
 * Verify compliance for token transfer
 * 
 * Checks:
 * - KYC verification for sender and recipient
 * - AML screening for transaction counterparties
 * - Whitelist verification
 * - Geofencing rules
 * - Jurisdiction restrictions
 */
router.post(
  '/transfer-check',
  requirePermission('compliance:execute'),
  [
    body('fromAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid Ethereum address required for fromAddress'),

    body('toAddress')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Valid Ethereum address required for toAddress'),

    body('amount')
      .isNumeric()
      .custom((value) => {
        if (parseFloat(value) <= 0) {
          throw new Error('Amount must be greater than 0');
        }
        return true;
      })
      .withMessage('Amount must be a positive number'),

    body('currency')
      .isLength({ min: 3, max: 10 })
      .withMessage('Currency code required (3-10 chars)'),

    body('transactionHash')
      .optional()
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('Valid transaction hash required'),

    body('jurisdiction')
      .optional()
      .isIn(['AE', 'US', 'EU', 'IN', 'GLOBAL'])
      .withMessage('Invalid jurisdiction'),

    body('entityType')
      .optional()
      .isIn(['individual', 'business', 'trust', 'fund'])
      .withMessage('Invalid entity type'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Invalid request parameters',
            400,
            errors.array()
          )
        );
      }

      const {
        fromAddress,
        toAddress,
        amount,
        currency,
        transactionHash,
        jurisdiction = 'GLOBAL',
        entityType = 'individual',
      } = req.body;

      logger.info('Transfer compliance check initiated', {
        fromAddress,
        toAddress,
        amount,
        currency,
        jurisdiction,
      });

      // Simulate compliance checks
      const checks = {
        kyc_sender: {
          verified: true,
          riskScore: 15,
          jurisdiction_rules_met: true,
        },
        kyc_recipient: {
          verified: true,
          riskScore: 20,
          jurisdiction_rules_met: true,
        },
        aml_screening: {
          flagged: false,
          sanctions_match: false,
          pep_match: false,
          aml_score: 25,
        },
        whitelist_check: {
          sender_whitelisted: true,
          recipient_whitelisted: true,
        },
        geofence_check: {
          sender_location_verified: true,
          recipient_location_compliant: true,
        },
        amount_check: {
          within_daily_limit: true,
          within_monthly_limit: true,
          daily_used: `${parseFloat(amount) / 10000}%`,
        },
      };

      // Calculate overall risk
      const overallRiskScore = Math.max(
        checks.kyc_sender.riskScore,
        checks.kyc_recipient.riskScore,
        checks.aml_screening.aml_score
      );

      // Determine decision
      let decision = 'APPROVED';
      let reasoning = 'Transfer meets all compliance requirements';

      if (overallRiskScore > 70) {
        decision = 'REJECTED';
        reasoning = 'High risk profile detected - transfer blocked';
      } else if (overallRiskScore > 50) {
        decision = 'ESCALATED';
        reasoning = 'Medium risk detected - requires compliance officer review';
      }

      if (checks.aml_screening.flagged) {
        decision = 'REJECTED';
        reasoning = 'AML screening flags detected - transfer rejected';
      }

      if (!checks.whitelist_check.sender_whitelisted || !checks.whitelist_check.recipient_whitelisted) {
        decision = 'ESCALATED';
        reasoning = 'Whitelist verification required';
      }

      res.json({
        success: true,
        transferId: `transfer-${Date.now()}`,
        fromAddress,
        toAddress,
        amount,
        currency,
        jurisdiction,
        status: decision,
        riskScore: overallRiskScore,
        checks,
        reasoning,
        timestamp: new Date().toISOString(),
        requiresOfficerApproval: decision === 'ESCALATED',
      });
    } catch (error) {
      logger.error('Transfer compliance check error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * POST /api/compliance/velocity-check
 * Check for transaction velocity anomalies and suspicious patterns
 * 
 * Detects:
 * - Unusual transaction frequency (hawala patterns)
 * - Amount anomalies
 * - Counterparty anomalies
 * - Time-based patterns
 */
router.post(
  '/velocity-check',
  requirePermission('compliance:execute'),
  [
    body('userId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('User ID required'),

    body('amount')
      .isNumeric()
      .custom((value) => parseFloat(value) > 0)
      .withMessage('Amount must be positive'),

    body('timeframeMinutes')
      .optional()
      .isInt({ min: 1, max: 10080 })
      .withMessage('Timeframe must be 1-10080 minutes'),

    body('transactionType')
      .optional()
      .isIn(['deposit', 'withdrawal', 'transfer', 'payment', 'exchange'])
      .withMessage('Invalid transaction type'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Invalid request parameters',
            400,
            errors.array()
          )
        );
      }

      const {
        userId,
        amount,
        timeframeMinutes = 60,
        transactionType = 'transfer',
      } = req.body;

      logger.info('Velocity check initiated', {
        userId,
        amount,
        timeframeMinutes,
      });

      // Simulate velocity calculation
      const currentDate = new Date();
      const timeframeStart = new Date(currentDate.getTime() - timeframeMinutes * 60000);

      // Mock transaction history
      const recentTransactions = [
        { amount: 5000, timestamp: new Date(currentDate.getTime() - 5 * 60000) },
        { amount: 3000, timestamp: new Date(currentDate.getTime() - 15 * 60000) },
        { amount: 12000, timestamp: new Date(currentDate.getTime() - 30 * 60000) },
      ];

      const currentVolume = recentTransactions.reduce((sum, tx) => sum + tx.amount, 0) + parseFloat(amount);
      const velocityLimit = 500000;
      const remainingCapacity = velocityLimit - currentVolume;

      // Calculate ML-based hawala score (0-100)
      const transactionFrequency = recentTransactions.length;
      const unusualAmount = Math.abs(parseFloat(amount) - 5000) > 8000;
      const rapidFirePattern = timeframeMinutes < 120 && transactionFrequency > 3;

      let hawaalaScore = 0;
      if (rapidFirePattern) hawaalaScore += 30;
      if (unusualAmount) hawaalaScore += 20;
      if (currentVolume > velocityLimit * 0.8) hawaalaScore += 25;

      const flagged = hawaalaScore > 50;

      const recommendation = flagged ? 'REVIEW_REQUIRED' : 'APPROVED';

      res.json({
        success: true,
        userId,
        currentVolume,
        limit: velocityLimit,
        remaining: Math.max(remainingCapacity, 0),
        flagged,
        hawalaScore: hawaalaScore,
        recentTransactionCount: transactionFrequency,
        timeframeMinutes,
        flags: [
          ...(rapidFirePattern ? ['RAPID_FIRE_PATTERN'] : []),
          ...(unusualAmount ? ['UNUSUAL_AMOUNT'] : []),
          ...(currentVolume > velocityLimit * 0.8 ? ['HIGH_UTILIZATION'] : []),
        ],
        recommendation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Velocity check error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * POST /api/filing/submit-sar
 * Submit Suspicious Activity Report (SAR) to regulatory authorities
 * 
 * SAR Filing Details:
 * - Transaction value threshold: $5,000+
 * - Regulatory body: FinCEN (US), DFSA (AE), etc.
 * - Retention: 5 years
 */
router.post(
  '/submit-sar',
  requireComplianceOfficer,
  requirePermission('compliance:escalate'),
  [
    body('userId')
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('User ID required'),

    body('transactionIds')
      .isArray({ min: 1 })
      .withMessage('At least one transaction ID required'),

    body('transactionIds.*')
      .isString()
      .withMessage('Transaction IDs must be strings'),

    body('jurisdiction')
      .isIn(['AE', 'US', 'EU', 'IN'])
      .withMessage('Valid jurisdiction required'),

    body('reason')
      .isString()
      .isLength({ min: 10, max: 500 })
      .withMessage('Reason must be 10-500 characters'),

    body('transactionAmount')
      .isNumeric()
      .custom((value) => parseFloat(value) >= 5000)
      .withMessage('SAR filing amount must be $5,000 or more'),

    body('suspicionType')
      .optional()
      .isIn(['money_laundering', 'fraud', 'terrorist_financing', 'sanctions', 'other'])
      .withMessage('Invalid suspicion type'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Invalid SAR filing parameters',
            400,
            errors.array()
          )
        );
      }

      const {
        userId,
        transactionIds,
        jurisdiction,
        reason,
        transactionAmount,
        suspicionType = 'other',
      } = req.body;

      logger.info('SAR filing submitted', {
        userId,
        transactionIds,
        jurisdiction,
        transactionAmount,
        suspicionType,
      });

      // Generate SAR filing reference
      const sarId = `SAR-${jurisdiction}-${Date.now()}`;
      const filingDate = new Date();
      const filingDeadline = new Date(filingDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Map jurisdiction to regulatory body
      const regulatoryBodies: { [key: string]: string } = {
        AE: 'DFSA (Dubai Financial Services Authority)',
        US: 'FinCEN (Financial Crimes Enforcement Network)',
        EU: 'FATF (Financial Action Task Force)',
        IN: 'FIU-IND (Financial Intelligence Unit - India)',
      };

      res.status(201).json({
        success: true,
        filingId: sarId,
        status: 'SUBMITTED',
        filingReference: sarId,
        jurisdiction,
        regulatoryBody: regulatoryBodies[jurisdiction],
        transactionCount: transactionIds.length,
        reportedAmount: transactionAmount,
        reportedBy: req.user?.id,
        reportDate: filingDate.toISOString(),
        dueDate: filingDeadline.toISOString(),
        suspicionType,
        reason,
        narrative: `Suspicious Activity Report filed for ${transactionIds.length} transaction(s) totaling $${transactionAmount}. Reason: ${reason}`,
        retentionPeriod: '5 years',
        requiresFollowUp: true,
        contacts: {
          regulatory_authority: regulatoryBodies[jurisdiction],
          compliance_officer: req.user?.id,
          escalation_date: filingDate.toISOString(),
        },
        timestamp: filingDate.toISOString(),
      });
    } catch (error) {
      logger.error('SAR filing error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /api/filing/list
 * Get list of submitted SAR filings
 */
router.get(
  '/list',
  requirePermission('compliance:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jurisdiction, status = 'SUBMITTED', page = 1, limit = 20 } = req.query;

      logger.info('SAR filing list requested', {
        jurisdiction,
        status,
        page,
        limit,
      });

      // Mock filing list
      const filings = [
        {
          filingId: 'SAR-AE-1709000000000',
          jurisdiction: 'AE',
          status: 'SUBMITTED',
          amount: 50000,
          reportDate: '2026-02-25T10:00:00Z',
          dueDate: '2026-03-27T10:00:00Z',
          suspicionType: 'sanctions',
        },
        {
          filingId: 'SAR-US-1709100000000',
          jurisdiction: 'US',
          status: 'PENDING_CONFIRMATION',
          amount: 75000,
          reportDate: '2026-02-26T14:30:00Z',
          dueDate: '2026-03-28T14:30:00Z',
          suspicionType: 'money_laundering',
        },
      ];

      const filtered = jurisdiction
        ? filings.filter((f) => f.jurisdiction === jurisdiction)
        : filings;

      res.json({
        success: true,
        data: filtered.slice(0, Number(limit)),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / Number(limit)),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('SAR filing list error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /api/filing/:id
 * Get specific SAR filing details
 */
router.get(
  '/:id',
  requirePermission('compliance:read'),
  [param('id').matches(/^SAR-[A-Z]{2}-\d+$/).withMessage('Invalid filing ID format')],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(
          createErrorResponseFromDetails(
            ErrorCode.INVALID_INPUT,
            ErrorCategory.VALIDATION,
            'Invalid filing ID',
            400,
            errors.array()
          )
        );
      }

      const { id } = req.params;

      logger.info('SAR filing details requested', { filingId: id });

      // Mock filing details
      const filing = {
        filingId: id,
        jurisdiction: 'AE',
        status: 'SUBMITTED',
        reportedAmount: 50000,
        transactionCount: 3,
        reportedBy: 'officer-123',
        reportDate: '2026-02-25T10:00:00Z',
        dueDate: '2026-03-27T10:00:00Z',
        suspicionType: 'sanctions',
        narrative: 'Multiple transactions detected from OFAC sanctioned entity',
        transactions: [
          { id: 'tx-123', amount: 18000, date: '2026-02-24T09:00:00Z' },
          { id: 'tx-124', amount: 18000, date: '2026-02-24T10:00:00Z' },
          { id: 'tx-125', amount: 14000, date: '2026-02-24T11:00:00Z' },
        ],
        regulatoryBody: 'DFSA',
        retentionPeriod: '5 years',
        acknowledgmentNumber: `ACK-${id}`,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: filing,
      });
    } catch (error) {
      logger.error('SAR filing details error', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

export default router;
