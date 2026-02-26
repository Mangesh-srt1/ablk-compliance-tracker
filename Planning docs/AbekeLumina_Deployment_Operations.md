# ComplianceShield - Deployment & Operations Guide
## Production Kubernetes & AWS Deployment Manual

**Document Version**: 1.0  
**Date**: February 26, 2026  
**Status**: Production Ready

---

## TABLE OF CONTENTS

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Local Development Setup](#local-development-setup)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [AWS Infrastructure Deployment](#aws-infrastructure-deployment)
5. [Monitoring & Observability](#monitoring--observability)
6. [Disaster Recovery & Failover](#disaster-recovery--failover)
7. [Security Hardening](#security-hardening)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## PRE-DEPLOYMENT CHECKLIST

### Code Quality & Testing

```bash
# ✅ Linting
npm run lint
npm run lint:fix

# ✅ Type Checking
npm run typecheck

# ✅ Unit Tests
npm run test -- --coverage
# Target: 80%+ coverage for compliance logic

# ✅ Integration Tests
npm run test:integration
# Tests API endpoints with mocked external services

# ✅ Security Scanning
npm audit
npm audit fix --audit-level=critical

# ✅ Docker Build
docker build -t compliance-shield-api:1.0.0 .
docker run --rm compliance-shield-api:1.0.0 npm run typecheck
```

### Infrastructure Prerequisites

```bash
# ✅ Kubernetes cluster
kubectl cluster-info
kubectl get nodes  # Should show 3+ nodes

# ✅ Docker credentials
docker login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# ✅ AWS CLI configured
aws sts get-caller-identity

# ✅ PostgreSQL connectivity
psql -h <db-host> -U <user> -d compliance_db -c "SELECT version();"

# ✅ Redis connectivity
redis-cli -h <redis-host> ping

# ✅ Kafka connectivity
kafka-console-producer --broker-list <kafka-brokers> --topic test
```

### Compliance & Documentation

```
[ ] API OpenAPI specification finalized
[ ] Database schema migrated
[ ] SEBI compliance checklist signed off
[ ] SOC2 controls documented
[ ] Incident response playbook approved
[ ] Runbooks for common issues
[ ] Team trained on deployment procedures
```

---

## LOCAL DEVELOPMENT SETUP

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/compliance-shield.git
cd compliance-shield

# Install root dependencies
npm install

# Install workspace dependencies
npm run bootstrap

# Install pre-commit hooks
npm run husky:install
```

### 2. Docker Compose Stack (Local)

```bash
# Copy env template
cp .env.example .env.development

# Start all services (PostgreSQL, Redis, Kafka, API)
docker-compose -f docker-compose.dev.yml up -d

# Check service health
docker-compose ps
docker-compose logs -f api

# Verify API is ready
curl http://localhost:3000/health

# Run database migrations
npm run migrate
npm run db:seed  # Load test data

# Test compliance endpoint
curl -X POST http://localhost:3000/v1/compliance/transfer-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "from_address": "0x123...",
    "to_address": "0x456...",
    "amount": "1000000000000000000",
    "token_id": "token-123",
    "blockchain_type": "permissioned"
  }'
```

### 3. Environment Configuration

**`.env.development` (Local)**
```
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000

DATABASE_URL=postgresql://postgres:password@localhost:5432/compliance_db
REDIS_URL=redis://localhost:6379

JWT_SECRET=dev-secret-change-in-production
KAFKA_BROKERS=localhost:9092

BALLERINE_API_KEY=test-key
MARBLE_API_KEY=test-key
CHAINALYSIS_API_KEY=test-key
GROK_API_KEY=test-key

BLOCKCHAIN_TYPE=permissioned
BESU_RPC_URL=http://localhost:8545

ENABLE_ORACLE=true
ENABLE_AI_REASONING=true
```

**`.env.production` (Use AWS Secrets Manager)**
```
NODE_ENV=production
LOG_LEVEL=info

# Use AWS RDS endpoint
DATABASE_URL=postgresql://admin:password@compliance-db.xxxxx.rds.amazonaws.com:5432/compliance_db

# Use ElastiCache endpoint
REDIS_URL=redis://compliance-redis.xxxxx.cache.amazonaws.com:6379

# Use AWS Secrets Manager
JWT_SECRET=${aws secretsmanager get-secret-value --secret-id compliance/jwt ...}

# Use Managed Kafka (MSK)
KAFKA_BROKERS=b-1.msk-cluster.xxxxx.kafka.us-east-1.amazonaws.com:9092,...

# Use real API keys from Secrets Manager
BALLERINE_API_KEY=${aws secretsmanager ...}
...
```

---

## KUBERNETES DEPLOYMENT

### 1. Build & Push Docker Image

```bash
# Build image for production
docker build -t compliance-shield-api:1.0.0 \
  --build-arg NODE_ENV=production .

# Tag for ECR
docker tag compliance-shield-api:1.0.0 \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/compliance-shield-api:1.0.0

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/compliance-shield-api:1.0.0

# Verify image
aws ecr describe-images --repository-name compliance-shield-api
```

### 2. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace compliance-shield

# Create secrets (NOTE: Never commit these!)
kubectl create secret generic compliance-secrets \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=REDIS_URL='redis://...' \
  --from-literal=JWT_SECRET='<secret>' \
  -n compliance-shield

# Create ConfigMap
kubectl create configmap compliance-config \
  --from-literal=LOG_LEVEL='info' \
  --from-literal=KAFKA_BROKERS='kafka-0.kafka-headless:9092,...' \
  -n compliance-shield

# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml
kubectl apply -f k8s/api-hpa.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/kafka-statefulset.yaml

# Verify deployment
kubectl rollout status deployment/compliance-api -n compliance-shield
kubectl get pods -n compliance-shield
kubectl get svc -n compliance-shield

# Port-forward for testing
kubectl port-forward svc/compliance-api 3000:80 -n compliance-shield
curl http://localhost:3000/health
```

### 3. Scaling & Updates

```bash
# Scale deployment
kubectl scale deployment/compliance-api --replicas=10 -n compliance-shield

# Update image (blue-green deployment)
kubectl set image deployment/compliance-api \
  api=<account-id>.dkr.ecr.us-east-1.amazonaws.com/compliance-shield-api:1.0.1 \
  -n compliance-shield

# Check rollout status
kubectl rollout status deployment/compliance-api -n compliance-shield

# Rollback if needed
kubectl rollout undo deployment/compliance-api -n compliance-shield
```

### 4. Health Checks & Monitoring

```bash
# Check pod health
kubectl get pods -n compliance-shield
kubectl describe pod <pod-name> -n compliance-shield
kubectl logs <pod-name> -n compliance-shield

# Check resource usage
kubectl top pods -n compliance-shield
kubectl top nodes

# Check HPA status
kubectl get hpa -n compliance-shield
kubectl describe hpa compliance-api-hpa -n compliance-shield
```

---

## AWS INFRASTRUCTURE DEPLOYMENT

### 1. Deploy with AWS CDK

```bash
# Install AWS CDK
npm install -g aws-cdk

# Navigate to CDK directory
cd cdk

# Install dependencies
npm install

# Synthesize CloudFormation template
cdk synth

# Deploy to AWS
cdk deploy ComplianceShieldProd \
  --region us-east-1 \
  --profile production

# Verify deployment
aws cloudformation describe-stacks \
  --stack-name ComplianceShieldProd \
  --region us-east-1

# Get outputs
aws cloudformation describe-stacks \
  --stack-name ComplianceShieldProd \
  --query 'Stacks[0].Outputs' \
  --region us-east-1
```

### 2. Database Migration & Seeding

```bash
# Connect to RDS instance
psql -h compliance-db.xxxxx.rds.amazonaws.com -U admin -d compliance_db

# Run migrations
npm run migrate

# Seed test data
npm run db:seed

# Verify tables
\dt  # List tables
SELECT count(*) FROM transfer_compliance_checks;
```

### 3. Configure Load Balancer & DNS

```bash
# Get ALB DNS name
aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[0].DNSName'

# Create Route53 DNS record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123... \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.compliance-shield.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z123...",
          "DNSName": "compliance-alb-123.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Test DNS resolution
dig api.compliance-shield.com
curl https://api.compliance-shield.com/health
```

---

## MONITORING & OBSERVABILITY

### 1. CloudWatch Setup

```bash
# View CloudWatch logs
aws logs tail /aws/ecs/compliance-api --follow

# Create custom metric alarm
aws cloudwatch put-metric-alarm \
  --alarm-name HighErrorRate \
  --alarm-description "Alert if error rate exceeds 1%" \
  --metric-name 4XX Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# View alarm state
aws cloudwatch describe-alarms --alarm-name HighErrorRate
```

### 2. Prometheus & Grafana (Kubernetes)

```bash
# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

# Create Grafana dashboard
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Access Grafana
# URL: http://localhost:3000
# Default: admin / prom-operator
```

### 3. Key Metrics to Monitor

```
Application Metrics:
├─ API_latency_p99: <100ms target
├─ compliance_checks_per_second: 10,000+ TPS
├─ approval_rate: 80-90% expected
├─ escalation_rate: <10% expected
├─ error_rate: <0.1% target
└─ cache_hit_rate: >95% target

Infrastructure Metrics:
├─ CPU_utilization: <70% (triggers scale-up)
├─ Memory_utilization: <80% (triggers scale-up)
├─ Disk_usage: <80% (alert threshold)
├─ Network_latency: <50ms (east-west)
└─ Database_connection_pool: <90% utilization

Database Metrics:
├─ Query_latency_p99: <20ms
├─ Connection_pool_utilization: <80%
├─ Cache_hit_ratio: >95%
├─ Long_running_queries: Alert if >5s
└─ Replication_lag: <100ms (multi-region)

Third-party API Metrics:
├─ Ballerine_latency: <200ms
├─ Marble_latency: <200ms
├─ Chainalysis_latency: <500ms
└─ Circuit_breaker_failures: Alert if >10/min
```

---

## DISASTER RECOVERY & FAILOVER

### 1. Backup & Restore

```bash
# Automated RDS daily backups (configured in CDK)
# Manual backup
aws rds create-db-snapshot \
  --db-instance-identifier compliance-db \
  --db-snapshot-identifier compliance-db-backup-$(date +%Y%m%d)

# Export to S3
aws rds start-export-task \
  --export-task-identifier compliance-db-export \
  --source-arn arn:aws:rds:us-east-1:xxx:db:compliance-db \
  --s3-bucket-name compliance-backups \
  --iam-role-arn arn:aws:iam::xxx:role/ExportRole

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier compliance-db-restored \
  --db-snapshot-identifier compliance-db-backup-20260226
```

### 2. Multi-Region Failover

```bash
# Enable multi-region RDS
aws rds create-db-instance-read-replica \
  --db-instance-identifier compliance-db-us-west-2 \
  --source-db-instance-identifier compliance-db \
  --region us-west-2

# Promote read replica if primary fails
aws rds promote-read-replica \
  --db-instance-identifier compliance-db-us-west-2 \
  --region us-west-2

# Verify replication lag
aws rds describe-db-instances \
  --query 'DBInstances[0].StatusInfos' \
  --region us-east-1
```

### 3. Kubernetes Pod Recovery

```bash
# Pods auto-recover via StatefulSet/Deployment
# Manual restart if needed
kubectl delete pod <pod-name> -n compliance-shield
# Kubernetes automatically creates replacement

# Drain node for maintenance
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node-name>  # Resume scheduling
```

---

## SECURITY HARDENING

### 1. AWS Security Best Practices

```bash
# Enable VPC Flow Logs
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids vpc-xxxxx \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/compliance-shield

# Enable GuardDuty (Threat Detection)
aws guardduty create-detector --enable

# Enable AWS Config (Compliance Monitoring)
aws configservice put-config-recorder \
  --config-recorder name=default,roleARN=arn:aws:iam::xxx:role/ConfigRole

# Enable CloudTrail (Audit Logging)
aws cloudtrail create-trail \
  --name compliance-audit-trail \
  --s3-bucket-name compliance-audit-logs
```

### 2. Kubernetes Security

```bash
# Apply Network Policies
kubectl apply -f k8s/network-policy.yaml

# Enable Pod Security Standards
kubectl label namespace compliance-shield \
  pod-security.kubernetes.io/enforce=restricted

# Scan container images for vulnerabilities
trivy image <account-id>.dkr.ecr.us-east-1.amazonaws.com/compliance-shield-api:1.0.0

# Enable RBAC auditing
kubectl apply -f k8s/audit-policy.yaml
```

### 3. Secrets Management

```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name compliance/jwt \
  --secret-string '{"JWT_SECRET":"very-secret-key"}'

# Rotate keys automatically (90-day rotation)
aws secretsmanager rotate-secret \
  --secret-id compliance/jwt \
  --rotation-rules AutomaticallyAfterDays=90

# Reference in ECS task
# env: JWT_SECRET: !Sub arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:compliance/jwt
```

---

## TROUBLESHOOTING GUIDE

### Common Issues & Solutions

**Issue 1: API Pod CrashLoopBackOff**
```bash
# Check logs
kubectl logs <pod-name> -n compliance-shield --previous

# Common causes:
# - Missing environment variables
# - Database connection failure
# - Port already in use

# Solution: Verify ConfigMap and Secrets
kubectl get cm -n compliance-shield
kubectl get secret -n compliance-shield

# Redeploy with correct secrets
kubectl delete secret compliance-secrets -n compliance-shield
kubectl create secret generic compliance-secrets \
  --from-literal=DATABASE_URL='postgresql://...' \
  -n compliance-shield
kubectl rollout restart deployment/compliance-api -n compliance-shield
```

**Issue 2: Database Connection Pool Exhaustion**
```bash
# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Solution: Increase pool size
# 1. Update pgBouncer config
# 2. Increase max_connections in RDS parameter group
# 3. Restart API pods to reconnect

# Monitor connection usage
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Graph: pg_connections / pg_connections_max
```

**Issue 3: High API Latency**
```bash
# Check Kubernetes metrics
kubectl top pods -n compliance-shield

# Check database query performance
psql -c "SELECT query, calls, mean_time/1000 as mean_ms FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;"

# Check Kafka consumer lag
kafka-consumer-groups --bootstrap-server $KAFKA_BROKERS \
  --group compliance-consumer-group --describe

# Solutions:
# 1. Scale up replicas: kubectl scale deployment compliance-api --replicas=20
# 2. Query optimization: Add indices or caching
# 3. Circuit breaker tuning: Increase timeout thresholds
```

**Issue 4: Redis Cache Misses**
```bash
# Check Redis memory usage
redis-cli INFO memory

# Check eviction policy
redis-cli CONFIG GET maxmemory-policy

# Solution: Adjust TTL or increase Redis capacity
# Current: REDIS_TTL_KYC=86400 (24h)
# If too many evictions, reduce TTL or scale Redis
redis-cli CLUSTER NODES
```

---

## RUNBOOK: Deploy New API Version

```bash
# 1. Build new image
docker build -t compliance-shield-api:1.0.1 .
docker tag compliance-shield-api:1.0.1 <ecr-repo>/compliance-shield-api:1.0.1
docker push <ecr-repo>/compliance-shield-api:1.0.1

# 2. Update image in deployment
kubectl set image deployment/compliance-api \
  api=<ecr-repo>/compliance-shield-api:1.0.1 \
  -n compliance-shield

# 3. Monitor rollout
watch kubectl rollout status deployment/compliance-api -n compliance-shield

# 4. Run smoke tests
curl https://api.compliance-shield.com/health
curl -X POST https://api.compliance-shield.com/v1/compliance/transfer-check \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{...}'

# 5. If rollout fails
kubectl rollout undo deployment/compliance-api -n compliance-shield

# 6. Verify metrics returned to normal
# Check: API latency, error rate, throughput
```

---

## RUNBOOK: Incident Response - API Outage

```
1. ASSESS (1 minute)
   [ ] Check if service is actually down: curl https://api.compliance-shield.com/health
   [ ] Check CloudWatch alarms: aws cloudwatch describe-alarms --state-value ALARM
   [ ] Check pod status: kubectl get pods -n compliance-shield

2. INVESTIGATE (5 minutes)
   [ ] Check API logs: kubectl logs -f deployment/compliance-api -n compliance-shield
   [ ] Check database connectivity: SELECT 1;  --in psql
   [ ] Check Redis: redis-cli PING
   [ ] Check Kafka: kafka-broker-api-versions --bootstrap-server $KAFKA_BROKERS

3. MITIGATE (Immediate)
   If pods are crashing:
     kubectl rollout undo deployment/compliance-api -n compliance-shield
   
   If database unreachable:
     [ ] Check RDS instance status: aws rds describe-db-instances
     [ ] Check security group: aws ec2 describe-security-groups
     [ ] Trigger failover: aws rds failover-db-cluster
   
   If high latency:
     [ ] Scale up: kubectl scale deployment compliance-api --replicas=30
     [ ] Check Kafka lag: kafka-consumer-groups ... --describe
     [ ] Clear Redis cache: redis-cli FLUSHDB

4. CLOSE
   [ ] Document incident in wiki
   [ ] Create post-mortem ticket
   [ ] Implement fix in next release
   [ ] Alert team of resolution
```

---

**Document Status**: PRODUCTION READY ✅  
**Last Updated**: February 26, 2026  
**Maintained By**: DevOps & Platform Team
