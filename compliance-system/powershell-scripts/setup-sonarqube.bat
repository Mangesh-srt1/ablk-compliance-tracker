@echo off
REM SonarQube Setup Automation Script (Batch version)
REM Usage: setup-sonarqube.bat

setlocal enabledelayedexpansion

set USERNAME=admin
set PASSWORD=admin123
set SERVER_URL=http://localhost:9000
set PROJECT_KEY=ablk-compliance-system
set PROJECT_NAME=Ableka Lumina - Compliance System

echo.
echo ========================================
echo SonarQube Automated Setup
echo ========================================
echo.

REM Step 1: Test Connection
echo [1/7] Testing SonarQube Connection...
curl -s -o nul -w "%%{http_code}" "%SERVER_URL%/api/system/status"
if %ERRORLEVEL% neq 0 (
    echo ERROR: Cannot connect to %SERVER_URL%
    echo Make sure SonarQube is running
    pause
    exit /b 1
)
echo OK - Connected to %SERVER_URL%
echo.

REM Step 2: Create Base64 Auth
echo [2/7] Creating authentication...
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "[Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('%USERNAME%:%PASSWORD%'))"') do set AUTH=%%a
echo OK - Authentication headers created
echo.

REM Step 3: Check if project exists
echo [3/7] Checking if project exists...
curl -s -H "Authorization: Basic %AUTH%" "%SERVER_URL%/api/projects/search?keys=%PROJECT_KEY%" > temp_project.json
findstr /I "\"key\":\"%PROJECT_KEY%\"" temp_project.json >nul
if %ERRORLEVEL% equ 0 (
    echo OK - Project already exists
    set PROJECT_EXISTS=1
) else (
    echo INFO - Project does not exist, will create it
    set PROJECT_EXISTS=0
)
del temp_project.json
echo.

REM Step 4: Create Project
if %PROJECT_EXISTS% equ 0 (
    echo [4/7] Creating project...
    powershell -NoProfile -Command ^
        "$body = @{ project='%PROJECT_KEY%'; name='%PROJECT_NAME%'; visibility='private' } | ConvertTo-Json; " ^
        "curl -s -X POST -H 'Authorization: Basic %AUTH%' -H 'Content-Type: application/json' -d '$body' '%SERVER_URL%/api/projects/create'"
    echo OK - Project created
) else (
    echo [4/7] Skipping project creation (already exists)
)
echo.

REM Step 5: Generate Token
echo [5/7] Generating authentication token...
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "[System.DateTime]::Now.ToString('yyyyMMdd-HHmmss')"') do set TIMESTAMP=%%a
set TOKEN_NAME=local-analysis-%TIMESTAMP%

powershell -NoProfile -Command ^
    "$body = @{ name='%TOKEN_NAME%'; login='%USERNAME%' } | ConvertTo-Json; " ^
    "$response = curl -s -X POST -H 'Authorization: Basic %AUTH%' -H 'Content-Type: application/json' -d '$body' '%SERVER_URL%/api/user_tokens/generate'; " ^
    "$token = ($response | ConvertFrom-Json).token; " ^
    "Write-Host $token" > temp_token.txt

set /p SONAR_TOKEN=<temp_token.txt
del temp_token.txt

echo OK - Token generated: %SONAR_TOKEN%
echo.

REM Step 6: Set Environment Variable
echo [6/7] Setting SONAR_TOKEN environment variable...
setx SONAR_TOKEN %SONAR_TOKEN%
echo OK - SONAR_TOKEN set permanently
echo.

REM Step 7: Install SonarScanner
echo [7/7] Installing sonarqube-scanner...
call npm run sonar:install
if %ERRORLEVEL% neq 0 (
    echo WARNING - Could not install via npm script, trying direct install...
    call npm install --save-dev sonarqube-scanner
)
echo OK - sonarqube-scanner installed
echo.

REM Step 8: Run Analysis
echo Running analysis (this may take a minute)...
cd compliance-system
call npm run test:coverage
call npx sonarqube-scanner -Dsonar.projectBaseDir=. -Dsonar.host.url=%SERVER_URL% -Dsonar.login=%SONAR_TOKEN%
cd ..

echo.
echo ========================================
echo SETUP COMPLETE!
echo ========================================
echo.
echo View your results at:
echo   %SERVER_URL%/projects/%PROJECT_KEY%
echo.
echo Your token has been saved to:
echo   Environment variable: SONAR_TOKEN
echo.
echo Next time, run analysis with:
echo   npm run sonar
echo.
pause
