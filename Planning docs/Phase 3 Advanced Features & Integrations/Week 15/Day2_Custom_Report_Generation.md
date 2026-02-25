# Day 2: Custom Report Generation

## Objective
Implement custom report generation system allowing users to create, schedule, and export compliance reports in multiple formats.

## Implementation Steps

1. **Create Report Builder Interface**
   - Design report template system
   - Implement drag-and-drop report builder

2. **Implement Report Engine**
   - Build report generation logic
   - Add data aggregation and formatting

3. **Add Export Capabilities**
   - Support PDF, Excel, and CSV exports
   - Implement scheduled report generation

4. **Create Report Templates**
   - Build predefined compliance report templates
   - Add custom template creation

## Code Snippets

### 1. Report Builder Component
```tsx
// src/components/reports/ReportBuilder.tsx
import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip
} from '@mui/material';
import { ExpandMore, Add, Save, PlayArrow } from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ReportElementPalette } from './ReportElementPalette';
import { ReportPreview } from './ReportPreview';
import { ReportTemplate } from '../../types/reports';

interface ReportBuilderProps {
  onSave: (template: ReportTemplate) => void;
  onGenerate: (template: ReportTemplate) => void;
  initialTemplate?: ReportTemplate;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  onSave,
  onGenerate,
  initialTemplate
}) => {
  const [template, setTemplate] = useState<ReportTemplate>(initialTemplate || {
    id: '',
    name: '',
    description: '',
    elements: [],
    filters: {},
    schedule: null,
  });

  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;

    if (source.droppableId === 'palette' && destination.droppableId === 'canvas') {
      // Add new element to canvas
      const newElement = {
        id: `element_${Date.now()}`,
        type: result.draggableId,
        position: destination.index,
        config: getDefaultConfig(result.draggableId),
      };

      const newElements = [...template.elements];
      newElements.splice(destination.index, 0, newElement);

      setTemplate(prev => ({
        ...prev,
        elements: newElements,
      }));
    } else if (source.droppableId === 'canvas' && destination.droppableId === 'canvas') {
      // Reorder elements
      const newElements = [...template.elements];
      const [removed] = newElements.splice(source.index, 1);
      newElements.splice(destination.index, 0, removed);

      setTemplate(prev => ({
        ...prev,
        elements: newElements,
      }));
    }
  }, [template.elements]);

  const getDefaultConfig = (elementType: string) => {
    switch (elementType) {
      case 'kpi':
        return { title: 'KPI Metric', metric: 'compliance_rate' };
      case 'chart':
        return { title: 'Risk Trend', type: 'line', dataSource: 'risk_trends' };
      case 'table':
        return { title: 'Transaction Summary', columns: ['date', 'amount', 'risk_score'] };
      case 'text':
        return { content: 'Enter your text here' };
      default:
        return {};
    }
  };

  const updateElementConfig = (elementId: string, config: any) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(el =>
        el.id === elementId ? { ...el, config: { ...el.config, ...config } } : el
      ),
    }));
  };

  const removeElement = (elementId: string) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== elementId),
    }));
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Report Name"
              value={template.name}
              onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Description"
              value={template.description}
              onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={() => onSave(template)}
              >
                Save Template
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={() => onGenerate(template)}
              >
                Generate Report
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Element Palette */}
        <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider', p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Report Elements
          </Typography>
          <ReportElementPalette />
        </Box>

        {/* Canvas */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Report Canvas
          </Typography>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="canvas">
              {(provided) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{ minHeight: 600, border: '2px dashed #ccc', borderRadius: 1, p: 2 }}
                >
                  {template.elements.map((element, index) => (
                    <Draggable key={element.id} draggableId={element.id} index={index}>
                      {(provided) => (
                        <Paper
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          sx={{ p: 2, mb: 2, cursor: 'move' }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                            <Chip label={element.type} color="primary" />
                            <Button
                              size="small"
                              color="error"
                              onClick={() => removeElement(element.id)}
                            >
                              Remove
                            </Button>
                          </Box>
                          {/* Element configuration would go here */}
                          <ReportElementConfig
                            element={element}
                            onUpdate={(config) => updateElementConfig(element.id, config)}
                          />
                        </Paper>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </DragDropContext>
        </Box>

        {/* Preview */}
        <Box sx={{ width: 400, borderLeft: 1, borderColor: 'divider', p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Preview
          </Typography>
          <ReportPreview template={template} />
        </Box>
      </Box>
    </Box>
  );
};
```

### 2. Report Engine
```typescript
// src/services/reports/ReportEngine.ts
import { ReportTemplate, ReportData, ReportFormat } from '../../types/reports';
import { ComplianceEngine } from '../compliance/ComplianceEngine';
import { DatabaseService } from '../database/DatabaseService';

export class ReportEngine {
  private complianceEngine: ComplianceEngine;
  private databaseService: DatabaseService;

  constructor(complianceEngine: ComplianceEngine, databaseService: DatabaseService) {
    this.complianceEngine = complianceEngine;
    this.databaseService = databaseService;
  }

  async generateReport(template: ReportTemplate, filters: any = {}): Promise<ReportData> {
    const reportData: ReportData = {
      id: `report_${Date.now()}`,
      templateId: template.id,
      generatedAt: new Date(),
      data: {},
      metadata: {
        filters,
        elementCount: template.elements.length,
      },
    };

    // Generate data for each element
    for (const element of template.elements) {
      try {
        const elementData = await this.generateElementData(element, filters);
        reportData.data[element.id] = elementData;
      } catch (error) {
        console.error(`Failed to generate data for element ${element.id}:`, error);
        reportData.data[element.id] = { error: 'Failed to generate data' };
      }
    }

    return reportData;
  }

  private async generateElementData(element: any, filters: any): Promise<any> {
    switch (element.type) {
      case 'kpi':
        return this.generateKPIData(element.config, filters);

      case 'chart':
        return this.generateChartData(element.config, filters);

      case 'table':
        return this.generateTableData(element.config, filters);

      case 'text':
        return { content: element.config.content };

      default:
        throw new Error(`Unknown element type: ${element.type}`);
    }
  }

  private async generateKPIData(config: any, filters: any): Promise<any> {
    const metrics = await this.complianceEngine.getMetrics(filters);

    switch (config.metric) {
      case 'compliance_rate':
        return {
          value: metrics.complianceRate,
          label: 'Compliance Rate',
          unit: '%',
          change: metrics.complianceChange,
        };

      case 'total_transactions':
        return {
          value: metrics.totalTransactions,
          label: 'Total Transactions',
          unit: '',
          change: metrics.transactionChange,
        };

      case 'risk_score':
        return {
          value: metrics.averageRiskScore,
          label: 'Average Risk Score',
          unit: '',
          change: metrics.riskChange,
        };

      default:
        return { value: 0, label: 'Unknown Metric' };
    }
  }

  private async generateChartData(config: any, filters: any): Promise<any> {
    const timeRange = filters.timeRange || { hours: 24 };

    switch (config.dataSource) {
      case 'risk_trends':
        const riskData = await this.databaseService.getRiskTrends(timeRange);
        return {
          type: config.type || 'line',
          data: riskData,
          xAxis: 'timestamp',
          yAxis: 'risk_score',
        };

      case 'transaction_volume':
        const volumeData = await this.databaseService.getTransactionVolume(timeRange);
        return {
          type: config.type || 'bar',
          data: volumeData,
          xAxis: 'date',
          yAxis: 'volume',
        };

      default:
        return { data: [] };
    }
  }

  private async generateTableData(config: any, filters: any): Promise<any> {
    const query = this.buildTableQuery(config, filters);
    const data = await this.databaseService.executeQuery(query);

    return {
      columns: config.columns,
      data: data.rows,
      totalRows: data.totalCount,
    };
  }

  private buildTableQuery(config: any, filters: any): any {
    // Build database query based on config and filters
    return {
      table: 'transactions',
      columns: config.columns,
      where: filters,
      orderBy: config.sortBy || 'created_at DESC',
      limit: config.limit || 1000,
    };
  }

  async exportReport(reportData: ReportData, format: ReportFormat): Promise<Buffer> {
    switch (format) {
      case 'pdf':
        return this.exportToPDF(reportData);

      case 'excel':
        return this.exportToExcel(reportData);

      case 'csv':
        return this.exportToCSV(reportData);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportToPDF(reportData: ReportData): Promise<Buffer> {
    // Implementation using pdfkit or puppeteer
    // This would generate a PDF with the report data
    return Buffer.from('PDF content');
  }

  private async exportToExcel(reportData: ReportData): Promise<Buffer> {
    // Implementation using exceljs
    // This would generate an Excel file with the report data
    return Buffer.from('Excel content');
  }

  private async exportToCSV(reportData: ReportData): Promise<Buffer> {
    // Implementation for CSV export
    // This would generate CSV data from table elements
    return Buffer.from('CSV content');
  }
}
```

### 3. Report Templates
```typescript
// src/services/reports/ReportTemplates.ts
import { ReportTemplate } from '../../types/reports';

export class ReportTemplates {
  static getPredefinedTemplates(): ReportTemplate[] {
    return [
      {
        id: 'daily_compliance_summary',
        name: 'Daily Compliance Summary',
        description: 'Overview of daily compliance metrics and alerts',
        elements: [
          {
            id: 'header',
            type: 'text',
            position: 0,
            config: {
              content: '# Daily Compliance Summary\n\nGenerated on: {date}',
            },
          },
          {
            id: 'kpi_compliance_rate',
            type: 'kpi',
            position: 1,
            config: {
              title: 'Compliance Rate',
              metric: 'compliance_rate',
            },
          },
          {
            id: 'kpi_total_transactions',
            type: 'kpi',
            position: 2,
            config: {
              title: 'Total Transactions',
              metric: 'total_transactions',
            },
          },
          {
            id: 'chart_risk_trends',
            type: 'chart',
            position: 3,
            config: {
              title: 'Risk Trends (24h)',
              type: 'line',
              dataSource: 'risk_trends',
            },
          },
          {
            id: 'table_recent_alerts',
            type: 'table',
            position: 4,
            config: {
              title: 'Recent Alerts',
              columns: ['timestamp', 'type', 'severity', 'description'],
              limit: 50,
            },
          },
        ],
        filters: {
          timeRange: { hours: 24 },
        },
        schedule: {
          frequency: 'daily',
          time: '09:00',
          timezone: 'UTC',
        },
      },
      {
        id: 'weekly_risk_assessment',
        name: 'Weekly Risk Assessment',
        description: 'Comprehensive weekly risk analysis report',
        elements: [
          {
            id: 'header',
            type: 'text',
            position: 0,
            config: {
              content: '# Weekly Risk Assessment Report\n\nWeek of: {week_start} - {week_end}',
            },
          },
          {
            id: 'chart_risk_distribution',
            type: 'chart',
            position: 1,
            config: {
              title: 'Risk Score Distribution',
              type: 'histogram',
              dataSource: 'risk_distribution',
            },
          },
          {
            id: 'table_high_risk_transactions',
            type: 'table',
            position: 2,
            config: {
              title: 'High Risk Transactions',
              columns: ['id', 'amount', 'risk_score', 'jurisdiction', 'timestamp'],
              filters: { risk_score: { gt: 70 } },
              limit: 100,
            },
          },
          {
            id: 'chart_jurisdiction_risks',
            type: 'chart',
            position: 3,
            config: {
              title: 'Risk by Jurisdiction',
              type: 'bar',
              dataSource: 'jurisdiction_risks',
            },
          },
        ],
        filters: {
          timeRange: { days: 7 },
        },
        schedule: {
          frequency: 'weekly',
          dayOfWeek: 1, // Monday
          time: '08:00',
          timezone: 'UTC',
        },
      },
    ];
  }

  static createCustomTemplate(name: string, description: string): ReportTemplate {
    return {
      id: `custom_${Date.now()}`,
      name,
      description,
      elements: [],
      filters: {},
      schedule: null,
    };
  }
}
```

### 4. Scheduled Reports
```typescript
// src/services/reports/ScheduledReports.ts
import { ReportTemplate, ReportSchedule } from '../../types/reports';
import { ReportEngine } from './ReportEngine';
import * as cron from 'node-cron';
import * as nodemailer from 'nodemailer';

export class ScheduledReports {
  private reportEngine: ReportEngine;
  private schedules: Map<string, cron.ScheduledTask> = new Map();
  private emailTransporter: nodemailer.Transporter;

  constructor(reportEngine: ReportEngine) {
    this.reportEngine = reportEngine;
    this.emailTransporter = nodemailer.createTransporter({
      // Email configuration
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  scheduleReport(template: ReportTemplate, schedule: ReportSchedule): void {
    if (!schedule) return;

    const cronExpression = this.buildCronExpression(schedule);

    const task = cron.schedule(cronExpression, async () => {
      try {
        await this.generateAndSendReport(template, schedule);
      } catch (error) {
        console.error(`Failed to generate scheduled report ${template.id}:`, error);
      }
    });

    this.schedules.set(template.id, task);
  }

  unscheduleReport(templateId: string): void {
    const task = this.schedules.get(templateId);
    if (task) {
      task.destroy();
      this.schedules.delete(templateId);
    }
  }

  private buildCronExpression(schedule: ReportSchedule): string {
    const { frequency, time, dayOfWeek } = schedule;
    const [hours, minutes] = time.split(':').map(Number);

    switch (frequency) {
      case 'daily':
        return `${minutes} ${hours} * * *`;

      case 'weekly':
        return `${minutes} ${hours} * * ${dayOfWeek}`;

      case 'monthly':
        return `${minutes} ${hours} 1 * *`;

      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  }

  private async generateAndSendReport(template: ReportTemplate, schedule: ReportSchedule): Promise<void> {
    // Generate report
    const reportData = await this.reportEngine.generateReport(template);

    // Export in preferred format
    const format = schedule.format || 'pdf';
    const reportBuffer = await this.reportEngine.exportReport(reportData, format);

    // Send via email
    if (schedule.recipients && schedule.recipients.length > 0) {
      const attachments = [{
        filename: `${template.name}.${format}`,
        content: reportBuffer,
      }];

      await this.emailTransporter.sendMail({
        from: process.env.REPORT_FROM_EMAIL,
        to: schedule.recipients.join(','),
        subject: `Scheduled Report: ${template.name}`,
        text: `Please find attached the scheduled report: ${template.name}`,
        attachments,
      });

      console.log(`Sent scheduled report ${template.id} to ${schedule.recipients.length} recipients`);
    }
  }

  getScheduledReports(): string[] {
    return Array.from(this.schedules.keys());
  }

  getScheduleStatus(templateId: string): boolean {
    return this.schedules.has(templateId);
  }
}
```

## Notes
- Custom report builder allows users to create tailored compliance reports
- Drag-and-drop interface makes report creation intuitive
- Multiple export formats support different use cases
- Scheduled reports automate regular compliance reporting
- Template system enables reuse and standardization