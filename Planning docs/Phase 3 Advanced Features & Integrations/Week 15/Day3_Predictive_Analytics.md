# Day 3: Predictive Analytics

## Objective
Implement predictive analytics system for compliance risk forecasting and anomaly detection using machine learning models.

## Implementation Steps

1. **Set up Machine Learning Pipeline**
   - Create data preprocessing pipeline
   - Implement feature engineering for compliance data

2. **Build Risk Prediction Models**
   - Train ML models for risk score prediction
   - Implement model evaluation and validation

3. **Implement Anomaly Detection**
   - Add unsupervised anomaly detection algorithms
   - Create real-time anomaly scoring

4. **Integrate Predictive Insights**
   - Connect predictions to dashboard and alerts
   - Add predictive recommendations

## Code Snippets

### 1. Data Preprocessing Pipeline
```typescript
// src/services/analytics/DataPreprocessingPipeline.ts
import { DatabaseService } from '../database/DatabaseService';
import { ComplianceEngine } from '../compliance/ComplianceEngine';

export interface ProcessedTransaction {
  id: string;
  amount: number;
  amount_log: number;
  amount_zscore: number;
  frequency_score: number;
  time_of_day: number;
  day_of_week: number;
  is_weekend: boolean;
  jurisdiction_risk: number;
  entity_age_days: number;
  previous_risk_score: number;
  sanctions_match: boolean;
  kyc_status: number;
  transaction_velocity: number;
  peer_group_average: number;
  risk_score: number; // target variable
}

export class DataPreprocessingPipeline {
  private databaseService: DatabaseService;
  private complianceEngine: ComplianceEngine;

  constructor(databaseService: DatabaseService, complianceEngine: ComplianceEngine) {
    this.databaseService = databaseService;
    this.complianceEngine = complianceEngine;
  }

  async preprocessTransactions(
    startDate: Date,
    endDate: Date,
    limit: number = 10000
  ): Promise<ProcessedTransaction[]> {
    // Fetch raw transaction data
    const rawData = await this.databaseService.getTransactionsForML(startDate, endDate, limit);

    // Process each transaction
    const processedData: ProcessedTransaction[] = [];

    for (const transaction of rawData) {
      const processed = await this.preprocessTransaction(transaction);
      processedData.push(processed);
    }

    return processedData;
  }

  private async preprocessTransaction(rawTransaction: any): Promise<ProcessedTransaction> {
    const transaction = rawTransaction.transaction;
    const entity = rawTransaction.entity;
    const historicalData = rawTransaction.historical;

    // Basic amount features
    const amount = transaction.amount;
    const amount_log = Math.log10(amount + 1);
    const amount_zscore = await this.calculateZScore(amount, historicalData.amounts);

    // Temporal features
    const timestamp = new Date(transaction.timestamp);
    const time_of_day = timestamp.getHours() + timestamp.getMinutes() / 60;
    const day_of_week = timestamp.getDay();
    const is_weekend = day_of_week === 0 || day_of_week === 6;

    // Frequency features
    const frequency_score = await this.calculateFrequencyScore(
      entity.id,
      timestamp,
      historicalData.recentTransactions
    );

    // Entity features
    const entity_age_days = Math.floor(
      (Date.now() - new Date(entity.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Risk features
    const jurisdiction_risk = this.getJurisdictionRiskScore(transaction.jurisdiction);
    const sanctions_match = await this.checkSanctionsMatch(entity);
    const kyc_status = this.getKYCStatusScore(entity.kyc_status);

    // Behavioral features
    const transaction_velocity = await this.calculateTransactionVelocity(
      entity.id,
      timestamp,
      historicalData.recentTransactions
    );

    const peer_group_average = await this.calculatePeerGroupAverage(
      transaction.type,
      transaction.jurisdiction,
      amount
    );

    return {
      id: transaction.id,
      amount,
      amount_log,
      amount_zscore,
      frequency_score,
      time_of_day,
      day_of_week,
      is_weekend,
      jurisdiction_risk,
      entity_age_days,
      previous_risk_score: historicalData.lastRiskScore || 0,
      sanctions_match,
      kyc_status,
      transaction_velocity,
      peer_group_average,
      risk_score: transaction.risk_score || 0,
    };
  }

  private async calculateZScore(value: number, historicalValues: number[]): Promise<number> {
    if (historicalValues.length === 0) return 0;

    const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
    const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : (value - mean) / stdDev;
  }

  private async calculateFrequencyScore(
    entityId: string,
    timestamp: Date,
    recentTransactions: any[]
  ): Promise<number> {
    // Calculate transaction frequency in the last 24 hours
    const oneDayAgo = new Date(timestamp.getTime() - 24 * 60 * 60 * 1000);
    const recentCount = recentTransactions.filter(tx =>
      new Date(tx.timestamp) >= oneDayAgo
    ).length;

    // Normalize to 0-1 scale (assuming max 100 transactions/day is very suspicious)
    return Math.min(recentCount / 100, 1);
  }

  private getJurisdictionRiskScore(jurisdiction: string): number {
    const riskMap: Record<string, number> = {
      'US': 0.2,
      'EU': 0.3,
      'IN': 0.4,
      'CN': 0.8,
      'RU': 0.9,
      'KP': 1.0, // North Korea
      'IR': 0.9, // Iran
    };

    return riskMap[jurisdiction] || 0.5;
  }

  private async checkSanctionsMatch(entity: any): Promise<boolean> {
    // Check against sanctions lists
    const sanctionsLists = await this.databaseService.getSanctionsLists();
    return sanctionsLists.some(list =>
      list.entries.some(entry =>
        entry.name.toLowerCase().includes(entity.name.toLowerCase()) ||
        entry.addresses.includes(entity.address)
      )
    );
  }

  private getKYCStatusScore(kycStatus: string): number {
    switch (kycStatus) {
      case 'verified': return 0.1;
      case 'pending': return 0.5;
      case 'failed': return 0.9;
      case 'not_required': return 0.3;
      default: return 0.7;
    }
  }

  private async calculateTransactionVelocity(
    entityId: string,
    timestamp: Date,
    recentTransactions: any[]
  ): Promise<number> {
    // Calculate average time between transactions
    if (recentTransactions.length < 2) return 0;

    const times = recentTransactions
      .map(tx => new Date(tx.timestamp).getTime())
      .sort((a, b) => a - b);

    const intervals = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const currentInterval = timestamp.getTime() - times[times.length - 1];

    // Return ratio of current interval to average (lower means higher velocity)
    return avgInterval === 0 ? 1 : Math.min(currentInterval / avgInterval, 2);
  }

  private async calculatePeerGroupAverage(
    transactionType: string,
    jurisdiction: string,
    amount: number
  ): Promise<number> {
    // Calculate average amount for similar transactions
    const peerTransactions = await this.databaseService.getPeerTransactions(
      transactionType,
      jurisdiction,
      amount * 0.5,
      amount * 2
    );

    if (peerTransactions.length === 0) return amount;

    const avgAmount = peerTransactions.reduce((sum, tx) => sum + tx.amount, 0) / peerTransactions.length;
    return avgAmount;
  }
}
```

### 2. Risk Prediction Model
```typescript
// src/services/analytics/RiskPredictionModel.ts
import * as tf from '@tensorflow/tfjs-node';
import { ProcessedTransaction } from './DataPreprocessingPipeline';

export class RiskPredictionModel {
  private model: tf.Sequential | null = null;
  private featureColumns = [
    'amount_log', 'amount_zscore', 'frequency_score', 'time_of_day',
    'day_of_week', 'is_weekend', 'jurisdiction_risk', 'entity_age_days',
    'previous_risk_score', 'sanctions_match', 'kyc_status',
    'transaction_velocity', 'peer_group_average'
  ];

  async trainModel(trainingData: ProcessedTransaction[]): Promise<void> {
    // Prepare training data
    const { features, labels } = this.prepareTrainingData(trainingData);

    // Create model
    this.model = tf.sequential();

    this.model.add(tf.layers.dense({ inputShape: [this.featureColumns.length], units: 64, activation: 'relu' }));
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    this.model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    this.model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    // Compile model
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'mse'],
    });

    // Train model
    await this.model.fit(features, labels, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.acc}`);
        },
      },
    });
  }

  async predictRisk(transaction: ProcessedTransaction): Promise<number> {
    if (!this.model) {
      throw new Error('Model not trained');
    }

    const features = this.extractFeatures(transaction);
    const prediction = this.model.predict(features) as tf.Tensor;

    const riskScore = (await prediction.data())[0];
    return Math.min(Math.max(riskScore * 100, 0), 100); // Convert to 0-100 scale
  }

  async predictBatch(transactions: ProcessedTransaction[]): Promise<number[]> {
    if (!this.model) {
      throw new Error('Model not trained');
    }

    const features = tf.concat(transactions.map(tx => this.extractFeatures(tx)));
    const predictions = this.model.predict(features) as tf.Tensor;

    const riskScores = await predictions.data();
    return Array.from(riskScores).map(score => Math.min(Math.max(score * 100, 0), 100));
  }

  private prepareTrainingData(data: ProcessedTransaction[]): { features: tf.Tensor; labels: tf.Tensor } {
    const features = tf.concat(data.map(tx => this.extractFeatures(tx)));
    const labels = tf.tensor1d(data.map(tx => tx.risk_score / 100)); // Normalize to 0-1

    return { features, labels };
  }

  private extractFeatures(transaction: ProcessedTransaction): tf.Tensor {
    const featureValues = this.featureColumns.map(col => {
      const value = (transaction as any)[col];
      return typeof value === 'boolean' ? (value ? 1 : 0) : value;
    });

    return tf.tensor1d(featureValues);
  }

  async saveModel(path: string): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    await this.model.save(`file://${path}`);
  }

  async loadModel(path: string): Promise<void> {
    this.model = await tf.loadLayersModel(`file://${path}`);
  }

  async evaluateModel(testData: ProcessedTransaction[]): Promise<any> {
    if (!this.model) {
      throw new Error('Model not trained');
    }

    const { features, labels } = this.prepareTrainingData(testData);
    const evaluation = await this.model.evaluate(features, labels) as tf.Scalar[];

    return {
      loss: await evaluation[0].data(),
      accuracy: await evaluation[1].data(),
      mse: await evaluation[2].data(),
    };
  }

  getFeatureImportance(): Record<string, number> {
    // Simplified feature importance calculation
    // In practice, this would use more sophisticated methods
    const importance: Record<string, number> = {};

    this.featureColumns.forEach((feature, index) => {
      // Mock importance scores - would be calculated from actual model weights
      importance[feature] = Math.random();
    });

    return importance;
  }
}
```

### 3. Anomaly Detection System
```typescript
// src/services/analytics/AnomalyDetection.ts
import { ProcessedTransaction } from './DataPreprocessingPipeline';
import { IsolationForest } from 'ml-isolation-forest';
import { StandardScaler } from 'ml-preprocess';

export class AnomalyDetection {
  private isolationForest: IsolationForest | null = null;
  private scaler: StandardScaler;
  private trained: boolean = false;

  constructor() {
    this.scaler = new StandardScaler();
  }

  async trainModel(trainingData: ProcessedTransaction[]): Promise<void> {
    // Extract numerical features for anomaly detection
    const features = trainingData.map(tx => [
      tx.amount_log,
      tx.amount_zscore,
      tx.frequency_score,
      tx.jurisdiction_risk,
      tx.transaction_velocity,
      tx.peer_group_average,
    ]);

    // Scale features
    const scaledFeatures = this.scaler.fitTransform(features);

    // Train isolation forest
    this.isolationForest = new IsolationForest({
      nEstimators: 100,
      maxSamples: 'auto',
      contamination: 0.1, // Expected proportion of anomalies
      randomState: 42,
    });

    this.isolationForest.fit(scaledFeatures);
    this.trained = true;
  }

  async detectAnomaly(transaction: ProcessedTransaction): Promise<{
    isAnomaly: boolean;
    anomalyScore: number;
    confidence: number;
  }> {
    if (!this.trained || !this.isolationForest) {
      throw new Error('Model not trained');
    }

    const features = [
      transaction.amount_log,
      transaction.amount_zscore,
      transaction.frequency_score,
      transaction.jurisdiction_risk,
      transaction.transaction_velocity,
      transaction.peer_group_average,
    ];

    const scaledFeatures = this.scaler.transform([features]);
    const scores = this.isolationForest.scoreSamples(scaledFeatures);

    const anomalyScore = scores[0];
    const isAnomaly = anomalyScore < 0; // Negative scores indicate anomalies
    const confidence = Math.abs(anomalyScore); // Higher absolute value = higher confidence

    return {
      isAnomaly,
      anomalyScore,
      confidence: Math.min(confidence, 1), // Normalize to 0-1
    };
  }

  async detectAnomaliesBatch(transactions: ProcessedTransaction[]): Promise<Array<{
    transactionId: string;
    isAnomaly: boolean;
    anomalyScore: number;
    confidence: number;
  }>> {
    if (!this.trained || !this.isolationForest) {
      throw new Error('Model not trained');
    }

    const features = transactions.map(tx => [
      tx.amount_log,
      tx.amount_zscore,
      tx.frequency_score,
      tx.jurisdiction_risk,
      tx.transaction_velocity,
      tx.peer_group_average,
    ]);

    const scaledFeatures = this.scaler.transform(features);
    const scores = this.isolationForest.scoreSamples(scaledFeatures);

    return transactions.map((tx, index) => {
      const anomalyScore = scores[index];
      const isAnomaly = anomalyScore < 0;
      const confidence = Math.abs(anomalyScore);

      return {
        transactionId: tx.id,
        isAnomaly,
        anomalyScore,
        confidence: Math.min(confidence, 1),
      };
    });
  }

  async updateModel(newData: ProcessedTransaction[]): Promise<void> {
    if (!this.trained) {
      await this.trainModel(newData);
      return;
    }

    // Online learning - retrain with combined data
    // In practice, this would use a more sophisticated online learning approach
    console.log('Retraining anomaly detection model with new data...');
    await this.trainModel(newData);
  }
}
```

### 4. Predictive Analytics Service
```typescript
// src/services/analytics/PredictiveAnalyticsService.ts
import { DataPreprocessingPipeline, ProcessedTransaction } from './DataPreprocessingPipeline';
import { RiskPredictionModel } from './RiskPredictionModel';
import { AnomalyDetection } from './AnomalyDetection';
import { DatabaseService } from '../database/DatabaseService';
import { ComplianceEngine } from '../compliance/ComplianceEngine';

export interface PredictionResult {
  transactionId: string;
  predictedRisk: number;
  confidence: number;
  isAnomaly: boolean;
  anomalyScore: number;
  riskFactors: string[];
  recommendations: string[];
}

export class PredictiveAnalyticsService {
  private preprocessing: DataPreprocessingPipeline;
  private riskModel: RiskPredictionModel;
  private anomalyDetector: AnomalyDetection;
  private databaseService: DatabaseService;
  private complianceEngine: ComplianceEngine;

  constructor(
    databaseService: DatabaseService,
    complianceEngine: ComplianceEngine
  ) {
    this.preprocessing = new DataPreprocessingPipeline(databaseService, complianceEngine);
    this.riskModel = new RiskPredictionModel();
    this.anomalyDetector = new AnomalyDetection();
    this.databaseService = databaseService;
    this.complianceEngine = complianceEngine;
  }

  async initialize(): Promise<void> {
    // Load or train models
    const trainingData = await this.preprocessing.preprocessTransactions(
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      new Date(),
      50000
    );

    console.log(`Training models with ${trainingData.length} samples...`);

    await this.riskModel.trainModel(trainingData);
    await this.anomalyDetector.trainModel(trainingData);

    console.log('Models trained successfully');
  }

  async predictTransactionRisk(transaction: any): Promise<PredictionResult> {
    // Preprocess transaction
    const processedTransaction = await this.preprocessing.preprocessTransaction({
      transaction,
      entity: await this.databaseService.getEntityById(transaction.entityId),
      historical: await this.databaseService.getEntityHistory(transaction.entityId),
    });

    // Get predictions
    const predictedRisk = await this.riskModel.predictRisk(processedTransaction);
    const anomalyResult = await this.anomalyDetector.detectAnomaly(processedTransaction);

    // Analyze risk factors
    const riskFactors = this.analyzeRiskFactors(processedTransaction, predictedRisk);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      predictedRisk,
      anomalyResult.isAnomaly,
      riskFactors
    );

    return {
      transactionId: transaction.id,
      predictedRisk,
      confidence: 0.85, // Would be calculated based on model certainty
      isAnomaly: anomalyResult.isAnomaly,
      anomalyScore: anomalyResult.anomalyScore,
      riskFactors,
      recommendations,
    };
  }

  async predictBatchRisk(transactions: any[]): Promise<PredictionResult[]> {
    // Preprocess all transactions
    const processedTransactions: ProcessedTransaction[] = [];
    for (const transaction of transactions) {
      const processed = await this.preprocessing.preprocessTransaction({
        transaction,
        entity: await this.databaseService.getEntityById(transaction.entityId),
        historical: await this.databaseService.getEntityHistory(transaction.entityId),
      });
      processedTransactions.push(processed);
    }

    // Batch predictions
    const riskPredictions = await this.riskModel.predictBatch(processedTransactions);
    const anomalyResults = await this.anomalyDetector.detectAnomaliesBatch(processedTransactions);

    // Combine results
    return transactions.map((transaction, index) => {
      const predictedRisk = riskPredictions[index];
      const anomalyResult = anomalyResults[index];
      const processedTransaction = processedTransactions[index];

      const riskFactors = this.analyzeRiskFactors(processedTransaction, predictedRisk);
      const recommendations = this.generateRecommendations(
        predictedRisk,
        anomalyResult.isAnomaly,
        riskFactors
      );

      return {
        transactionId: transaction.id,
        predictedRisk,
        confidence: 0.85,
        isAnomaly: anomalyResult.isAnomaly,
        anomalyScore: anomalyResult.anomalyScore,
        riskFactors,
        recommendations,
      };
    });
  }

  private analyzeRiskFactors(transaction: ProcessedTransaction, predictedRisk: number): string[] {
    const factors: string[] = [];

    if (transaction.amount_zscore > 2) factors.push('Unusual transaction amount');
    if (transaction.frequency_score > 0.7) factors.push('High transaction frequency');
    if (transaction.jurisdiction_risk > 0.7) factors.push('High-risk jurisdiction');
    if (transaction.sanctions_match) factors.push('Sanctions list match');
    if (transaction.kyc_status > 0.7) factors.push('Incomplete KYC');
    if (transaction.transaction_velocity < 0.5) factors.push('High transaction velocity');
    if (Math.abs(transaction.amount - transaction.peer_group_average) / transaction.peer_group_average > 0.5) {
      factors.push('Amount deviates from peer group');
    }

    return factors;
  }

  private generateRecommendations(
    riskScore: number,
    isAnomaly: boolean,
    riskFactors: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore > 80) {
      recommendations.push('Immediate transaction hold recommended');
      recommendations.push('Enhanced due diligence required');
    } else if (riskScore > 60) {
      recommendations.push('Additional verification needed');
      recommendations.push('Monitor entity closely');
    }

    if (isAnomaly) {
      recommendations.push('Transaction flagged as anomalous');
      recommendations.push('Manual review recommended');
    }

    if (riskFactors.includes('Incomplete KYC')) {
      recommendations.push('Complete KYC verification');
    }

    if (riskFactors.includes('High-risk jurisdiction')) {
      recommendations.push('Apply enhanced monitoring for jurisdiction');
    }

    return recommendations;
  }

  async getModelPerformance(): Promise<any> {
    // Evaluate model performance on recent data
    const testData = await this.preprocessing.preprocessTransactions(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      new Date(),
      1000
    );

    const riskEvaluation = await this.riskModel.evaluateModel(testData);

    return {
      riskModel: riskEvaluation,
      featureImportance: this.riskModel.getFeatureImportance(),
      lastTrained: new Date(), // Would track actual training time
    };
  }

  async retrainModels(): Promise<void> {
    console.log('Retraining predictive models...');
    await this.initialize();
  }
}
```

## Notes
- Predictive analytics uses machine learning to forecast compliance risks
- Feature engineering transforms raw data into predictive features
- Ensemble of risk prediction and anomaly detection provides comprehensive analysis
- Models are trained on historical compliance data and continuously updated
- Real-time predictions enable proactive compliance monitoring