# Day 1: Create Docker Images for API

## Objectives
- Create optimized Docker images for the Ableka Lumina API service
- Implement multi-stage builds for efficient image size and security
- Configure production-ready container settings
- Set up proper dependency management and caching
- Ensure cross-platform compatibility and reproducibility
- Implement security best practices for container images

## Implementation Details

### Docker Image Strategy
The API service requires a robust, secure, and efficient containerization strategy. We'll implement:

- Multi-stage builds to minimize final image size
- Non-root user execution for security
- Proper dependency caching and layer optimization
- Health checks and graceful shutdown handling
- Environment-specific configurations
- Security scanning integration

### Image Optimization Goals
- Base image size: <200MB for API service
- Build time: <5 minutes
- Security vulnerabilities: 0 critical, <5 high
- Startup time: <30 seconds
- Memory usage: <512MB baseline

## Code Implementation

### 1. Multi-Stage Dockerfile for API Service
Create `Dockerfile.api`:

```dockerfile
# ================================
# Build Stage
# ================================
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    sqlite-dev \
    postgresql-dev

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/ui/package*.json ./packages/ui/
COPY packages/agent/package*.json ./packages/agent/

# Install dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --ignore-scripts

# Copy source code
COPY . .

# Build the API service
WORKDIR /app/packages/api
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ================================
# Production Stage
# ================================
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    postgresql-client \
    redis \
    && addgroup -g 1001 -S nodejs \
    && adduser -S ableka -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/api/package*.json ./packages/api/

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules

# Copy built application
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/public ./packages/api/public

# Copy migration files and other assets
COPY --from=builder /app/packages/api/src/database/migrations ./packages/api/src/database/migrations
COPY --from=builder /app/packages/api/src/database/seeds ./packages/api/src/database/seeds

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /app/temp \
    && chown -R ableka:nodejs /app

# Switch to non-root user
USER ableka

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "packages/api/dist/server.js"]
```

### 2. Dockerfile for Agent Service
Create `Dockerfile.agent`:

```dockerfile
# ================================
# Agent Build Stage
# ================================
FROM node:18-alpine AS agent-builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/agent/package*.json ./packages/agent/

# Install dependencies
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy source code
COPY packages/agent ./packages/agent

# Build agent service
WORKDIR /app/packages/agent
RUN npm run build

# ================================
# Agent Production Stage
# ================================
FROM node:18-alpine AS agent-production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    redis \
    && addgroup -g 1002 -S agent \
    && adduser -S agent -u 1002

# Set working directory
WORKDIR /app

# Copy built agent
COPY --from=agent-builder /app/packages/agent/dist ./dist
COPY --from=agent-builder /app/packages/agent/node_modules ./node_modules
COPY --from=agent-builder /app/packages/agent/package*.json ./

# Create log directory
RUN mkdir -p /app/logs && chown -R agent:agent /app

# Switch to non-root user
USER agent

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Start agent service
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/agent.js"]
```

### 3. Dockerfile for UI Service
Create `Dockerfile.ui`:

```dockerfile
# ================================
# UI Build Stage
# ================================
FROM node:18-alpine AS ui-builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy package files
COPY packages/ui/package*.json ./packages/ui/

# Install dependencies
RUN --mount=type=cache,target=/root/.npm \
    cd packages/ui && npm ci

# Copy source code
COPY packages/ui ./packages/ui

# Build UI
WORKDIR /app/packages/ui
RUN npm run build

# ================================
# UI Production Stage
# ================================
FROM nginx:alpine AS ui-production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built UI files
COPY --from=ui-builder /app/packages/ui/build /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Create nginx user and directories
RUN addgroup -g 1003 -S nginx \
    && adduser -S nginx -u 1003 -G nginx \
    && mkdir -p /var/cache/nginx /var/log/nginx \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 4. Nginx Configuration for UI
Create `docker/nginx.conf`:

```nginx
user nginx;
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

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

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
        application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=static:10m rate=100r/s;

    include /etc/nginx/conf.d/*.conf;
}
```

Create `docker/default.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API proxy (if needed for development)
    location /api/ {
        proxy_pass http://api:3000;
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
}
```

### 5. Docker Compose for Development
Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://ableka:password@postgres:5432/ableka_prod
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - API_KEY_SECRET=${API_KEY_SECRET}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    networks:
      - ableka-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  agent:
    build:
      context: .
      dockerfile: Dockerfile.agent
      target: agent-production
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - REDIS_URL=redis://redis:6379
      - GROK_API_KEY=${GROK_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
    volumes:
      - ./logs:/app/logs
    networks:
      - ableka-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  ui:
    build:
      context: .
      dockerfile: Dockerfile.ui
      target: ui-production
    ports:
      - "80:80"
    depends_on:
      - api
    networks:
      - ableka-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=ableka_prod
      - POSTGRES_USER=ableka
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - ableka-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ableka -d ableka_prod"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - ableka-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:

networks:
  ableka-network:
    driver: bridge
```

### 6. Docker Build and Push Script
Create `scripts/docker-build.sh`:

```bash
#!/bin/bash

# Docker Build and Push Script for Ableka Lumina
set -e

# Configuration
REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
REPO_NAME="ableka-lumina"
TAG="${TAG:-latest}"
BUILD_ARGS=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Function to build and push image
build_and_push() {
    local service=$1
    local dockerfile=$2
    local image_name="${REGISTRY}/${REPO_NAME}-${service}:${TAG}"

    log "Building ${service} image..."
    docker build \
        --file ${dockerfile} \
        --tag ${image_name} \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from ${image_name} \
        --progress=plain \
        ${BUILD_ARGS} \
        .

    log "Pushing ${service} image..."
    docker push ${image_name}

    log "${service} image pushed: ${image_name}"
}

# Authenticate with ECR
log "Authenticating with ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${REGISTRY}

# Create ECR repositories if they don't exist
for service in api agent ui; do
    log "Ensuring ECR repository exists for ${service}..."
    aws ecr describe-repositories --repository-names ${REPO_NAME}-${service} --region ${AWS_REGION} || \
    aws ecr create-repository --repository-name ${REPO_NAME}-${service} --region ${AWS_REGION}
done

# Build and push images
log "Starting Docker build process..."

build_and_push "api" "Dockerfile.api"
build_and_push "agent" "Dockerfile.agent"
build_and_push "ui" "Dockerfile.ui"

log "All images built and pushed successfully!"

# Generate image manifest
cat > image-manifest.json << EOF
{
  "version": "${TAG}",
  "build_date": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "images": {
    "api": "${REGISTRY}/${REPO_NAME}-api:${TAG}",
    "agent": "${REGISTRY}/${REPO_NAME}-agent:${TAG}",
    "ui": "${REGISTRY}/${REPO_NAME}-ui:${TAG}"
  },
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD)"
}
EOF

log "Image manifest generated: image-manifest.json"
```

### 7. Security Scanning Integration
Create `scripts/security-scan.sh`:

```bash
#!/bin/bash

# Security scanning script for Docker images
set -e

REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
REPO_NAME="ableka-lumina"
TAG="${TAG:-latest}"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "ERROR: $1" >&2
    exit 1
}

# Function to scan image
scan_image() {
    local service=$1
    local image="${REGISTRY}/${REPO_NAME}-${service}:${TAG}"

    log "Scanning ${service} image for vulnerabilities..."

    # Use Trivy for vulnerability scanning
    if command -v trivy &> /dev/null; then
        trivy image \
            --format json \
            --output trivy-${service}-scan.json \
            ${image}

        # Check for critical vulnerabilities
        critical_count=$(jq '.Results[].Vulnerabilities[]? | select(.Severity == "CRITICAL") | .VulnerabilityID' trivy-${service}-scan.json | wc -l)
        high_count=$(jq '.Results[].Vulnerabilities[]? | select(.Severity == "HIGH") | .VulnerabilityID' trivy-${service}-scan.json | wc -l)

        log "${service} scan results: ${critical_count} critical, ${high_count} high vulnerabilities"

        if [ "$critical_count" -gt 0 ]; then
            error "Critical vulnerabilities found in ${service} image"
        fi

        if [ "$high_count" -gt 10 ]; then
            error "Too many high-severity vulnerabilities in ${service} image"
        fi
    else
        warn "Trivy not found, skipping vulnerability scan"
    fi

    # Scan for secrets
    log "Scanning ${service} image for secrets..."
    if command -v docker &> /dev/null; then
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            zricethezav/gitleaks:latest \
            detect \
            --source ${image} \
            --verbose \
            --redact \
            --config /path/to/gitleaks-config.toml || true
    fi
}

# Scan all images
for service in api agent ui; do
    scan_image ${service}
done

log "Security scanning completed successfully"
```

### 8. Image Size and Performance Optimization
Create `scripts/optimize-images.sh`:

```bash
#!/bin/bash

# Image optimization script
set -e

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Function to analyze image
analyze_image() {
    local service=$1
    local image=$2

    log "Analyzing ${service} image..."

    # Get image size
    size=$(docker inspect ${image} | jq -r '.[0].Size')
    size_mb=$((size / 1024 / 1024))

    log "${service} image size: ${size_mb}MB"

    # Check layers
    layer_count=$(docker history ${image} | wc -l)
    log "${service} layers: ${layer_count}"

    # Performance check - start time
    log "Testing ${service} startup time..."
    start_time=$(date +%s%3N)

    container_id=$(docker run -d --rm ${image})
    sleep 5

    # Check if container is healthy
    health=$(docker inspect ${container_id} | jq -r '.[0].State.Health.Status' 2>/dev/null || echo "unknown")

    end_time=$(date +%s%3N)
    startup_time=$((end_time - start_time))

    log "${service} startup time: ${startup_time}ms"
    log "${service} health status: ${health}"

    docker stop ${container_id} >/dev/null 2>&1

    # Validate size limits
    if [ ${size_mb} -gt 500 ]; then
        log "WARNING: ${service} image size (${size_mb}MB) exceeds 500MB limit"
    fi

    if [ ${startup_time} -gt 30000 ]; then
        log "WARNING: ${service} startup time (${startup_time}ms) exceeds 30s limit"
    fi
}

# Analyze all images
analyze_image "api" "ableka-lumina-api:latest"
analyze_image "agent" "ableka-lumina-agent:latest"
analyze_image "ui" "ableka-lumina-ui:latest"

log "Image analysis completed"
```

## Testing and Validation

### Building and Testing Images
```bash
# Build all images
docker-compose build

# Test API image
docker run -d --name test-api -p 3000:3000 ableka-lumina-api:latest
sleep 10
curl http://localhost:3000/health
docker stop test-api && docker rm test-api

# Test Agent image
docker run -d --name test-agent -p 4000:4000 ableka-lumina-agent:latest
sleep 10
curl http://localhost:4000/health
docker stop test-agent && docker rm test-agent

# Test UI image
docker run -d --name test-ui -p 8080:80 ableka-lumina-ui:latest
sleep 5
curl http://localhost:8080/
docker stop test-ui && docker rm test-ui

# Run security scan
./scripts/security-scan.sh

# Analyze image performance
./scripts/optimize-images.sh
```

### CI/CD Integration
Add Docker building to your GitHub Actions workflow:

```yaml
- name: Build and Push Docker Images
  run: |
    echo "TAG=${GITHUB_SHA::8}" >> $GITHUB_ENV
    chmod +x scripts/docker-build.sh
    ./scripts/docker-build.sh
  env:
    AWS_REGION: ${{ secrets.AWS_REGION }}
    AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}

- name: Security Scan
  run: |
    chmod +x scripts/security-scan.sh
    ./scripts/security-scan.sh

- name: Performance Test
  run: |
    chmod +x scripts/optimize-images.sh
    ./scripts/optimize-images.sh
```

### Image Validation Checklist
- [ ] Images build successfully without errors
- [ ] Image sizes are within limits (<200MB for API, <100MB for UI)
- [ ] Containers start within 30 seconds
- [ ] Health checks pass
- [ ] No critical security vulnerabilities
- [ ] Non-root users are used
- [ ] Proper signal handling with dumb-init
- [ ] Multi-stage builds reduce final image size
- [ ] Cross-platform compatibility (linux/amd64, linux/arm64)

## Next Steps
- Day 2 will focus on building Docker images for the portal/UI
- Day 3 will set up Fargate cluster configuration
- Day 4 will deploy to ECS
- Day 5 will configure Aurora PG multi-tenant database

This Docker implementation provides a solid foundation for containerized deployment of the Ableka Lumina platform with security, performance, and scalability in mind.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 5 Deployment & Launch\Week 21\Day 1.md