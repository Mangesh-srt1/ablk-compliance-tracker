# Day 1: Advanced UI Components

## Objective
Develop advanced React components for the compliance dashboard, including data visualization, interactive elements, and responsive design.

## Implementation Steps

1. **Create Reusable Component Library**
   - Build base components for forms, tables, and charts
   - Implement theme system and design tokens

2. **Develop Data Visualization Components**
   - Create charts for compliance metrics and trends
   - Add interactive drill-down capabilities

3. **Implement Advanced Form Components**
   - Build complex forms for compliance workflows
   - Add validation and error handling

4. **Create Dashboard Layout System**
   - Implement responsive grid layouts
   - Add widget system for customizable dashboards

## Code Snippets

### 1. Component Library Structure
```typescript
// src/components/ui/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { Table } from './Table';
export { Card } from './Card';
export { Modal } from './Modal';
export { Tabs } from './Tabs';
export { Badge } from './Badge';
export { Alert } from './Alert';
export { Loading } from './Loading';
export { EmptyState } from './EmptyState';
```

### 2. Theme System
```typescript
// src/theme/index.ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    success: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

export const complianceColors = {
  lowRisk: '#4caf50',
  mediumRisk: '#ff9800',
  highRisk: '#f44336',
  criticalRisk: '#9c27b0',
  compliant: '#2196f3',
  nonCompliant: '#f44336',
  pending: '#ff9800',
  approved: '#4caf50',
  rejected: '#f44336',
};
```

### 3. Advanced Data Table Component
```tsx
// src/components/ui/DataTable.tsx
import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Checkbox,
  TablePagination,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Box,
} from '@mui/material';
import { FilterList, Download, Refresh } from '@mui/icons-material';

export interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any) => string;
  sortable?: boolean;
  filterable?: boolean;
}

export interface DataTableProps {
  columns: Column[];
  data: any[];
  title?: string;
  selectable?: boolean;
  onSelectionChange?: (selected: any[]) => void;
  onRowClick?: (row: any) => void;
  onExport?: (data: any[]) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  title,
  selectable = false,
  onSelectionChange,
  onRowClick,
  onExport,
  onRefresh,
  loading = false,
}) => {
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<string>('');
  const [selected, setSelected] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = data.map((n) => n.id);
      setSelected(newSelected);
      onSelectionChange?.(data);
      return;
    }
    setSelected([]);
    onSelectionChange?.([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, row: any) => {
    if (selectable) {
      const selectedIndex = selected.indexOf(row.id);
      let newSelected: any[] = [];

      if (selectedIndex === -1) {
        newSelected = newSelected.concat(selected, row.id);
      } else if (selectedIndex === 0) {
        newSelected = newSelected.concat(selected.slice(1));
      } else if (selectedIndex === selected.length - 1) {
        newSelected = newSelected.concat(selected.slice(0, -1));
      } else if (selectedIndex > 0) {
        newSelected = newSelected.concat(
          selected.slice(0, selectedIndex),
          selected.slice(selectedIndex + 1),
        );
      }

      setSelected(newSelected);
      onSelectionChange?.(data.filter(item => newSelected.includes(item.id)));
    }

    onRowClick?.(row);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const sortedData = useMemo(() => {
    if (!orderBy) return data;

    return [...data].sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];

      if (aValue < bValue) {
        return order === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, order, orderBy]);

  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const isSelected = (id: any) => selected.indexOf(id) !== -1;

  return (
    <Paper>
      {title && (
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flex: '1 1 100%' }}>
            {title}
          </Typography>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh}>
                <Refresh />
              </IconButton>
            </Tooltip>
          )}
          {onExport && (
            <Tooltip title="Export">
              <IconButton onClick={() => onExport(data)}>
                <Download />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      )}

      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < data.length}
                    checked={data.length > 0 && selected.length === data.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={orderBy === column.id ? order : false}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => {
                const isItemSelected = isSelected(row.id);
                return (
                  <TableRow
                    hover
                    onClick={(event) => handleClick(event, row)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={row.id}
                    selected={isItemSelected}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox checked={isItemSelected} />
                      </TableCell>
                    )}
                    {columns.map((column) => {
                      const value = row[column.id];
                      return (
                        <TableCell key={column.id} align={column.align}>
                          {column.format ? column.format(value) : value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};
```

### 4. Interactive Chart Component
```tsx
// src/components/ui/InteractiveChart.tsx
import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { Box, ToggleButton, ToggleButtonGroup, Paper, Typography } from '@mui/material';

export type ChartType = 'line' | 'bar' | 'area';

export interface ChartData {
  [key: string]: any;
}

export interface InteractiveChartProps {
  data: ChartData[];
  xAxisKey: string;
  yAxisKeys: string[];
  title?: string;
  height?: number;
  colors?: string[];
  showBrush?: boolean;
  onDataPointClick?: (data: any) => void;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  xAxisKey,
  yAxisKeys,
  title,
  height = 400,
  colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'],
  showBrush = false,
  onDataPointClick,
}) => {
  const [chartType, setChartType] = useState<ChartType>('line');

  const handleChartTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newChartType: ChartType | null,
  ) => {
    if (newChartType !== null) {
      setChartType(newChartType);
    }
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const renderLines = () =>
      yAxisKeys.map((key, index) => (
        <Line
          key={key}
          type="monotone"
          dataKey={key}
          stroke={colors[index % colors.length]}
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6, onClick: onDataPointClick }}
        />
      ));

    const renderBars = () =>
      yAxisKeys.map((key, index) => (
        <Bar
          key={key}
          dataKey={key}
          fill={colors[index % colors.length]}
          onClick={onDataPointClick}
        />
      ));

    const renderAreas = () =>
      yAxisKeys.map((key, index) => (
        <Area
          key={key}
          type="monotone"
          dataKey={key}
          stackId="1"
          stroke={colors[index % colors.length]}
          fill={colors[index % colors.length]}
          onClick={onDataPointClick}
        />
      ));

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {renderBars()}
            {showBrush && <Brush />}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {renderAreas()}
            {showBrush && <Brush />}
          </AreaChart>
        );

      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {renderLines()}
            {showBrush && <Brush />}
          </LineChart>
        );
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      {title && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{title}</Typography>
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={handleChartTypeChange}
            size="small"
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="bar">Bar</ToggleButton>
            <ToggleButton value="area">Area</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </Paper>
  );
};
```

### 5. Advanced Form Component
```tsx
// src/components/ui/AdvancedForm.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  Button,
  Grid,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'textarea';
  required?: boolean;
  options?: { value: any; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  };
  placeholder?: string;
  helperText?: string;
  grid?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
}

export interface AdvancedFormProps {
  fields: FormField[];
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  onChange?: (values: Record<string, any>) => void;
  initialValues?: Record<string, any>;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  layout?: 'vertical' | 'horizontal';
}

export const AdvancedForm: React.FC<AdvancedFormProps> = ({
  fields,
  onSubmit,
  onChange,
  initialValues = {},
  submitLabel = 'Submit',
  loading = false,
  disabled = false,
  layout = 'vertical',
}) => {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || (Array.isArray(value) && value.length === 0))) {
      return `${field.label} is required`;
    }

    if (!value) return null;

    if (field.validation) {
      const { min, max, pattern, custom } = field.validation;

      if (typeof value === 'string') {
        if (min && value.length < min) {
          return `${field.label} must be at least ${min} characters`;
        }
        if (max && value.length > max) {
          return `${field.label} must be no more than ${max} characters`;
        }
        if (pattern && !pattern.test(value)) {
          return `${field.label} format is invalid`;
        }
      }

      if (typeof value === 'number') {
        if (min !== undefined && value < min) {
          return `${field.label} must be at least ${min}`;
        }
        if (max !== undefined && value > max) {
          return `${field.label} must be no more than ${max}`;
        }
      }

      if (custom) {
        return custom(value);
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    fields.forEach(field => {
      const error = validateField(field, values[field.name]);
      if (error) {
        newErrors[field.name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (field: FormField, value: any) => {
    const newValues = { ...values, [field.name]: value };
    setValues(newValues);

    // Clear error when user starts typing
    if (errors[field.name]) {
      setErrors({ ...errors, [field.name]: '' });
    }

    onChange?.(newValues);
  };

  const handleBlur = (field: FormField) => {
    setTouched({ ...touched, [field.name]: true });
    const error = validateField(field, values[field.name]);
    if (error) {
      setErrors({ ...errors, [field.name]: error });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const renderField = (field: FormField) => {
    const value = values[field.name] || '';
    const error = errors[field.name];
    const isTouched = touched[field.name];
    const showError = isTouched && error;

    const commonProps = {
      fullWidth: true,
      label: field.label,
      value,
      onChange: (e: any) => handleChange(field, e.target.value),
      onBlur: () => handleBlur(field),
      error: !!showError,
      helperText: showError || field.helperText,
      placeholder: field.placeholder,
      disabled: disabled || loading,
      required: field.required,
    };

    switch (field.type) {
      case 'select':
        return (
          <FormControl {...commonProps}>
            <InputLabel>{field.label}</InputLabel>
            <Select {...commonProps}>
              {field.options?.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'multiselect':
        return (
          <FormControl {...commonProps}>
            <InputLabel>{field.label}</InputLabel>
            <Select
              {...commonProps}
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e: any) => handleChange(field, e.target.value)}
            >
              {field.options?.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={!!value}
                onChange={(e) => handleChange(field, e.target.checked)}
                disabled={disabled || loading}
              />
            }
            label={field.label}
          />
        );

      case 'radio':
        return (
          <FormControl component="fieldset">
            <FormLabel component="legend">{field.label}</FormLabel>
            <RadioGroup
              value={value}
              onChange={(e) => handleChange(field, e.target.value)}
            >
              {field.options?.map(option => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                  disabled={disabled || loading}
                />
              ))}
            </RadioGroup>
          </FormControl>
        );

      case 'date':
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label={field.label}
              value={value}
              onChange={(date) => handleChange(field, date)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!showError,
                  helperText: showError || field.helperText,
                },
              }}
            />
          </LocalizationProvider>
        );

      case 'textarea':
        return (
          <TextField
            {...commonProps}
            multiline
            rows={4}
          />
        );

      default:
        return (
          <TextField
            {...commonProps}
            type={field.type}
          />
        );
    }
  };

  const gridProps = layout === 'horizontal' ? { container: true, spacing: 2 } : {};

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
        {layout === 'horizontal' ? (
          <Grid {...gridProps}>
            {fields.map(field => (
              <Grid key={field.name} item {...field.grid}>
                {renderField(field)}
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {fields.map(field => (
              <Box key={field.name}>
                {renderField(field)}
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={disabled || loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Submitting...' : submitLabel}
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};
```

## Notes
- Advanced UI components provide reusable building blocks for the compliance dashboard
- Theme system ensures consistent styling across the application
- Data table supports sorting, filtering, pagination, and selection
- Interactive charts allow users to switch between visualization types
- Advanced forms handle complex validation and different input types