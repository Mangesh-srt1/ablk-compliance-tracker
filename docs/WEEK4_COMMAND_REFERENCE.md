# WEEK 4 COMMAND REFERENCE GUIDE
**Quick Commands for Each Theme**

---

## 📊 BUILD & VALIDATION COMMANDS

### Verify Build Quality (Run Daily at 4 PM)
```bash
# Check TypeScript compilation (must be 0 errors)
npm run build

# Check ESLint style guide (must be 0 violations)
npm run lint

# Check TypeScript strict mode (must be 0 type errors)
npm run typecheck

# Run all tests
npm run test
```

### Git Workflow (Commit Daily)
```bash
# See current status
git status

# Add all changes
git add -A

# Commit with meaningful message
git commit -m "theme: description-of-today-work"

# View last 5 commits
git log --oneline -5

# Push to remote
git push origin main
```

---

## 🗒️ DOCUMENTATION GENERATION

### Monday: Generate Swagger UI
```bash
# Install swagger tools (if needed)
npm install --save-dev swagger-jsdoc swagger-ui-express

# Option 1: If using swagger-jsdoc with JSDoc comments
npx swagger-jsdoc -d swaggerDefinition.js -f 'src/**/*.{js,ts}' -o openapi.yaml

# Option 2: Validate existing OpenAPI spec
npx swagger-ui-express --port 8080 Planning\ docs/Phase\ 1\ Planning/Week\ 4/OpenAPI_Spec.yaml

# Option 3: If spec exists in YAML
npx http-server --port 8080  # Serve from directory with index.html

# Test: Visit http://localhost:8080 to verify
```

### Create Documentation Files
```bash
# Create new markdown file
code Planning\ docs/Phase\ 1\ Planning/Week\ 4/PRD_Validation_Checklist.md

# Create executive summary
code Planning\ docs/Phase\ 1\ Planning/Week\ 4/Executive_Summary_Week4.md

# Create compliance audit final
code Planning\ docs/Phase\ 1\ Planning/Week\ 4/Compliance_Audit_Report.md
```

---

## 💾 DATABASE OPTIMIZATION (Tuesday)

### Create Reporting Views
```bash
# Connect to PostgreSQL and create views
psql -U postgres -d compliance_db -f scripts/create-reporting-views.sql

# Or manually:
psql -U postgres -d compliance_db << 'EOF'
CREATE MATERIALIZED VIEW compliance_decisions_by_jurisdiction_daily AS
SELECT jurisdiction_code, date_trunc('day', created_at) as decision_date,
       COUNT(*) as total_decisions,
       COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
       AVG(risk_score) as avg_risk_score
FROM kyc_records 
GROUP BY jurisdiction_code, decision_date;

-- Refresh the view
REFRESH MATERIALIZED VIEW compliance_decisions_by_jurisdiction_daily;
EOF
```

### Query Optimization
```bash
# Find slow queries (use PostgreSQL logs)
tail -f logs/postgresql/*.log | grep "duration: "

# Run query analysis
psql -U postgres -d compliance_db -c "EXPLAIN ANALYZE SELECT * FROM kyc_records LIMIT 10;"

# Add index to frequently queried column
psql -U postgres -d compliance_db << 'EOF'
CREATE INDEX idx_kyc_wallet ON kyc_records (wallet_address);
CREATE INDEX idx_kyc_jurisdiction ON kyc_records (jurisdiction_code);
CREATE INDEX idx_aml_risk ON aml_checks (risk_score);
ANALYZE;  -- Update statistics
EOF

# Verify index creation
psql -U postgres -d compliance_db -c "\d+ kyc_records"
```

### Full-Text Search Setup
```bash
# Create full-text search index
psql -U postgres -d compliance_db << 'EOF'
-- Add tsvector column for full-text search
ALTER TABLE kyc_records ADD COLUMN search_vector tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(entity_name, '') || ' ' || 
                          COALESCE(wallet_address, ''))
  ) STORED;

-- Create index
CREATE INDEX idx_search_vector ON kyc_records USING GIN (search_vector);

-- Test full-text search
SELECT * FROM kyc_records 
WHERE search_vector @@ to_tsquery('english', 'john');
EOF
```

---

## 🔒 SECURITY HARDENING (Wednesday)

### Enable Encryption at Rest
```bash
# Install pgcrypto extension
psql -U postgres -d compliance_db << 'EOF'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive columns
ALTER TABLE kyc_records ADD COLUMN wallet_address_encrypted bytea;

-- Create function to encrypt
CREATE OR REPLACE FUNCTION encrypt_wallet(plain_text TEXT)
RETURNS bytea AS $$
BEGIN
  RETURN pgp_sym_encrypt(plain_text, 'your-encryption-key');
END;
$$ LANGUAGE plpgsql;

-- Encrypt existing data
UPDATE kyc_records 
SET wallet_address_encrypted = encrypt_wallet(wallet_address) 
WHERE wallet_address_encrypted IS NULL;
EOF
```

### Add Security Headers Middleware
```bash
# In src/api/src/index.ts, add helmet middleware:
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameGuard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
}));
```

### Implement Rate Limiting per Jurisdiction
```bash
# npm install ratelimit storage (if needed)
npm install redis express-rate-limit

# In src/api/src/middleware/rateLimiter.ts:
# Create jurisdiction-specific limits
JURISDICTION_LIMITS = {
  'AE': { windowMs: 60000, maxRequests: 100 },  // Stricter
  'US': { windowMs: 60000, maxRequests: 200 },  // Standard
  'IN': { windowMs: 60000, maxRequests: 150 },  // Medium
};
```

---

## 🔗 BLOCKCHAIN INTEGRATION (Thursday)

### Test Besu Permissioned Chain
```bash
# Assuming client provides Besu RPC endpoint
export BESU_RPC_URL="https://client-validator.internal:8545"

# Test connection
curl -X POST $BESU_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_blockNumber",
    "params": [],
    "id": 1
  }'

# Run integration tests
npm run test -- --testPathPattern=blockchain
```

### Test Chainalysis Integration
```bash
# Set API key
export CHAINALYSIS_API_KEY="your-api-key"

# Run Chainalysis tests
npm run test -- --testPathPattern=chainalysis

# Manual test: Lookup wallet risk
curl -X POST https://api.chainalysis.com/v2/entities \
  -H "Authorization: Bearer $CHAINALYSIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": ["0x1234567890abcdef..."]
  }'
```

### Performance Benchmark
```bash
# Run stress tests (from Week 3 deliverable)
cd compliance-system/src/api/src/__tests__

# Ramp-up test (gradually increase load)
npx ts-node stress-tests.ts --testType ramp-up --duration 60 --targetConcurrency 100

# Constant load test
npx ts-node stress-tests.ts --testType constant --duration 60 --concurrency 50

# Spike test
npx ts-node stress-tests.ts --testType spike --duration 60 --spikeLoad 200
```

---

## 🌍 INTERNATIONALIZATION (Friday)

### Setup i18n Framework
```bash
# Install i18n packages
npm install i18next i18next-backend i18next-browser-language-detector

# Create translation files
mkdir -p src/locales/{en,ar,zh,hi,es}

# Create translation files for each language
cat > src/locales/en/translation.json << 'EOF'
{
  "kyc": {
    "title": "Know Your Customer",
    "verify": "Verify Identity",
    "approved": "Approved"
  },
  "aml": {
    "title": "Anti-Money Laundering",
    "risk_high": "High Risk"
  }
}
EOF

# Create similar files for ar, zh, hi, es...
```

### Create Jurisdiction YAML Configs
```bash
# Create jurisdiction folder
mkdir -p config/jurisdictions

# Dubai DFSA Config
cat > config/jurisdictions/ae-dubai.yaml << 'EOF'
jurisdiction:
  code: AE
  name: "United Arab Emirates - Dubai"
  regulator: "DFSA"
  
kyc:
  docRequirements: [PASSPORT, PROOF_OF_ADDRESS, UAE_ID]
  minAgeYears: 21
  
aml:
  sanctionsLists: [OFAC_SDN, UN_SECURITY_COUNCIL, DFSA_PERSONS]
  PEPCheckRequired: true
  
governance:
  majorChangesRequireVote: true
  votingThreshold: 66
EOF

# Create similar files for us-reg-d.yaml, in-sebi.yaml, eu-gdpr.yaml, sa-cma.yaml...
```

### Load & Use Jurisdictions
```bash
# In your agent/service code:
import fs from 'fs';
import yaml from 'yaml';

const loadJurisdictionConfig = (code: string) => {
  const content = fs.readFileSync(`config/jurisdictions/${code.toLowerCase()}.yaml`, 'utf8');
  return yaml.parse(content);
};

const aeConfig = loadJurisdictionConfig('AE');
console.log(aeConfig.kyc.docRequirements); // ['PASSPORT', 'PROOF_OF_ADDRESS', ...]
```

---

## 📊 DASHBOARD & MONITORING (Friday)

### Configure Advanced Prometheus Queries
```bash
# In src/monitoring/prometheus.yml:
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Add custom recording rules for compliance metrics
rule_files:
  - 'compliance_rules.yml'

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['localhost:4000']
      
  - job_name: 'agents'
    static_configs:
      - targets: ['localhost:4002']
```

### Create Grafana Dashboards
```bash
# Access Grafana at localhost:3000 (user: admin, pass: admin)

# Add Prometheus data source:
# Settings → Data Sources → Add Prometheus
# URL: http://prometheus:9090

# Create dashboard with panels:
# 1. API Request Rate
# PromQL: rate(http_requests_total[5m])

# 2. KYC Decision Success Rate
# PromQL: rate(kyc_decisions_approved[5m]) / rate(kyc_decisions_total[5m])

# 3. Blockchain Monitoring Latency
# PromQL: histogram_quantile(0.95, rate(blockchain_monitoring_duration_seconds_bucket[5m]))

# 4. Database Connection Pool
# PromQL: db_connection_pool_available_connections
```

---

## 🔄 DAILY WORKFLOW (Use Every Day 4:30 PM)

```bash
#!/bin/bash
# Daily completion checklist script

echo "=== WEEK 4 DAILY COMPLETION CHECKLIST ==="

# 1. Verify build
echo "[1/4] Verifying build..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed! Fix TypeScript errors."
  exit 1
fi

# 2. Run tests
echo "[2/4] Running tests..."
npm run test -- --coverage

# 3. Check lint
echo "[3/4] Checking code style..."
npm run lint
if [ $? -ne 0 ]; then
  echo "⚠️  Lint issues found. Running npm run lint:fix..."
  npm run lint:fix
fi

# 4. Commit progress
echo "[4/4] Committing progress..."
git add -A
git commit -m "Week 4: Daily progress $(date +%A)"
git log --oneline -1

echo "✅ Daily completion check passed!"
```

---

## 🚨 TROUBLESHOOTING

### TypeScript Build Fails
```bash
# Clear cache and rebuild
rm -rf coverage dist
npm run build

# If issues persist, check types:
npx tsc --noEmit
```

### Tests Failing
```bash
# Run with verbose output
npm run test -- --verbose

# Run specific test
npm run test -- --testNamePattern="KYC"

# Reset test database
npm run db:reset
```

### Docker Issues
```bash
# Verify containers running
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f api

# Restart all services
docker-compose -f docker-compose.dev.yml restart

# Full reset (WARNING: deletes data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Database Connection Issues
```bash
# Check PostgreSQL running
psql -U postgres -l

# Test connection
npm run db:test-connection

# View connection pool stats
curl http://localhost:4000/api/health/db
```

---

## 📌 KEY FILES FOR WEEK 4

**Documentation to Update/Create**:
- [ ] `PRD_Validation_Checklist.md` (Monday)
- [ ] `Executive_Summary_Week4.md` (Monday)
- [ ] `Database_Optimization_Report.md` (Tuesday)
- [ ] `SECURITY_HARDENING_CHECKLIST.md` (Wednesday)
- [ ] `Blockchain_Integration_Guide.md` (Thursday)
- [ ] `i18n_Framework_Setup.md` (Friday)
- [ ] `WEEK4_COMPLETION_REPORT.md` (Friday)

**Code Files to Create/Update**:
- [ ] `src/config/jurisdictions/` (5 YAML files)
- [ ] `scripts/create-reporting-views.sql` (15+ views)
- [ ] `src/api/src/__tests__/blockchain_integration.test.ts`
- [ ] `src/locales/{en,ar,zh,hi,es}/` (i18n files)
- [ ] `src/monitoring/prometheus.yml` (dashboard config)

**Reference Docs**:
- `MASTER_IMPLEMENTATION_PLAN.md`
- `AbekeLumina_RWA_Enterprise_Implementation.md`
- `DEPLOYMENT_GUIDE.md`

---

## ✨ QUICK COPY-PASTE: Monday Start

```bash
# Morning checklist
git status
npm run build  # Verify 0 errors
npm run lint   # Verify 0 violations

# Then start PRD review
code Planning\ docs/Phase\ 1\ Planning/Week\ 4/PRD_Draft_v1.md

# Generate Swagger UI
npx swagger-ui-express --port 8080 Planning\ docs/Phase\ 1\ Planning/Week\ 4/OpenAPI_Spec.yaml

# End of day
git add -A
git commit -m "docs: Complete Phase 1 documentation review and validation"
git log --oneline -1
```

---

**Ready?** Copy any command above and run it! 🚀
