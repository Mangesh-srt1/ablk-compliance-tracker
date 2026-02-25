# Day 3: Setup Fargate Cluster Configuration

## Objectives
- Configure AWS Fargate cluster for container orchestration
- Set up VPC, subnets, and security groups for production deployment
- Implement auto-scaling policies for cost optimization and performance
- Configure CloudWatch monitoring and logging for the cluster
- Set up IAM roles and policies for ECS task execution
- Implement blue-green deployment strategy for zero-downtime updates

## Implementation Details

### Fargate Cluster Architecture
The Ableka Lumina production deployment requires:

- Multi-AZ deployment for high availability
- Auto-scaling based on CPU/memory utilization and custom metrics
- Integration with CloudWatch for comprehensive monitoring
- IAM least-privilege access for security
- Blue-green deployment for seamless updates
- Cost optimization through spot instances and reserved capacity

### Performance Targets
- Service availability: 99.9% uptime
- Auto-scaling response time: <2 minutes
- Cost optimization: 30% reduction through spot instances
- Monitoring coverage: 100% of services and infrastructure

## Code Implementation

### 1. Terraform Configuration for Fargate Cluster
Create `infrastructure/terraform/ecs/main.tf`:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  name_prefix = "ableka-lumina"
  environment = "prod"
  region      = "us-east-1"

  tags = {
    Project     = "Ableka Lumina"
    Environment = local.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps Team"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-${local.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.ecs.arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs.name
      }
    }
  }

  tags = local.tags
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = [aws_ecs_capacity_provider.fargate.arn, aws_ecs_capacity_provider.fargate_spot.arn]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = aws_ecs_capacity_provider.fargate.name
  }
}

# Fargate Capacity Provider
resource "aws_ecs_capacity_provider" "fargate" {
  name = "${local.name_prefix}-fargate"

  fargate_capacity_provider {
    fargate_capacity_provider_configuration {
      default_capacity_provider_strategy {
        weight = 100
        base   = 1
      }
    }
  }

  tags = local.tags
}

# Fargate Spot Capacity Provider
resource "aws_ecs_capacity_provider" "fargate_spot" {
  name = "${local.name_prefix}-fargate-spot"

  fargate_capacity_provider {
    fargate_capacity_provider_configuration {
      default_capacity_provider_strategy {
        weight = 10
        base   = 0
      }
    }
  }

  tags = local.tags
}

# CloudWatch Log Group for ECS
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}-${local.environment}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.ecs.arn

  tags = local.tags
}

# KMS Key for ECS encryption
resource "aws_kms_key" "ecs" {
  description             = "KMS key for ECS cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.tags
}

# KMS Key Alias
resource "aws_kms_alias" "ecs" {
  name          = "alias/${local.name_prefix}-ecs-${local.environment}"
  target_key_id = aws_kms_key.ecs.key_id
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# ECS Task Execution Policy
resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional permissions for ECS execution role
resource "aws_iam_role_policy" "ecs_execution_additional" {
  name = "${local.name_prefix}-ecs-execution-additional-${local.environment}"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
          "ssm:GetParametersByPath",
          "secretsmanager:GetSecretValue",
          "kms:Decrypt",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# ECS Task Role
resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# ECS Task Policy
resource "aws_iam_role_policy" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-${local.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "rds-db:connect",
          "elasticache:*",
          "ses:SendEmail",
          "ses:SendRawEmail",
          "cloudwatch:PutMetricData",
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${local.region}:${data.aws_caller_identity.current.account_id}:parameter/ableka/*"
        ]
      }
    ]
  })
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Outputs
output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_execution.arn
}

output "task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.ecs.name
}
```

### 2. VPC and Networking Configuration
Create `infrastructure/terraform/vpc/main.tf`:

```hcl
# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-vpc-${local.environment}"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-igw-${local.environment}"
  })
}

# Public Subnets
resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index * 32}.0/19"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-public-${data.aws_availability_zones.available.names[count.index]}-${local.environment}"
    Type = "Public"
  })
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${64 + count.index * 32}.0/19"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-private-${data.aws_availability_zones.available.names[count.index]}-${local.environment}"
    Type = "Private"
  })
}

# NAT Gateway
resource "aws_eip" "nat" {
  count = 3
  vpc   = true

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}-${local.environment}"
  })
}

resource "aws_nat_gateway" "main" {
  count         = 3
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-nat-${data.aws_availability_zones.available.names[count.index]}-${local.environment}"
  })

  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-public-rt-${local.environment}"
  })
}

resource "aws_route_table" "private" {
  count  = 3
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-private-rt-${data.aws_availability_zones.available.names[count.index]}-${local.environment}"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 3
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb-${local.environment}"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-alb-${local.environment}"
  })
}

resource "aws_security_group" "ecs" {
  name_prefix = "${local.name_prefix}-ecs-${local.environment}"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-ecs-${local.environment}"
  })
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-${local.environment}"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-rds-${local.environment}"
  })
}

resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-${local.environment}"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-redis-${local.environment}"
  })
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ECS security group ID"
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}
```

### 3. Auto-Scaling Configuration
Create `infrastructure/terraform/ecs/autoscaling.tf`:

```hcl
# Application Auto Scaling for ECS Service
resource "aws_appautoscaling_target" "api" {
  max_capacity       = 20
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_target" "ui" {
  max_capacity       = 10
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.ui.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU-based scaling policy for API
resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name_prefix}-api-cpu-${local.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Memory-based scaling policy for API
resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${local.name_prefix}-api-memory-${local.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Request-based scaling policy for API
resource "aws_appautoscaling_policy" "api_requests" {
  name               = "${local.name_prefix}-api-requests-${local.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "RequestCountPerTarget"
      namespace   = "AWS/ApplicationELB"
      statistic   = "Average"
      dimensions {
        name  = "TargetGroup"
        value = aws_lb_target_group.api.arn_suffix
      }
      dimensions {
        name  = "LoadBalancer"
        value = aws_lb.main.arn_suffix
      }
    }
    target_value = 1000.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# CPU-based scaling policy for UI
resource "aws_appautoscaling_policy" "ui_cpu" {
  name               = "${local.name_prefix}-ui-cpu-${local.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ui.resource_id
  scalable_dimension = aws_appautoscaling_target.ui.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ui.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 60.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 120
  }
}

# Scheduled scaling for cost optimization
resource "aws_appautoscaling_scheduled_action" "api_scale_down" {
  name               = "${local.name_prefix}-api-scale-down-${local.environment}"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  schedule           = "cron(0 2 * * ? *)" # 2 AM daily

  scalable_target_action {
    min_capacity = 1
    max_capacity = 5
  }
}

resource "aws_appautoscaling_scheduled_action" "api_scale_up" {
  name               = "${local.name_prefix}-api-scale-up-${local.environment}"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  schedule           = "cron(0 6 * * ? *)" # 6 AM daily

  scalable_target_action {
    min_capacity = 2
    max_capacity = 20
  }
}
```

### 4. CloudWatch Monitoring and Alarms
Create `infrastructure/terraform/monitoring/main.tf`:

```hcl
# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-${local.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # ECS Service Health
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.api.name, "ClusterName", aws_ecs_cluster.main.name, { "label": "API CPU" }],
            [".", "MemoryUtilization", ".", ".", ".", ".", { "label": "API Memory" }],
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.ui.name, "ClusterName", aws_ecs_cluster.main.name, { "label": "UI CPU" }],
            [".", "MemoryUtilization", ".", ".", ".", ".", { "label": "UI Memory" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = local.region
          title   = "ECS Service Utilization"
          period  = 300
        }
      },

      # ALB Metrics
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix, { "label": "Total Requests" }],
            [".", "TargetResponseTime", ".", ".", { "label": "Response Time", "stat": "Average" }],
            [".", "HTTPCode_Target_2XX_Count", ".", ".", { "label": "2XX Responses" }],
            [".", "HTTPCode_Target_4XX_Count", ".", ".", { "label": "4XX Responses" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { "label": "5XX Responses" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = local.region
          title   = "Application Load Balancer"
          period  = 300
        }
      },

      # Database Metrics
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.main.identifier, { "label": "DB Connections" }],
            [".", "CPUUtilization", ".", ".", { "label": "DB CPU" }],
            [".", "FreeStorageSpace", ".", ".", { "label": "Free Storage", "stat": "Minimum" }],
            [".", "ReadLatency", ".", ".", { "label": "Read Latency" }],
            [".", "WriteLatency", ".", ".", { "label": "Write Latency" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = local.region
          title   = "Database Performance"
          period  = 300
        }
      },

      # Redis Metrics
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CurrConnections", "CacheClusterId", aws_elasticache_cluster.main.cluster_id, { "label": "Redis Connections" }],
            [".", "CacheHits", ".", ".", { "label": "Cache Hits" }],
            [".", "CacheMisses", ".", ".", { "label": "Cache Misses" }],
            [".", "CPUUtilization", ".", ".", { "label": "Redis CPU" }],
            [".", "FreeableMemory", ".", ".", { "label": "Free Memory" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = local.region
          title   = "Redis Performance"
          period  = 300
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "${local.name_prefix}-api-cpu-high-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "API service CPU utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName  = aws_ecs_service.api.name
    ClusterName  = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_memory_high" {
  alarm_name          = "${local.name_prefix}-api-memory-high-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "API service memory utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName  = aws_ecs_service.api.name
    ClusterName  = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${local.name_prefix}-api-5xx-errors-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "API service has high 5XX error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "db_connections_high" {
  alarm_name          = "${local.name_prefix}-db-connections-high-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Database has high connection count"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts-${local.environment}"

  tags = local.tags
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}
```

### 5. Blue-Green Deployment Configuration
Create `infrastructure/terraform/ecs/blue-green.tf`:

```hcl
# CodeDeploy Application
resource "aws_codedeploy_app" "main" {
  compute_platform = "ECS"
  name             = "${local.name_prefix}-${local.environment}"

  tags = local.tags
}

# CodeDeploy Deployment Group for API
resource "aws_codedeploy_deployment_group" "api" {
  app_name               = aws_codedeploy_app.main.name
  deployment_group_name  = "${local.name_prefix}-api-${local.environment}"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = "CodeDeployDefault.ECSLinear10PercentEvery1Minutes"

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }

  blue_green_deployment_config {
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.api.name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.api_https.arn]
      }

      target_group {
        name = aws_lb_target_group.api_blue.name
      }

      target_group {
        name = aws_lb_target_group.api_green.name
      }
    }
  }

  tags = local.tags
}

# CodeDeploy Deployment Group for UI
resource "aws_codedeploy_deployment_group" "ui" {
  app_name               = aws_codedeploy_app.main.name
  deployment_group_name  = "${local.name_prefix}-ui-${local.environment}"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = "CodeDeployDefault.ECSLinear10PercentEvery1Minutes"

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }

  blue_green_deployment_config {
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.ui.name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [aws_lb_listener.ui_https.arn]
      }

      target_group {
        name = aws_lb_target_group.ui_blue.name
      }

      target_group {
        name = aws_lb_target_group.ui_green.name
      }
    }
  }

  tags = local.tags
}

# CodeDeploy IAM Role
resource "aws_iam_role" "codedeploy" {
  name = "${local.name_prefix}-codedeploy-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# CodeDeploy IAM Policy
resource "aws_iam_role_policy_attachment" "codedeploy" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}

# Additional CodeDeploy permissions
resource "aws_iam_role_policy" "codedeploy_additional" {
  name = "${local.name_prefix}-codedeploy-additional-${local.environment}"
  role = aws_iam_role.codedeploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:UpdateService",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "iam:PassRole",
          "lambda:InvokeFunction"
        ]
        Resource = "*"
      }
    ]
  })
}
```

### 6. Deployment Scripts
Create `scripts/deploy-fargate.sh`:

```bash
#!/bin/bash
set -e

# Ableka Lumina Fargate Deployment Script
echo "🚀 Starting Ableka Lumina Fargate deployment..."

# Configuration
ENVIRONMENT=${ENVIRONMENT:-prod}
REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        error "Terraform is not installed"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials are not configured"
        exit 1
    fi

    log "Prerequisites validation completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."

    cd infrastructure/terraform

    # Initialize Terraform
    terraform init

    # Validate configuration
    terraform validate

    # Plan deployment
    terraform plan -out=tfplan

    # Apply changes
    terraform apply tfplan

    cd ../..
    log "Infrastructure deployment completed"
}

# Build and push Docker images
build_and_push_images() {
    log "Building and pushing Docker images..."

    # Login to ECR
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

    # Build and push API image
    log "Building API image..."
    docker build -f packages/api/Dockerfile.advanced -t ableka-lumina-api:$ENVIRONMENT .
    docker tag ableka-lumina-api:$ENVIRONMENT $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/ableka-lumina-api:$ENVIRONMENT
    docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/ableka-lumina-api:$ENVIRONMENT

    # Build and push UI image
    log "Building UI image..."
    docker build -f packages/ui/Dockerfile.ui.advanced -t ableka-lumina-ui:$ENVIRONMENT .
    docker tag ableka-lumina-ui:$ENVIRONMENT $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/ableka-lumina-ui:$ENVIRONMENT
    docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/ableka-lumina-ui:$ENVIRONMENT

    log "Docker images built and pushed"
}

# Deploy ECS services
deploy_services() {
    log "Deploying ECS services..."

    # Update API service
    aws ecs update-service \
        --cluster ableka-lumina-prod \
        --service ableka-lumina-api-prod \
        --force-new-deployment \
        --region $REGION

    # Update UI service
    aws ecs update-service \
        --cluster ableka-lumina-prod \
        --service ableka-lumina-ui-prod \
        --force-new-deployment \
        --region $REGION

    log "ECS services deployment initiated"
}

# Wait for deployment completion
wait_for_deployment() {
    log "Waiting for deployment completion..."

    # Wait for API service
    aws ecs wait services-stable \
        --cluster ableka-lumina-prod \
        --services ableka-lumina-api-prod \
        --region $REGION

    # Wait for UI service
    aws ecs wait services-stable \
        --cluster ableka-lumina-prod \
        --services ableka-lumina-ui-prod \
        --region $REGION

    log "Deployment completed successfully"
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
    if curl -f -s https://$ALB_DNS/api/health > /dev/null; then
        log "API health check passed"
    else
        error "API health check failed"
        exit 1
    fi

    # Health check UI
    if curl -f -s https://$ALB_DNS/health > /dev/null; then
        log "UI health check passed"
    else
        error "UI health check failed"
        exit 1
    fi

    log "All health checks passed"
}

# Main deployment flow
main() {
    log "Starting Ableka Lumina deployment to Fargate"

    validate_prerequisites
    deploy_infrastructure
    build_and_push_images
    deploy_services
    wait_for_deployment
    run_health_checks

    log "🎉 Deployment completed successfully!"
    log "Application is available at: https://$ALB_DNS"
}

# Handle command line arguments
case "${1:-}" in
    "validate")
        validate_prerequisites
        ;;
    "infra")
        deploy_infrastructure
        ;;
    "build")
        build_and_push_images
        ;;
    "deploy")
        deploy_services
        ;;
    "health")
        run_health_checks
        ;;
    *)
        main
        ;;
esac
```

## Testing and Validation

### Infrastructure Testing
```bash
# Validate Terraform configuration
cd infrastructure/terraform
terraform validate
terraform plan

# Test deployment script
./scripts/deploy-fargate.sh validate

# Deploy infrastructure only
./scripts/deploy-fargate.sh infra
```

### Cluster Testing
```bash
# Check cluster status
aws ecs describe-clusters --clusters ableka-lumina-prod

# List running tasks
aws ecs list-tasks --cluster ableka-lumina-prod

# Check service health
aws ecs describe-services --cluster ableka-lumina-prod --services ableka-lumina-api-prod ableka-lumina-ui-prod
```

### Auto-scaling Testing
```bash
# Simulate load for testing auto-scaling
# Install hey for load testing
go install github.com/rakyll/hey@latest

# Generate load on API
hey -n 10000 -c 100 https://your-alb-dns/api/scans

# Monitor scaling
aws ecs describe-services --cluster ableka-lumina-prod --services ableka-lumina-api-prod
```

### Blue-Green Deployment Testing
```bash
# Test blue-green deployment
aws deploy create-deployment \
    --application-name ableka-lumina-prod \
    --deployment-group-name ableka-lumina-api-prod \
    --revision '{"revisionType": "AppSpecContent", "appSpecContent": {"content": "{\"version\": 1, \"Resources\": [{\"TargetService\": {\"Type\": \"AWS::ECS::Service\", \"Properties\": {\"TaskDefinition\": \"arn:aws:ecs:us-east-1:123456789012:task-definition/ableka-lumina-api:2\", \"LoadBalancerInfo\": {\"ContainerName\": \"api\", \"ContainerPort\": 3000}}}}]}"}}' \
    --region us-east-1
```

## Next Steps
- Day 4 will focus on ECS service deployment and configuration
- Day 5 will handle Aurora PG multi-tenant database setup
- Week 22 will implement infrastructure scaling and caching layers

This Fargate cluster configuration provides a robust, scalable, and secure foundation for the Ableka Lumina production deployment with comprehensive monitoring, auto-scaling, and blue-green deployment capabilities.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 5 Deployment & Launch\Week 21\Day 3.md