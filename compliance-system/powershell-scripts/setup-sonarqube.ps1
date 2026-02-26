# SonarQube Setup Automation Script
# Simplified PowerShell version - creates project, generates token, runs analysis
# Requirements: PowerShell 5.1+, Node.js 16+, npm
# Usage: .\setup-sonarqube.ps1 -Username admin -Password admin123

param(
    [string]$Username = "admin",
    [string]$Password = "admin123",
    [string]$ServerUrl = "http://localhost:9000",
    [string]$ProjectKey = "ablk-compliance-system",
    [string]$ProjectName = "Ableka Lumina - Compliance System"
)

# Simplified output function
function Write-Status {
    param([string]$Message, [string]$Type = "INFO")
    $colors = @{
        "INFO" = "Cyan"
        "SUCCESS" = "Green"
        "ERROR" = "Red"
        "WARN" = "Yellow"
    }
    Write-Host $Message -ForegroundColor $colors[$Type]
}

Write-Status "=== SonarQube Setup Automation ===" "INFO"
Write-Host ""

# Step 1: Test Connection
Write-Status "Step 1: Testing SonarQube Connection..." "INFO"
try {
    $response = Invoke-WebRequest -Uri "$ServerUrl/api/system/status" -ErrorAction Stop -UseBasicParsing
    $status = $response.Content | ConvertFrom-Json
    Write-Status "  Connected to $ServerUrl (Status: $($status.status))" "SUCCESS"
}
catch {
    Write-Status "  ERROR: Cannot connect to $ServerUrl" "ERROR"
    Write-Host "  Error details: $_"
    Write-Status "  Ensure SonarQube is running on localhost:9000" "WARN"
    exit 1
}
Write-Host ""

# Step 2: Create Auth Header
Write-Status "Step 2: Setting up authentication..." "INFO"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$Username`:$Password"))
$headers = @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
}
Write-Status "  Authentication headers created" "SUCCESS"
Write-Host ""

# Step 3: Check/Create Project
Write-Status "Step 3: Checking/creating SonarQube project..." "INFO"
$projectExists = $false
try {
    $projectResp = Invoke-WebRequest -Uri "$ServerUrl/api/projects/search?keys=$ProjectKey" -Headers $headers -ErrorAction Stop -UseBasicParsing
    $projectData = $projectResp.Content | ConvertFrom-Json
    if ($projectData.components -and $projectData.components.Count -gt 0) {
        $projectExists = $true
        Write-Status "  Project already exists" "INFO"
    }
}
catch {
    # Project doesn't exist - that's fine
}

if (-not $projectExists) {
    try {
        $projBody = @{
            project = $ProjectKey
            name = $ProjectName
            visibility = "private"
        } | ConvertTo-Json
        
        $createResp = Invoke-WebRequest -Uri "$ServerUrl/api/projects/create" -Method POST -Headers $headers -Body $projBody -ErrorAction Stop -UseBasicParsing
        Write-Status "  Project created successfully" "SUCCESS"
    }
    catch {
        Write-Status "  ERROR: Could not create project: $_" "ERROR"
        exit 1
    }
}
Write-Host ""

# Step 4: Generate Token
Write-Status "Step 4: Generating authentication token..." "INFO"
$tokenName = "sonar-analysis-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$token = $null
try {
    $tokenBody = @{
        name = $tokenName
        login = $Username
    } | ConvertTo-Json
    
    $tokenResp = Invoke-WebRequest -Uri "$ServerUrl/api/user_tokens/generate" -Method POST -Headers $headers -Body $tokenBody -ErrorAction Stop -UseBasicParsing
    $tokenData = $tokenResp.Content | ConvertFrom-Json
    $token = $tokenData.token
    Write-Status "  Token generated: $tokenName" "SUCCESS"
}
catch {
    Write-Status "  WARNING: Token generation failed. Attempting recovery..." "WARN"
    try {
        $searchResp = Invoke-WebRequest -Uri "$ServerUrl/api/user_tokens/search?login=$Username" -Headers $headers -ErrorAction Stop -UseBasicParsing
        $searchData = $searchResp.Content | ConvertFrom-Json
        if ($searchData.userTokens -and $searchData.userTokens.Count -gt 0) {
            $token = $searchData.userTokens[0].token
            Write-Status "  Using existing token instead" "INFO"
        }
    }
    catch {
        Write-Status "  ERROR: Could not retrieve token: $_" "ERROR"
        exit 1
    }
}
Write-Host ""

# Step 5: Save Token
Write-Status "Step 5: Saving SONAR_TOKEN environment variable..." "INFO"
$env:SONAR_TOKEN = $token
[Environment]::SetEnvironmentVariable("SONAR_TOKEN", $token, "User")
Write-Status "  Token saved to environment" "SUCCESS"
Write-Host ""

# Step 6: Install Scanner
Write-Status "Step 6: Installing sonarqube-scanner..." "INFO"
try {
    npm install --save-dev sonarqube-scanner 2>&1 | Out-Null
    Write-Status "  sonarqube-scanner installed" "SUCCESS"
}
catch {
    Write-Status "  WARNING: npm install had issues: $_" "WARN"
}
Write-Host ""

# Step 7: Run Tests
Write-Status "Step 7: Running tests with coverage..." "INFO"
try {
    npm run test:coverage 2>&1 | Out-Null
    Write-Status "  Tests completed" "SUCCESS"
}
catch {
    Write-Status "  WARNING: Test execution encountered issues" "WARN"
}
Write-Host ""

# Step 8: Run Analysis
Write-Status "Step 8: Running SonarQube analysis..." "INFO"
Write-Status "  (This may take a minute...)" "WARN"
try {
    npx sonarqube-scanner -Dsonar.projectBaseDir=. -Dsonar.host.url=$ServerUrl -Dsonar.login=$token 2>&1 | Out-Null
    Write-Status "  Analysis completed" "SUCCESS"
}
catch {
    Write-Status "  ERROR: Analysis failed: $_" "ERROR"
    exit 1
}
Write-Host ""

# Summary
Write-Host "========================================"
Write-Status "SETUP COMPLETE!" "SUCCESS"
Write-Host "========================================"
Write-Host ""
Write-Host "Dashboard: $ServerUrl/projects/$ProjectKey"
Write-Host "Token: $token"
Write-Host ""
Write-Host "Next: npm run sonar   (to re-run analysis)"
Write-Host ""
Write-Host ""
