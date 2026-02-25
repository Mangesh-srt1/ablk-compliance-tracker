# Day 1: Real-time Dashboards

## Objective
Implement real-time dashboards for compliance monitoring and analytics using React and WebSocket connections.

## Implementation Steps

1. **Set up Dashboard Framework**
   - Create dashboard layout with responsive grid
   - Implement real-time data subscriptions

2. **Create Compliance Metrics Components**
   - Build KPI cards for compliance scores
   - Add charts for risk trends and alerts

3. **Implement Real-time Updates**
   - Set up WebSocket connections for live data
   - Add data streaming and updates

4. **Add Interactive Filters**
   - Implement date range and jurisdiction filters
   - Create drill-down capabilities

## Code Snippets

### 1. Dashboard Layout Component
```tsx
// src/components/dashboard/DashboardLayout.tsx
import React, { useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import { ComplianceKPIs } from './ComplianceKPIs';
import { RiskTrendChart } from './RiskTrendChart';
import { AlertSummary } from './AlertSummary';
import { JurisdictionMap } from './JurisdictionMap';
import { useWebSocket } from '../../hooks/useWebSocket';

export const DashboardLayout: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    // Subscribe to real-time dashboard updates
    const subscription = subscribe('dashboard:metrics', (data) => {
      setDashboardData(data);
    });

    // Initial data load
    fetchDashboardData();

    return () => {
      unsubscribe(subscription);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/metrics');
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  if (!dashboardData) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Compliance Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <ComplianceKPIs data={dashboardData.kpis} />
          </Paper>
        </Grid>

        {/* Risk Trends */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <RiskTrendChart data={dashboardData.riskTrends} />
          </Paper>
        </Grid>

        {/* Alert Summary */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <AlertSummary data={dashboardData.alerts} />
          </Paper>
        </Grid>

        {/* Jurisdiction Map */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <JurisdictionMap data={dashboardData.jurisdictions} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
```

### 2. Compliance KPIs Component
```tsx
// src/components/dashboard/ComplianceKPIs.tsx
import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { TrendingUp, TrendingDown, Warning, CheckCircle } from '@mui/icons-material';

interface KPIMetric {
  label: string;
  value: number;
  change: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface ComplianceKPIsProps {
  data: {
    totalTransactions: KPIMetric;
    complianceRate: KPIMetric;
    riskScore: KPIMetric;
    alertsToday: KPIMetric;
  };
}

export const ComplianceKPIs: React.FC<ComplianceKPIsProps> = ({ data }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
      default: return '#2196f3';
    }
  };

  const getStatusIcon = (status: string, change: number) => {
    if (status === 'critical') return <Warning />;
    if (change > 0) return <TrendingUp />;
    if (change < 0) return <TrendingDown />;
    return <CheckCircle />;
  };

  const KPICard: React.FC<{ metric: KPIMetric }> = ({ metric }) => (
    <Card sx={{ minWidth: 200 }}>
      <CardContent>
        <Typography color="textSecondary" gutterBottom>
          {metric.label}
        </Typography>
        <Box display="flex" alignItems="center" mb={1}>
          <Typography variant="h4" component="div" sx={{ mr: 1 }}>
            {metric.value.toLocaleString()}{metric.unit}
          </Typography>
          {getStatusIcon(metric.status, metric.change)}
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: metric.change >= 0 ? '#4caf50' : '#f44336',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {metric.change > 0 ? '+' : ''}{metric.change}% from yesterday
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard metric={data.totalTransactions} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard metric={data.complianceRate} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard metric={data.riskScore} />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KPICard metric={data.alertsToday} />
      </Grid>
    </Grid>
  );
};
```

### 3. Risk Trend Chart Component
```tsx
// src/components/dashboard/RiskTrendChart.tsx
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface RiskTrendData {
  timestamp: string;
  overallRisk: number;
  amlRisk: number;
  kycRisk: number;
  sanctionsRisk: number;
}

interface RiskTrendChartProps {
  data: RiskTrendData[];
}

export const RiskTrendChart: React.FC<RiskTrendChartProps> = ({ data }) => {
  return (
    <div>
      <h3>Risk Trends (Last 24 Hours)</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => new Date(value).toLocaleTimeString()}
          />
          <YAxis domain={[0, 100]} />
          <Tooltip
            labelFormatter={(value) => new Date(value).toLocaleString()}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)}%`,
              name.replace('Risk', ' Risk')
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="overallRisk"
            stroke="#8884d8"
            strokeWidth={2}
            name="Overall Risk"
          />
          <Line
            type="monotone"
            dataKey="amlRisk"
            stroke="#82ca9d"
            name="AML Risk"
          />
          <Line
            type="monotone"
            dataKey="kycRisk"
            stroke="#ffc658"
            name="KYC Risk"
          />
          <Line
            type="monotone"
            dataKey="sanctionsRisk"
            stroke="#ff7300"
            name="Sanctions Risk"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

### 4. WebSocket Hook for Real-time Updates
```tsx
// src/hooks/useWebSocket.ts
import { useRef, useEffect, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  payload: any;
}

export const useWebSocket = () => {
  const ws = useRef<WebSocket | null>(null);
  const subscriptions = useRef<Map<string, (data: any) => void>>(new Map());

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:8080');

      ws.current.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          const callback = subscriptions.current.get(message.type);
          if (callback) {
            callback(message.payload);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connect, 1000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const subscribe = useCallback((type: string, callback: (data: any) => void) => {
    subscriptions.current.set(type, callback);
    return type;
  }, []);

  const unsubscribe = useCallback((subscriptionId: string) => {
    subscriptions.current.delete(subscriptionId);
  }, []);

  const send = useCallback((type: string, payload: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { subscribe, unsubscribe, send };
};
```

### 5. Backend WebSocket Server
```typescript
// src/services/websocket/WebSocketServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ComplianceEngine } from '../compliance/ComplianceEngine';

export class DashboardWebSocketServer {
  private wss: WebSocketServer;
  private complianceEngine: ComplianceEngine;
  private clients: Set<WebSocket> = new Set();

  constructor(server: any, complianceEngine: ComplianceEngine) {
    this.complianceEngine = complianceEngine;
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Start broadcasting updates
    this.startBroadcasting();
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    console.log('New WebSocket connection');
    this.clients.add(ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.clients.delete(ws);
    });

    // Send initial dashboard data
    this.sendInitialData(ws);
  }

  private handleMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe':
        // Handle subscription requests
        break;
      case 'unsubscribe':
        // Handle unsubscription requests
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private async sendInitialData(ws: WebSocket): Promise<void> {
    try {
      const dashboardData = await this.getDashboardData();
      ws.send(JSON.stringify({
        type: 'dashboard:metrics',
        payload: dashboardData,
      }));
    } catch (error) {
      console.error('Failed to send initial data:', error);
    }
  }

  private async getDashboardData(): Promise<any> {
    // Aggregate data from compliance engine
    const metrics = await this.complianceEngine.getMetrics();

    return {
      kpis: {
        totalTransactions: {
          label: 'Total Transactions',
          value: metrics.totalTransactions,
          change: metrics.transactionChange,
          unit: '',
          status: 'good',
        },
        complianceRate: {
          label: 'Compliance Rate',
          value: metrics.complianceRate,
          change: metrics.complianceChange,
          unit: '%',
          status: metrics.complianceRate > 95 ? 'good' : metrics.complianceRate > 85 ? 'warning' : 'critical',
        },
        riskScore: {
          label: 'Average Risk Score',
          value: metrics.averageRiskScore,
          change: metrics.riskChange,
          unit: '',
          status: metrics.averageRiskScore < 30 ? 'good' : metrics.averageRiskScore < 60 ? 'warning' : 'critical',
        },
        alertsToday: {
          label: 'Alerts Today',
          value: metrics.alertsToday,
          change: metrics.alertsChange,
          unit: '',
          status: metrics.alertsToday < 10 ? 'good' : metrics.alertsToday < 50 ? 'warning' : 'critical',
        },
      },
      riskTrends: metrics.riskTrends,
      alerts: metrics.alertSummary,
      jurisdictions: metrics.jurisdictionData,
    };
  }

  private startBroadcasting(): void {
    // Broadcast updates every 30 seconds
    setInterval(async () => {
      if (this.clients.size > 0) {
        try {
          const dashboardData = await this.getDashboardData();

          this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'dashboard:metrics',
                payload: dashboardData,
              }));
            }
          });
        } catch (error) {
          console.error('Failed to broadcast dashboard data:', error);
        }
      }
    }, 30000);
  }

  public broadcastAlert(alert: any): void {
    const message = JSON.stringify({
      type: 'alert:new',
      payload: alert,
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

## Notes
- Real-time dashboards provide immediate visibility into compliance status
- WebSocket connections enable live updates without polling
- Responsive design ensures usability across devices
- KPI cards show key metrics with trend indicators
- Charts visualize risk trends and patterns over time