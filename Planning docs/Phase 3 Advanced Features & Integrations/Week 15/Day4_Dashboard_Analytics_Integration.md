# Day 4: Dashboard Analytics Integration

## Objective
Integrate predictive analytics and real-time insights into the dashboard for enhanced compliance monitoring.

## Implementation Steps

1. **Create Analytics Dashboard Components**
   - Build predictive risk indicators
   - Add anomaly detection visualizations

2. **Implement Real-time Analytics Updates**
   - Stream predictive insights to dashboard
   - Add predictive alerts and notifications

3. **Add Analytics Controls**
   - Create model performance monitoring
   - Add retraining and model management

4. **Integrate Predictive Recommendations**
   - Display AI-generated recommendations
   - Add actionable insights

## Code Snippets

### 1. Predictive Risk Indicators Component
```tsx
// src/components/dashboard/PredictiveRiskIndicators.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, LinearProgress, Chip } from '@mui/material';
import { TrendingUp, Warning, CheckCircle, Error } from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';

interface PredictiveMetrics {
  currentRisk: number;
  predictedRisk: number;
  riskChange: number;
  anomalyScore: number;
  confidence: number;
  topRiskFactors: string[];
  recommendations: string[];
}

interface PredictiveRiskIndicatorsProps {
  transactionId?: string;
}

export const PredictiveRiskIndicators: React.FC<PredictiveRiskIndicatorsProps> = ({
  transactionId
}) => {
  const [metrics, setMetrics] = useState<PredictiveMetrics | null>(null);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    const subscription = subscribe('analytics:predictions', (data: PredictiveMetrics) => {
      if (!transactionId || data.transactionId === transactionId) {
        setMetrics(data);
      }
    });

    // Fetch initial data
    if (transactionId) {
      fetchTransactionAnalytics(transactionId);
    } else {
      fetchGlobalAnalytics();
    }

    return () => unsubscribe(subscription);
  }, [transactionId]);

  const fetchTransactionAnalytics = async (id: string) => {
    try {
      const response = await fetch(`/api/analytics/transaction/${id}`);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch transaction analytics:', error);
    }
  };

  const fetchGlobalAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/global');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch global analytics:', error);
    }
  };

  if (!metrics) {
    return <div>Loading predictive analytics...</div>;
  }

  const getRiskColor = (risk: number) => {
    if (risk >= 80) return '#f44336';
    if (risk >= 60) return '#ff9800';
    if (risk >= 40) return '#ffeb3b';
    return '#4caf50';
  };

  const getRiskIcon = (risk: number) => {
    if (risk >= 80) return <Error />;
    if (risk >= 60) return <Warning />;
    return <CheckCircle />;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Current vs Predicted Risk */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Risk Assessment
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="body1" sx={{ mr: 2 }}>
              Current Risk: {metrics.currentRisk.toFixed(1)}%
            </Typography>
            {getRiskIcon(metrics.currentRisk)}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="body1" sx={{ mr: 2 }}>
              Predicted Risk: {metrics.predictedRisk.toFixed(1)}%
            </Typography>
            {getRiskIcon(metrics.predictedRisk)}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TrendingUp
              sx={{
                color: metrics.riskChange > 0 ? '#f44336' : '#4caf50',
                mr: 1
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: metrics.riskChange > 0 ? '#f44336' : '#4caf50'
              }}
            >
              {metrics.riskChange > 0 ? '+' : ''}{metrics.riskChange.toFixed(1)}% change
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Anomaly Score */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Anomaly Detection
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Anomaly Score: {metrics.anomalyScore.toFixed(3)}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.abs(metrics.anomalyScore) * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#e0e0e0',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: metrics.anomalyScore < 0 ? '#f44336' : '#4caf50',
                },
              }}
            />
          </Box>
          <Typography variant="body2" color="textSecondary">
            Confidence: {(metrics.confidence * 100).toFixed(1)}%
          </Typography>
        </CardContent>
      </Card>

      {/* Risk Factors */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Top Risk Factors
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {metrics.topRiskFactors.map((factor, index) => (
              <Chip
                key={index}
                label={factor}
                size="small"
                color="warning"
                variant="outlined"
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            AI Recommendations
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {metrics.recommendations.map((recommendation, index) => (
              <Box
                key={index}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  backgroundColor: '#e3f2fd',
                  border: '1px solid #2196f3'
                }}
              >
                <Typography variant="body2">
                  {recommendation}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
```

### 2. Analytics WebSocket Integration
```tsx
// src/services/websocket/AnalyticsWebSocketServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import { PredictiveAnalyticsService } from '../analytics/PredictiveAnalyticsService';

export class AnalyticsWebSocketServer {
  private wss: WebSocketServer;
  private analyticsService: PredictiveAnalyticsService;
  private clients: Set<WebSocket> = new Set();

  constructor(server: any, analyticsService: PredictiveAnalyticsService) {
    this.analyticsService = analyticsService;
    this.wss = new WebSocketServer({ server, path: '/analytics' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // Start streaming analytics
    this.startAnalyticsStreaming();
  }

  private handleConnection(ws: WebSocket): void {
    console.log('Analytics WebSocket connection established');
    this.clients.add(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Invalid analytics WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Analytics WebSocket connection closed');
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('Analytics WebSocket error:', error);
      this.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe:transaction':
        // Handle transaction-specific analytics subscription
        this.subscribeToTransaction(ws, message.transactionId);
        break;
      case 'unsubscribe:transaction':
        // Handle unsubscription
        break;
      default:
        console.log('Unknown analytics message type:', message.type);
    }
  }

  private async subscribeToTransaction(ws: WebSocket, transactionId: string): Promise<void> {
    try {
      // Get initial analytics for transaction
      const analytics = await this.analyticsService.predictTransactionRisk({ id: transactionId });

      ws.send(JSON.stringify({
        type: 'analytics:transaction',
        transactionId,
        data: analytics,
      }));
    } catch (error) {
      console.error('Failed to get transaction analytics:', error);
    }
  }

  private async startAnalyticsStreaming(): Promise<void> {
    // Stream global analytics every 30 seconds
    setInterval(async () => {
      if (this.clients.size > 0) {
        try {
          const globalAnalytics = await this.getGlobalAnalytics();

          this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'analytics:global',
                data: globalAnalytics,
              }));
            }
          });
        } catch (error) {
          console.error('Failed to stream global analytics:', error);
        }
      }
    }, 30000);
  }

  private async getGlobalAnalytics(): Promise<any> {
    // Aggregate analytics across all recent transactions
    const recentTransactions = await this.getRecentTransactions();
    const predictions = await this.analyticsService.predictBatchRisk(recentTransactions);

    const avgRisk = predictions.reduce((sum, p) => sum + p.predictedRisk, 0) / predictions.length;
    const anomalyCount = predictions.filter(p => p.isAnomaly).length;
    const highRiskCount = predictions.filter(p => p.predictedRisk > 70).length;

    return {
      averageRisk: avgRisk,
      anomalyCount,
      highRiskCount,
      totalTransactions: predictions.length,
      topRiskFactors: this.getTopRiskFactors(predictions),
      recommendations: this.generateGlobalRecommendations(avgRisk, anomalyCount),
    };
  }

  private async getRecentTransactions(): Promise<any[]> {
    // Get transactions from last hour
    // Implementation would query database
    return [];
  }

  private getTopRiskFactors(predictions: any[]): string[] {
    const factorCounts: Record<string, number> = {};

    predictions.forEach(prediction => {
      prediction.riskFactors.forEach((factor: string) => {
        factorCounts[factor] = (factorCounts[factor] || 0) + 1;
      });
    });

    return Object.entries(factorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([factor]) => factor);
  }

  private generateGlobalRecommendations(avgRisk: number, anomalyCount: number): string[] {
    const recommendations: string[] = [];

    if (avgRisk > 70) {
      recommendations.push('High average risk detected - review monitoring thresholds');
    }

    if (anomalyCount > 10) {
      recommendations.push('Increased anomalous activity - consider enhanced screening');
    }

    recommendations.push('Monitor predictive model performance regularly');

    return recommendations;
  }

  public broadcastPrediction(prediction: any): void {
    const message = JSON.stringify({
      type: 'analytics:prediction',
      data: prediction,
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public close(): void {
    this.wss.close();
  }
}
```

### 3. Model Performance Dashboard
```tsx
// src/components/dashboard/ModelPerformanceDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Box, Grid, Button,
  LinearProgress, Chip, Alert
} from '@mui/material';
import { Refresh, TrendingUp, Assessment } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  lastUpdated: Date;
}

interface PerformanceData {
  timestamp: string;
  accuracy: number;
  predictions: number;
}

export const ModelPerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceData[]>([]);
  const [isRetraining, setIsRetraining] = useState(false);

  useEffect(() => {
    fetchModelMetrics();
    fetchPerformanceHistory();
  }, []);

  const fetchModelMetrics = async () => {
    try {
      const response = await fetch('/api/analytics/model-performance');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch model metrics:', error);
    }
  };

  const fetchPerformanceHistory = async () => {
    try {
      const response = await fetch('/api/analytics/performance-history');
      const data = await response.json();
      setPerformanceHistory(data);
    } catch (error) {
      console.error('Failed to fetch performance history:', error);
    }
  };

  const handleRetraining = async () => {
    setIsRetraining(true);
    try {
      await fetch('/api/analytics/retrain', { method: 'POST' });
      await fetchModelMetrics();
      await fetchPerformanceHistory();
    } catch (error) {
      console.error('Failed to retrain model:', error);
    } finally {
      setIsRetraining(false);
    }
  };

  const getMetricColor = (value: number, goodThreshold: number) => {
    return value >= goodThreshold ? '#4caf50' : value >= goodThreshold * 0.8 ? '#ff9800' : '#f44336';
  };

  if (!metrics) {
    return <div>Loading model performance...</div>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          AI Model Performance
        </Typography>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={handleRetraining}
          disabled={isRetraining}
        >
          {isRetraining ? 'Retraining...' : 'Retrain Model'}
        </Button>
      </Box>

      {metrics.lastUpdated && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Key Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Model Accuracy
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" sx={{ mr: 2 }}>
                  {(metrics.accuracy * 100).toFixed(1)}%
                </Typography>
                <Chip
                  label={metrics.accuracy > 0.8 ? 'Good' : metrics.accuracy > 0.7 ? 'Fair' : 'Poor'}
                  color={metrics.accuracy > 0.8 ? 'success' : metrics.accuracy > 0.7 ? 'warning' : 'error'}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={metrics.accuracy * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getMetricColor(metrics.accuracy, 0.8),
                  },
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Precision & Recall
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Precision: {(metrics.precision * 100).toFixed(1)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={metrics.precision * 100}
                  sx={{ height: 6, mb: 1 }}
                />
              </Box>
              <Box>
                <Typography variant="body2">
                  Recall: {(metrics.recall * 100).toFixed(1)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={metrics.recall * 100}
                  sx={{ height: 6 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance History Chart */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance History
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Accuracy"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Additional Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                F1 Score & AUC
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="body2">F1 Score</Typography>
                  <Typography variant="h6">{(metrics.f1Score * 100).toFixed(1)}%</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">AUC</Typography>
                  <Typography variant="h6">{(metrics.auc * 100).toFixed(1)}%</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Model Health
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment sx={{ mr: 1, color: '#4caf50' }} />
                <Typography variant="body2">Model Status: Active</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp sx={{ mr: 1, color: '#2196f3' }} />
                <Typography variant="body2">
                  Predictions Today: {performanceHistory[performanceHistory.length - 1]?.predictions || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
```

## Notes
- Dashboard integrates predictive analytics with real-time risk monitoring
- WebSocket streaming provides live updates of AI predictions
- Model performance monitoring ensures prediction quality
- Retraining capabilities keep models current with new data patterns