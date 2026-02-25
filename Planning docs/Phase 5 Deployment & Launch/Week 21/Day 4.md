# Day 4: Deploy to ECS and Service Configuration

## Objectives
- Deploy Ableka Lumina services to ECS with proper task definitions
- Configure Application Load Balancer for traffic distribution
- Set up service discovery and inter-service communication
- Implement health checks and circuit breakers
- Configure service mesh with AWS App Mesh (optional)
- Set up CloudWatch logging and X-Ray tracing

## Implementation Details

### ECS Service Architecture
The deployment requires:

- Task definitions with proper resource allocation
- Service configurations with rolling updates
- Load balancer integration with target groups
- Health check configurations for reliability
- Service discovery for inter-service communication
- Distributed tracing for observability

### Performance Targets
- Service deployment time: <5 minutes
- Zero-downtime deployments: 100% success rate
- Health check response time: <5 seconds
- Inter-service communication latency: <50ms
- Tracing coverage: 100% of requests

## Code Implementation

### 1. ECS Task Definitions
Create `infrastructure/terraform/ecs/task-definitions.tf`:

```hcl
# API Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api-${local.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${aws_caller_identity.current.account_id}.dkr.ecr.${local.region}.amazonaws.com/ableka-lumina-api:${var.image_tag}"

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "DATABASE_URL"
          value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
        },
        {
          name  = "REDIS_URL"
          value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:${aws_elasticache_cluster.main.cache_nodes[0].port}"
        },
        {
          name  = "AWS_REGION"
          value = local.region
        },
        {
          name  = "S3_BUCKET"
          value = aws_s3_bucket.main.bucket
        }
      ]

      secrets = [
        {
          name      = "JWT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.jwt_secret.arn}:JWT_SECRET::"
        },
        {
          name      = "API_KEY_SECRET"
          valueFrom = "${aws_secretsmanager_secret.api_key_secret.arn}:API_KEY_SECRET::"
        },
        {
          name      = "GROK_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.grok_api_key.arn}:GROK_API_KEY::"
        },
        {
          name      = "OPENAI_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.openai_api_key.arn}:OPENAI_API_KEY::"
        },
        {
          name      = "STRIPE_SECRET_KEY"
          valueFrom = "${aws_secretsmanager_secret.stripe_secret_key.arn}:STRIPE_SECRET_KEY::"
        },
        {
          name      = "SENDGRID_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.sendgrid_api_key.arn}:SENDGRID_API_KEY::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3000/health || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      # Resource limits
      memoryReservation = 1024
      cpu               = 512

      # Enable CloudWatch metrics
      enableCloudwatchLogging = true

      # X-Ray tracing
      environment = concat(local.container_environment, [
        {
          name  = "AWS_XRAY_DAEMON_ADDRESS"
          value = "xray-daemon:2000"
        }
      ])
    },
    # X-Ray daemon sidecar
    {
      name  = "xray-daemon"
      image = "amazon/aws-xray-daemon:latest"

      portMappings = [
        {
          containerPort = 2000
          hostPort      = 2000
          protocol      = "udp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.xray.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "xray"
        }
      }

      memoryReservation = 256
      cpu               = 128
    }
  ])

  tags = local.tags
}

# UI Task Definition
resource "aws_ecs_task_definition" "ui" {
  family                   = "${local.name_prefix}-ui-${local.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "ui"
      image = "${aws_caller_identity.current.account_id}.dkr.ecr.${local.region}.amazonaws.com/ableka-lumina-ui:${var.image_tag}"

      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "NEXT_PUBLIC_API_URL"
          value = "https://${aws_route53_record.api.fqdn}"
        },
        {
          name  = "NEXT_PUBLIC_WS_URL"
          value = "wss://${aws_route53_record.api.fqdn}"
        },
        {
          name  = "NEXT_PUBLIC_CDN_URL"
          value = "https://${aws_cloudfront_distribution.main.domain_name}"
        }
      ]

      secrets = [
        {
          name      = "NEXT_PUBLIC_GA_ID"
          valueFrom = "${aws_secretsmanager_secret.ga_id.arn}:GA_ID::"
        },
        {
          name      = "NEXT_PUBLIC_SENTRY_DSN"
          valueFrom = "${aws_secretsmanager_secret.sentry_dsn.arn}:SENTRY_DSN::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "ui"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3000/health || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      # Resource limits
      memoryReservation = 512
      cpu               = 256

      # Enable CloudWatch metrics
      enableCloudwatchLogging = true
    }
  ])

  tags = local.tags
}

# Agent Task Definition (for background processing)
resource "aws_ecs_task_definition" "agent" {
  family                   = "${local.name_prefix}-agent-${local.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "2048"
  memory                   = "4096"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "agent"
      image = "${aws_caller_identity.current.account_id}.dkr.ecr.${local.region}.amazonaws.com/ableka-lumina-agent:${var.image_tag}"

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "DATABASE_URL"
          value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}"
        },
        {
          name  = "REDIS_URL"
          value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:${aws_elasticache_cluster.main.cache_nodes[0].port}"
        },
        {
          name  = "AWS_REGION"
          value = local.region
        }
      ]

      secrets = [
        {
          name      = "GROK_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.grok_api_key.arn}:GROK_API_KEY::"
        },
        {
          name      = "OPENAI_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.openai_api_key.arn}:OPENAI_API_KEY::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "agent"
        }
      }

      # Resource limits
      memoryReservation = 2048
      cpu               = 1024

      # Enable CloudWatch metrics
      enableCloudwatchLogging = true
    }
  ])

  tags = local.tags
}

# CloudWatch Log Group for X-Ray
resource "aws_cloudwatch_log_group" "xray" {
  name              = "/ecs/xray/${local.name_prefix}-${local.environment}"
  retention_in_days = 30

  tags = local.tags
}

# Variables
variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# Local variables
locals {
  container_environment = [
    {
      name  = "NODE_ENV"
      value = "production"
    }
  ]
}
```

### 2. ECS Services Configuration
Create `infrastructure/terraform/ecs/services.tf`:

```hcl
# API ECS Service
resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api-${local.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2

  network_configuration {
    security_groups  = [aws_security_group.ecs.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  service_registries {
    registry_arn = aws_service_discovery_service.api.arn
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  health_check_grace_period_seconds = 60

  # Enable execute command for debugging
  enable_execute_command = true

  tags = local.tags

  depends_on = [aws_lb_listener.api_https]
}

# UI ECS Service
resource "aws_ecs_service" "ui" {
  name            = "${local.name_prefix}-ui-${local.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ui.arn
  desired_count   = 1

  network_configuration {
    security_groups  = [aws_security_group.ecs.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ui.arn
    container_name   = "ui"
    container_port   = 3000
  }

  service_registries {
    registry_arn = aws_service_discovery_service.ui.arn
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  health_check_grace_period_seconds = 30

  # Enable execute command for debugging
  enable_execute_command = true

  tags = local.tags

  depends_on = [aws_lb_listener.ui_https]
}

# Agent ECS Service (for background processing)
resource "aws_ecs_service" "agent" {
  name            = "${local.name_prefix}-agent-${local.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.agent.arn
  desired_count   = 1

  network_configuration {
    security_groups  = [aws_security_group.ecs.id]
    subnets          = aws_subnet.private[*].id
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.agent.arn
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Enable execute command for debugging
  enable_execute_command = true

  tags = local.tags
}
```

### 3. Application Load Balancer Configuration
Create `infrastructure/terraform/alb/main.tf`:

```hcl
# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb-${local.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true

  # Access logs
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "alb-logs"
    enabled = true
  }

  tags = local.tags
}

# API Target Groups
resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api-${local.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  tags = local.tags
}

# API Blue Target Group (for blue-green deployment)
resource "aws_lb_target_group" "api_blue" {
  name        = "${local.name_prefix}-api-blue-${local.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = local.tags
}

# API Green Target Group (for blue-green deployment)
resource "aws_lb_target_group" "api_green" {
  name        = "${local.name_prefix}-api-green-${local.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = local.tags
}

# UI Target Groups
resource "aws_lb_target_group" "ui" {
  name        = "${local.name_prefix}-ui-${local.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = local.tags
}

# UI Blue Target Group
resource "aws_lb_target_group" "ui_blue" {
  name        = "${local.name_prefix}-ui-blue-${local.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = local.tags
}

# UI Green Target Group
resource "aws_lb_target_group" "ui_green" {
  name        = "${local.name_prefix}-ui-green-${local.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = local.tags
}

# HTTPS Listener for API
resource "aws_lb_listener" "api_https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  # Rules for API routing
  dynamic "rule" {
    for_each = ["/api/*"]
    content {
      priority = 100 + index(["/api/*"], rule.value)

      action {
        type             = "forward"
        target_group_arn = aws_lb_target_group.api.arn
      }

      condition {
        path_pattern {
          values = [rule.value]
        }
      }
    }
  }

  tags = local.tags
}

# HTTPS Listener for UI
resource "aws_lb_listener" "ui_https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.ui.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ui.arn
  }

  tags = local.tags
}

# HTTP to HTTPS redirect
resource "aws_lb_listener" "redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# S3 bucket for ALB access logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${local.name_prefix}-alb-logs-${local.environment}"

  tags = local.tags
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_elb_service_account.main.id}:root"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb-logs/*"
      }
    ]
  })
}

# Data source for ELB service account
data "aws_elb_service_account" "main" {}
```

### 4. Service Discovery Configuration
Create `infrastructure/terraform/service-discovery/main.tf`:

```hcl
# Service Discovery Namespace
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${local.name_prefix}.local"
  description = "Service discovery namespace for Ableka Lumina"
  vpc         = aws_vpc.main.id

  tags = local.tags
}

# API Service Discovery
resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = local.tags
}

# UI Service Discovery
resource "aws_service_discovery_service" "ui" {
  name = "ui"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = local.tags
}

# Agent Service Discovery
resource "aws_service_discovery_service" "agent" {
  name = "agent"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = local.tags
}
```

### 5. X-Ray Tracing Configuration
Create `infrastructure/terraform/xray/main.tf`:

```hcl
# X-Ray Sampling Rule
resource "aws_xray_sampling_rule" "api" {
  rule_name      = "${local.name_prefix}-api-${local.environment}"
  priority       = 10
  reservoir_size = 100
  fixed_rate     = 0.1
  url_path       = "/api/*"
  service_name   = "ableka-lumina-api"
  service_type   = "AWS::ECS::Service"
  host           = "*"
  http_method    = "*"

  tags = local.tags
}

resource "aws_xray_sampling_rule" "ui" {
  rule_name      = "${local.name_prefix}-ui-${local.environment}"
  priority       = 20
  reservoir_size = 50
  fixed_rate     = 0.05
  url_path       = "/*"
  service_name   = "ableka-lumina-ui"
  service_type   = "AWS::ECS::Service"
  host           = "*"
  http_method    = "*"

  tags = local.tags
}

# X-Ray Group for API
resource "aws_xray_group" "api" {
  group_name        = "${local.name_prefix}-api-${local.environment}"
  filter_expression = "service(\"ableka-lumina-api\")"

  tags = local.tags
}

# X-Ray Group for UI
resource "aws_xray_group" "ui" {
  group_name        = "${local.name_prefix}-ui-${local.environment}"
  filter_expression = "service(\"ableka-lumina-ui\")"

  tags = local.tags
}

# X-Ray Encryption Configuration
resource "aws_xray_encryption_config" "main" {
  type = "KMS"
  key_id = aws_kms_key.xray.arn
}

# KMS Key for X-Ray
resource "aws_kms_key" "xray" {
  description             = "KMS key for X-Ray encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.tags
}

resource "aws_kms_alias" "xray" {
  name          = "alias/${local.name_prefix}-xray-${local.environment}"
  target_key_id = aws_kms_key.xray.key_id
}
```

### 6. Deployment and Monitoring Scripts
Create `scripts/ecs-deploy.sh`:

```bash
#!/bin/bash
set -e

# Ableka Lumina ECS Deployment Script
echo "🚀 Deploying Ableka Lumina to ECS..."

# Configuration
CLUSTER_NAME="ableka-lumina-prod"
REGION=${AWS_REGION:-us-east-1}
IMAGE_TAG=${IMAGE_TAG:-latest}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

# Update task definition
update_task_definition() {
    local service_name=$1
    local task_family="${local.name_prefix}-${service_name}-prod"

    log "Updating task definition for $service_name..."

    # Register new task definition
    aws ecs register-task-definition \
        --family $task_family \
        --cli-input-json file://infrastructure/terraform/ecs/task-definitions.json \
        --region $REGION

    # Get latest task definition ARN
    TASK_DEF_ARN=$(aws ecs describe-task-definition \
        --task-definition $task_family \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text \
        --region $REGION)

    log "Task definition updated: $TASK_DEF_ARN"
}

# Deploy service
deploy_service() {
    local service_name=$1
    local task_family="${local.name_prefix}-${service_name}-prod"

    log "Deploying $service_name service..."

    # Update service with new task definition
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service "${local.name_prefix}-${service_name}-prod" \
        --task-definition $task_family \
        --force-new-deployment \
        --region $REGION

    # Wait for deployment to complete
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services "${local.name_prefix}-${service_name}-prod" \
        --region $REGION

    log "$service_name service deployed successfully"
}

# Run health checks
run_health_checks() {
    log "Running health checks..."

    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --names ableka-lumina-alb-prod \
        --query 'LoadBalancers[0].DNSName' \
        --output text \
        --region $REGION)

    # Health check API
    if curl -f -s -k https://$ALB_DNS/api/health; then
        log "✅ API health check passed"
    else
        error "❌ API health check failed"
        exit 1
    fi

    # Health check UI
    if curl -f -s -k https://$ALB_DNS/health; then
        log "✅ UI health check passed"
    else
        error "❌ UI health check failed"
        exit 1
    fi
}

# Monitor deployment
monitor_deployment() {
    log "Monitoring deployment..."

    # Check service status
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services ableka-lumina-api-prod ableka-lumina-ui-prod \
        --query 'services[].[serviceName,runningCount,desiredCount,pendingCount]' \
        --output table \
        --region $REGION

    # Check target group health
    aws elbv2 describe-target-health \
        --target-group-arn $(aws elbv2 describe-target-groups \
            --names ableka-lumina-api-prod \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text \
            --region $REGION) \
        --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State]' \
        --output table \
        --region $REGION
}

# Main deployment
main() {
    log "Starting ECS deployment..."

    # Update task definitions
    update_task_definition "api"
    update_task_definition "ui"
    update_task_definition "agent"

    # Deploy services
    deploy_service "api"
    deploy_service "ui"
    deploy_service "agent"

    # Run health checks
    run_health_checks

    # Monitor deployment
    monitor_deployment

    log "🎉 ECS deployment completed successfully!"
}

# Execute based on arguments
case "${1:-}" in
    "api")
        update_task_definition "api"
        deploy_service "api"
        ;;
    "ui")
        update_task_definition "ui"
        deploy_service "ui"
        ;;
    "agent")
        update_task_definition "agent"
        deploy_service "agent"
        ;;
    "health")
        run_health_checks
        ;;
    "monitor")
        monitor_deployment
        ;;
    *)
        main
        ;;
esac
```

## Testing and Validation

### Service Deployment Testing
```bash
# Test task definition registration
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Test service update
aws ecs update-service --cluster ableka-lumina-prod --service ableka-lumina-api-prod --force-new-deployment

# Monitor deployment progress
aws ecs describe-services --cluster ableka-lumina-prod --services ableka-lumina-api-prod
```

### Load Balancer Testing
```bash
# Test ALB configuration
curl -I https://your-domain.com/api/health

# Test target group health
aws elbv2 describe-target-health --target-group-arn your-target-group-arn

# Test SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### Service Discovery Testing
```bash
# Test service discovery
dig api.ableka.local

# Test inter-service communication
curl http://api.ableka.local:3000/health
```

### Tracing Testing
```bash
# Check X-Ray traces
aws xray get-trace-summaries --start-time $(date -u +%Y-%m-%dT%H:%M:%S) --end-time $(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%S)

# View X-Ray service map
# Access via AWS Console: https://console.aws.amazon.com/xray/home
```

### Performance Testing
```bash
# Load test with hey
hey -n 1000 -c 10 https://your-domain.com/api/scans

# Monitor performance metrics
aws cloudwatch get-metric-statistics \
    --namespace AWS/ApplicationELB \
    --metric-name TargetResponseTime \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average \
    --dimensions Name=LoadBalancer,Value=your-alb-arn
```

## Next Steps
- Day 5 will focus on Aurora PG multi-tenant database setup
- Week 22 will implement caching layers and API Gateway
- Week 23 will handle geo-redundancy and scaling configurations

This ECS deployment configuration provides a robust, observable, and scalable container orchestration platform with comprehensive monitoring, tracing, and service discovery capabilities for the Ableka Lumina RegTech platform.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 5 Deployment & Launch\Week 21\Day 4.md