# Day 2: Build Docker Images for Portal/UI

## Objectives
- Create optimized Docker images for the Ableka Lumina portal and demo UI
- Implement multi-stage builds for efficient React application containerization
- Configure production-ready nginx settings for static asset serving
- Set up proper caching strategies and CDN integration
- Ensure responsive design and cross-browser compatibility in containers
- Implement security headers and HTTPS redirect configuration

## Implementation Details

### UI Containerization Strategy
The portal and demo UI require specialized containerization focusing on:

- Static asset optimization and compression
- Efficient nginx configuration for SPA routing
- CDN integration for global content delivery
- Security hardening for web applications
- Performance monitoring and analytics integration
- Multi-environment configuration management

### Performance Targets
- First Contentful Paint: <1.5 seconds
- Largest Contentful Paint: <2.5 seconds
- First Input Delay: <100ms
- Bundle size: <500KB gzipped
- Image optimization: WebP/AVIF support

## Code Implementation

### 1. Advanced Dockerfile for React UI
Create `Dockerfile.ui.advanced`:

```dockerfile
# ================================
# Dependencies Stage
# ================================
FROM node:18-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY packages/ui/package*.json ./

# Install dependencies
RUN \
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile --network-timeout 600000; \
  else echo "Lockfile not found." && exit 1; \
  fi

# ================================
# Builder Stage
# ================================
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/ui .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build the application
RUN \
  if [ -f yarn.lock ]; then yarn build; \
  else npm run build; \
  fi

# ================================
# Runner Stage
# ================================
FROM nginx:1.23-alpine AS runner
WORKDIR /app

# Install additional packages
RUN apk add --no-cache curl

# Copy nginx configuration
COPY --from=builder /app/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/docker/default.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/out /usr/share/nginx/html

# Create nginx user and set permissions
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nextjs:nodejs /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nextjs:nodejs /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 2. Nginx Configuration for React SPA
Create `packages/ui/docker/nginx.conf`:

```nginx
user nextjs;
worker_processes auto;

error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json
        font/woff
        font/woff2
        image/svg+xml;

    # Brotli compression (if available)
    brotli on;
    brotli_comp_level 6;
    brotli_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json
        font/woff
        font/woff2
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-DNS-Prefetch-Control "on" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.ableka.com wss://api.ableka.com; frame-ancestors 'none';" always;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=ui:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    include /etc/nginx/conf.d/*.conf;
}
```

Create `packages/ui/docker/default.conf`:

```nginx
upstream api_backend {
    server api:3000;
    keepalive 32;
}

server {
    listen 3000;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Rate limiting
    limit_req zone=ui burst=20 nodelay;

    # Handle React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header X-Robots-Tag "noindex, nofollow";
            access_log off;

            # WebP/AVIF conversion (if supported)
            location ~* \.(png|jpg|jpeg)$ {
                try_files $uri$avif_suffix $uri$webp_suffix $uri =404;
            }
        }

        # Cache HTML with short expiry
        location ~* \.html$ {
            expires 1h;
            add_header Cache-Control "public, must-revalidate, proxy-revalidate";
        }
    }

    # API proxy with rate limiting
    location /api/ {
        limit_req zone=api burst=5 nodelay;

        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # WebSocket proxy for real-time updates
    location /ws/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket specific settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Favicon and robots.txt
    location = /favicon.ico {
        access_log off;
        log_not_found off;
    }

    location = /robots.txt {
        access_log off;
        log_not_found off;
    }

    # Security: Block access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}
```

### 3. Multi-Environment Docker Compose
Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  ui:
    build:
      context: .
      dockerfile: packages/ui/Dockerfile.ui.advanced
      target: runner
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://api.ableka.com
      - NEXT_PUBLIC_WS_URL=wss://api.ableka.com
      - NEXT_PUBLIC_CDN_URL=https://cdn.ableka.com
      - NEXT_PUBLIC_GA_ID=${GA_ID}
      - NEXT_PUBLIC_SENTRY_DSN=${SENTRY_DSN}
    depends_on:
      - api
    networks:
      - ableka-prod
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s

  api:
    image: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ableka-lumina-api:${TAG}
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - API_KEY_SECRET=${API_KEY_SECRET}
      - GROK_API_KEY=${GROK_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - AWS_REGION=${AWS_REGION}
      - S3_BUCKET=${S3_BUCKET}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    networks:
      - ableka-prod
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=ableka_prod
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - ableka-prod
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ableka_prod"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_prod_data:/data
    networks:
      - ableka-prod
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

volumes:
  postgres_prod_data:
  redis_prod_data:

networks:
  ableka-prod:
    driver: bridge
```

### 4. CDN Integration Configuration
Create `packages/ui/public/_headers`:

```
/*
  X-Frame-Options: SAMEORIGIN
  X-XSS-Protection: 1; mode=block
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.ableka.com wss://api.ableka.com; frame-ancestors 'none';

/_static/*
  Cache-Control: public, max-age=31536000, immutable

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Cache-Control: no-cache, no-store, must-revalidate

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.woff2
  Cache-Control: public, max-age=31536000, immutable

/*.webp
  Cache-Control: public, max-age=31536000, immutable

/*.avif
  Cache-Control: public, max-age=31536000, immutable
```

### 5. Performance Optimization Scripts
Create `packages/ui/scripts/optimize-build.js`:

```javascript
const fs = require('fs');
const path = require('path');

console.log('🚀 Optimizing Ableka Lumina UI build...');

// Analyze bundle size
function analyzeBundle() {
  const buildDir = path.join(__dirname, '../.next/static/chunks');

  if (!fs.existsSync(buildDir)) {
    console.log('⚠️  Build directory not found. Run build first.');
    return;
  }

  const files = fs.readdirSync(buildDir, { recursive: true })
    .filter(file => file.endsWith('.js'))
    .map(file => {
      const filePath = path.join(buildDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2)
      };
    })
    .sort((a, b) => b.size - a.size);

  console.log('\n📊 Bundle Analysis:');
  console.log('==================');
  files.slice(0, 10).forEach((file, index) => {
    console.log(`${index + 1}. ${file.name}: ${file.sizeKB} KB`);
  });

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

  console.log(`\n📦 Total bundle size: ${totalSizeMB} MB`);

  if (totalSizeMB > 2) {
    console.log('⚠️  Bundle size exceeds 2MB. Consider code splitting.');
  } else {
    console.log('✅ Bundle size is optimal.');
  }
}

// Generate service worker for caching
function generateServiceWorker() {
  const swContent = `
const CACHE_NAME = 'ableka-lumina-v1';
const STATIC_CACHE = 'ableka-static-v1';
const API_CACHE = 'ableka-api-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/robots.txt'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
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
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return fetch(request).then((response) => {
          // Cache successful GET requests
          if (request.method === 'GET' && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => {
          // Return cached version if available
          return cache.match(request);
        });
      })
    );
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.includes(url.pathname) || 
      url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$/)) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default fetch
  event.respondWith(fetch(request));
});
`;

  const swPath = path.join(__dirname, '../public/sw.js');
  fs.writeFileSync(swPath, swContent);
  console.log('✅ Service worker generated');
}

// Optimize images (placeholder for future implementation)
function optimizeImages() {
  console.log('🖼️  Image optimization not implemented yet');
  console.log('   Consider using next/image with automatic optimization');
}

// Run optimizations
analyzeBundle();
generateServiceWorker();
optimizeImages();

console.log('\n🎉 Build optimization completed!');
```

### 6. UI Performance Monitoring
Create `packages/ui/lib/performance.ts`:

```typescript
// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  // Core Web Vitals tracking
  trackCoreWebVitals() {
    if (typeof window !== 'undefined') {
      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('LCP', lastEntry.startTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.recordMetric('FID', entry.processingStart - entry.startTime);
        });
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      new PerformanceObserver((list) => {
        let clsValue = 0;
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.recordMetric('CLS', clsValue);
      }).observe({ entryTypes: ['layout-shift'] });
    }
  }

  // API call performance tracking
  trackApiCall(endpoint: string, startTime: number, endTime: number, success: boolean) {
    const duration = endTime - startTime;
    this.recordMetric(`API_${endpoint}`, duration);

    if (success) {
      this.recordMetric(`API_${endpoint}_success`, duration);
    } else {
      this.recordMetric(`API_${endpoint}_error`, duration);
    }
  }

  // Page load performance
  trackPageLoad() {
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        const loadTime = performance.now();
        this.recordMetric('page_load', loadTime);
      });
    }
  }

  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);

    // Send to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'performance_metric', {
        event_category: 'performance',
        event_label: name,
        value: Math.round(value)
      });
    }
  }

  // Get metrics summary
  getMetricsSummary() {
    const summary: Record<string, any> = {};

    this.metrics.forEach((values, name) => {
      const sorted = values.sort((a, b) => a - b);
      summary[name] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        average: values.reduce((sum, val) => sum + val, 0) / values.length
      };
    });

    return summary;
  }

  // Send metrics to monitoring service
  async sendMetricsToMonitoring() {
    const summary = this.getMetricsSummary();

    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          metrics: summary,
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      });
    } catch (error) {
      console.warn('Failed to send performance metrics:', error);
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Initialize tracking
if (typeof window !== 'undefined') {
  performanceMonitor.trackCoreWebVitals();
  performanceMonitor.trackPageLoad();

  // Send metrics periodically
  setInterval(() => {
    performanceMonitor.sendMetricsToMonitoring();
  }, 60000); // Every minute
}
```

### 7. Docker Build Optimization
Update `scripts/docker-build.sh` to include UI building:

```bash
# Build UI image with optimizations
build_and_push "ui" "packages/ui/Dockerfile.ui.advanced"

# Additional UI-specific optimizations
log "Optimizing UI build..."
docker run --rm \
  -v $(pwd)/packages/ui:/app \
  -w /app \
  node:18-alpine \
  sh -c "npm run optimize-build"
```

## Testing and Validation

### UI Container Testing
```bash
# Build UI image
docker build -f packages/ui/Dockerfile.ui.advanced -t ableka-lumina-ui:test .

# Test container startup
docker run -d --name ui-test -p 3000:3000 ableka-lumina-ui:test
sleep 10

# Test health endpoint
curl http://localhost:3000/health

# Test static asset serving
curl -I http://localhost:3000/_next/static/chunks/main.js

# Test SPA routing
curl http://localhost:3000/dashboard

# Performance test
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/

# Clean up
docker stop ui-test && docker rm ui-test
```

### Performance Validation
```bash
# Lighthouse CI for performance testing
npm install -g lighthouse
lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json

# Bundle analyzer
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer packages/ui/.next/static/chunks/*.js
```

### Cross-Browser Testing
```bash
# Use Playwright for cross-browser validation
npx playwright install
npx playwright test packages/ui/e2e/
```

### CDN Integration Testing
```bash
# Test CDN asset loading
curl -H "Host: cdn.ableka.com" https://your-cdn-domain.com/_next/static/chunks/main.js

# Test image optimization
curl -H "Accept: image/webp" http://localhost:3000/images/logo.png
```

## Next Steps
- Day 3 will focus on setting up Fargate cluster configuration
- Day 4 will handle ECS deployment and service configuration
- Day 5 will configure Aurora PG multi-tenant database setup

This UI containerization implementation ensures optimal performance, security, and scalability for the Ableka Lumina portal and demo interfaces.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 5 Deployment & Launch\Week 21\Day 2.md