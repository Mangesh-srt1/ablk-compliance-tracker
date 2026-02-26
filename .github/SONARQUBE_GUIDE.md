# SonarQube Integration Guide for Ableka Lumina

This document is referenced in copilot-instructions.md and provides quick troubleshooting for SonarQube code quality analysis.

## Known Issues & Solutions

### Issue 1: Authentication Failure

**Error:**
```
ERROR: Not authorized. Analyzing this project requires authentication.
Please check the user token in the property 'sonar.token' or the credentials
in the properties 'sonar.login' and 'sonar.password'.
```

**Solution:**
Add credentials to `sonar-project.properties` in the root directory:

```properties
sonar.host.url=http://localhost:9000
sonar.token=YOUR_TOKEN_HERE
# OR (deprecated but works):
sonar.login=admin
sonar.password=admin123
```

**To generate token:**
1. Open http://localhost:9000
2. Login with admin credentials
3. Navigate to: Account → Security → Tokens
4. Click "Generate"
5. Copy the token (starts with `squ_`)
6. Add to `sonar-project.properties`: `sonar.token=squ_xxxxx`

---

### Issue 2: Language Pattern Conflicts

**Error:**
```
ERROR: Language of file 'src\agents\src\agents\amlAgent.ts' can not be decided
as the file matches patterns of both sonar.lang.patterns.js and sonar.lang.patterns.ts
```

**Root Cause:**
Both JavaScript and TypeScript patterns matching the same file extensions cause ambiguity.

**Solution:**
Add explicit language pattern separation to `sonar-project.properties`:

```properties
# CRITICAL - must be separated:
sonar.lang.patterns.ts=**/*.ts,**/*.tsx
sonar.lang.patterns.js=**/*.js,**/*.jsx,**/*.mjs
```

This ensures:
- `.ts` and `.tsx` files are analyzed as TypeScript
- `.js`, `.jsx`, `.mjs` files are analyzed as JavaScript
- No overlap or ambiguity

---

### Issue 3: Deprecated Credentials Warning

**Warning:**
```
WARN: The properties 'sonar.login' and 'sonar.password' are deprecated 
and will be removed in the future. Please pass a token with the 'sonar.token' 
property instead.
```

**Solution:**
Replace login/password with token authentication:

**OLD (deprecated):**
```properties
sonar.login=admin
sonar.password=admin123
```

**NEW (recommended):**
```properties
sonar.token=squ_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Get token from: http://localhost:9000/admin/credentials

---

### Issue 4: TypeScript verbatimModuleSyntax Compilation Errors

**Error:**
```
ERROR: ECMAScript imports and exports cannot be written in a CommonJS file 
under 'verbatimModuleSyntax'. Adjust the 'type' field in the nearest 
'package.json' to make this file an ECMAScript module, or adjust your 
'verbatimModuleSyntax', 'module', and 'moduleResolution' settings in TypeScript.
```

**Root Cause:**
TypeScript strict mode configuration conflicts with how some libraries are imported in CommonJS modules.

**Solution:**
Update `tsconfig.json` in `src/api/` directory:

```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": false,
    "module": "commonjs",
    "target": "ES2020",
    "moduleResolution": "node"
  }
}
```

**Key Settings:**
- `"verbatimModuleSyntax": false` - Allows flexible import syntax
- `"module": "commonjs"` - Uses CommonJS for compilation
- `"moduleResolution": "node"` - Resolves modules like Node.js

---

## SonarQube Configuration Template

**File: `sonar-project.properties`** (create in project root)

```properties
# Project Identification
sonar.projectKey=ablk-compliance-system
sonar.projectName=Ableka Lumina - Compliance System
sonar.projectVersion=1.0.0

# Server & Authentication
sonar.host.url=http://localhost:9000
sonar.token=YOUR_TOKEN_HERE
# sonar.token generated from: http://localhost:9000/admin/credentials

# Source Code & Tests
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=**/__tests__/**/*.test.ts,**/*.spec.ts
sonar.sourceEncoding=UTF-8

# **CRITICAL** - Language Pattern Separation
# Must be separated to avoid conflicts
sonar.lang.patterns.ts=**/*.ts,**/*.tsx
sonar.lang.patterns.js=**/*.js,**/*.jsx,**/*.mjs

# Coverage Reports
sonar.javascript.lcov.reportPaths=src/*/coverage/lcov.info
sonar.typescript.tsconfigPath=tsconfig.json

# Exclusions (don't analyze these)
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,**/.husky/**,**/docs/**
sonar.test.exclusions=src/**/node_modules/**,src/**/dist/**
sonar.coverage.exclusions=**/types/**,**/interfaces/**,**/constants/**,**/*.d.ts

# Performance Tuning
sonar.host.timeout=600
sonar.ws.timeout=600
sonar.verbose=false
```

---

## Running SonarQube Analysis

### Option 1: Using npm Scripts

```bash
cd compliance-system
npm run sonar    # Runs tests + coverage + SonarQube analysis
```

### Option 2: Direct Scanner Invocation

```bash
cd compliance-system
npx sonarqube-scanner    # Uses sonar-project.properties
```

### View Results

Open browser: http://localhost:9000/projects/ablk-compliance-system

---

## Troubleshooting Checklist

Before running analysis, verify:

- [ ] SonarQube server is running: http://localhost:9000 accessible
- [ ] `sonar-project.properties` exists in `compliance-system/` (project root)
- [ ] `sonar.token` is set (or `sonar.login`/`sonar.password` for fallback)
- [ ] `sonar.lang.patterns.ts` and `sonar.lang.patterns.js` are **SEPARATED**
- [ ] All `tsconfig.json` files have `"verbatimModuleSyntax": false`
- [ ] Test coverage report generated: `coverage/lcov-report/` directory exists
- [ ] No stale npm modules: `rm -rf node_modules && npm install`

**If analysis still fails:**
1. Check sonar-project.properties for syntax errors
2. Verify sonar.token is valid (not expired)
3. Ensure sonar.lang.patterns are not overlapping
4. Check TypeScript configuration in tsconfig.json
5. View server logs: http://localhost:9000/admin/system → Logs

---

## Automatic Copilot Handling

**For Copilot to automatically resolve SonarQube issues:**

1. Reference this file in copilot-instructions.md
2. When user mentions "SonarQube", "code quality", or "analysis":
   - Check for authentication errors → Apply Issue 1 solution
   - Check for language conflicts → Apply Issue 2 solution
   - Check for deprecated warnings → Apply Issue 3 solution
   - Check for TypeScript errors → Apply Issue 4 solution
3. Verify sonar-project.properties is properly configured
4. Suggest running: `npm run sonar`
5. Provide direct link: http://localhost:9000/projects/ablk-compliance-system

---

## Quick Decision Tree

```
Does SonarQube server run?
├─ NO → Start: docker run -d -p 9000:9000 sonarqube
│
└─ YES → Does sonar-project.properties exist?
   ├─ NO → Create from template (copy Configuration section)
   │
   └─ YES → Is sonar.token set?
      ├─ NO → Generate at http://localhost:9000/admin/credentials
      │        → Add to sonar-project.properties
      │
      └─ YES → Are sonar.lang.patterns.ts/js separated?
         ├─ NO → Add both patterns separately (Issue 2 solution)
         │
         └─ YES → Does tsconfig.json have verbatimModuleSyntax: false?
            ├─ NO → Update tsconfig.json (Issue 4 solution)
            │
            └─ YES → Run: npm run sonar
               │
               ├─ SUCCESS → View http://localhost:9000/projects
               │
               └─ FAILURE → Check error message
                           → Match to Issue 1-4 above
                           → Apply solution
                           → Retry
```

---

## Files Involved

- **Main config:** `sonar-project.properties` (project root)
- **TypeScript config:** `src/api/tsconfig.json`
- **Agents config:** `src/agents/tsconfig.json`
- **Dashboard config:** `src/dashboard/tsconfig.json`
- **npm scripts:** `package.json` (root level)
- **Instructions:** `.github/copilot-instructions.md` (references this file)

---

## References

- **SonarQube Official Docs:** https://docs.sonarsource.com/sonarqube/latest/
- **Scanner CLI Guide:** https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/
- **Quality Gates:** https://docs.sonarsource.com/sonarqube/latest/user-guide/quality-gates/

---

## GitHub Actions Integration

To automatically run SonarQube analysis in CI/CD, add this to `.github/workflows/analyze.yml`:

```yaml
name: Code Quality Analysis

on: [push, pull_request]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with coverage
        run: npm run test:coverage
      
      - name: Run SonarQube Analysis
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        run: npx sonarqube-scanner
```

**Required GitHub Secret:** `SONAR_TOKEN` (from http://localhost:9000/admin/credentials)

---

**Document Last Updated:** February 26, 2026  
**For:** Ableka Lumina Compliance Engine  
**Related:** copilot-instructions.md (SonarQube Integration section)
