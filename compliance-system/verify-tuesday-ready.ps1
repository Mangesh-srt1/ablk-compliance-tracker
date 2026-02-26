#!/usr/bin/env pwsh
# Tuesday Readiness Verification Script
# Run this to verify database, code, and build are ready for Tuesday work

$ErrorActionPreference = "Stop"

Write-Host "🔍 TUESDAY (Mar 4) READINESS CHECK" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. Docker Check
Write-Host "▶ Checking Docker services..." -ForegroundColor Yellow
try {
    $dockerCheck = & docker-compose -f docker-compose.dev.yml ps --format "json" 2>$null | ConvertFrom-Json
    $postgresHealthy = $dockerCheck | Where-Object { $_.Service -eq "postgres" -and $_.State -match "healthy" }
    $redisHealthy = $dockerCheck | Where-Object { $_.Service -eq "redis" }
    
    if ($postgresHealthy) {
        Write-Host "  ✅ PostgreSQL healthy" -ForegroundColor Green
    } else {
        Write-Host "  ❌ PostgreSQL not healthy" -ForegroundColor Red
        Write-Host "     Run: docker-compose -f docker-compose.dev.yml up -d" -ForegroundColor Yellow
        $allGood = $false
    }
    
    if ($redisHealthy) {
        Write-Host "  ✅ Redis running" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Redis not running" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host "  ⚠️  Docker service check failed" -ForegroundColor Yellow
    Write-Host "     Trying to start services..." -ForegroundColor Yellow
    & docker-compose -f docker-compose.dev.yml up -d
}

Write-Host ""

# 2. Database Check
Write-Host "▶ Checking database..." -ForegroundColor Yellow
try {
    $kycCount = & docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d compliance_db -c "SELECT COUNT(*) as count FROM kyc_checks;" 2>$null
    if ($kycCount -match "\d+") {
        $count = [int]($kycCount | Select-String -Pattern "\d+" -AllMatches | Select-Object -First 1).Matches.Value
        Write-Host "  ✅ Database has $count KYC records" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  Could not verify KYC records" -ForegroundColor Yellow
}

Write-Host ""

# 3. Build Check
Write-Host "▶ Checking TypeScript compilation..." -ForegroundColor Yellow
$buildOutput = & npm run build 2>&1 | Select-String -Pattern "error" -NotMatch | Select-String "TS\d+"
if ($buildOutput -is [System.Object[]] -or ($buildOutput -is [string] -and $buildOutput.Length -gt 0)) {
    Write-Host "  ⚠️  Build has issues" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ Build successful (0 TypeScript errors)" -ForegroundColor Green
}

Write-Host ""

# 4. Code Files Check
Write-Host "▶ Checking critical files..." -ForegroundColor Yellow
$filesToCheck = @(
    "src/agents/src/tools/ballerineClient.ts",
    "src/api/src/services/providers/ballerineKycProvider.ts",
    "src/api/src/services/providers/chainalysisAmlProvider.ts",
    "src/api/src/services/kycService.ts",
    "src/agents/src/agents/kycAgent.ts",
    "src/agents/src/agents/amlAgent.ts"
)

foreach ($file in $filesToCheck) {
    if (Test-Path "compliance-system/$file") {
        $size = (Get-Item "compliance-system/$file").Length
        $kilobytes = [math]::Round($size / 1024, 1)
        Write-Host "  ✅ $file ($kilobytes KB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file NOT FOUND" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""

# 5. Test Files Check
Write-Host "▶ Checking test files..." -ForegroundColor Yellow
$testFiles = @(
    "src/api/src/__tests__/unit/services/kycService.test.ts",
    "src/agents/src/__tests__/unit/agents/kycAgent.test.ts",
    "src/api/src/__tests__/unit/services/amlService.test.ts",
    "src/api/src/__tests__/database.integration.test.ts"
)

foreach ($file in $testFiles) {
    if (Test-Path "compliance-system/$file") {
        Write-Host "  ✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $file not found (will be created during Tuesday work)" -ForegroundColor Yellow
    }
}

Write-Host ""

# 6. Environment Check
Write-Host "▶ Checking environment variables..." -ForegroundColor Yellow
$envFile = "compliance-system/.env"
if (Test-Path $envFile) {
    $hasDbUrl = Select-String -Path $envFile -Pattern "DATABASE_URL" -Quiet
    $hasApiKey = Select-String -Path $envFile -Pattern "BALLERINE_API_KEY" -Quiet
    
    if ($hasDbUrl) {
        Write-Host "  ✅ DATABASE_URL configured" -ForegroundColor Green
    }
    if ($hasApiKey) {
        Write-Host "  ✅ BALLERINE_API_KEY configured" -ForegroundColor Green
    } else {
        Write-Host "  ℹ️  BALLERINE_API_KEY not set (will use test/mock)" -ForegroundColor Cyan
    }
} else {
    Write-Host "  ⚠️  .env file not found" -ForegroundColor Yellow
}

Write-Host ""

# 7. npm dependencies
Write-Host "▶ Checking npm dependencies..." -ForegroundColor Yellow
try {
    $json = Get-Content "compliance-system/package.json" | ConvertFrom-Json
    $hasJest = $json.devDependencies.jest -or $json.dependencies.jest
    $hasAxios = $json.devDependencies.axios -or $json.dependencies.axios
    
    if ($hasJest) {
        Write-Host "  ✅ Jest installed" -ForegroundColor Green
    }
    if ($hasAxios) {
        Write-Host "  ✅ Axios installed" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  Could not verify dependencies" -ForegroundColor Yellow
}

Write-Host ""

# 8. Summary
Write-Host "═════════════════════════════════════" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ READY FOR TUESDAY WORK!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Review: docs/TUESDAY_EXECUTION_GUIDE.md" -ForegroundColor White
    Write-Host "  2. Start: npm run test:watch" -ForegroundColor White
    Write-Host "  3. Begin: Task 1 - Ballerine client tests" -ForegroundColor White
} else {
    Write-Host "⚠️  Some issues found - see above" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Fix blockers:" -ForegroundColor Cyan
    Write-Host "  1. Start Docker: docker-compose -f docker-compose.dev.yml up -d" -ForegroundColor White
    Write-Host "  2. Verify database: docker-compose -f docker-compose.dev.yml ps" -ForegroundColor White
    Write-Host "  3. Run build: npm run build" -ForegroundColor White
}

Write-Host ""
Write-Host "═════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Reference: docs/TUESDAY_EXECUTION_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
