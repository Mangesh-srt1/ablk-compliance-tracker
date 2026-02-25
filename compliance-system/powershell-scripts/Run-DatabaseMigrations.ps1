# Compliance System Database Migration Script
# Run this script to initialize the compliance database schema

param(
    [string]$Environment = "development",
    [switch]$Force
)

Write-Host "Compliance System Database Migration Script" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

# Load environment variables
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env" -ForegroundColor Blue
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($key, $value)
        }
    }
} else {
    Write-Host "Warning: .env file not found. Using default values." -ForegroundColor Yellow
}

# Database connection parameters
$dbHost = $env:DB_HOST ?? "localhost"
$dbPort = $env:DB_PORT ?? "5432"
$dbUser = $env:DB_USER ?? "compliance_user"
$dbPassword = $env:DB_PASSWORD ?? "secure_password_123"
$dbName = $env:DB_NAME ?? "compliance_db"

Write-Host "Database Host: $dbHost" -ForegroundColor Blue
Write-Host "Database Port: $dbPort" -ForegroundColor Blue
Write-Host "Database Name: $dbName" -ForegroundColor Blue

# Check if PostgreSQL is running
Write-Host "Checking PostgreSQL connection..." -ForegroundColor Blue
try {
    $connectionString = "Host=$dbHost;Port=$dbPort;Username=$dbUser;Password=$dbPassword;Database=$dbName"
    $sqlConnection = New-Object System.Data.SqlClient.SqlConnection
    $sqlConnection.ConnectionString = $connectionString
    $sqlConnection.Open()

    Write-Host "PostgreSQL connection successful" -ForegroundColor Green

    # Run migration scripts
    Write-Host "Running database migrations..." -ForegroundColor Blue

    # Create compliance schema
    $createSchemaQuery = @"
CREATE SCHEMA IF NOT EXISTS compliance;

-- Create compliance_agents table
CREATE TABLE IF NOT EXISTS compliance.compliance_agents (
    id SERIAL PRIMARY KEY,
    agent_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create compliance_checks table
CREATE TABLE IF NOT EXISTS compliance.compliance_checks (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES compliance.compliance_agents(id),
    transaction_id VARCHAR(100),
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    risk_score DECIMAL(3,2),
    findings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create compliance_rules table
CREATE TABLE IF NOT EXISTS compliance.compliance_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    conditions JSONB,
    actions JSONB,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_log table
CREATE TABLE IF NOT EXISTS compliance.audit_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_compliance_checks_transaction ON compliance.compliance_checks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status ON compliance.compliance_checks(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON compliance.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON compliance.audit_log(created_at);

-- Insert default compliance agents
INSERT INTO compliance.compliance_agents (agent_type, name, config) VALUES
('supervisor', 'Compliance Supervisor Agent', '{"max_concurrent_checks": 10, "risk_threshold": 0.7}'),
('kyc', 'KYC Verification Agent', '{"providers": ["ballerine"], "auto_approve_threshold": 0.9}'),
('aml', 'AML Monitoring Agent', '{"velocity_window_days": 30, "suspicious_amount": 50000}'),
('sebi', 'SEBI Compliance Agent', '{"reporting_frequency": "daily", "auto_escalation": true}')
ON CONFLICT (id) DO NOTHING;

-- Insert default compliance rules
INSERT INTO compliance.compliance_rules (rule_name, rule_type, conditions, actions, priority) VALUES
('High Risk Transaction', 'aml', '{"amount": {">": 100000}, "velocity": {">": 5}}', '{"escalate": true, "block": false, "notify": true}', 10),
('Sanctions List Check', 'kyc', '{"sanctions_match": true}', '{"block": true, "notify": true, "report": true}', 9),
('Velocity Threshold', 'aml', '{"daily_volume": {">": 50000}}', '{"flag": true, "review": true}', 5),
('SEBI Reporting', 'regulatory', '{"transaction_type": "security"}', '{"report": true, "archive": true}', 8)
ON CONFLICT (id) DO NOTHING;
"@

    $command = $sqlConnection.CreateCommand()
    $command.CommandText = $createSchemaQuery
    $command.ExecuteNonQuery()

    Write-Host "Database schema created successfully" -ForegroundColor Green

    $sqlConnection.Close()

} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Database migration completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green