# Compliance System Deployment Script
# Builds and deploys the AI compliance system to Fargate

param(
    [string]$Environment = "development",
    [switch]$NoCache,
    [switch]$SkipTests
)

Write-Host "AI Compliance System Deployment Script" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green

# Configuration
$buildArgs = @{}
if ($NoCache) {
    $buildArgs["--no-cache"] = $true
    Write-Host "Building without cache" -ForegroundColor Blue
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Blue

if (!(Test-Path ".env")) {
    Write-Host "Error: .env file not found. Please copy .env.example to .env and configure." -ForegroundColor Red
    exit 1
}

if (!(Test-Path "docker-compose.yml")) {
    Write-Host "Error: docker-compose.yml not found." -ForegroundColor Red
    exit 1
}

# Load environment variables
Write-Host "Loading environment configuration..." -ForegroundColor Blue
Get-Content ".env" | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($key, $value)
    }
}

# Run database migrations
Write-Host "Running database migrations..." -ForegroundColor Blue
try {
    & ".\powershell-scripts\Run-DatabaseMigrations.ps1" -Environment $Environment
    if ($LASTEXITCODE -ne 0) {
        throw "Database migration failed"
    }
} catch {
    Write-Host "Error during database migration: $_" -ForegroundColor Red
    exit 1
}

# Run tests if not skipped
if (!$SkipTests) {
    Write-Host "Running test suite..." -ForegroundColor Blue
    try {
        # Test API service
        if (Test-Path "src/api") {
            Push-Location "src/api"
            npm test
            if ($LASTEXITCODE -ne 0) { throw "API tests failed" }
            Pop-Location
        }

        # Test agents service
        if (Test-Path "src/agents") {
            Push-Location "src/agents"
            npm test
            if ($LASTEXITCODE -ne 0) { throw "Agents tests failed" }
            Pop-Location
        }

        # Test dashboard
        if (Test-Path "src/dashboard") {
            Push-Location "src/dashboard"
            npm test
            if ($LASTEXITCODE -ne 0) { throw "Dashboard tests failed" }
            Pop-Location
        }

        Write-Host "All tests passed" -ForegroundColor Green
    } catch {
        Write-Host "Error during testing: $_" -ForegroundColor Red
        exit 1
    }
}

# Build Docker images
Write-Host "Building Docker images..." -ForegroundColor Blue
try {
    $dockerArgs = @("compose", "build")
    if ($NoCache) {
        $dockerArgs += "--no-cache"
    }

    & docker $dockerArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed"
    }

    Write-Host "Docker images built successfully" -ForegroundColor Green
} catch {
    Write-Host "Error during Docker build: $_" -ForegroundColor Red
    exit 1
}

# Deploy services
Write-Host "Deploying services..." -ForegroundColor Blue
try {
    & docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Service deployment failed"
    }

    Write-Host "Services deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "Error during deployment: $_" -ForegroundColor Red
    exit 1
}

# Wait for services to be healthy
Write-Host "Waiting for services to be healthy..." -ForegroundColor Blue
Start-Sleep -Seconds 30

# Health check
Write-Host "Performing health checks..." -ForegroundColor Blue
$services = @(
    @{Name = "compliance-gateway"; Port = 3000; Path = "/health"},
    @{Name = "compliance-agents"; Port = 3002; Path = "/health"},
    @{Name = "compliance-dashboard"; Port = 3001; Path = "/"}
)

$allHealthy = $true
foreach ($service in $services) {
    try {
        $url = "http://localhost:$($service.Port)$($service.Path)"
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "$($service.Name): Healthy" -ForegroundColor Green
        } else {
            Write-Host "$($service.Name): Unhealthy (Status: $($response.StatusCode))" -ForegroundColor Red
            $allHealthy = $false
        }
    } catch {
        Write-Host "$($service.Name): Unhealthy (Error: $_)" -ForegroundColor Red
        $allHealthy = $false
    }
}

if ($allHealthy) {
    Write-Host "All services are healthy!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Deployment completed successfully!" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host "Access URLs:" -ForegroundColor Cyan
    Write-Host "  Dashboard: http://localhost:3001" -ForegroundColor Cyan
    Write-Host "  API Gateway: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  Agents API: http://localhost:3002" -ForegroundColor Cyan
    Write-Host "  Grafana: http://localhost:3001" -ForegroundColor Cyan
} else {
    Write-Host "Some services are not healthy. Please check the logs." -ForegroundColor Red
    exit 1
}