# Day 5: UI Integration and Deployment Preparation

## Objective
Integrate all UI components into a cohesive application, prepare for deployment with proper build configuration, environment setup, and monitoring infrastructure.

## Implementation Steps

1. **Complete UI Component Integration**
   - Integrate all dashboard components
   - Set up routing and navigation
   - Implement global state management

2. **Build Configuration and Optimization**
   - Configure webpack/build tools
   - Implement code splitting and lazy loading
   - Set up asset optimization

3. **Environment Configuration**
   - Set up environment variables
   - Configure different environments (dev, staging, prod)
   - Implement feature flags

4. **Deployment Preparation**
   - Set up CI/CD pipeline
   - Configure containerization
   - Implement health checks and monitoring

5. **Performance Optimization**
   - Implement caching strategies
   - Add service worker for offline support
   - Optimize bundle size

## Code Snippets

### 1. Main App Router
```tsx
// src/App.tsx
import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  CircularProgress,
  Container,
} from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';
import i18n from './i18n';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SkipLinks } from './components/common/SkipLinks';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { ErrorFallback } from './components/common/ErrorFallback';
import { createAppTheme } from './theme';
import { useRTL } from './hooks/useRTL';

// Lazy load components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ComplianceReports = lazy(() => import('./pages/ComplianceReports'));
const RiskAnalysis = lazy(() => import('./pages/RiskAnalysis'));
const Settings = lazy(() => import('./pages/Settings'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));

const LoadingFallback = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}
  >
    <CircularProgress />
  </Box>
);

const AppContent: React.FC = () => {
  const { direction } = useRTL();
  const theme = createAppTheme(direction);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Box
          sx={{
            direction,
            minHeight: '100vh',
            backgroundColor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SkipLinks />
          <Header />
          <Box sx={{ display: 'flex', flex: 1 }}>
            <Sidebar />
            <Box
              component="main"
              id="main-content"
              role="main"
              sx={{
                flex: 1,
                p: 3,
                overflow: 'auto',
              }}
            >
              <Container maxWidth="xl">
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/compliance-reports" element={<ComplianceReports />} />
                    <Route path="/risk-analysis" element={<RiskAnalysis />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/user-management" element={<UserManagement />} />
                    <Route path="/audit-logs" element={<AuditLogs />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </Container>
            </Box>
          </Box>
          <Footer />
        </Box>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <AccessibilityProvider>
          <NotificationProvider>
            <Router>
              <AppContent />
            </Router>
          </NotificationProvider>
        </AccessibilityProvider>
      </AuthProvider>
    </I18nextProvider>
  );
};

export default App;
```

### 2. Global State Management with Zustand
```typescript
// src/stores/dashboardStore.ts
import create from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { DashboardWidget } from '../components/dashboard/DashboardGrid';

interface DashboardState {
  widgets: DashboardWidget[];
  isEditable: boolean;
  currentTemplate: string | null;
  templates: Record<string, DashboardWidget[]>;

  // Actions
  setWidgets: (widgets: DashboardWidget[]) => void;
  addWidget: (widget: DashboardWidget) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  setEditable: (editable: boolean) => void;
  saveTemplate: (name: string) => void;
  loadTemplate: (name: string) => void;
  resetDashboard: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        widgets: [],
        isEditable: false,
        currentTemplate: null,
        templates: {},

        setWidgets: (widgets) => set({ widgets }),

        addWidget: (widget) =>
          set((state) => ({
            widgets: [...state.widgets, widget],
          })),

        removeWidget: (widgetId) =>
          set((state) => ({
            widgets: state.widgets.filter((w) => w.id !== widgetId),
          })),

        updateWidget: (widgetId, updates) =>
          set((state) => ({
            widgets: state.widgets.map((w) =>
              w.id === widgetId ? { ...w, ...updates } : w
            ),
          })),

        setEditable: (editable) => set({ isEditable: editable }),

        saveTemplate: (name) =>
          set((state) => ({
            templates: {
              ...state.templates,
              [name]: [...state.widgets],
            },
            currentTemplate: name,
          })),

        loadTemplate: (name) =>
          set((state) => ({
            widgets: state.templates[name] ? [...state.templates[name]] : [],
            currentTemplate: name,
          })),

        resetDashboard: () =>
          set({
            widgets: [],
            isEditable: false,
            currentTemplate: null,
          }),
      }),
      {
        name: 'dashboard-storage',
        partialize: (state) => ({
          widgets: state.widgets,
          templates: state.templates,
          currentTemplate: state.currentTemplate,
        }),
      }
    ),
    {
      name: 'dashboard-store',
    }
  )
);
```

### 3. Authentication Context
```tsx
// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check for existing session
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      if (token) {
        // Validate token with server
        const response = await fetch('/api/auth/validate', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const user = await response.json();
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Token invalid, clear it
          localStorage.removeItem('auth-token');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const { user, token } = await response.json();

      localStorage.setItem('auth-token', token);
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth-token');
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const refreshToken = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      if (!token) throw new Error('No token available');

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Token refresh failed');

      const { token: newToken } = await response.json();
      localStorage.setItem('auth-token', newToken);
    } catch (error) {
      logout(); // Force logout on refresh failure
      throw error;
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!authState.user) return false;
    return authState.user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        isAuthenticated: authState.isAuthenticated,
        isLoading: authState.isLoading,
        login,
        logout,
        refreshToken,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
```

### 4. Build Configuration (Webpack)
```javascript
// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const WorkboxPlugin = require('workbox-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isAnalyze = env && env.analyze;

  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
      publicPath: '/',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          use: 'babel-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    require('autoprefixer'),
                    isProduction && require('cssnano'),
                  ].filter(Boolean),
                },
              },
            },
          ],
        },
        {
          test: /\.(png|jpe?g|gif|svg|woff2?|eot|ttf|otf)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10 * 1024, // 10kb
            },
          },
          generator: {
            filename: 'assets/[name].[contenthash][ext]',
          },
        },
      ],
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          mui: {
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            name: 'mui',
            chunks: 'all',
          },
          react: {
            test: /[\\/]node_modules[\\/]react/,
            name: 'react',
            chunks: 'all',
          },
        },
      },
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: isProduction,
            },
          },
        }),
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        minify: isProduction,
      }),
      isProduction && new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[name].[contenthash].chunk.css',
      }),
      isProduction && new CompressionPlugin({
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 10240,
        minRatio: 0.8,
      }),
      isProduction && new WorkboxPlugin.GenerateSW({
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      }),
      isAnalyze && new BundleAnalyzerPlugin(),
    ].filter(Boolean),
    devServer: {
      contentBase: path.join(__dirname, 'dist'),
      compress: true,
      port: 3000,
      historyApiFallback: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
  };
};
```

### 5. Environment Configuration
```typescript
// src/config/index.ts
interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
  };
  features: {
    analytics: boolean;
    notifications: boolean;
    auditLogs: boolean;
    multiTenancy: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    dateFormat: string;
  };
  security: {
    enableMFA: boolean;
    sessionTimeout: number;
    passwordPolicy: {
      minLength: number;
      requireSpecialChars: boolean;
      requireNumbers: boolean;
    };
  };
  monitoring: {
    sentry: {
      dsn: string;
      environment: string;
    };
    analytics: {
      trackingId: string;
    };
  };
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value || defaultValue!;
};

const getBooleanEnvVar = (key: string, defaultValue: boolean = false): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const config: AppConfig = {
  api: {
    baseUrl: getEnvVar('REACT_APP_API_BASE_URL', 'http://localhost:8000/api'),
    timeout: parseInt(getEnvVar('REACT_APP_API_TIMEOUT', '30000')),
  },
  features: {
    analytics: getBooleanEnvVar('REACT_APP_ENABLE_ANALYTICS', false),
    notifications: getBooleanEnvVar('REACT_APP_ENABLE_NOTIFICATIONS', true),
    auditLogs: getBooleanEnvVar('REACT_APP_ENABLE_AUDIT_LOGS', true),
    multiTenancy: getBooleanEnvVar('REACT_APP_MULTI_TENANCY', false),
  },
  ui: {
    theme: (getEnvVar('REACT_APP_DEFAULT_THEME', 'auto') as 'light' | 'dark' | 'auto'),
    language: getEnvVar('REACT_APP_DEFAULT_LANGUAGE', 'en'),
    dateFormat: getEnvVar('REACT_APP_DATE_FORMAT', 'YYYY-MM-DD'),
  },
  security: {
    enableMFA: getBooleanEnvVar('REACT_APP_ENABLE_MFA', false),
    sessionTimeout: parseInt(getEnvVar('REACT_APP_SESSION_TIMEOUT', '3600000')), // 1 hour
    passwordPolicy: {
      minLength: parseInt(getEnvVar('REACT_APP_PASSWORD_MIN_LENGTH', '8')),
      requireSpecialChars: getBooleanEnvVar('REACT_APP_PASSWORD_REQUIRE_SPECIAL', true),
      requireNumbers: getBooleanEnvVar('REACT_APP_PASSWORD_REQUIRE_NUMBERS', true),
    },
  },
  monitoring: {
    sentry: {
      dsn: getEnvVar('REACT_APP_SENTRY_DSN', ''),
      environment: getEnvVar('REACT_APP_ENVIRONMENT', 'development'),
    },
    analytics: {
      trackingId: getEnvVar('REACT_APP_GA_TRACKING_ID', ''),
    },
  },
};

export default config;
```

### 6. Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
events {
  worker_connections 1024;
}

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;

  # Gzip compression
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/json;

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer-when-downgrade" always;
  add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

  server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Handle client-side routing
    location / {
      try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
      proxy_pass http://api:8000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
      access_log off;
      return 200 "healthy\n";
      add_header Content-Type text/plain;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }
  }
}
```

### 7. CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run tests
        run: npm run test:ci

      - name: Build application
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-files
          path: dist/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run security audit
        run: npm audit --audit-level high

      - name: Run SAST scan
        uses: github/super-linter/slim@v4
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  deploy-staging:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-files
          path: dist/

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment"
          # Add your staging deployment commands here

  deploy-production:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-files
          path: dist/

      - name: Deploy to production
        run: |
          echo "Deploying to production environment"
          # Add your production deployment commands here
```

### 8. Service Worker for Offline Support
```typescript
// src/serviceWorker.ts
const CACHE_NAME = 'compliance-dashboard-v1';
const STATIC_CACHE = 'compliance-static-v1';
const API_CACHE = 'compliance-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  // Add other static assets
];

const API_ENDPOINTS = [
  '/api/dashboard',
  '/api/compliance',
  '/api/risk',
];

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  (self as any).skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  (self as any).clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Cache successful GET requests
            if (request.method === 'GET' && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Return cached version if available
            return cache.match(request);
          });
      })
    );
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic
  console.log('Performing background sync');
}

// Push notifications
self.addEventListener('push', (event: any) => {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: data.url,
  };

  event.waitUntil(
    (self as any).registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  event.waitUntil(
    (self as any).clients.openWindow(event.notification.data)
  );
});
```

### 9. Error Boundary Component
```tsx
// src/components/common/ErrorFallback.tsx
import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  AlertTitle,
} from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const { t } = useTranslation();

  const handleReload = () => {
    window.location.reload();
  };

  const handleReset = () => {
    resetErrorBoundary();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Paper
        sx={{
          p: 4,
          maxWidth: 500,
          textAlign: 'center',
        }}
      >
        <ErrorIcon
          sx={{
            fontSize: 64,
            color: 'error.main',
            mb: 2,
          }}
        />

        <Typography variant="h5" gutterBottom>
          {t('error.somethingWentWrong', 'Something went wrong')}
        </Typography>

        <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
          <AlertTitle>
            {t('error.errorDetails', 'Error Details')}
          </AlertTitle>
          <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {error.message}
          </Typography>
          {process.env.NODE_ENV === 'development' && (
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
              {error.stack}
            </Typography>
          )}
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
          >
            {t('error.tryAgain', 'Try Again')}
          </Button>
          <Button
            variant="outlined"
            onClick={handleReload}
          >
            {t('error.reloadPage', 'Reload Page')}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};
```

### 10. Performance Monitoring Setup
```typescript
// src/utils/monitoring.ts
import * as Sentry from '@sentry/react';
import { Integrations } from '@sentry/tracing';
import config from '../config';

export const initMonitoring = () => {
  if (config.monitoring.sentry.dsn) {
    Sentry.init({
      dsn: config.monitoring.sentry.dsn,
      environment: config.monitoring.sentry.environment,
      integrations: [
        new Integrations.BrowserTracing({
          tracingOrigins: [config.api.baseUrl],
        }),
      ],
      tracesSampleRate: 1.0,
      beforeSend(event) {
        // Filter out development errors in production
        if (config.monitoring.sentry.environment === 'production') {
          // Add custom filtering logic
        }
        return event;
      },
    });
  }
};

export const logError = (error: Error, context?: any) => {
  console.error(error, context);

  if (config.monitoring.sentry.dsn) {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }
};

export const logPerformance = (name: string, value: number) => {
  if ('performance' in window && 'measure' in window.performance) {
    // Use Performance API
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  }

  // Send to analytics if enabled
  if (config.features.analytics && config.monitoring.analytics.trackingId) {
    // Send to Google Analytics or other service
  }
};

export const startPerformanceTimer = (name: string) => {
  if ('performance' in window && 'mark' in window.performance) {
    performance.mark(`${name}-start`);
  }
};
```

## Notes
- Complete application integration with routing, state management, and authentication
- Production-ready build configuration with code splitting and optimization
- Comprehensive environment configuration and feature flags
- Docker containerization and CI/CD pipeline setup
- Service worker for offline support and caching
- Error boundaries and monitoring for production reliability
- Performance optimization and bundle analysis