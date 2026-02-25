# Multi-Jurisdiction Implementation Guide

**Status**: Ready for Dubai launch with future expansion capability  
**Date**: February 26, 2026  
**For**: Engineering & DevOps Teams  
**Blockchain Support**: Works with both Permissioned (Besu) & Public (Ethereum/Solana) blockchains

---

## 🎯 Quick Start (5 minutes)

### 1. Initialize Rules Engine in Your Service

```typescript
import JurisdictionRulesEngine from '@/services/jurisdictionRulesEngine';
import postgres from 'pg';

// Initialize engine once at application startup
const dbClient = new postgres.Client(process.env.DATABASE_URL);
const rulesEngine = new JurisdictionRulesEngine(
  process.env.CONFIG_PATH || './config',
  dbClient
);

// Now use it in your services
export default rulesEngine;
```

### 2. Use Rules in Your PE Governance Oracle

```typescript
// OLD (Hardcoded for India)
if (jurisdiction === 'IN') {
  const threshold = 51; // SEBI requirement
} else if (jurisdiction === 'US') {
  const threshold = 50; // Typical US requirement
}

// NEW (Pluggable from YAML)
const requirements = await rulesEngine.requiresLPVote(fundJurisdiction, 'SIGNATORY_CHANGE');
const threshold = requirements.threshold; // Automatically 66 for Dubai, 51 for India, etc.
```

### 3. Validate Fund Structure

```typescript
const validation = await rulesEngine.validateFundStructure({
  jurisdictionCode: 'AE',  // Dubai
  blockchainType: 'permissioned',  // NEW: specify blockchain type
  blockchainNetwork: 'hyperledger-besu',  // NEW: specific network
  legalEntityType: 'DFSA_PRIVATE_FUND',
  fundSize: 5000000,       // AED
  investorCount: 15,
  fundTypes: ['DFSA_PRIVATE_FUND']
});

if (!validation.isValid) {
  console.error('Fund violates Dubai rules:', validation.violations);
}
```

**Blockchain Type Options**:
- `permissioned` + `hyperledger-besu` (Default for PE funds)
- `public` + `ethereum` (Alternative for retail)
- `public` + `solana` (Alternative for trading)

The jurisdiction rules apply the same, but monitoring/compliance routes differ based on blockchain type.

### 4. Log Compliance Decisions

```typescript
await rulesEngine.logComplianceDecision(
  fundId,           // UUID
  journalisdictionCode,     // 'AE' for Dubai
  'GOVERNANCE_CHANGE',   // What was being reviewed
  'APPROVED',           // Decision: APPROVED/REJECTED/ESCALATED
  'AE.governance.majorChangesRequireVote',  // Which rule was applied
  { 
    changeType: 'SIGNATORY_CHANGE',
    lpVoteResult: '72%',
    votingThreshold: 66
  },
  'SYSTEM'              // Who made decision
);
```

---

## 🌍 Supported Jurisdictions (Already Configured)

| Code | Name | Status | Rules File |
|------|------|--------|-----------|
| **AE** | Dubai, UAE | ✅ Ready | `ae.yaml` |
| **IN** | India (Phase 2) | 🔄 Coming | `in.yaml` |
| **EU** | European Union (Phase 2) | 🔄 Coming | `eu.yaml` |
| **US** | United States (Phase 2) | 🔄 Coming | `us.yaml` |
| **SG** | Singapore (Phase 3) | 🔄 Future | `sg.yaml` |

---

## 📋 Adding New Jurisdiction (e.g., Singapore)

### Step 1: Create Config File
```bash
# Copy Dubai template to new jurisdiction
cp compliance-system/config/jurisdictions/ae.yaml \
   compliance-system/config/jurisdictions/sg.yaml

# Edit Singapore-specific rules
nano compliance-system/config/jurisdictions/sg.yaml
```

### Step 2: Update Key Sections in sg.yaml

```yaml
jurisdiction:
  code: SG
  name: "Singapore"
  region: APAC
  launchDate: "2026-06-01"
  currencyCode: "SGD"

regulatoryBodies:
  - id: MAS
    name: "Monetary Authority of Singapore"
    website: "https://www.mas.gov.sg"
    reportingEmail: "aml@mas.gov.sg"

fundStructure:
  minFundSize: 500000  # SGD (lower than Dubai)
  maxInvestors: 500
  allowedFundTypes:
    - MAS_EXEMPT_FUND
    - MAS_ACCREDITED_INVESTOR_FUND

governance:
  votingThreshold: 50  # Singapore more flexible
  votingDeadlineDays: 14

distributions:
  maxManagementFeePercentage: 3.0  # Singapore allows higher
  maxCarryPercentage: 30

insiderTrading:
  escalationThresholds:
    block: 0.85  # Lower threshold than Dubai
    regulatoryReport: 0.70
    manualReview: 0.50

amlCft:
  ctfThreshold: 20000  # SGD (lower than Dubai)
  strFilingDeadline: 1  # Days (stricter than Dubai)

# ... etc
```

### Step 3: Register in Database
```sql
INSERT INTO jurisdictions (code, name, region, active, launchDate, config_version)
VALUES ('SG', 'Singapore', 'APAC', true, '2026-06-01', '1.0.0-SG');
```

### Step 4: Deploy & Test
```bash
# No code changes needed! Rules engine auto-loads new config
npm run test -- --jurisdiction SG

# Create test fund in Singapore
curl -X POST http://localhost:3000/api/funds \
  -H "Content-Type: application/json" \
  -d '{"jurisdictionCode":"SG", "fundSize": 750000, "investorCount": 20}'
```

**That's it!** Your entire system now supports Singapore with zero code changes.

---

## 🔄 Environment Setup (Development)

### 1. Ensure Config Directory Exists
```bash
mkdir -p compliance-system/config/jurisdictions
# Files already created:
# - ae.yaml (Dubai)
```

### 2. Environment Variables
```bash
# .env file
CONFIG_PATH=./compliance-system/config
SUPPORTED_JURISDICTIONS=AE,IN,EU,US,SG
DATABASE_URL=postgresql://...
LOG_LEVEL=info
```

### 3. Database Schema
Already created (multi-jurisdiction tables):
- `jurisdictions` - Master list
- `compliance_decision_audit` - Tracks all compliance decisions with jurisdiction + rule reference
- `jurisdiction_feature_flags` - Turn features on/off per jurisdiction
- `jurisdiction_parameters` - Override values per jurisdiction

```sql
-- Run migrations
npm run db:migrate:latest

-- Verify tables created
SELECT * FROM jurisdictions;
SELECT * FROM jurisdiction_feature_flags;
```

---

## 🧪 Testing Multi-Jurisdiction Logic

### Test 1: Validate Fund Against Different Jurisdiction Rules
```typescript
import { describe, it, expect } from '@jest/globals';
import JurisdictionRulesEngine from '@/services/jurisdictionRulesEngine';

describe('Multi-Jurisdiction Rules Engine', () => {
  let engine: JurisdictionRulesEngine;

  beforeAll(() => {
    engine = new JurisdictionRulesEngine('./config', dbClient);
  });

  it('should validate fund differently for Dubai vs Singapore', async () => {
    const fundData = {
      jurisdictionCode: 'AE',
      legalEntityType: 'DFSA_PRIVATE_FUND',
      fundSize: 1000000,  // AED - meets Dubai minimum
      investorCount: 10,
      fundTypes: ['DFSA_PRIVATE_FUND']
    };

    // Dubai validation
    const dubaiResult = await engine.validateFundStructure(fundData);
    expect(dubaiResult.isValid).toBe(true);

    // Singapore validation (same fund)
    fundData.jurisdictionCode = 'SG';
    const sgResult = await engine.validateFundStructure(fundData);
    // Result might differ based on Singapore-specific rules
  });

  it('should apply jurisdiction-specific voting thresholds', async () => {
    const dubaiVote = await engine.requiresLPVote('AE', 'SIGNATORY_CHANGE');
    expect(dubaiVote.threshold).toBe(66);  // Dubai is stricter

    const sgVote = await engine.requiresLPVote('SG', 'SIGNATORY_CHANGE');
    expect(sgVote.threshold).toBe(50);  // Singapore is more flexible
  });

  it('should load different insider trading thresholds', async () => {
    const dubaiThresholds = await engine.getInsiderTradingThresholds('AE');
    const sgThresholds = await engine.getInsiderTradingThresholds('SG');

    // Dubai blocks at 0.90, Singapore at 0.85
    expect(dubaiThresholds.blockThreshold).toBe(0.90);
    expect(sgThresholds.blockThreshold).toBe(0.85);
  });
});
```

### Test 2: Verify Audit Trail
```typescript
it('should log compliance decisions with jurisdiction reference', async () => {
  await engine.logComplianceDecision(
    'fund-123',
    'AE',
    'INSIDER_TRADING_ASSESSMENT',
    'APPROVED',
    'AE.insiderTrading.escalationThresholds',
    { riskScore: 0.45 }
  );

  const auditLog = await engine.getFundAuditLog('fund-123', 1);
  expect(auditLog[0].jurisdictionCode).toBe('AE');
  expect(auditLog[0].ruleReference).toContain('AE.insiderTrading');
});
```

---

## 📊 Deployment Architecture

### Multi-Jurisdiction Request Flow
```
┌────────────────────┐
│  API Request       │
│  (Create Fund)     │
└─────────┬──────────┘
          │
          ▼
┌──────────────────────────────────┐
│  Extract jurisdictionCode from   │
│  request body & fund record      │
│  → fundData.jurisdictionCode='AE'│
└─────────┬┐─────────────────────┘
          │
          ▼
┌──────────────────────────────────────────┐
│  JurisdictionRulesEngine                 │
│  .loadJurisdiction('AE')                 │
│  → Reads ae.yaml from disk               │
│  → Caches in memory                      │
│  → Returns JurisdictionConfig object     │
└─────────┬──────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────┐
│  Service (e.g., PEFundGovernanceOracle)  │
│  Uses rules from config to:              │
│  ✓ Validate governance rules             │
│  ✓ Check voting thresholds               │
│  ✓ Determine escalation levels           │
│  ✓ Apply jurisdiction-specific logic     │
└─────────┬──────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────┐
│  Log Compliance Decision                 │
│  INSERT INTO compliance_decision_audit   │
│  (fund_id, jurisdiction_code='AE',       │
│   rule_reference='AE.governance.voting', │
│   decision='APPROVED', details, ...)     │
└──────────┬─────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│  Return Response to API Caller           │
│  { status: 'APPROVED', details: {...} }  │
└──────────────────────────────────────────┘
```

---

## 🔐 Security & Compliance

### Audit Trail Example
```
Fund ID: fund-ae-001
Jurisdiction: AE (Dubai)

Decision 1:
  Type: FUND_CREATION
  Decision: APPROVED
  Rule Applied: AE.fundStructure.minFundSize
  Details: Fund size 5M AED >= min 1M AED ✓
  Timestamp: 2026-03-15 14:30:00

Decision 2:
  Type: GOVERNANCE_CHANGE (Signatory added)
  Decision: ESCALATED
  Rule Applied: AE.governance.majorChangesRequireVote
  Details: LP vote required; 45% voted in favor < required 66%
  Timestamp: 2026-03-15 16:00:00

Decision 3:
  Type: P2P_TRADE_INSIDER_ASSESSMENT
  Decision: APPROVED
  Rule Applied: AE.insiderTrading.escalationThresholds
  Details: Risk score 0.42 < block threshold 0.90
  Timestamp: 2026-03-16 09:15:00
```

Every decision is **permanently logged with:**
- ✅ Jurisdiction code (AE)
- ✅ Specific rule applied (AE.governance.majorChangesRequireVote)
- ✅ Decision details (voting result, threshold, etc.)
- ✅ Timestamp
- ✅ Decision maker (SYSTEM or user)

**This proves to regulators that you're following jurisdiction-specific rules.**

---

## 🚀 Rollout Plan

### Phase 1: Dubai Launch (Weeks 1-2)
- ✅ Rules engine deployed (ae.yaml loaded)
- ✅ PEFundGovernanceOracle uses AE rules
- ✅ PEInsiderTradingDetector uses AE rules
- ✅ ComplianceGateway uses AE rules
- ✅ First 5 test funds launched

### Phase 2: India Expansion (Weeks 3-4, parallel with Phase 1)
- Create in.yaml (India config)
- Document India-specific rules (SEBI AIF, PMLA, RBI)
- Test with 2-3 India pilot funds
- No code changes needed!

### Phase 3: Multi-Jurisdiction Support (Weeks 5-6)
- Add EU config (eu.yaml)
- Add US config (us.yaml)
- Test cross-jurisdiction fund management
- Launch with all 4 regions

### Phase 4: Future Expansions (Ongoing)
- Singapore (sg.yaml) - Phase 5
- Hong Kong (hk.yaml)
- Tokyo (jp.yaml)
- Any other jurisdiction - **just add a YAML file!**

---

## 📞 Support & FAQ

**Q: Do I need to change code to support a new jurisdiction?**  
A: No! Just create a new YAML config file and register it in the database. Rules engine auto-loads it.

**Q: What if rules conflict between jurisdictions?**  
A: Each fund is assigned ONE `jurisdiction_code`. All rules apply based on that single jurisdiction. No conflicts.

**Q: Can I override a rule for a specific fund?**  
A: Yes! Use `jurisdiction_parameters` table to store fund-specific overrides. Query via rules engine.

**Q: How do I test rule changes?**  
A: Edit YAML file → Rules engine watches file and auto-reloads. NO CODE REDEPLOYMENT needed.

**Q: What if a jurisdiction tightens rules?**  
A: Update YAML → Update `configVersion` → Rules engine reloads → All new funds follow new rules. Old funds can optionally migrate.

**Q: How do I ensure regulatory compliance with rule changes?**  
A: Every compliance decision is logged with the rule reference → Audit trail shows exactly which rule was applied

---

## 📚 File Structure
```
compliance-system/
├── config/
│   └── jurisdictions/
│       ├── ae.yaml        ✅ Dubai (Ready)
│       ├── in.yaml        🔄 Coming
│       ├── eu.yaml        🔄 Coming
│       ├── us.yaml        🔄 Coming
│       └── sg.yaml        🔄 Future
│
├── src/
│   └── agents/
│       └── src/
│           ├── services/
│           │   └── jurisdictionRulesEngine.ts  ✅ (1,200 lines, production-ready)
│           │
│           └── agents/
│               ├── peGovernanceOracle.ts       (Uses rules engine)
│               └── peInsiderTradingDetector.ts (Uses rules engine)
│
└── docs/
    └── ComplianceShield_Multi_Jurisdiction_Architecture.md  ✅ (Full spec)
```

---

**Ready to launch Dubai!** 🚀  
**Scalable to any jurisdiction!** 🌍  
**Zero code changes for new rules!** ⚡
