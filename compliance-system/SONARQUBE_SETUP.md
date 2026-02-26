# Local SonarQube Setup Guide

**Local SonarQube Server:** `http://localhost:9000`

This guide helps you analyze code quality for Ableka Lumina using your local SonarQube server.

---

## ✅ Quick Start (3 Steps)

### Step 1: Create Project in SonarQube

1. Open **http://localhost:9000**
2. Click **Create Project** (or the "+" button)
3. Fill in:
   - **Project Key:** `ablk-compliance-system`
   - **Project Name:** `Ableka Lumina - Compliance System`
   - **Visibility:** Private
4. Click **Create**

### Step 2: Generate Authentication Token

1. Go to **http://localhost:9000/admin/credentials**
2. Click **Generate Token**
3. Name it: `local-analysis-token`
4. Copy the token (you'll use it in Step 3)

### Step 3: Run Analysis Locally

**Navigate to compliance-system folder:**

```bash
cd compliance-system
```

**Run analysis with token:**

```bash
npx sonarqube-scanner \
  -Dsonar.projectBaseDir=. \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=<YOUR-TOKEN-HERE>
```

**Replace `<YOUR-TOKEN-HERE>` with the token from Step 2**

Example:

```bash
npx sonarqube-scanner \
  -Dsonar.projectBaseDir=. \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=squ_abc123xyz789
```

### Step 4: View Results

1. Open **http://localhost:9000/projects/ablk-compliance-system**
2. See code quality metrics:
   - **Bugs & Vulnerabilities**
   - **Code Smells** (maintainability issues)
   - **Coverage** (test coverage %)
   - **Duplication**
   - **Security Issues**

---

## 📦 Installation & Setup

### Prerequisites

- ✅ SonarQube Server running on `localhost:9000`
- ✅ Node.js 20+ installed
- ✅ npm package manager

### Option A: Use npm Script (Recommended)

**1. Add to package.json:**

```json
{
  "scripts": {
    "sonar": "npm run test:coverage && npx sonarqube-scanner -Dsonar.projectBaseDir=. -Dsonar.host.url=http://localhost:9000 -Dsonar.login=$SONAR_TOKEN",
    "sonar:local": "npm run test:coverage && npx sonarqube-scanner -Dsonar.projectBaseDir=. -Dsonar.host.url=http://localhost:9000"
  }
}
```

**2. Install SonarScanner CLI:**

```bash
npm install --save-dev sonarqube-scanner
```

**3. Run analysis:**

```bash
# With token (recommended):
export SONAR_TOKEN=<your-token>
npm run sonar

# Without token (requires project key in config):
npm run sonar:local
```

### Option B: Direct Command

```bash
# Download and run SonarScanner directly
npx sonarqube-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.projectKey=ablk-compliance-system \
  -Dsonar.projectName="Ableka Lumina - Compliance System" \
  -Dsonar.projectBaseDir=. \
  -Dsonar.sources=src \
  -Dsonar.tests=src \
  -Dsonar.test.inclusions=**/__tests__/**/*.test.ts \
  -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/** \
  -Dsonar.javascript.lcov.reportPaths=src/api/coverage/lcov.info \
  -Dsonar.login=<YOUR-TOKEN>
```

---

## 🔐 Token Management

### Generate Token from UI

1. Login to SonarQube: **http://localhost:9000**
2. Click your **avatar** (top right)
3. Select **My Account**
4. Go to **Security** tab
5. Click **Generate Tokens**
6. Name: `local-analysis-token` (or your name)
7. **Copy the token immediately** (won't be shown again)

### Use Token in Analysis

**Option 1: Environment Variable (Recommended)**

```bash
export SONAR_TOKEN=squ_abc123xyz789
npm run sonar
```

**Option 2: Command Line**

```bash
npx sonarqube-scanner \
  -Dsonar.login=squ_abc123xyz789 \
  -Dsonar.host.url=http://localhost:9000
```

**Option 3: .env File**
Create `compliance-system/.env.local`:

```
SONAR_TOKEN=squ_abc123xyz789
SONAR_HOST_URL=http://localhost:9000
```

Then run:

```bash
npx sonarqube-scanner \
  -Dsonar.host.url=$SONAR_HOST_URL \
  -Dsonar.login=$SONAR_TOKEN
```

### Token Security

⚠️ **Important:**

- 🔒 Never commit tokens to Git
- 🔒 Never share tokens publicly
- 🔒 Tokens can be revoked from SonarQube UI
- 🔒 Create separate tokens for different purposes

---

## 🎯 Configuration Explained

**Configuration File:** `sonar-project.properties`

```properties
# Project identity
sonar.projectKey=ablk-compliance-system
sonar.projectName=Ableka Lumina - Compliance System
sonar.projectVersion=1.0.0

# Server location
sonar.host.url=http://localhost:9000

# What to analyze
sonar.sources=src                    # Source code folder

# What to test
sonar.tests=src                      # Test code location
sonar.test.inclusions=**/__tests__/** # Test file patterns

# Code coverage reports
sonar.javascript.lcov.reportPaths=src/api/coverage/lcov.info

# Exclusions
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**

# Encoding
sonar.sourceEncoding=UTF-8
```

---

## 📊 Understanding SonarQube Results

### Main Metrics

**🐛 Bugs**

- Code defects that will cause runtime errors
- Priority: **CRITICAL** - Fix immediately

**🔒 Vulnerabilities**

- Security weaknesses
- Priority: **CRITICAL** - Fix immediately

**🧹 Code Smells**

- Maintainability issues (complexity, duplication)
- Priority: **HIGH** - Fix soon

**📈 Coverage**

- Percentage of code tested by unit tests
- Target: **≥80%** for compliance code

**♻️ Duplication**

- Code that's copied/repeated
- Target: **<5%** duplication

**⚡ Hotspots**

- Code that's complex or risky
- Review for potential improvements

### Quality Gate

A **Quality Gate** is a set of rules that must pass:

- ✅ No critical bugs
- ✅ No critical vulnerabilities
- ✅ Code coverage ≥80%
- ✅ Duplication <3%

View quality gate at project dashboard.

---

## 🔧 Troubleshooting

### Error: "Cannot connect to http://localhost:9000"

**Solution 1:** Check if SonarQube is running

```bash
# Test connection
curl http://localhost:9000
# Should return HTML (not "Connection refused")
```

**Solution 2:** Check firewall

```bash
# Windows: Check port 9000
netstat -ano | findstr :9000

# If not running, start SonarQube
docker run -d --name sonarqube -p 9000:9000 sonarqube
```

### Error: "Invalid token"

**Solution:** Regenerate token

1. Go to http://localhost:9000/admin/credentials
2. Delete old token
3. Generate new token
4. Use new token in analysis command

### Error: "Project not found"

**Solution:** Create project first

1. Go to http://localhost:9000
2. Click **Create Project**
3. Use same project key as in command: `ablk-compliance-system`

### Analysis Takes Too Long

**Solution:** Skip large folders

```bash
npx sonarqube-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=$SONAR_TOKEN \
  -Dsonar.exclusions=**/docs/**,**/Planning/**
```

### Coverage Report Not Found

**Solution 1:** Generate coverage first

```bash
npm run test:coverage
```

**Solution 2:** Check path in properties

```properties
# Check this path exists:
sonar.javascript.lcov.reportPaths=src/api/coverage/lcov.info
```

**Solution 3:** Create empty coverage if needed

```bash
mkdir -p src/api/coverage
```

---

## 🚀 Workflow Integration

### Before Committing Code

**Step 1: Run tests with coverage**

```bash
npm run test:coverage
```

**Step 2: Run SonarQube analysis**

```bash
export SONAR_TOKEN=<your-token>
npm run sonar
```

**Step 3: Check dashboard**
Open http://localhost:9000/projects/ablk-compliance-system

**Step 4: Fix critical issues**

- Bugs must be fixed
- Vulnerabilities must be fixed
- Aim for quality gate pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add feature with SonarQube quality check"
git push
```

---

## 📋 NPM Scripts Setup

Add to `compliance-system/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "sonar": "npm run test:coverage && npx sonarqube-scanner",
    "sonar:check": "curl -s http://localhost:9000/api/projects/search?keys=ablk-compliance-system | jq '.components[0]' || echo '❌ Project not found'",
    "sonar:install": "npm install --save-dev sonarqube-scanner"
  }
}
```

Then use:

```bash
npm run sonar              # Run full analysis
npm run sonar:check       # Check if project exists
npm run test:coverage     # Just generate coverage
```

---

## 🔄 Quality Gate Rules

Set up quality gate that enforces:

- ✅ New hotspot review: 100%
- ✅ Bugs: 0
- ✅ Vulnerabilities: 0
- ✅ Code coverage: ≥80%
- ✅ Duplicated lines: <3%

**To configure:**

1. Go to http://localhost:9000/admin/qualitygates
2. Create new or edit existing gate
3. Add conditions
4. Associate with project

---

## 📱 Mobile App / IDE Integration

### VS Code SonarLint Extension

1. Install extension: **SonarLint** (sonarsource.sonarlint-vscode)
2. Go to Settings → SonarLint
3. Add connection:
   - **Server Type:** SonarQube
   - **Server URL:** http://localhost:9000
   - **Token:** Your SonarQube token
4. Select project: `ablk-compliance-system`

Benefits:

- Real-time code analysis in editor
- Issues highlighted as you type
- Auto-fix suggestions
- Same rules as server

### IntelliJ / WebStorm

1. Install **SonarLint** plugin
2. Configure connection to localhost:9000
3. Bind to project `ablk-compliance-system`
4. Analyze files on-the-fly

---

## 📚 Additional Resources

- **SonarQube Docs:** https://docs.sonarqube.org/
- **SonarQube Scanner:** https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/
- **Quality Gates:** https://docs.sonarqube.org/latest/user-guide/quality-gates/
- **Rules Guide:** https://rules.sonarsource.com/

---

## ✅ Local SonarQube Server Status

**URL:** http://localhost:9000  
**Project Key:** `ablk-compliance-system`  
**Project Name:** Ableka Lumina - Compliance System

**Configuration:** See `sonar-project.properties` in compliance-system folder

**Last Updated:** February 26, 2026
