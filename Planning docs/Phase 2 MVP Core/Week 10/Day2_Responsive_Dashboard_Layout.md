# Day 2: Responsive Dashboard Layout

## Objective
Create a responsive dashboard layout system with customizable widgets, drag-and-drop functionality, and adaptive design for different screen sizes.

## Implementation Steps

1. **Implement Dashboard Grid System**
   - Create responsive grid layout with breakpoints
   - Add widget container system

2. **Develop Widget Framework**
   - Build base widget component with configuration
   - Implement widget registry and factory

3. **Add Drag-and-Drop Functionality**
   - Enable widget repositioning and resizing
   - Implement layout persistence

4. **Create Dashboard Templates**
   - Build predefined dashboard layouts
   - Add template customization

## Code Snippets

### 1. Dashboard Grid System
```tsx
// src/components/dashboard/DashboardGrid.tsx
import React, { useState, useCallback } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { WidthProvider, Responsive, Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  config: any;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
}

export interface DashboardGridProps {
  widgets: DashboardWidget[];
  onLayoutChange: (layout: Layout[], layouts: Layouts) => void;
  onWidgetConfigChange: (widgetId: string, config: any) => void;
  onWidgetRemove: (widgetId: string) => void;
  isEditable?: boolean;
  breakpoints?: { lg: number; md: number; sm: number; xs: number; xxs: number };
  cols?: { lg: number; md: number; sm: number; xs: number; xxs: number };
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  widgets,
  onLayoutChange,
  onWidgetConfigChange,
  onWidgetRemove,
  isEditable = false,
  breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const layouts = React.useMemo(() => {
    const layoutMap: Layouts = {};

    Object.keys(breakpoints).forEach(breakpoint => {
      layoutMap[breakpoint] = widgets.map(widget => ({
        i: widget.id,
        ...widget.layout,
      }));
    });

    return layoutMap;
  }, [widgets, breakpoints]);

  const handleLayoutChange = useCallback((layout: Layout[], layouts: Layouts) => {
    onLayoutChange(layout, layouts);
  }, [onLayoutChange]);

  const handleBreakpointChange = useCallback((newBreakpoint: string, newCols: number) => {
    // Handle breakpoint changes if needed
  }, []);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        onBreakpointChange={handleBreakpointChange}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={30}
        margin={[16, 16]}
        containerPadding={[16, 16]}
        isDraggable={isEditable}
        isResizable={isEditable}
        draggableHandle=".drag-handle"
        resizeHandles={['se']}
        compactType="vertical"
        preventCollision={false}
      >
        {widgets.map(widget => (
          <Box key={widget.id} sx={{ height: '100%' }}>
            <DashboardWidgetContainer
              widget={widget}
              isEditable={isEditable}
              onConfigChange={(config) => onWidgetConfigChange(widget.id, config)}
              onRemove={() => onWidgetRemove(widget.id)}
              isMobile={isMobile}
            />
          </Box>
        ))}
      </ResponsiveGridLayout>
    </Box>
  );
};
```

### 2. Widget Container Component
```tsx
// src/components/dashboard/DashboardWidgetContainer.tsx
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import {
  MoreVert,
  Settings,
  Delete,
  DragIndicator,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import { DashboardWidget } from './DashboardGrid';
import { WidgetRenderer } from './WidgetRenderer';

interface DashboardWidgetContainerProps {
  widget: DashboardWidget;
  isEditable: boolean;
  onConfigChange: (config: any) => void;
  onRemove: () => void;
  isMobile: boolean;
}

export const DashboardWidgetContainer: React.FC<DashboardWidgetContainerProps> = ({
  widget,
  isEditable,
  onConfigChange,
  onRemove,
  isMobile,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleSettingsClick = () => {
    // Open widget configuration dialog
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    onRemove();
    handleMenuClose();
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? theme.zIndex.modal : 'auto',
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isEditable && (
              <DragIndicator
                className="drag-handle"
                sx={{
                  mr: 1,
                  cursor: 'move',
                  color: theme.palette.text.secondary,
                }}
              />
            )}
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {widget.title}
            </Typography>
          </Box>
        }
        action={
          <Box>
            <IconButton onClick={handleFullscreenToggle}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
            {isEditable && (
              <>
                <IconButton onClick={handleMenuClick}>
                  <MoreVert />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={handleSettingsClick}>
                    <Settings sx={{ mr: 1 }} />
                    Settings
                  </MenuItem>
                  <MenuItem onClick={handleDeleteClick}>
                    <Delete sx={{ mr: 1 }} />
                    Remove
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        }
        sx={{
          pb: 1,
          '& .MuiCardHeader-action': {
            alignSelf: 'flex-start',
            marginTop: 0,
          },
        }}
      />

      <CardContent
        sx={{
          flex: 1,
          p: isMobile ? 1 : 2,
          '&:last-child': { pb: isMobile ? 1 : 2 },
        }}
      >
        <WidgetRenderer
          widget={widget}
          onConfigChange={onConfigChange}
          isFullscreen={isFullscreen}
        />
      </CardContent>
    </Card>
  );
};
```

### 3. Widget Renderer
```tsx
// src/components/dashboard/WidgetRenderer.tsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { DashboardWidget } from './DashboardGrid';
import { KPICard } from './widgets/KPICard';
import { ChartWidget } from './widgets/ChartWidget';
import { TableWidget } from './widgets/TableWidget';
import { MapWidget } from './widgets/MapWidget';
import { AlertWidget } from './widgets/AlertWidget';

interface WidgetRendererProps {
  widget: DashboardWidget;
  onConfigChange: (config: any) => void;
  isFullscreen: boolean;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  widget,
  onConfigChange,
  isFullscreen,
}) => {
  const renderWidget = () => {
    switch (widget.type) {
      case 'kpi':
        return <KPICard config={widget.config} />;

      case 'chart':
        return <ChartWidget config={widget.config} />;

      case 'table':
        return <TableWidget config={widget.config} />;

      case 'map':
        return <MapWidget config={widget.config} />;

      case 'alerts':
        return <AlertWidget config={widget.config} />;

      default:
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 100,
            }}
          >
            <Typography color="textSecondary">
              Unknown widget type: {widget.type}
            </Typography>
          </Box>
        );
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        overflow: isFullscreen ? 'auto' : 'hidden',
      }}
    >
      {renderWidget()}
    </Box>
  );
};
```

### 4. Widget Registry and Factory
```tsx
// src/components/dashboard/WidgetRegistry.ts
import { DashboardWidget } from './DashboardGrid';

export interface WidgetDefinition {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaultLayout: {
    w: number;
    h: number;
    minW: number;
    minH: number;
  };
  defaultConfig: any;
  configSchema: any; // JSON Schema for configuration
}

export class WidgetRegistry {
  private static instance: WidgetRegistry;
  private widgets: Map<string, WidgetDefinition> = new Map();

  private constructor() {
    this.registerDefaultWidgets();
  }

  static getInstance(): WidgetRegistry {
    if (!WidgetRegistry.instance) {
      WidgetRegistry.instance = new WidgetRegistry();
    }
    return WidgetRegistry.instance;
  }

  registerWidget(definition: WidgetDefinition): void {
    this.widgets.set(definition.type, definition);
  }

  getWidgetDefinition(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type);
  }

  getAllWidgets(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  getWidgetsByCategory(category: string): WidgetDefinition[] {
    return this.getAllWidgets().filter(widget => widget.category === category);
  }

  createWidget(type: string, id: string, title?: string): DashboardWidget | null {
    const definition = this.getWidgetDefinition(type);
    if (!definition) return null;

    return {
      id,
      type,
      title: title || definition.name,
      config: { ...definition.defaultConfig },
      layout: {
        x: 0,
        y: 0,
        ...definition.defaultLayout,
      },
    };
  }

  private registerDefaultWidgets(): void {
    // KPI Widget
    this.registerWidget({
      type: 'kpi',
      name: 'KPI Card',
      description: 'Display key performance indicators',
      category: 'metrics',
      icon: 'trending_up',
      defaultLayout: { w: 3, h: 2, minW: 2, minH: 2 },
      defaultConfig: {
        metric: 'compliance_rate',
        title: 'Compliance Rate',
        showTrend: true,
        showComparison: true,
      },
      configSchema: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: ['compliance_rate', 'total_transactions', 'risk_score'] },
          title: { type: 'string' },
          showTrend: { type: 'boolean' },
          showComparison: { type: 'boolean' },
        },
      },
    });

    // Chart Widget
    this.registerWidget({
      type: 'chart',
      name: 'Chart',
      description: 'Display data in various chart formats',
      category: 'visualization',
      icon: 'bar_chart',
      defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
      defaultConfig: {
        chartType: 'line',
        dataSource: 'risk_trends',
        timeRange: '24h',
        showLegend: true,
        showGrid: true,
      },
      configSchema: {
        type: 'object',
        properties: {
          chartType: { type: 'string', enum: ['line', 'bar', 'area', 'pie'] },
          dataSource: { type: 'string' },
          timeRange: { type: 'string' },
          showLegend: { type: 'boolean' },
          showGrid: { type: 'boolean' },
        },
      },
    });

    // Table Widget
    this.registerWidget({
      type: 'table',
      name: 'Data Table',
      description: 'Display tabular data with sorting and filtering',
      category: 'data',
      icon: 'table_chart',
      defaultLayout: { w: 8, h: 4, minW: 6, minH: 3 },
      defaultConfig: {
        dataSource: 'transactions',
        columns: ['id', 'amount', 'risk_score', 'status'],
        pageSize: 10,
        sortable: true,
        filterable: true,
      },
      configSchema: {
        type: 'object',
        properties: {
          dataSource: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          pageSize: { type: 'number' },
          sortable: { type: 'boolean' },
          filterable: { type: 'boolean' },
        },
      },
    });

    // Map Widget
    this.registerWidget({
      type: 'map',
      name: 'Geographic Map',
      description: 'Display geographic data and jurisdiction information',
      category: 'geographic',
      icon: 'map',
      defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
      defaultConfig: {
        mapType: 'choropleth',
        dataSource: 'jurisdiction_risks',
        showLegend: true,
        interactive: true,
      },
      configSchema: {
        type: 'object',
        properties: {
          mapType: { type: 'string', enum: ['choropleth', 'bubble', 'heatmap'] },
          dataSource: { type: 'string' },
          showLegend: { type: 'boolean' },
          interactive: { type: 'boolean' },
        },
      },
    });

    // Alert Widget
    this.registerWidget({
      type: 'alerts',
      name: 'Alert Summary',
      description: 'Display compliance alerts and notifications',
      category: 'alerts',
      icon: 'warning',
      defaultLayout: { w: 4, h: 3, minW: 3, minH: 2 },
      defaultConfig: {
        alertTypes: ['high_risk', 'anomaly', 'compliance_breach'],
        maxItems: 5,
        showTimestamp: true,
        autoRefresh: true,
      },
      configSchema: {
        type: 'object',
        properties: {
          alertTypes: { type: 'array', items: { type: 'string' } },
          maxItems: { type: 'number' },
          showTimestamp: { type: 'boolean' },
          autoRefresh: { type: 'boolean' },
        },
      },
    });
  }
}
```

### 5. Dashboard Manager
```tsx
// src/components/dashboard/DashboardManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
} from '@mui/material';
import { Add, Save, Load, Delete } from '@mui/icons-material';
import { DashboardGrid, DashboardWidget } from './DashboardGrid';
import { WidgetRegistry } from './WidgetRegistry';

interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  createdAt: Date;
  updatedAt: Date;
}

export const DashboardManager: React.FC = () => {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isEditable, setIsEditable] = useState(false);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<DashboardTemplate | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const widgetRegistry = WidgetRegistry.getInstance();

  useEffect(() => {
    loadTemplates();
    loadDefaultDashboard();
  }, []);

  const loadTemplates = async () => {
    try {
      // Load saved templates from API
      const response = await fetch('/api/dashboard/templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadDefaultDashboard = () => {
    // Load default dashboard widgets
    const defaultWidgets: DashboardWidget[] = [
      {
        id: 'kpi-1',
        type: 'kpi',
        title: 'Compliance Rate',
        config: { metric: 'compliance_rate' },
        layout: { x: 0, y: 0, w: 3, h: 2 },
      },
      {
        id: 'kpi-2',
        type: 'kpi',
        title: 'Total Transactions',
        config: { metric: 'total_transactions' },
        layout: { x: 3, y: 0, w: 3, h: 2 },
      },
      {
        id: 'chart-1',
        type: 'chart',
        title: 'Risk Trends',
        config: { chartType: 'line', dataSource: 'risk_trends' },
        layout: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        id: 'alerts-1',
        type: 'alerts',
        title: 'Recent Alerts',
        config: { alertTypes: ['high_risk', 'anomaly'] },
        layout: { x: 0, y: 2, w: 6, h: 3 },
      },
    ];

    setWidgets(defaultWidgets);
  };

  const handleLayoutChange = useCallback((layout: any[], layouts: any) => {
    // Update widget layouts
    setWidgets(prevWidgets =>
      prevWidgets.map(widget => {
        const layoutItem = layout.find(item => item.i === widget.id);
        if (layoutItem) {
          return {
            ...widget,
            layout: {
              ...widget.layout,
              x: layoutItem.x,
              y: layoutItem.y,
              w: layoutItem.w,
              h: layoutItem.h,
            },
          };
        }
        return widget;
      })
    );
  }, []);

  const handleWidgetConfigChange = useCallback((widgetId: string, config: any) => {
    setWidgets(prevWidgets =>
      prevWidgets.map(widget =>
        widget.id === widgetId ? { ...widget, config } : widget
      )
    );
  }, []);

  const handleWidgetRemove = useCallback((widgetId: string) => {
    setWidgets(prevWidgets => prevWidgets.filter(widget => widget.id !== widgetId));
  }, []);

  const handleAddWidget = (widgetType: string) => {
    const newWidget = widgetRegistry.createWidget(
      widgetType,
      `widget-${Date.now()}`,
      `New ${widgetRegistry.getWidgetDefinition(widgetType)?.name}`
    );

    if (newWidget) {
      setWidgets(prevWidgets => [...prevWidgets, newWidget]);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;

    const template: DashboardTemplate = {
      id: currentTemplate?.id || `template-${Date.now()}`,
      name: templateName,
      description: templateDescription,
      widgets: [...widgets],
      createdAt: currentTemplate?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    try {
      await fetch('/api/dashboard/templates', {
        method: currentTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      await loadTemplates();
      setShowTemplateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
      setCurrentTemplate(null);
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleLoadTemplate = (template: DashboardTemplate) => {
    setWidgets(template.widgets);
    setCurrentTemplate(template);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await fetch(`/api/dashboard/templates/${templateId}`, {
        method: 'DELETE',
      });
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
        <Button
          variant={isEditable ? 'contained' : 'outlined'}
          onClick={() => setIsEditable(!isEditable)}
        >
          {isEditable ? 'Save Layout' : 'Edit Layout'}
        </Button>

        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={() => setShowTemplateDialog(true)}
        >
          Save as Template
        </Button>

        <Button
          variant="outlined"
          startIcon={<Load />}
          onClick={() => setShowTemplateDialog(true)}
        >
          Load Template
        </Button>
      </Box>

      {/* Widget Palette (when editing) */}
      {isEditable && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            Add Widgets
          </Typography>
          <Grid container spacing={1}>
            {widgetRegistry.getAllWidgets().map(widget => (
              <Grid item key={widget.type}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleAddWidget(widget.type)}
                  startIcon={<span>{widget.icon}</span>}
                >
                  {widget.name}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Dashboard Grid */}
      <Box sx={{ flex: 1, p: 2 }}>
        <DashboardGrid
          widgets={widgets}
          onLayoutChange={handleLayoutChange}
          onWidgetConfigChange={handleWidgetConfigChange}
          onWidgetRemove={handleWidgetRemove}
          isEditable={isEditable}
        />
      </Box>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onClose={() => setShowTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {currentTemplate ? 'Load Dashboard Template' : 'Save Dashboard Template'}
        </DialogTitle>
        <DialogContent>
          {currentTemplate ? (
            <Grid container spacing={2}>
              {templates.map(template => (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">{template.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {template.description}
                      </Typography>
                      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleLoadTemplate(template)}
                        >
                          Load
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ pt: 1 }}>
              <TextField
                fullWidth
                label="Template Name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
          {!currentTemplate && (
            <Button onClick={handleSaveTemplate} variant="contained">
              Save Template
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
```

## Notes
- Responsive grid system adapts to different screen sizes and devices
- Drag-and-drop functionality allows users to customize dashboard layouts
- Widget framework provides extensible component system
- Template system enables saving and loading dashboard configurations
- Fullscreen mode enhances widget visibility for detailed analysis