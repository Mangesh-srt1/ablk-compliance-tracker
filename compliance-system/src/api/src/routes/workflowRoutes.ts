import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { requirePermission } from '../middleware/authMiddleware';
import { getWorkflowBuilderService } from '../services/workflowBuilderService';
import { getWorkflowExecutorService } from '../services/workflowExecutorService';
import { createErrorResponseFromDetails, ErrorCategory, ErrorCode } from '../types/errors';

const router = Router();
const workflowBuilder = getWorkflowBuilderService();
const workflowExecutor = getWorkflowExecutorService();

router.get(
  '/versions/:workflowId',
  requirePermission('workflows:read'),
  [param('workflowId').isString().notEmpty()],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid workflowId',
          400,
          errors.array()
        )
      );
    }

    const versions = workflowBuilder.getWorkflowVersions(req.params.workflowId);
    return res.status(200).json({ success: true, data: versions, count: versions.length });
  }
);

router.post(
  '/create',
  requirePermission('workflows:write'),
  [
    body('name').isString().notEmpty(),
    body('jurisdiction').isString().notEmpty(),
    body('blocks').isArray({ min: 1 }),
    body('createdBy').isString().notEmpty(),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid workflow creation payload',
          400,
          errors.array()
        )
      );
    }

    const workflow = workflowBuilder.createWorkflow(req.body);
    return res.status(201).json({ success: true, data: workflow });
  }
);

router.get(
  '/',
  requirePermission('workflows:read'),
  [query('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid workflow filter',
          400,
          errors.array()
        )
      );
    }

    const data = workflowBuilder.listWorkflows(req.query.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | undefined);
    return res.status(200).json({ success: true, data, count: data.length });
  }
);

router.get(
  '/:workflowId',
  requirePermission('workflows:read'),
  [param('workflowId').isString().notEmpty()],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid workflowId',
          400,
          errors.array()
        )
      );
    }

    const workflow = workflowBuilder.getWorkflow(req.params.workflowId);
    if (!workflow) {
      return res.status(404).json(
        createErrorResponseFromDetails(
          ErrorCode.RESOURCE_NOT_FOUND,
          ErrorCategory.NOT_FOUND,
          'Workflow not found',
          404
        )
      );
    }

    return res.status(200).json({ success: true, data: workflow });
  }
);

router.post(
  '/:workflowId/publish',
  requirePermission('workflows:write'),
  [param('workflowId').isString().notEmpty(), body('publishedBy').isString().notEmpty()],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid publish payload',
          400,
          errors.array()
        )
      );
    }

    try {
      const workflow = workflowBuilder.publishWorkflow(req.params.workflowId, req.body.publishedBy);
      return res.status(200).json({ success: true, data: workflow });
    } catch (error) {
      return res.status(404).json(
        createErrorResponseFromDetails(
          ErrorCode.RESOURCE_NOT_FOUND,
          ErrorCategory.NOT_FOUND,
          error instanceof Error ? error.message : 'Workflow not found',
          404
        )
      );
    }
  }
);

router.post(
  '/:workflowId/test',
  requirePermission('workflows:write'),
  [param('workflowId').isString().notEmpty(), body('input').isObject()],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        createErrorResponseFromDetails(
          ErrorCode.INVALID_INPUT,
          ErrorCategory.VALIDATION,
          'Invalid workflow test payload',
          400,
          errors.array()
        )
      );
    }

    try {
      const result = workflowExecutor.testWorkflow(req.params.workflowId, req.body.input);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return res.status(404).json(
        createErrorResponseFromDetails(
          ErrorCode.RESOURCE_NOT_FOUND,
          ErrorCategory.NOT_FOUND,
          error instanceof Error ? error.message : 'Workflow not found',
          404
        )
      );
    }
  }
);

export default router;
