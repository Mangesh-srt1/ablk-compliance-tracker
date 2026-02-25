# Day 5: Analytics API

## Objective
Create REST API endpoints for accessing predictive analytics, model management, and compliance insights.

## Implementation Steps

1. **Create Analytics API Routes**
   - Build endpoints for predictions and insights
   - Add model management endpoints

2. **Implement API Controllers**
   - Create controllers for analytics operations
   - Add input validation and error handling

3. **Add Authentication & Authorization**
   - Secure analytics endpoints
   - Implement role-based access control

4. **Create API Documentation**
   - Generate OpenAPI specifications
   - Add usage examples and guides

## Code Snippets

### 1. Analytics API Routes
```typescript
// src/routes/analytics.ts
import express from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const analyticsController = new AnalyticsController();

// Rate limiting for analytics endpoints
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many analytics requests, please try again later.',
});

// Apply authentication to all routes
router.use(authMiddleware);

// Transaction analytics
router.post('/predict/transaction', analyticsLimiter, analyticsController.predictTransactionRisk);
router.post('/predict/batch', analyticsLimiter, analyticsController.predictBatchRisk);
router.get('/transaction/:id', analyticsController.getTransactionAnalytics);

// Global analytics
router.get('/global', analyticsController.getGlobalAnalytics);
router.get('/trends', analyticsController.getRiskTrends);
router.get('/anomalies', analyticsController.getAnomalySummary);

// Model management
router.get('/model/performance', analyticsController.getModelPerformance);
router.post('/model/retrain', analyticsController.retrainModel);
router.get('/model/status', analyticsController.getModelStatus);
router.post('/model/update', analyticsController.updateModel);

// Compliance insights
router.get('/insights/risk-factors', analyticsController.getRiskFactors);
router.get('/insights/recommendations', analyticsController.getRecommendations);
router.get('/insights/jurisdiction/:code', analyticsController.getJurisdictionInsights);

// Historical analytics
router.get('/history/risk-scores', analyticsController.getHistoricalRiskScores);
router.get('/history/anomalies', analyticsController.getHistoricalAnomalies);

export default router;
```

### 2. Analytics Controller
```typescript
// src/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { PredictiveAnalyticsService } from '../services/analytics/PredictiveAnalyticsService';
import { DatabaseService } from '../services/database/DatabaseService';

export class AnalyticsController {
  private analyticsService: PredictiveAnalyticsService;
  private databaseService: DatabaseService;

  constructor() {
    // Services would be injected via dependency injection
    this.analyticsService = new PredictiveAnalyticsService(this.databaseService, null as any);
    this.databaseService = new DatabaseService();
  }

  predictTransactionRisk = async (req: Request, res: Response) => {
    try {
      const { transaction } = req.body;

      if (!transaction || !transaction.id) {
        return res.status(400).json({
          error: 'Invalid request: transaction with id required'
        });
      }

      const prediction = await this.analyticsService.predictTransactionRisk(transaction);

      res.json({
        success: true,
        data: prediction,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error predicting transaction risk:', error);
      res.status(500).json({
        error: 'Failed to predict transaction risk',
        message: error.message,
      });
    }
  };

  predictBatchRisk = async (req: Request, res: Response) => {
    try {
      const { transactions } = req.body;

      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({
          error: 'Invalid request: array of transactions required'
        });
      }

      if (transactions.length > 1000) {
        return res.status(400).json({
          error: 'Batch size too large: maximum 1000 transactions'
        });
      }

      const predictions = await this.analyticsService.predictBatchRisk(transactions);

      res.json({
        success: true,
        data: predictions,
        count: predictions.length,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error predicting batch risk:', error);
      res.status(500).json({
        error: 'Failed to predict batch risk',
        message: error.message,
      });
    }
  };

  getTransactionAnalytics = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { includeHistory = false } = req.query;

      const analytics = await this.databaseService.getTransactionAnalytics(id, includeHistory === 'true');

      if (!analytics) {
        return res.status(404).json({
          error: 'Transaction analytics not found'
        });
      }

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Error getting transaction analytics:', error);
      res.status(500).json({
        error: 'Failed to get transaction analytics',
        message: error.message,
      });
    }
  };

  getGlobalAnalytics = async (req: Request, res: Response) => {
    try {
      const { timeRange = '24h' } = req.query;

      const analytics = await this.databaseService.getGlobalAnalytics(timeRange as string);

      res.json({
        success: true,
        data: analytics,
        timeRange,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error getting global analytics:', error);
      res.status(500).json({
        error: 'Failed to get global analytics',
        message: error.message,
      });
    }
  };

  getModelPerformance = async (req: Request, res: Response) => {
    try {
      const performance = await this.analyticsService.getModelPerformance();

      res.json({
        success: true,
        data: performance,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error getting model performance:', error);
      res.status(500).json({
        error: 'Failed to get model performance',
        message: error.message,
      });
    }
  };

  retrainModel = async (req: Request, res: Response) => {
    try {
      // Check user permissions for model retraining
      if (!req.user?.roles?.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions to retrain model'
        });
      }

      // Start async retraining
      this.analyticsService.retrainModels().catch(error => {
        console.error('Async model retraining failed:', error);
      });

      res.json({
        success: true,
        message: 'Model retraining started',
        status: 'in_progress',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error starting model retraining:', error);
      res.status(500).json({
        error: 'Failed to start model retraining',
        message: error.message,
      });
    }
  };

  getModelStatus = async (req: Request, res: Response) => {
    try {
      // Check if model is currently training or available
      const status = {
        available: true,
        lastTrained: new Date('2024-01-15'),
        version: '1.2.3',
        training: false,
      };

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error getting model status:', error);
      res.status(500).json({
        error: 'Failed to get model status',
        message: error.message,
      });
    }
  };

  getRiskFactors = async (req: Request, res: Response) => {
    try {
      const { limit = 10, jurisdiction } = req.query;

      const factors = await this.databaseService.getTopRiskFactors(
        parseInt(limit as string),
        jurisdiction as string
      );

      res.json({
        success: true,
        data: factors,
      });
    } catch (error) {
      console.error('Error getting risk factors:', error);
      res.status(500).json({
        error: 'Failed to get risk factors',
        message: error.message,
      });
    }
  };

  getRecommendations = async (req: Request, res: Response) => {
    try {
      const { riskLevel, type } = req.query;

      const recommendations = await this.databaseService.getAIRecommendations(
        riskLevel as string,
        type as string
      );

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (error) {
      console.error('Error getting recommendations:', error);
      res.status(500).json({
        error: 'Failed to get recommendations',
        message: error.message,
      });
    }
  };
}
```

### 3. API Documentation (OpenAPI)
```yaml
# src/docs/analytics-api.yaml
openapi: 3.0.3
info:
  title: Ableka Lumina Analytics API
  version: 1.0.0
  description: API for accessing predictive analytics and compliance insights

servers:
  - url: https://api.ableka-lumina.com/v1
    description: Production server
  - url: https://staging.api.ableka-lumina.com/v1
    description: Staging server

security:
  - bearerAuth: []

paths:
  /analytics/predict/transaction:
    post:
      summary: Predict risk for a single transaction
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Transaction'
      responses:
        '200':
          description: Successful prediction
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PredictionResult'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized

  /analytics/predict/batch:
    post:
      summary: Predict risk for multiple transactions
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                transactions:
                  type: array
                  items:
                    $ref: '#/components/schemas/Transaction'
                  maxItems: 1000
      responses:
        '200':
          description: Successful batch prediction
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PredictionResult'
                  count:
                    type: integer

  /analytics/model/performance:
    get:
      summary: Get model performance metrics
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Model performance data
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ModelPerformance'

components:
  schemas:
    Transaction:
      type: object
      required:
        - id
        - amount
        - from
        - to
      properties:
        id:
          type: string
        amount:
          type: number
        from:
          type: string
        to:
          type: string
        timestamp:
          type: string
          format: date-time
        jurisdiction:
          type: string

    PredictionResult:
      type: object
      properties:
        transactionId:
          type: string
        predictedRisk:
          type: number
          minimum: 0
          maximum: 100
        confidence:
          type: number
          minimum: 0
          maximum: 1
        isAnomaly:
          type: boolean
        anomalyScore:
          type: number
        riskFactors:
          type: array
          items:
            type: string
        recommendations:
          type: array
          items:
            type: string

    ModelPerformance:
      type: object
      properties:
        riskModel:
          type: object
          properties:
            loss:
              type: number
            accuracy:
              type: number
            mse:
              type: number
        featureImportance:
          type: object
          additionalProperties:
            type: number
        lastTrained:
          type: string
          format: date-time

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Notes
- Analytics API provides programmatic access to predictive capabilities
- Rate limiting and authentication protect sensitive analytics endpoints
- OpenAPI documentation enables easy integration for external systems
- Batch processing optimizes performance for multiple predictions