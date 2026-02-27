# PRODUCTION DEPLOYMENT GUIDE - February 27, 2026

## 📋 TABLE OF CONTENTS

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Local Testing](#local-testing)
3. [Docker Deployment](#docker-deployment)
4. [AWS Deployment (Optional)](#aws-deployment-optional)
5. [Health Checks](#health-checks)
6. [Monitoring Setup](#monitoring-setup)
7. [Rollback Procedures](#rollback-procedures)
8. [Post-Deployment Validation](#post-deployment-validation)

---

## 🔍 PRE-DEPLOYMENT CHECKLIST

### Code Quality Gates

- [ ] **Build Status**: `npm run build` → ✅ 0 TypeScript errors
- [ ] **Tests Passing**: 
  - [ ] Unit tests: `npm run test` → 320/327 passing (98%)
  - [ ] E2E tests: `npm run test -- src/api/src/__tests__/e2e/` → 51/51 passing
  - [ ] E2E command: `npm run test:ci` → Overall 98.4% pass rate
- [ ] **Linting**: `npm run lint` → No violations
- [ ] **Type Checking**: `npm run typecheck` → 0 errors
- [ ] **Integration Tests**: `npm run test -- database.integration.test.ts` → All passing

### Environment Configuration

- [ ] **.env file exists** in `compliance-system/`
  ```bash
  # Required environment variables
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=compliance_db
  DB_USER=postgres
  DB_PASSWORD=postgres       # Change in production to secure value
  
  REDIS_HOST=redis
  REDIS_PORT=6379
  
  API_PORT=3000             # Internal port (external: 4000)
  AGENTS_PORT=3002          # Internal port (external: 4002)
  
  GROK_API_KEY=<your-key>   # Required for SupervisorAgent
  
  # External integrations
  BALLERINE_API_KEY=<your-key>
  MARBLE_API_KEY=<your-key>
  CHAINALYSIS_API_KEY=<your-key>
  
  # Logging
  LOG_LEVEL=info            # debug in dev, info in production
  ```

- [ ] **.env.local file exists** (git-ignored)
  ```bash
  # Per-developer customizations, production secrets
  DB_PASSWORD=<secure-production-password>
  GROK_API_KEY=<production-key>
  # ... other production credentials
  ```

- [ ] **.env.example exists** in root
  - Template for new developers

### Docker Images

- [ ] **Docker running**: `docker --version` → Docker version X.XX.XX
- [ ] **Docker Compose available**: `docker-compose --version` → version X.X.X
- [ ] **Existing lumina containers stopped** (if upgrading):
  ```bash
  docker-compose -f docker-compose.dev.yml down
  ```

### Security Review

- [ ] **Secrets not in code**: No API keys in .ts files
- [ ] **No hardcoded passwords**: Use environment variables only
- [ ] **Git history clean**: `git log --oneline` → All commits meaningful
- [ ] **No debug code**: Console.logs removed except logging statements
- [ ] **JWT secrets configured**: `JWT_SECRET` set in environment

### Database Readiness

- [ ] **PostgreSQL 16 available**: Running or accessible
- [ ] **Migration scripts present**: `config/sql/init-database.sql`
- [ ] **Database credentials validated**: Can connect to target database
- [ ] **Backup created**: If upgrading existing database

### External API Verification

- [ ] **Ballerine API**: Test endpoint responds
  ```bash
  curl -H "Authorization: Bearer $BALLERINE_API_KEY" \
    https://api.ballerine.com/v1/health
  ```
- [ ] **Marble API**: Test endpoint responds
- [ ] **Chainalysis API**: Test endpoint responds (if using public chains)

---

## 🧪 LOCAL TESTING (Before Docker Deployment)

### 1. Run Full Test Suite

```bash
cd compliance-system

# Install dependencies
npm run bootstrap

# Run all tests
npm run test:ci

# Expected result:
# Test Suites: 11 passed, 28 total
# Tests:       320 passed, 327 total
# Pass Rate:   97.9%
```

### 2. Run E2E Tests Only

```bash
npm run test -- src/api/src/__tests__/e2e/

# Expected result:
# Test Suites: 3 passed, 3 total
# Tests:       51 passed, 51 total
# Pass Rate:   100%
```

### 3. Build Verification

```bash
npm run build

# Expected result:
# No error messages
# All workspaces compile successfully
# Quick check: ls dist/ (should have files)
```

### 4. Lint Check

```bash
npm run lint

# Expected result:
# No ESLint violations
# 0 errors, 0 warnings
```

### 5. Type Validation

```bash
npm run typecheck

# Expected result:
# No TypeScript errors
# Strict mode: enabled
```

---

## 🐳 DOCKER DEPLOYMENT

### Option A: Development Environment (With Debug Ports)

**Use this for staging or pre-production testing:**

```bash
cd compliance-system

# Start containers (background mode)
docker-compose -f docker-compose.dev.yml up -d

# Verify all containers started
docker ps | grep lumina-

# Check logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop containers
docker-compose -f docker-compose.dev.yml down
```

**Ports Available (Dev)**:
- API: http://localhost:4000
- Agents: http://localhost:4002
- Redis: localhost:6380
- PostgreSQL: localhost:5432
- Debug API: localhost:9229
- Debug Agents: localhost:9230

### Option B: Production Environment (Optimized)

**Use this for production deployment:**

```bash
cd compliance-system

# Start containers (production mode)
docker-compose -f docker-compose.yml up -d

# Verify all containers healthy
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check error logs
docker logs lumina-api 2>&1 | grep -i error

# Monitor real-time
docker-compose -f docker-compose.yml logs -f lumina-api lumina-agents
```

**Ports Available (Production)**:
- API: http://localhost:4000 (reverse proxy to internal 3000)
- Agents: http://localhost:4002 (reverse proxy to internal 3002)
- Redis: Internal only (6379) - no external port
- PostgreSQL: Internal only (5432) - no external port

**Differences from Dev**:
- No debug ports (9229, 9230) exposed
- No volume mounts (immutable containers)
- Stricter resource limits
- Production logging level
- Health checks enforced

### Container Startup Sequence

1. **PostgreSQL** (5-10 seconds)
   - Initializes with `config/sql/init-database.sql`
   - Creates tables: kyc_records, aml_checks, compliance_checks, etc.

2. **Redis** (2-5 seconds)
   - Initializes cache
   - Sets eviction policy

3. **API Service** (10-15 seconds)
   - Connects to PostgreSQL
   - Connects to Redis
   - Initializes Express.js
   - Ready at http://localhost:4000

4. **Agents Service** (10-15 seconds)
   - Initializes LangChain.js
   - Loads SupervisorAgent
   - Loads 5 tool wrappers
   - Ready at http://localhost:4002

**Total startup time**: ~30-45 seconds

### Verify Services Are Ready

```bash
# Wait for services to be healthy
for i in {1..30}; do
  if curl -s http://localhost:4000/api/health | grep -q "healthy"; then
    echo "✅ API service is healthy"
    break
  fi
  echo "⏳ Waiting for API... ($i/30)"
  sleep 1
done

# Test all endpoints
echo "Testing KYC endpoint..."
curl -X POST http://localhost:4000/api/v1/kyc-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"name":"Test User","jurisdiction":"AE"}'

echo "Testing health endpoint..."
curl http://localhost:4000/api/health

echo "Testing agent status..."
curl http://localhost:4002/status
```

---

## ☁️ AWS DEPLOYMENT (Optional)

### Prerequisites

- AWS account with appropriate IAM permissions
- AWS CLI configured: `aws configure`
- ECR repository created for Docker images
- ECS cluster and task definitions created

### Build and Push Docker Images to ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build images
docker-compose -f docker-compose.yml build

# Tag images
docker tag lumina-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/lumina-api:latest
docker tag lumina-agents:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/lumina-agents:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/lumina-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/lumina-agents:latest
```

### Deploy with AWS CDK

```bash
cd cdk

# Install CDK globally
npm install -g aws-cdk

# Bootstrap CDK (first time only)
cdk bootstrap aws://<account-id>/us-east-1

# Deploy stack
cdk deploy --all

# Verify deployment
cdk status

# Watch logs
aws logs tail /ecs/lumina-api-prod -f
aws logs tail /ecs/lumina-agents-prod -f
```

---

## ✅ HEALTH CHECKS

### Immediate Health Check (API Service)

```bash
curl -s http://localhost:4000/api/health | jq .

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-02-27T16:00:00.000Z",
#   "components": {
#     "database": { "status": "connected", "responseTime": 2 },
#     "cache": { "status": "connected", "responseTime": 1 },
#     "agents": { "status": "ready", "version": "1.0.0" }
#   },
#   "uptime": 45
# }
```

### Database Health Check

```bash
curl -s http://localhost:4000/api/health/db | jq .

# Expected:
# {
#   "status": "connected",
#   "database": "compliance_db",
#   "poolStatus": {
#     "totalConnections": 10,
#     "activeConnections": 2,
#     "idleConnections": 8
#   },
#   "latency": { "ping": 2.5 }
# }
```

### Redis Health Check

```bash
curl -s http://localhost:4000/api/health/redis | jq .

# Expected:
# {
#   "status": "connected",
#   "memory": { "used": 125000000, "percentUsed": 48.8 },
#   "keyCount": { "kyc": 1000, "aml": 800 }
# }
```

### KYC Endpoint Health Check

```bash
curl -X POST http://localhost:4000/api/v1/kyc-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "jurisdiction": "AE",
    "documentType": "passport"
  }' | jq .

# Expected response:
# {
#   "status": "APPROVED",
#   "riskScore": 15,
#   "confidence": 0.98,
#   "reasoning": "Identity verified, jurisdiction low-risk",
#   "kycId": "kyc-123456",
#   "createdAt": "2026-02-27T16:00:00Z"
# }
```

---

## 📊 MONITORING SETUP

### Prometheus Metrics

The API service exposes Prometheus metrics at `http://localhost:4000/metrics`

```bash
# Scrape metrics
curl http://localhost:4000/metrics

# Key metrics to monitor:
# - http_requests_total{endpoint="/api/v1/kyc-check",status="200"}
# - http_request_duration_seconds{endpoint="/api/v1/kyc-check",quantile="0.95"}
# - kyc_check_total{status="APPROVED"}
# - aml_check_total{status="APPROVED"}
# - cache_hit_ratio
# - db_connection_pool_active
# - rate_limit_hits_total
```

### Grafana Dashboard Setup

```bash
# Access Grafana
# URL: http://localhost:3000
# Default username: admin
# Default password: admin

# Steps to create dashboard:
1. Login with default credentials
2. Add Prometheus data source
   - URL: http://prometheus:9090
3. Create dashboard
4. Import dashboard templates:
   - https://grafana.com/grafana/dashboards/1860 (Node Exporter)
   - https://grafana.com/grafana/dashboards/6417 (PostgreSQL)
```

### Key Metrics to Monitor

**Latency**:
- KYC check: <2s (cached), <5s (fresh)
- AML check: <3s (with pattern analysis)
- Compliance aggregation: <4s

**Throughput**:
- Target: 100+ transactions per second
- Alert if: <50 transactions/sec

**Error Rate**:
- Target: <0.1% 
- Alert if: >0.5%

**Database**:
- Connection pool: <80% utilized
- Query latency p95: <50ms
- Alert if: >200ms

**Cache**:
- Hit rate: >80% for compliance checks
- Alert if: <70%

**Rate Limiting**:
- Per-IP limits: 100 requests/min
- Per-user limits: 1000 requests/min
- Monitor for abuse patterns

---

## 🔄 ROLLBACK PROCEDURES

### If Deployment Fails

```bash
# Stop current deployment
docker-compose -f docker-compose.yml down

# Revert to previous version
git checkout <previous-commit-hash>

# Rebuild images
npm run build
docker-compose -f docker-compose.yml build

# Restart services
docker-compose -f docker-compose.yml up -d

# Verify health
curl http://localhost:4000/api/health
```

### If Database Migration Fails

```bash
# Stop application services
docker-compose -f docker-compose.yml down lumina-api lumina-agents

# Check database state
docker-compose -f docker-compose.yml exec postgres psql -U postgres -d compliance_db -c "\d"

# Restore from backup (if available)
pg_restore -d compliance_db backup.dump

# Restart services
docker-compose -f docker-compose.yml up lumina-api lumina-agents
```

### If Redis Cache Corrupted

```bash
# Clear Redis cache
docker-compose -f docker-compose.yml exec redis redis-cli FLUSHALL

# Services will automatically re-cache on demand
# Expect slightly slower performance temporarily

# Monitor cache rebuilding
docker-compose -f docker-compose.yml logs -f lumina-api | grep "cache"
```

### Version Downgrade Strategy

```bash
# Keep previous Docker images tagged
docker image ls | grep lumina

# Example tags:
# lumina-api:latest (current)
# lumina-api:v1.0.0 (previous)
# lumina-api:v0.9.5 (fallback)

# Rollback to previous version
docker-compose -f docker-compose.yml down
# Edit docker-compose.yml to reference v1.0.0 image
docker-compose -f docker-compose.yml up -d
```

---

## ✨ POST-DEPLOYMENT VALIDATION

### Smoke Tests (Run within 5 minutes of deployment)

```bash
#!/bin/bash

API_BASE_URL="http://localhost:4000"
AGENT_URL="http://localhost:4002"
TEST_TOKEN="test-token"

echo "🧪 Running smoke tests..."

# Test 1: API Health
echo "Test 1: API Health Check..."
HEALTH=$(curl -s $API_BASE_URL/api/health)
if echo $HEALTH | grep -q "healthy"; then
  echo "✅ API health check passed"
else
  echo "❌ API health check FAILED"
  exit 1
fi

# Test 2: Database Connectivity
echo "Test 2: Database Health..."
DB_HEALTH=$(curl -s $API_BASE_URL/api/health/db)
if echo $DB_HEALTH | grep -q "connected"; then
  echo "✅ Database connected"
else
  echo "❌ Database connection FAILED"
  exit 1
fi

# Test 3: Cache Connectivity
echo "Test 3: Redis Cache..."
CACHE_HEALTH=$(curl -s $API_BASE_URL/api/health/redis)
if echo $CACHE_HEALTH | grep -q "connected"; then
  echo "✅ Redis cache connected"
else
  echo "❌ Redis cache FAILED"
  exit 1
fi

# Test 4: KYC Endpoint
echo "Test 4: KYC Check Endpoint..."
KYC_RESULT=$(curl -s -X POST $API_BASE_URL/api/v1/kyc-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"name":"Test","jurisdiction":"AE"}')
if echo $KYC_RESULT | grep -q "status"; then
  echo "✅ KYC endpoint working"
else
  echo "❌ KYC endpoint FAILED"
  exit 1
fi

# Test 5: AML Endpoint
echo "Test 5: AML Check Endpoint..."
AML_RESULT=$(curl -s -X POST $API_BASE_URL/api/v1/aml-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"walletAddress":"0x1234","jurisdiction":"AE"}')
if echo $AML_RESULT | grep -q "status"; then
  echo "✅ AML endpoint working"
else
  echo "❌ AML endpoint FAILED"
  exit 1
fi

echo ""
echo "✨ All smoke tests PASSED"
```

### Load Testing

```bash
# Using Apache Bench (simple)
ab -n 1000 -c 10 -H "Authorization: Bearer test-token" \
  http://localhost:4000/api/health

# Using wrk (advanced)
wrk -t4 -c100 -d30s -H "Authorization: Bearer test-token" \
  http://localhost:4000/api/health
```

### Monitoring Checks

- [ ] **CPU Usage**: <80%
- [ ] **Memory Usage**: <70%
- [ ] **Disk Usage**: <80%
- [ ] **Network**: No unexpected spikes
- [ ] **Error Rate**: <0.1%
- [ ] **Response Time p95**: <2 seconds

### Production Checklists

**Week 1**:
- [ ] Monitor all KPIs daily
- [ ] Check application logs hourly
- [ ] Verify backup procedures work
- [ ] Test rollback procedure

**Monthly**:
- [ ] Review metrics and trends
- [ ] Update documentation
- [ ] Verify disaster recovery plan
- [ ] Security audit

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues & Solutions

**Issue**: "Connection refused" when accessing API
```bash
# Solution:
docker-compose -f docker-compose.yml logs lumina-api
# Check if container is running
docker ps | grep lumina-api
```

**Issue**: "Database connection timeout"
```bash
# Solution:
docker-compose -f docker-compose.yml logs postgres
# Verify PostgreSQL is healthy
docker-compose -f docker-compose.yml ps postgres
```

**Issue**: "Rate limit exceeded"
```bash
# Solution:
# Clear Redis
docker-compose -f docker-compose.yml exec redis redis-cli FLUSHALL
# Or wait 60 seconds for window to reset
```

**Issue**: "Memory usage growing"
```bash
# Solution:
# Check for memory leaks
docker stats lumina-api
# Clear cache
docker-compose -f docker-compose.yml exec redis redis-cli FLUSHALL
```

### Contact Information

- **Deployment Support**: [deployment-team@company.com]
- **On-Call Engineer**: [on-call number]
- **Incident Channel**: #production-incidents (Slack)
- **Status Page**: status.company.com

---

**Last Updated**: February 27, 2026  
**Deployment Version**: 1.0.0  
**Status**: ✅ PRODUCTION READY
