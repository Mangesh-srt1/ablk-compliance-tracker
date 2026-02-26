# AI Compliance System - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the AI Compliance System to AWS using Infrastructure as Code (IaC) with CDK and Docker containers.

## Prerequisites

### Required Tools

- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- Docker and Docker Compose
- Git
- PowerShell (for Windows deployments)

### AWS Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "ecs:*",
        "rds:*",
        "elasticache:*",
        "events:*",
        "lambda:*",
        "logs:*",
        "secretsmanager:*",
        "kms:*",
        "s3:*",
        "cloudfront:*",
        "wafv2:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

## Environment Setup

### 1. Clone and Setup

```bash
git clone <repository-url>
cd compliance-system
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. AWS Configuration

```bash
aws configure
# Enter your AWS credentials and preferred region (us-east-1 recommended)
```

## Local Development Deployment

### Using Docker Compose (Recommended for Development)

```bash
# Build and deploy all services
.\powershell-scripts\Deploy-ComplianceSystem.ps1 -Environment development

# Or with no-cache build
.\powershell-scripts\Deploy-ComplianceSystem.ps1 -Environment development -NoCache

# Skip tests if needed
.\powershell-scripts\Deploy-ComplianceSystem.ps1 -Environment development -SkipTests
```

### Manual Docker Commands

```bash
# Build images
docker compose build

# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Production AWS Deployment

### 1. CDK Setup

```bash
cd cdk

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Synthesize CloudFormation template
cdk synth

# Review changes
cdk diff

# Deploy to AWS
cdk deploy
```

### 2. Database Initialization

```bash
# Run database migrations
.\powershell-scripts\Run-DatabaseMigrations.ps1 -Environment production
```

### 3. Configure Secrets

```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name grok-api-key \
  --secret-string '{"api_key":"your-grok-api-key"}'

aws secretsmanager create-secret \
  --name compliance-db-secret \
  --secret-string '{"username":"compliance_admin","password":"secure-password"}'
```

## Service Architecture

### Core Services

- **API Gateway** (Port 3000): Main entry point with JWT authentication
- **AI Agents** (Port 3002): LangGraph-based compliance processing
- **Dashboard** (Port 3001): React frontend for compliance monitoring
- **PostgreSQL**: Primary database with Aurora
- **Redis**: Caching and session management
- **Grafana** (Port 3001): Monitoring and alerting

### Supporting Services

- **Besu Validator**: Permissioned blockchain for transaction validation
- **EventBridge**: Event-driven architecture for real-time processing
- **Lambda**: Serverless event processing
- **S3**: Document storage with encryption
- **CloudFront**: Global CDN distribution
- **WAF**: Web application firewall

## Configuration

### Environment Variables

```bash
# Database
DB_HOST=compliance-database.cluster-xxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=compliance_admin
DB_NAME=compliance_db

# Redis
REDIS_HOST=compliance-redis.xxxxxx.ng.0001.use1.cache.amazonaws.com
REDIS_PORT=6379

# AI/ML
GROK_API_KEY=your-grok-api-key
LANGCHAIN_API_KEY=your-langchain-api-key

# Security
JWT_SECRET=your-256-bit-jwt-secret
ENCRYPTION_KEY=your-256-bit-encryption-key

# AWS
AWS_REGION=us-east-1
KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
```

### Scaling Configuration

```typescript
// Auto-scaling rules in CDK
scaling.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 70,
  minCapacity: 2,
  maxCapacity: 10,
});
```

## Monitoring and Observability

### CloudWatch Dashboards

- Application metrics and logs
- Infrastructure monitoring
- AI model performance tracking
- Compliance violation alerts

### Grafana Dashboards

- Real-time compliance metrics
- Transaction processing latency
- AI agent performance
- Risk scoring trends

### Alerting

- Critical: Compliance violations
- Warning: Performance degradation
- Info: Routine maintenance notifications

## Security Configuration

### Network Security

- VPC with private subnets
- Security groups with minimal required access
- WAF protection for web applications
- TLS 1.3 encryption for all traffic

### Data Protection

- KMS encryption for data at rest
- TLS for data in transit
- PII redaction for AI processing
- Automated data lifecycle management

### Access Control

- JWT-based API authentication
- RBAC for user permissions
- AWS IAM for infrastructure access
- Multi-factor authentication required

## Backup and Recovery

### Database Backups

- Automated daily backups with 30-day retention
- Cross-region backup replication
- Point-in-time recovery capability

### Disaster Recovery

- Multi-AZ deployment for high availability
- Automated failover procedures
- Backup restoration testing

## Troubleshooting

### Common Issues

#### Service Startup Failures

```bash
# Check service logs
docker compose logs <service-name>

# Check AWS CloudWatch logs
aws logs tail /aws/ecs/compliance-system --follow
```

#### Database Connection Issues

```bash
# Test database connectivity
psql -h <db-host> -U <db-user> -d <db-name>

# Check security groups
aws ec2 describe-security-groups --group-ids <sg-id>
```

#### AI Agent Performance

```bash
# Monitor agent metrics
curl http://localhost:3002/metrics

# Check LangSmith traces
# Access via LangSmith dashboard
```

### Health Checks

```bash
# API Gateway health
curl http://localhost:3000/health

# AI Agents health
curl http://localhost:3002/health

# Dashboard health
curl http://localhost:3001/
```

## Performance Optimization

### Database Tuning

- Connection pooling with PgBouncer
- Query optimization and indexing
- Read replica for reporting queries

### Caching Strategy

- Redis for session and API response caching
- CDN for static asset delivery
- Application-level caching for compliance rules

### Scaling Guidelines

- Horizontal scaling for API services
- Vertical scaling for AI agents
- Database read replicas for high read loads

## Compliance and Audit

### SEBI Compliance

- Automated transaction reporting
- Audit trail maintenance
- Regulatory filing automation

### DPDP Compliance

- Data minimization principles
- Consent management
- Data subject rights implementation

### Security Audits

- Regular penetration testing
- Code security scanning with SonarQube
- Infrastructure security assessments

## Support and Maintenance

### Regular Maintenance Tasks

- Security patch updates
- Database maintenance windows
- AI model retraining and validation
- Backup verification

### Monitoring Alerts

- Set up PagerDuty or similar for critical alerts
- Configure Slack notifications for warnings
- Email alerts for informational events

### Documentation Updates

- Keep runbooks current
- Update incident response procedures
- Maintain configuration documentation

## Cost Optimization

### AWS Cost Management

- Use reserved instances for steady workloads
- Implement auto-scaling to reduce over-provisioning
- Monitor and optimize data transfer costs
- Use CloudFront for global distribution

### Resource Optimization

- Right-size EC2 instances
- Implement spot instances where appropriate
- Use Aurora Serverless for variable workloads
- Optimize storage costs with lifecycle policies

---

## Quick Start Commands

```bash
# Development setup
cp .env.example .env
docker compose up -d
.\powershell-scripts\Run-DatabaseMigrations.ps1

# Production deployment
cd cdk && npm install && cdk deploy
```

For additional support, refer to the project documentation or contact the DevOps team.
