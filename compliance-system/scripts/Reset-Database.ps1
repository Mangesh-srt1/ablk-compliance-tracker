#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Reset and initialize the compliance database with fresh schema and all migrations.

.DESCRIPTION
    This script performs a complete database reset:
    1. Drops the existing compliance_db database
    2. Creates a fresh compliance_db database
    3. Applies the initial schema (init-database.sql)
    4. Applies all migrations in order
    5. Verifies the final schema

.PARAMETER ContainerName
    Docker container name for PostgreSQL (default: compliance-postgres)

.PARAMETER DatabaseName
    Database name to reset (default: compliance_db)

.PARAMETER PostgresUser
    PostgreSQL user (default: postgres)

.PARAMETER SkipConfirmation
    Skip the confirmation prompt before resetting database

.PARAMETER IncludeSARCTR
    Apply SAR/CTR reporting schema (migration 008). Default: $false

.PARAMETER IncludeTestData
    Apply test data seeding (migration 009). Default: $false
    Note: Only recommended for development/QA environments

.EXAMPLE
    .\scripts\Reset-Database.ps1
    Reset the database with core migrations only

.EXAMPLE
    .\scripts\Reset-Database.ps1 -SkipConfirmation -IncludeSARCTR -IncludeTestData
    Reset database including SAR/CTR schema and test data (all migrations)
#>

[CmdletBinding()]
param(
    [string]$ContainerName = "compliance-postgres",
    [string]$DatabaseName = "compliance_db",
    [string]$PostgresUser = "postgres",
    [switch]$SkipConfirmation,
    [switch]$IncludeSARCTR = $false,
    [switch]$IncludeTestData = $false
)

$ErrorActionPreference = "Stop"

# Ensure we're in the correct directory
$scriptDir = Split-Path -Parent $PSScriptRoot
Set-Location $scriptDir

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DATABASE RESET SCRIPT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Working directory: $scriptDir" -ForegroundColor Gray

# Verify Docker container is running
Write-Host "`nStep 0: Verifying Docker Container..." -ForegroundColor Magenta
try {
    $containerStatus = docker inspect -f '{{.State.Running}}' $ContainerName 2>&1
    if ($containerStatus -ne "true") {
        Write-Host "ERROR: Container $ContainerName is not running" -ForegroundColor Red
        Write-Host "Start it with: docker-compose up -d" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "OK: Container $ContainerName is running" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Container $ContainerName not found" -ForegroundColor Red
    exit 1
}

# Confirmation prompt
if (-not $SkipConfirmation) {
    Write-Host "`nWARNING: This will DROP database $DatabaseName and recreate it!" -ForegroundColor Yellow
    Write-Host "WARNING: All existing data will be LOST." -ForegroundColor Yellow
    $confirm = Read-Host "`nContinue? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Aborted by user" -ForegroundColor Gray
        exit 0
    }
}

# Step 1: Drop and recreate database
Write-Host "`nStep 1: Drop and Recreate Database..." -ForegroundColor Magenta
try {
    docker exec $ContainerName psql -U $PostgresUser -c "DROP DATABASE IF EXISTS $DatabaseName;" | Out-Null
    Write-Host "OK: Dropped database $DatabaseName" -ForegroundColor Green
    
    docker exec $ContainerName psql -U $PostgresUser -c "CREATE DATABASE $DatabaseName;" | Out-Null
    Write-Host "OK: Created database $DatabaseName" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to drop/create database" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 2: Apply initial schema
Write-Host "`nStep 2: Apply Initial Schema..." -ForegroundColor Magenta
$initSchemaPath = "config/sql/init-database.sql"
if (-not (Test-Path $initSchemaPath)) {
    Write-Host "ERROR: Init schema not found: $initSchemaPath" -ForegroundColor Red
    exit 1
}

try {
    docker cp $initSchemaPath "${ContainerName}:/tmp/init-database.sql" | Out-Null
    $output = docker exec $ContainerName psql -U $PostgresUser -d $DatabaseName -f /tmp/init-database.sql 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to apply init schema" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
    
    Write-Host "OK: Applied init-database.sql" -ForegroundColor Green
    Write-Host "  - Created base tables" -ForegroundColor Gray
    Write-Host "  - Created enums and types" -ForegroundColor Gray
    Write-Host "  - Created indexes" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Error applying init schema" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 3: Apply all migrations
Write-Host "`nStep 3: Apply Migrations..." -ForegroundColor Magenta
$migrationsPath = "config/sql/migrations"
if (-not (Test-Path $migrationsPath)) {
    Write-Host "WARNING: Migrations folder not found: $migrationsPath" -ForegroundColor Yellow
} else {
    $migrations = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name
    
    if ($migrations.Count -eq 0) {
        Write-Host "WARNING: No migration files found" -ForegroundColor Yellow
    } else {
        Write-Host "Found $($migrations.Count) migration files" -ForegroundColor Gray
        
        # Temporarily allow errors so psql NOTICE messages don't stop execution
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        
        foreach ($migration in $migrations) {
            # Skip optional migrations based on flags
            if ($migration.Name -eq "008_sar_ctr_schema.sql" -and -not $IncludeSARCTR) {
                Write-Host "  Skipping: $($migration.Name) (use -IncludeSARCTR to apply)" -ForegroundColor Gray
                continue
            }
            if ($migration.Name -eq "009_seed_test_data.sql" -and -not $IncludeTestData) {
                Write-Host "  Skipping: $($migration.Name) (use -IncludeTestData to apply)" -ForegroundColor Gray
                continue
            }
            
            Write-Host "  Applying: $($migration.Name)" -ForegroundColor Gray
            
            # Copy migration to container
            docker cp $migration.FullName "${ContainerName}:/tmp/$($migration.Name)" 2>&1 | Out-Null
            
            # Execute migration
            $output = docker exec $ContainerName psql -U $PostgresUser -d $DatabaseName -f "/tmp/$($migration.Name)" 2>&1
            
            # Check for actual ERRORs (not just NOTICE messages)
            $errorLines = $output | Where-Object { $_ -match "ERROR:" -and $_ -notmatch "NOTICE:" }
            if ($errorLines) {
                Write-Host "  ERROR: Failed to apply $($migration.Name)" -ForegroundColor Red
                Write-Host $errorLines
                $ErrorActionPreference = $previousErrorAction
                exit 1
            }
            
            Write-Host "  OK: $($migration.Name)" -ForegroundColor Green
        }
        
        # Restore error handling
        $ErrorActionPreference = $previousErrorAction
    }
}

# Step 4: Verify schema
Write-Host "`nStep 4: Verify Schema..." -ForegroundColor Magenta
try {
    $requiredColumns = @('id', 'email', 'password_hash', 'full_name', 'role', 
                         'is_active', 'is_email_verified', 'approval_status', 
                         'permissions', 'is_bootstrap_admin')
    
    $missingColumns = @()
    foreach ($col in $requiredColumns) {
        # Use SQL query to check if column exists
        $colExists = docker exec $ContainerName psql -U $PostgresUser -d $DatabaseName -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = '$col');" 2>&1
        
        if ($colExists -notmatch 't') {
            $missingColumns += $col
        }
    }
    
    if ($missingColumns.Count -gt 0) {
        Write-Host "ERROR: Missing columns: $($missingColumns -join ', ')" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "OK: All required columns present" -ForegroundColor Green
    
    $tableCount = docker exec $ContainerName psql -U $PostgresUser -d $DatabaseName -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1
    Write-Host "OK: Database has $($tableCount.Trim()) tables" -ForegroundColor Green
    
    $adminCount = docker exec $ContainerName psql -U $PostgresUser -d $DatabaseName -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@platform.com';" 2>&1
    if ($adminCount.Trim() -eq "1") {
        Write-Host "OK: Bootstrap admin account exists" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Bootstrap admin not found" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "ERROR: Schema verification failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 5: Restart API services
Write-Host "`nStep 5: Restart API Services..." -ForegroundColor Magenta
try {
    $apiContainers = @("compliance-gateway", "compliance-agents")
    foreach ($container in $apiContainers) {
        $exists = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $container }
        if ($exists) {
            docker restart $container | Out-Null
            Write-Host "OK: Restarted $container" -ForegroundColor Green
        } else {
            Write-Host "WARNING: $container not found (skipped)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "WARNING: Failed to restart API containers" -ForegroundColor Yellow
    Write-Host "You may need to restart manually: docker restart compliance-gateway compliance-agents" -ForegroundColor Gray
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DATABASE RESET COMPLETE!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database: $DatabaseName" -ForegroundColor Green
Write-Host "Container: $ContainerName" -ForegroundColor Green
Write-Host "Status: Ready for use" -ForegroundColor Green

Write-Host "`nMigrations Applied:" -ForegroundColor Cyan
Write-Host "  `u{2713} 001_initial_schema.sql - core tables" -ForegroundColor White
Write-Host "  `u{2713} 002_blockchain_monitoring.sql - blockchain integration" -ForegroundColor White
Write-Host "  `u{2713} 002_vector_store.sql - ML embeddings" -ForegroundColor White
Write-Host "  `u{2713} 003_tenants_and_oauth.sql - multi-tenancy" -ForegroundColor White
Write-Host "  `u{2713} 004_api_key_security.sql - API key management" -ForegroundColor White
Write-Host "  `u{2713} 005_user_registration.sql - user self-registration" -ForegroundColor White
Write-Host "  `u{2713} 006_admin_approval_flow.sql - admin approval workflow" -ForegroundColor White
Write-Host "  `u{2713} 007_bootstrap_admin_flag.sql - bootstrap admin" -ForegroundColor White

if ($IncludeSARCTR) {
    Write-Host "  `u{2713} 008_sar_ctr_schema.sql - SAR/CTR reporting" -ForegroundColor White
} else {
    Write-Host "  · 008_sar_ctr_schema.sql - SAR/CTR reporting (optional, use -IncludeSARCTR)" -ForegroundColor Gray
}

if ($IncludeTestData) {
    Write-Host "  `u{2713} 009_seed_test_data.sql - test data" -ForegroundColor White
} else {
    Write-Host "  · 009_seed_test_data.sql - test data (optional, use -IncludeTestData)" -ForegroundColor Gray
}

Write-Host "`nDefault credentials:" -ForegroundColor Cyan
Write-Host "  Email: admin@platform.com" -ForegroundColor White
Write-Host "  Password: Admin@Platform1" -ForegroundColor White
Write-Host "  WARNING: Change password immediately in production!" -ForegroundColor Yellow

Write-Host "`nConnection string:" -ForegroundColor Cyan
Write-Host "  postgresql://$PostgresUser@localhost:4432/$DatabaseName" -ForegroundColor White

Write-Host "`nFor full reset with all optional features:" -ForegroundColor Yellow
Write-Host "  .\scripts\Reset-Database.ps1 -SkipConfirmation -IncludeSARCTR -IncludeTestData" -ForegroundColor Yellow

Write-Host "`nAll done!`n" -ForegroundColor Green
