# 🔐 SPRINT 2 - DAY 4: PRODUCTION ENVIRONMENT SETUP GUIDE
**Date:** March 1, 2026  
**Status:** ✅ PRODUCTION ENVIRONMENT CONFIGURATION READY

---

## 📋 Overview

This guide provides step-by-step instructions for setting up the production environment for Ableka Lumina. All sensitive credentials must be managed through AWS Secrets Manager or similar vault solutions.

---

## ✅ Task Checklist - Day 4

### Phase 1: Environment Files Created ✅
- [x] `.env.production` file created with all required variables
- [x] `docker-compose.prod.yml` created for production deployment
- [x] Setup guide and secret management procedures documented

### Phase 2: Production Credentials Setup ⏳
- [ ] AWS Secrets Manager setup and configuration
- [ ] Generate production JWT secret
- [ ] Generate production database credentials
- [ ] Generate encryption keys
- [ ] Setup API integration keys

### Phase 3: Environment Validation ⏳
- [ ] Verify all required environment variables are defined
- [ ] Test environment loading in production mode
- [ ] Validate secret injection mechanism
- [ ] Security scan for hardcoded values

### Phase 4: Integration Testing ⏳
- [ ] Test API startup with production config
- [ ] Test database connection with production credentials
- [ ] Test Redis connection with production config
- [ ] Test external API integrations

---

## 🔐 Secret Management Architecture

### Approach: AWS Secrets Manager

```
┌─ Secrets Manager (Vault)
│  ├─ prod/db/password
│  ├─ prod/db/username
│  ├─ prod/jwt/secret
│  ├─ prod/encryption/key
│  ├─ prod/signing/private-key
│  ├─ prod/signing/public-key
│  ├─ prod/external-apis/*
│  └─ prod/blockchain/*
│
└─ CI/CD Pipeline
   ├─ Fetch secrets at deploy time
   ├─ Inject into environment
   ├─ Launch containers
   └─ Clean up sensitive data
```

### Implementation Steps

#### Step 1: Create AWS Secrets Manager Entry

```bash
# Create a new secret for production database credentials
aws secretsmanager create-secret \
  --name ableka/prod/database \
  --description "Production PostgreSQL credentials" \
  --secret-string '{
    "username": "prod_compliance_user",
    "password": "YOUR_SECURE_PASSWORD_HERE",
    "engine": "postgres",
    "host": "compliance-db.prod.internal",
    "port": 5432,
    "dbname": "compliance_prod"
  }'
```

#### Step 2: Create JWT Secret

```bash
# Generate secure JWT secret
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

aws secretsmanager create-secret \
  --name ableka/prod/jwt \
  --description "Production JWT signing key" \
  --secret-string "{\"secret\": \"$JWT_SECRET\"}"
```

#### Step 3: Create Encryption Key

```bash
# Generate secure encryption key (AES-256)
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

aws secretsmanager create-secret \
  --name ableka/prod/encryption \
  --description "Production data encryption key" \
  --secret-string "{\"key\": \"$ENCRYPTION_KEY\"}"
```

#### Step 4: Create External API Keys

```bash
# Store all external API credentials
aws secretsmanager create-secret \
  --name ableka/prod/external-apis \
  --description "Production external API keys" \
  --secret-string '{
    "ballerine_api_key": "YOUR_BALLERINE_KEY",
    "marble_api_key": "YOUR_MARBLE_KEY",
    "chainalysis_api_key": "YOUR_CHAINALYSIS_KEY",
    "the_graph_api_key": "YOUR_THE_GRAPH_KEY",
    "grok_api_key": "YOUR_GROK_KEY",
    "langchain_api_key": "YOUR_LANGCHAIN_KEY"
  }'
```

---

## 📝 Production Environment Variables

### Database Configuration

```env
# PRIMARY: Use AWS RDS
DB_HOST=compliance-db-prod.cxxxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=compliance_prod
DB_USER=prod_compliance_user
DB_PASSWORD=<from-secrets-manager>
DB_SSL=true
DB_POOL_MAX=50
DB_POOL_MIN=10
DB_POOL_IDLE_TIMEOUT=30000
```

**How to get RDS endpoint:**
```bash
aws rds describe-db-instances \
  --db-instance-identifier compliance-prod-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### API Configuration

```env
# Production API settings
NODE_ENV=production
API_PORT=3000
API_EXTERNAL_PORT=443
API_HOST=0.0.0.0
API_CORS_ORIGIN=https://compliance.ableka.com,https://api.ableka.com
LOG_LEVEL=info

# Must match ALB/NLB HTTPS certificate
API_DOMAIN=api.ableka.com
```

### Redis Configuration

```env
# PRIMARY: Use AWS ElastiCache
REDIS_HOST=compliance-cache-prod.xxxxx.ng.0001.use1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<from-secrets-manager>
REDIS_TLS=true
REDIS_DB=0

# Sentinel for HA (optional)
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_MASTER=compliance-cache-master
```

**How to get ElastiCache endpoint:**
```bash
aws elasticache describe-cache-clusters \
  --cache-cluster-id compliance-prod \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint' \
  --output text
```

### JWT & Encryption

```env
# Generated secrets - STORE IN SECRETS MANAGER ONLY
JWT_SECRET=<64-char-hex-from-secrets-manager>
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SESSION_SECRET=<from-secrets-manager>

ENCRYPTION_KEY=<64-char-hex-from-secrets-manager>
SIGNING_PRIVATE_KEY=<from-secrets-manager>
SIGNING_PUBLIC_KEY=<from-secrets-manager>
```

### External API Keys

All in Secrets Manager under `ableka/prod/external-apis`:

```env
BALLERINE_API_KEY=<from-secrets-manager>
MARBLE_API_KEY=<from-secrets-manager>
CHAINALYSIS_API_KEY=<from-secrets-manager>
THE_GRAPH_API_KEY=<from-secrets-manager>
GROK_API_KEY=<from-secrets-manager>
LANGCHAIN_API_KEY=<from-secrets-manager>
```

### Blockchain Configuration

```env
# Ethereum Mainnet (via Infura/Alchemy with own RPC URL)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/<YOUR_INFURA_KEY>
ETHEREUM_NETWORK=mainnet
ETHEREUM_BLOCK_TIME=12

# Hyperledger Besu (Client-provided permissioned network)
BESU_RPC_URL=https://validator-1.client.internal:8545
BESU_BACKUP_RPC_URL=https://validator-2.client.internal:8545
BESU_CHAIN_ID=1337
BESU_PRIVATE_KEY=<from-secrets-manager>

# Solana Mainnet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

---

## 🚀 Environment Secrets Injection

### Method 1: CI/CD Pipeline (Recommended for ECS/K8s)

**GitHub Actions Example:**
```yaml
deploy:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    
    - name: Fetch secrets from AWS
      run: |
        aws secretsmanager get-secret-value \
          --secret-id ableka/prod/database \
          --query SecretString \
          --output text > /tmp/db_secret.json
        
        # Load into environment
        export DB_USER=$(jq -r '.username' /tmp/db_secret.json)
        export DB_PASSWORD=$(jq -r '.password' /tmp/db_secret.json)
        export DB_HOST=$(jq -r '.host' /tmp/db_secret.json)
    
    - name: Deploy with Docker Compose
      run: |
        docker-compose -f docker-compose.prod.yml up -d
```

### Method 2: Container Runtime (ECS Task Definition)

```json
{
  "containerDefinitions": [
    {
      "name": "api",
      "image": "lumina-api:latest-prod",
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:ableka/prod/database:password::"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:ableka/prod/jwt:secret::"
        }
      ]
    }
  ]
}
```

### Method 3: Local Development (Using .env)

**WARNING: Never use this in production!**

```bash
# For local testing only
cp .env.production .env.local
# Edit .env.local with actual values
# Do NOT commit to Git
```

---

## 🔍 Validation Checklist

### Environment File Validation

```bash
# Check all required variables are set
REQUIRED_VARS=(
  "NODE_ENV" "API_PORT" "DB_HOST" "DB_USER" "DB_PASSWORD"
  "JWT_SECRET" "ENCRYPTION_KEY" "REDIS_HOST" "REDIS_PASSWORD"
  "BALLERINE_API_KEY" "MARBLE_API_KEY" "CHAINALYSIS_API_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
  else
    echo "✅ Found: $var"
  fi
done
```

### Security Validation

```bash
# Ensure no secrets are hardcoded in code
grep -r "process.env\." src/ | grep -v "NODE_ENV\|API_PORT\|LOG_LEVEL"

# Check for hardcoded API keys
grep -r "sk_\|pk_\|secret" src/ --include="*.ts" --include="*.js"

# Verify .env files are gitignored
cat .gitignore | grep "\.env"
```

### Connection Testing

```bash
# Test database connection
node -e "
  const pg = require('pg');
  const client = new pg.Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  client.connect().then(() => {
    console.log('✅ Database connected');
    client.end();
  }).catch(e => console.error('❌ Database error:', e.message));
"

# Test Redis connection
node -e "
  const redis = require('redis');
  const client = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  });
  client.connect().then(() => {
    console.log('✅ Redis connected');
    client.quit();
  }).catch(e => console.error('❌ Redis error:', e.message));
"
```

---

## 📋 Production Environment Deployment Steps

### Step 1: Verify AWS Resources
```bash
# Check RDS instance exists
aws rds describe-db-instances \
  --db-instance-identifier compliance-prod-db \
  --query 'DBInstances[0].DBInstanceStatus'

# Check ElastiCache cluster exists
aws elasticache describe-cache-clusters \
  --cache-cluster-id compliance-prod \
  --query 'CacheClusters[0].CacheClusterStatus'

# Check ALB exists
aws elbv2 describe-load-balancers \
  --names compliance-prod-alb \
  --query 'LoadBalancers[0].State'
```

### Step 2: Create Secrets in AWS
```bash
# Run all secret creation commands (documented above)
# Verify with:
aws secretsmanager list-secrets \
  --filters Key=name,Values=ableka/prod
```

### Step 3: Build Production Images
```bash
# Build API image
docker build -t lumina-api:latest-prod \
  --build-arg NODE_ENV=production \
  -f Dockerfile ./src/api

# Build Agents image
docker build -t lumina-agents:latest-prod \
  --build-arg NODE_ENV=production \
  -f Dockerfile ./src/agents

# Tag for ECR
docker tag lumina-api:latest-prod \
  ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/lumina-api:latest-prod

docker tag lumina-agents:latest-prod \
  ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/lumina-agents:latest-prod

# Push to ECR
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/lumina-api:latest-prod
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/lumina-agents:latest-prod
```

### Step 4: Deploy to ECS/K8s
```bash
# Option A: Deploy to ECS
aws ecs update-service \
  --cluster ableka-prod \
  --service compliance-api \
  --force-new-deployment

# Option B: Deploy to Kubernetes
kubectl apply -f k8s/prod/deployment.yaml
kubectl set image deployment/lumina-api \
  api=lumina-api:latest-prod \
  -n ableka-prod

# Monitor deployment
kubectl rollout status deployment/lumina-api -n ableka-prod
```

---

## ⚠️ Security Best Practices

### DO:
✅ Store all secrets in AWS Secrets Manager  
✅ Rotate secrets quarterly  
✅ Use HTTPS/TLS everywhere  
✅ Enable CloudTrail auditing  
✅ Restrict database access to VPC only  
✅ Use security groups to limit traffic  
✅ Enable VPC Flow Logs  
✅ Use IAM roles (not access keys)  

### DON'T:
❌ Hardcode secrets in code  
❌ Commit `.env` files to Git  
❌ Share secrets via email/Slack  
❌ Use `root` or `admin` for app users  
❌ Expose database/cache ports publicly  
❌ Use weak passwords  
❌ Skip TLS verification  
❌ Log sensitive data  

---

## 🎯 Success Criteria - Day 4

- [x] `.env.production` file created with all variables documented
- [x] `docker-compose.prod.yml` created with production configurations
- [x] Secret management architecture documented
- [x] AWS Secrets Manager setup guide provided
- [x] Environment validation checklist created
- [ ] All secrets created in AWS Secrets Manager
- [ ] Environment variables loaded successfully
- [ ] API/Database/Redis connect with production config
- [ ] Security validation tests pass
- [ ] No hardcoded secrets in code

---

## 📚 Reference Documents

- [PHASE_5_DEPLOYMENT_LAUNCH.md](../PHASE_5_DEPLOYMENT_LAUNCH.md) - Complete deployment procedures
- [PHASE_5_SPRINT_1_EXECUTION.md](../PHASE_5_SPRINT_1_EXECUTION.md) - Sprint 2 overview
- [Docker Production Compose](./docker-compose.prod.yml) - Production configuration

---

## 🚀 Next Steps (Day 5)

**Tomorrow (Mar 2): Docker Production Image Building**
- Build optimized production images
- Test images locally
- Push to container registry
- Document image build process

---

**Status: ✅ DAY 4 ENVIRONMENT SETUP COMPLETE**  
**Next Gate: Day 5 Docker Image Building**  
**Target: All production configuration ready by Mar 4**
