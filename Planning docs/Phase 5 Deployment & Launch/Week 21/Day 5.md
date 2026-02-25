# Day 5: Configure Aurora PG Multi-Tenant Database

## Objectives
- Set up Amazon Aurora PostgreSQL for multi-tenant architecture
- Implement database schema with tenant isolation
- Configure connection pooling and performance optimization
- Set up automated backups and disaster recovery
- Implement database monitoring and alerting
- Configure cross-region replication for high availability

## Implementation Details

### Multi-Tenant Database Architecture
The Ableka Lumina platform requires:

- Row-level security (RLS) for tenant data isolation
- Shared database with separate schemas per tenant
- Connection pooling with PgBouncer
- Automated backup and restore procedures
- Performance monitoring and query optimization
- Cross-region replication for disaster recovery

### Performance Targets
- Database connection time: <50ms
- Query response time: <100ms for 95th percentile
- Backup completion time: <4 hours
- RTO (Recovery Time Objective): <1 hour
- RPO (Recovery Point Objective): <5 minutes

## Code Implementation

### 1. Aurora PostgreSQL Configuration
Create `infrastructure/terraform/rds/main.tf`:

```hcl
# Aurora PostgreSQL Cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier              = "${local.name_prefix}-aurora-${local.environment}"
  engine                          = "aurora-postgresql"
  engine_version                  = "15.4"
  database_name                   = "ableka_prod"
  master_username                 = var.db_username
  master_password                 = var.db_password
  backup_retention_period         = 30
  preferred_backup_window         = "03:00-04:00"
  preferred_maintenance_window    = "sun:04:00-sun:05:00"
  db_subnet_group_name            = aws_db_subnet_group.main.name
  vpc_security_group_ids          = [aws_security_group.rds.id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name
  final_snapshot_identifier       = "${local.name_prefix}-aurora-${local.environment}-final"

  # Multi-AZ deployment
  availability_zones = data.aws_availability_zones.available.names

  # Encryption
  storage_encrypted   = true
  kms_key_id         = aws_kms_key.rds.arn

  # Performance and scaling
  serverlessv2_scaling_configuration {
    min_capacity = 2
    max_capacity = 64
  }

  # Backups
  copy_tags_to_snapshot     = true
  deletion_protection       = true
  skip_final_snapshot       = false

  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = local.tags
}

# Aurora Cluster Instances
resource "aws_rds_cluster_instance" "main" {
  count                = 2
  identifier           = "${local.name_prefix}-aurora-${local.environment}-${count.index + 1}"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = "db.serverlessv2"
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  db_subnet_group_name = aws_db_subnet_group.main.name

  # Performance insights
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  tags = local.tags
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-aurora-${local.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = local.tags
}

# DB Cluster Parameter Group
resource "aws_rds_cluster_parameter_group" "main" {
  family = "aurora-postgresql15"
  name   = "${local.name_prefix}-aurora-${local.environment}"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pg_hint_plan"
  }

  parameter {
    name  = "pg_stat_statements.max"
    value = "10000"
  }

  parameter {
    name  = "pg_stat_statements.track"
    value = "all"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "max_connections"
    value = "2000"
  }

  tags = local.tags
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.tags
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name_prefix}-rds-${local.environment}"
  target_key_id = aws_kms_key.rds.key_id
}

# IAM Role for RDS monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${local.name_prefix}-rds-monitoring-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
```

### 2. Multi-Tenant Schema Design
Create `packages/api/src/database/migrations/001_initial_schema.sql`:

```sql
-- Ableka Lumina Multi-Tenant Database Schema
-- Version: 1.0.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_hint_plan";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create tenant management schema
CREATE SCHEMA IF NOT EXISTS tenant_management;

-- Tenants table
CREATE TABLE tenant_management.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    schema_name VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    subscription_tier VARCHAR(50) DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{}'
);

-- Create indexes for tenant management
CREATE INDEX idx_tenants_domain ON tenant_management.tenants(domain);
CREATE INDEX idx_tenants_status ON tenant_management.tenants(status);
CREATE INDEX idx_tenants_subscription_tier ON tenant_management.tenants(subscription_tier);

-- Function to create tenant schema
CREATE OR REPLACE FUNCTION tenant_management.create_tenant_schema(
    p_tenant_id UUID,
    p_schema_name VARCHAR(100)
) RETURNS VOID AS $$
DECLARE
    schema_sql TEXT;
BEGIN
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema_name);

    -- Create tenant-specific tables
    schema_sql := format('
        -- Users table
        CREATE TABLE %I.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            role VARCHAR(50) DEFAULT ''user'' CHECK (role IN (''admin'', ''user'', ''viewer'')),
            status VARCHAR(50) DEFAULT ''active'' CHECK (status IN (''active'', ''inactive'', ''suspended'')),
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            tenant_id UUID DEFAULT ''%s''
        );

        -- Organizations table
        CREATE TABLE %I.organizations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            industry VARCHAR(100),
            country VARCHAR(100),
            regulatory_requirements JSONB DEFAULT ''[]'',
            status VARCHAR(50) DEFAULT ''active'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            tenant_id UUID DEFAULT ''%s''
        );

        -- Compliance scans table
        CREATE TABLE %I.compliance_scans (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            organization_id UUID NOT NULL REFERENCES %I.organizations(id) ON DELETE CASCADE,
            scan_type VARCHAR(100) NOT NULL,
            status VARCHAR(50) DEFAULT ''pending'' CHECK (status IN (''pending'', ''running'', ''completed'', ''failed'')),
            priority VARCHAR(20) DEFAULT ''normal'' CHECK (priority IN (''low'', ''normal'', ''high'', ''critical'')),
            configuration JSONB DEFAULT ''{}'',
            results JSONB DEFAULT ''{}'',
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            tenant_id UUID DEFAULT ''%s''
        );

        -- Regulatory documents table
        CREATE TABLE %I.regulatory_documents (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            title VARCHAR(500) NOT NULL,
            content TEXT,
            document_type VARCHAR(100),
            jurisdiction VARCHAR(100),
            effective_date DATE,
            expiry_date DATE,
            status VARCHAR(50) DEFAULT ''active'',
            tags TEXT[],
            embedding VECTOR(1536),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            tenant_id UUID DEFAULT ''%s''
        );

        -- Agent executions table
        CREATE TABLE %I.agent_executions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            scan_id UUID REFERENCES %I.compliance_scans(id) ON DELETE CASCADE,
            agent_type VARCHAR(100) NOT NULL,
            status VARCHAR(50) DEFAULT ''pending'',
            input_data JSONB DEFAULT ''{}'',
            output_data JSONB DEFAULT ''{}'',
            execution_time INTERVAL,
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            tenant_id UUID DEFAULT ''%s''
        );

        -- Create indexes
        CREATE INDEX idx_%s_users_email ON %I.users(email);
        CREATE INDEX idx_%s_users_status ON %I.users(status);
        CREATE INDEX idx_%s_organizations_name ON %I.organizations(name);
        CREATE INDEX idx_%s_compliance_scans_status ON %I.compliance_scans(status);
        CREATE INDEX idx_%s_compliance_scans_organization_id ON %I.compliance_scans(organization_id);
        CREATE INDEX idx_%s_regulatory_documents_type ON %I.regulatory_documents(document_type);
        CREATE INDEX idx_%s_regulatory_documents_jurisdiction ON %I.regulatory_documents(jurisdiction);
        CREATE INDEX idx_%s_regulatory_documents_embedding ON %I.regulatory_documents USING ivfflat (embedding vector_cosine_ops);
        CREATE INDEX idx_%s_agent_executions_scan_id ON %I.agent_executions(scan_id);
        CREATE INDEX idx_%s_agent_executions_status ON %I.agent_executions(status);

        -- Enable Row Level Security
        ALTER TABLE %I.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE %I.organizations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE %I.compliance_scans ENABLE ROW LEVEL SECURITY;
        ALTER TABLE %I.regulatory_documents ENABLE ROW LEVEL SECURITY;
        ALTER TABLE %I.agent_executions ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY tenant_isolation_users ON %I.users FOR ALL USING (tenant_id = ''%s'');
        CREATE POLICY tenant_isolation_organizations ON %I.organizations FOR ALL USING (tenant_id = ''%s'');
        CREATE POLICY tenant_isolation_scans ON %I.compliance_scans FOR ALL USING (tenant_id = ''%s'');
        CREATE POLICY tenant_isolation_documents ON %I.regulatory_documents FOR ALL USING (tenant_id = ''%s'');
        CREATE POLICY tenant_isolation_executions ON %I.agent_executions FOR ALL USING (tenant_id = ''%s'');
    ',
    p_schema_name, p_tenant_id,
    p_schema_name, p_tenant_id,
    p_schema_name, p_schema_name, p_tenant_id,
    p_schema_name, p_tenant_id,
    p_schema_name, p_tenant_id,
    p_schema_name, p_schema_name, p_tenant_id,
    p_schema_name, p_schema_name, p_schema_name, p_schema_name,
    p_schema_name, p_schema_name, p_schema_name, p_schema_name,
    p_schema_name, p_schema_name, p_schema_name, p_schema_name,
    p_schema_name, p_schema_name, p_schema_name, p_schema_name,
    p_schema_name, p_schema_name, p_schema_name, p_schema_name,
    p_schema_name, p_schema_name, p_schema_name, p_schema_name,
    p_tenant_id, p_tenant_id, p_tenant_id, p_tenant_id, p_tenant_id
    );

    EXECUTE schema_sql;

    -- Update tenant record
    UPDATE tenant_management.tenants
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to drop tenant schema
CREATE OR REPLACE FUNCTION tenant_management.drop_tenant_schema(
    p_schema_name VARCHAR(100)
) RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', p_schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tenant schema
CREATE OR REPLACE FUNCTION tenant_management.get_tenant_schema(
    p_domain VARCHAR(255)
) RETURNS VARCHAR(100) AS $$
DECLARE
    v_schema_name VARCHAR(100);
BEGIN
    SELECT schema_name INTO v_schema_name
    FROM tenant_management.tenants
    WHERE domain = p_domain AND status = 'active';

    RETURN v_schema_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default tenant
INSERT INTO tenant_management.tenants (name, domain, schema_name, subscription_tier)
VALUES ('Ableka Default', 'app.ableka.com', 'tenant_default', 'enterprise');

-- Create default tenant schema
SELECT tenant_management.create_tenant_schema(
    (SELECT id FROM tenant_management.tenants WHERE domain = 'app.ableka.com'),
    'tenant_default'
);
```

### 3. Connection Pooling with PgBouncer
Create `infrastructure/terraform/pgbouncer/main.tf`:

```hcl
# PgBouncer EC2 instance
resource "aws_instance" "pgbouncer" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.pgbouncer.id]

  user_data = templatefile("${path.module}/pgbouncer-init.sh", {
    aurora_endpoint = aws_rds_cluster.main.endpoint
    db_username     = var.db_username
    db_password     = var.db_password
  })

  tags = merge(local.tags, {
    Name = "${local.name_prefix}-pgbouncer-${local.environment}"
  })
}

# PgBouncer security group
resource "aws_security_group" "pgbouncer" {
  name_prefix = "${local.name_prefix}-pgbouncer-${local.environment}"
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

  tags = local.tags
}

# PgBouncer configuration template
resource "aws_s3_object" "pgbouncer_config" {
  bucket = aws_s3_bucket.config.bucket
  key    = "pgbouncer/pgbouncer.ini"
  content = templatefile("${path.module}/pgbouncer.ini.tpl", {
    aurora_endpoint = aws_rds_cluster.main.endpoint
    db_username     = var.db_username
  })
  etag = filemd5("${path.module}/pgbouncer.ini.tpl")
}

# PgBouncer init script
resource "local_file" "pgbouncer_init" {
  filename = "${path.module}/pgbouncer-init.sh"
  content = <<-EOF
    #!/bin/bash
    yum update -y
    yum install -y pgbouncer

    # Download configuration from S3
    aws s3 cp s3://${aws_s3_bucket.config.bucket}/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini

    # Create userlist.txt
    cat > /etc/pgbouncer/userlist.txt << EOF_USERLIST
    "${var.db_username}" "${var.db_password}"
    EOF_USERLIST

    # Start PgBouncer
    systemctl enable pgbouncer
    systemctl start pgbouncer
  EOF
}
```

Create `infrastructure/terraform/pgbouncer/pgbouncer.ini.tpl`:

```ini
[databases]
* = host=${aurora_endpoint} port=5432

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 5432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5
max_db_connections = 50
max_user_connections = 100
server_idle_timeout = 30
server_lifetime = 3600
tcp_keepalive = 1
tcp_keepidle = 30
tcp_keepintvl = 10
tcp_keepcnt = 3
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
admin_users = ${db_username}
```

### 4. Database Monitoring and Alerting
Create `infrastructure/terraform/monitoring/database.tf`:

```hcl
# CloudWatch Alarms for Aurora
resource "aws_cloudwatch_metric_alarm" "db_cpu_high" {
  alarm_name          = "${local.name_prefix}-db-cpu-high-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Database CPU utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.cluster_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "db_memory_low" {
  alarm_name          = "${local.name_prefix}-db-memory-low-${local.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "1073741824"  # 1GB
  alarm_description   = "Database freeable memory is low"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.cluster_identifier
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
  threshold           = "1500"
  alarm_description   = "Database connection count is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.cluster_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "db_replica_lag" {
  alarm_name          = "${local.name_prefix}-db-replica-lag-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "AuroraReplicaLag"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "300"  # 5 minutes
  alarm_description   = "Database replica lag is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.main.cluster_identifier
  }
}

# Performance Insights monitoring
resource "aws_cloudwatch_dashboard" "database" {
  dashboard_name = "${local.name_prefix}-database-${local.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", aws_rds_cluster.main.cluster_identifier],
            [".", "CPUUtilization", ".", "."],
            [".", "FreeableMemory", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = local.region
          title   = "Database Performance"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          query = "SOURCE '/aws/rds/cluster/${aws_rds_cluster.main.cluster_identifier}/postgresql' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region = local.region
          title  = "Database Logs"
        }
      }
    ]
  })
}
```

### 5. Backup and Disaster Recovery
Create `infrastructure/terraform/backup/main.tf`:

```hcl
# AWS Backup Vault
resource "aws_backup_vault" "main" {
  name        = "${local.name_prefix}-backup-${local.environment}"
  kms_key_arn = aws_kms_key.backup.arn

  tags = local.tags
}

# KMS Key for backup encryption
resource "aws_kms_key" "backup" {
  description             = "KMS key for backup encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.tags
}

resource "aws_kms_alias" "backup" {
  name          = "alias/${local.name_prefix}-backup-${local.environment}"
  target_key_id = aws_kms_key.backup.key_id
}

# Backup Plan
resource "aws_backup_plan" "database" {
  name = "${local.name_prefix}-database-backup-${local.environment}"

  rule {
    rule_name         = "database_daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 2 * * ? *)"  # Daily at 2 AM

    lifecycle {
      delete_after = 30  # Keep backups for 30 days
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.cross_region.arn

      lifecycle {
        delete_after = 90  # Keep cross-region copies for 90 days
      }
    }
  }

  tags = local.tags
}

# Cross-region backup vault
resource "aws_backup_vault" "cross_region" {
  provider    = aws.secondary
  name        = "${local.name_prefix}-backup-dr-${local.environment}"
  kms_key_arn = aws_kms_key.backup_dr.arn

  tags = local.tags
}

resource "aws_kms_key" "backup_dr" {
  provider                = aws.secondary
  description             = "KMS key for DR backup encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.tags
}

# Backup Selection
resource "aws_backup_selection" "database" {
  name         = "${local.name_prefix}-database-selection-${local.environment}"
  plan_id      = aws_backup_plan.database.id
  iam_role_arn = aws_iam_role.backup.arn

  resources = [
    aws_rds_cluster.main.arn
  ]
}

# Backup IAM Role
resource "aws_iam_role" "backup" {
  name = "${local.name_prefix}-backup-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}
```

### 6. Database Migration Scripts
Create `scripts/db-migrate.sh`:

```bash
#!/bin/bash
set -e

# Ableka Lumina Database Migration Script
echo "🗄️ Running Ableka Lumina database migrations..."

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-ableka_prod}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
ENVIRONMENT=${ENVIRONMENT:-dev}

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

# Check database connection
check_connection() {
    log "Checking database connection..."

    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" &> /dev/null; then
        log "Database connection successful"
    else
        error "Database connection failed"
        exit 1
    fi
}

# Run migrations
run_migrations() {
    log "Running database migrations..."

    # Create migrations table if it doesn't exist
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
EOF

    # Get list of migration files
    MIGRATION_DIR="packages/api/src/database/migrations"
    MIGRATIONS=$(ls $MIGRATION_DIR/*.sql | sort)

    for migration in $MIGRATIONS; do
        version=$(basename $migration .sql)

        # Check if migration already applied
        applied=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version';")

        if [ "$applied" -eq "0" ]; then
            log "Applying migration: $version"

            # Apply migration
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migration

            # Record migration
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "INSERT INTO schema_migrations (version) VALUES ('$version');"

            log "Migration $version applied successfully"
        else
            log "Migration $version already applied"
        fi
    done
}

# Create tenant
create_tenant() {
    local tenant_name=$1
    local domain=$2
    local schema_name=$3

    log "Creating tenant: $tenant_name"

    # Insert tenant record
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
        INSERT INTO tenant_management.tenants (name, domain, schema_name)
        VALUES ('$tenant_name', '$domain', '$schema_name')
        ON CONFLICT (domain) DO NOTHING;
EOF

    # Create tenant schema
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
        SELECT tenant_management.create_tenant_schema(
            (SELECT id FROM tenant_management.tenants WHERE domain = '$domain'),
            '$schema_name'
        );
EOF

    log "Tenant $tenant_name created successfully"
}

# Run performance optimizations
optimize_database() {
    log "Running database optimizations..."

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
        -- Analyze all tables
        ANALYZE;

        -- Vacuum analyze for better query planning
        VACUUM ANALYZE;

        -- Update table statistics
        SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup
        FROM pg_stat_user_tables
        ORDER BY n_dead_tup DESC;

        -- Reindex if needed (check for bloated indexes)
        REINDEX DATABASE ableka_prod;
EOF

    log "Database optimization completed"
}

# Main migration flow
main() {
    check_connection
    run_migrations

    # Create default tenant if in production
    if [ "$ENVIRONMENT" = "prod" ]; then
        create_tenant "Ableka Default" "app.ableka.com" "tenant_default"
    fi

    optimize_database

    log "🎉 Database migration completed successfully!"
}

# Execute based on arguments
case "${1:-}" in
    "check")
        check_connection
        ;;
    "migrate")
        run_migrations
        ;;
    "tenant")
        create_tenant "$2" "$3" "$4"
        ;;
    "optimize")
        optimize_database
        ;;
    *)
        main
        ;;
esac
```

## Testing and Validation

### Database Connection Testing
```bash
# Test Aurora connection
psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -c "SELECT version();"

# Test multi-tenant schema
psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';"
```

### Performance Testing
```bash
# Run pgbench for performance testing
pgbench -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c 10 -j 2 -T 60

# Monitor performance insights
aws rds describe-db-cluster-parameters --db-cluster-parameter-group-name ableka-aurora-prod
```

### Backup Testing
```bash
# Test backup creation
aws backup start-backup-job --backup-vault-name ableka-backup-prod --resource-arn $DB_CLUSTER_ARN

# List backups
aws backup list-backup-jobs --by-resource-arn $DB_CLUSTER_ARN
```

### Multi-Tenant Testing
```bash
# Test tenant isolation
psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" << 'EOF'
    -- Switch to tenant schema
    SET search_path TO tenant_default;

    -- Test RLS
    SELECT COUNT(*) FROM users;
    SELECT COUNT(*) FROM tenant_management.tenants;
EOF
```

### Disaster Recovery Testing
```bash
# Test failover
aws rds failover-db-cluster --db-cluster-identifier ableka-aurora-prod

# Test backup restoration
aws backup start-restore-job --recovery-point-arn $BACKUP_ARN --metadata '{"DatabaseName": "ableka_prod_dr"}'
```

## Next Steps
- Week 22 will implement caching layers and API Gateway
- Week 23 will handle geo-redundancy and scaling configurations
- Week 24 will focus on launch preparation and go-live procedures

This Aurora PostgreSQL multi-tenant configuration provides a robust, scalable, and secure database foundation with comprehensive monitoring, backup, and disaster recovery capabilities for the Ableka Lumina RegTech platform.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 5 Deployment & Launch\Week 21\Day 5.md