# SPRINT 2 - DAY 4: Production Environment Validation Script
# Purpose: Verify .env.production and docker-compose.prod.yml are properly configured
# Usage: .\Validate-ProductionEnvironment.ps1

param(
    [ValidateSet('validate-env', 'validate-docker', 'validate-secrets', 'validate-all')]
    [string]$Mode = 'validate-all',
    
    [string]$EnvFile = './.env.production',
    [string]$DockerComposeFile = './docker-compose.prod.yml',
    [switch]$Verbose = $false
)

# Colors for output
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Cyan = [System.ConsoleColor]::Cyan

# Counters for results
$passed = 0
$failed = 0
$warnings = 0

function Write-Status {
    param(
        [string]$Message,
        [ValidateSet('pass', 'fail', 'warn', 'info')]
        [string]$Type = 'info'
    )
    
    $prefix = switch ($Type) {
        'pass' { "✅ PASS"; $passed++ }
        'fail' { "❌ FAIL"; $failed++ }
        'warn' { "⚠️  WARN"; $warnings++ }
        'info' { "ℹ️  INFO" }
    }
    
    Write-Host "$prefix : $Message"
}

function Get-EnvVariables {
    param([string]$FilePath)
    
    $vars = @{}
    
    if (-not (Test-Path $FilePath)) {
        Write-Status "Environment file not found: $FilePath" -Type fail
        return $vars
    }
    
    Get-Content $FilePath | Where-Object { $_ -match '^\s*[A-Z_]+=' } | ForEach-Object {
        $line = $_.Trim()
        if (-not $line.StartsWith('#') -and $line -match '^([A-Z_]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2].Trim('"').Trim("'")
            $vars[$key] = $value
        }
    }
    
    return $vars
}

function Validate-RequiredVariables {
    param(
        [hashtable]$Variables,
        [string[]]$RequiredVars
    )
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING REQUIRED VARIABLES" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    foreach ($var in $RequiredVars) {
        if ($Variables.ContainsKey($var)) {
            $value = $Variables[$var]
            $display = if ($value.Length -gt 30) {
                $value.Substring(0, 27) + "..."
            } else {
                $value
            }
            Write-Status "Found: $var = $display" -Type pass
        } else {
            Write-Status "Missing required variable: $var" -Type fail
        }
    }
}

function Validate-SecretVariables {
    param([hashtable]$Variables)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING SECRET VARIABLES" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    $secretVars = @(
        'DB_PASSWORD', 'JWT_SECRET', 'ENCRYPTION_KEY',
        'BALLERINE_API_KEY', 'MARBLE_API_KEY', 'CHAINALYSIS_API_KEY',
        'GROK_API_KEY', 'SESSION_SECRET'
    )
    
    foreach ($secret in $secretVars) {
        if ($Variables.ContainsKey($secret)) {
            $value = $Variables[$secret]
            if ($value -match '^\$\{' -or $value -eq '' -or $value -like '*placeholder*') {
                Write-Status "$secret uses placeholder/variable (good for production)" -Type pass
            } elseif ($value.Length -lt 8) {
                Write-Status "$secret appears too short for a secret" -Type warn
            } else {
                Write-Status "$secret is defined" -Type pass
            }
        } else {
            Write-Status "Missing secret variable: $secret" -Type fail
        }
    }
}

function Validate-DatabaseConfig {
    param([hashtable]$Variables)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING DATABASE CONFIGURATION" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    $dbVars = @('DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME')
    
    foreach ($var in $dbVars) {
        if ($Variables.ContainsKey($var)) {
            Write-Status "Database config: $var is defined" -Type pass
        } else {
            Write-Status "Missing database config: $var" -Type fail
        }
    }
    
    # Validate DB_HOST format (should be RDS endpoint in prod)
    if ($Variables.ContainsKey('DB_HOST')) {
        $host = $Variables['DB_HOST']
        if ($host -like '*rds.amazonaws.com*') {
            Write-Status "DB_HOST appears to be RDS (production)" -Type pass
        } elseif ($host -like 'postgres' -or $host -like 'localhost') {
            Write-Status "DB_HOST appears to be development/local" -Type warn
        } else {
            Write-Status "DB_HOST: $host (custom endpoint)" -Type info
        }
    }
    
    # Validate DB_PORT
    if ($Variables.ContainsKey('DB_PORT')) {
        $port = $Variables['DB_PORT']
        if ($port -eq '5432' -or $port -eq '') {
            Write-Status "DB_PORT is standard PostgreSQL port (5432)" -Type pass
        } else {
            Write-Status "DB_PORT is non-standard: $port" -Type warn
        }
    }
    
    # Validate pool settings
    if ($Variables.ContainsKey('DB_POOL_MAX')) {
        $max = $Variables['DB_POOL_MAX']
        if ($max -ge 20) {
            Write-Status "DB_POOL_MAX=$max (good for production)" -Type pass
        } else {
            Write-Status "DB_POOL_MAX=$max (consider increasing for production)" -Type warn
        }
    }
}

function Validate-CacheConfig {
    param([hashtable]$Variables)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING REDIS/CACHE CONFIGURATION" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    if ($Variables.ContainsKey('REDIS_HOST')) {
        $host = $Variables['REDIS_HOST']
        if ($host -like '*cache.amazonaws.com*') {
            Write-Status "REDIS_HOST appears to be ElastiCache (production)" -Type pass
        } elseif ($host -like 'redis' -or $host -like 'localhost') {
            Write-Status "REDIS_HOST appears to be development/local" -Type warn
        } else {
            Write-Status "REDIS_HOST: $host (custom endpoint)" -Type info
        }
    }
    
    if ($Variables.ContainsKey('REDIS_TLS')) {
        if ($Variables['REDIS_TLS'] -eq 'true') {
            Write-Status "REDIS_TLS is enabled (good for production)" -Type pass
        } else {
            Write-Status "REDIS_TLS is disabled (should be enabled in production)" -Type warn
        }
    }
}

function Validate-APIConfig {
    param([hashtable]$Variables)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING API CONFIGURATION" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    if ($Variables.ContainsKey('NODE_ENV')) {
        $env = $Variables['NODE_ENV']
        if ($env -eq 'production') {
            Write-Status "NODE_ENV=production (correct)" -Type pass
        } else {
            Write-Status "NODE_ENV=$env (should be 'production')" -Type warn
        }
    }
    
    if ($Variables.ContainsKey('LOG_LEVEL')) {
        $level = $Variables['LOG_LEVEL']
        if ($level -in @('info', 'warn', 'error')) {
            Write-Status "LOG_LEVEL=$level (appropriate for production)" -Type pass
        } else {
            Write-Status "LOG_LEVEL=$level (consider 'info' or 'warn' for production)" -Type warn
        }
    }
    
    if ($Variables.ContainsKey('API_CORS_ORIGIN')) {
        $cors = $Variables['API_CORS_ORIGIN']
        if ($cors -like '*https*') {
            Write-Status "CORS origins use HTTPS (good)" -Type pass
        } else {
            Write-Status "CORS origins should use HTTPS" -Type warn
        }
    }
}

function Validate-ExternalAPIs {
    param([hashtable]$Variables)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING EXTERNAL API CONFIGURATION" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    $apis = @(
        'BALLERINE_API_KEY',
        'MARBLE_API_KEY',
        'CHAINALYSIS_API_KEY',
        'THE_GRAPH_API_KEY',
        'GROK_API_KEY',
        'LANGCHAIN_API_KEY'
    )
    
    $defined = 0
    foreach ($api in $apis) {
        if ($Variables.ContainsKey($api)) {
            $value = $Variables[$api]
            if ($value -and $value -notlike '${*' -and $value -notlike '*placeholder*') {
                Write-Status "External API configured: $api" -Type pass
                $defined++
            } else {
                Write-Status "External API placeholder: $api" -Type info
            }
        } else {
            Write-Status "Missing external API: $api" -Type warn
        }
    }
    
    Write-Status "Configured external APIs: $defined/$($apis.Length)" -Type info
}

function Validate-BlockchainConfig {
    param([hashtable]$Variables)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING BLOCKCHAIN CONFIGURATION" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    if ($Variables.ContainsKey('ETHEREUM_RPC_URL')) {
        Write-Status "Ethereum RPC URL configured" -Type pass
    } else {
        Write-Status "Ethereum RPC URL not configured" -Type warn
    }
    
    if ($Variables.ContainsKey('BESU_RPC_URL')) {
        Write-Status "Hyperledger Besu RPC URL configured" -Type pass
    } else {
        Write-Status "Hyperledger Besu RPC URL not configured" -Type info
    }
    
    if ($Variables.ContainsKey('SOLANA_RPC_URL')) {
        Write-Status "Solana RPC URL configured" -Type pass
    } else {
        Write-Status "Solana RPC URL not configured" -Type info
    }
}

function Validate-DockerCompose {
    param([string]$FilePath)
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "VALIDATING DOCKER COMPOSE CONFIGURATION" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    if (-not (Test-Path $FilePath)) {
        Write-Status "Docker Compose file not found: $FilePath" -Type fail
        return
    }
    
    Write-Status "Docker Compose file found" -Type pass
    
    $content = Get-Content $FilePath -Raw
    
    # Validate services
    $services = @('api', 'agents', 'postgres', 'redis')
    foreach ($service in $services) {
        if ($content -match "^\s*$service\s*:" -or $content -match "`n\s+$service\s*:") {
            Write-Status "Service defined: $service" -Type pass
        } else {
            Write-Status "Service not defined: $service" -Type fail
        }
    }
    
    # Validate resource limits
    if ($content -match 'cpus.*[0-9]' -and $content -match 'memory.*[MG]') {
        Write-Status "Resource limits are defined" -Type pass
    } else {
        Write-Status "Resource limits may be missing" -Type warn
    }
    
    # Validate healthchecks
    $healthchecks = ($content | Select-String -Pattern 'healthcheck:' | Measure-Object).Count
    if ($healthchecks -ge 3) {
        Write-Status "Health checks configured ($healthchecks instances)" -Type pass
    } else {
        Write-Status "Health checks may be incomplete" -Type warn
    }
    
    # Validate volumes
    if ($content -match 'volumes:' -and ($content -match 'postgres_data' -or $content -match 'redis_data')) {
        Write-Status "Persistent volumes configured" -Type pass
    } else {
        Write-Status "Persistent volumes may be missing" -Type warn
    }
    
    # Validate image references
    if ($content -match 'lumina-api.*latest-prod' -and $content -match 'lumina-agents.*latest-prod') {
        Write-Status "Production image tags used" -Type pass
    } else {
        Write-Status "Check image tags (should use latest-prod in production)" -Type warn
    }
}

function Validate-CodeSecrets {
    param([string]$SourcePath = './src')
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "SCANNING FOR HARDCODED SECRETS" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
    
    if (-not (Test-Path $SourcePath)) {
        Write-Status "Source directory not found: $SourcePath" -Type warn
        return
    }
    
    # Pattern for potential hardcoded secrets
    $suspiciousPatterns = @(
        "sk_[a-zA-Z0-9]{20,}",
        "pk_[a-zA-Z0-9]{20,}",
        'password.*=.*["\x27](?!<|\$)',
        'apiKey.*=.*["\x27](?!<|\$)',
        'secret.*=.*["\x27](?!<|\$)'
    )
    
    $foundIssues = 0
    
    foreach ($pattern in $suspiciousPatterns) {
        $files = Get-ChildItem $SourcePath -Filter "*.ts" -Recurse | 
                 Select-String -Pattern $pattern | 
                 Where-Object { $_ -notmatch '(process.env|placeholder|example|test)' }
        
        if ($files) {
            foreach ($file in $files) {
                Write-Status "Potential hardcoded secret found in $($file.Filename)" -Type fail
                $foundIssues++
            }
        }
    }
    
    if ($foundIssues -eq 0) {
        Write-Status "No obvious hardcoded secrets detected" -Type pass
    }
}

# Main execution
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   SPRINT 2 - DAY 4: PRODUCTION ENVIRONMENT VALIDATION     ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Validate environment file
if ($Mode -in @('validate-env', 'validate-all')) {
    $vars = Get-EnvVariables -FilePath $EnvFile
    
    if ($vars.Count -eq 0) {
        Write-Host "No environment variables found in $EnvFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Status "$($vars.Count) environment variables loaded from $EnvFile" -Type info
    
    # Required variables for production
    $requiredVars = @(
        'NODE_ENV', 'API_PORT', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER',
        'REDIS_HOST', 'REDIS_PORT', 'JWT_SECRET', 'ENCRYPTION_KEY',
        'LOG_LEVEL', 'API_CORS_ORIGIN'
    )
    
    Validate-RequiredVariables -Variables $vars -RequiredVars $requiredVars
    Validate-SecretVariables -Variables $vars
    Validate-DatabaseConfig -Variables $vars
    Validate-CacheConfig -Variables $vars
    Validate-APIConfig -Variables $vars
    Validate-ExternalAPIs -Variables $vars
    Validate-BlockchainConfig -Variables $vars
    Validate-CodeSecrets -SourcePath './src'
}

# Validate Docker Compose
if ($Mode -in @('validate-docker', 'validate-all')) {
    Validate-DockerCompose -FilePath $DockerComposeFile
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Passed: $passed" -ForegroundColor Green
Write-Host "⚠️  Warnings: $warnings" -ForegroundColor Yellow
Write-Host "❌ Failed: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ VALIDATION SUCCESSFUL - Production environment is ready!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ VALIDATION FAILED - Fix the issues above before deploying" -ForegroundColor Red
    exit 1
}
