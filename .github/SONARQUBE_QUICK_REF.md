# SonarQube Quick Reference

**Local Server:** `http://localhost:9000`  
**Project Key:** `ablk-compliance-system`

## 🚀 Run Analysis (One Command)

```bash
cd compliance-system
export SONAR_TOKEN=<your-token>
npm run sonar
```

## 📋 Step-by-Step Setup

### 1️⃣ Create Project (First Time Only)
- Go to http://localhost:9000
- Click **Create Project**
- Key: `ablk-compliance-system`
- Click **Create**

### 2️⃣ Create Token
- Go to http://localhost:9000/admin/credentials
- Click **Generate Token**
- Name: `local-analysis-token`
- Copy token

### 3️⃣ Run Analysis
```bash
cd compliance-system
export SONAR_TOKEN=squ_xxxxx  # Your token from step 2
npm run sonar
```

### 4️⃣ View Results
- Open http://localhost:9000/projects/ablk-compliance-system
- Check metrics: bugs, coverage, duplication, etc.

## 📚 Common Commands

```bash
# Full analysis with coverage
npm run sonar

# Check if project exists
npm run sonar:check

# Just generate coverage (no analysis)
npm run test:coverage

# Install sonarqube-scanner
npm run sonar:install
```

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot connect to localhost:9000" | Check if SonarQube container is running: `docker ps` |
| "Invalid token" | Regenerate at http://localhost:9000/admin/credentials |
| "Project not found" | Create project first (see Step 1 above) |
| Coverage not found | Run `npm run test:coverage` before analysis |

## 📖 Full Guide

See `SONARQUBE_SETUP.md` for complete documentation including:
- Token management
- Configuration explained
- Understanding results
- IDE integration
- Quality gates
- CI/CD workflow

---

**Status:** ✅ Local SonarQube Server (http://localhost:9000)  
**Configuration:** `sonar-project.properties`
