# Ableka Lumina - 3-Phase Enhancement Roadmap
**March 1, 2026 - Comprehensive Feature Completion Plan**

---

## 📊 Overview

| Phase | Features | Effort | Timeline | Status |
|-------|----------|--------|----------|--------|
| **Phase 1** | SAR/CTR Reporting + Auto-generation | 16-24h | This Sprint | 🟢 STARTING |
| **Phase 2** | Continuous Monitoring Alerts + Webhooks | 12-20h | Next Sprint | 🟡 PLANNED |
| **Phase 3** | No-Code Workflow Builder (Full Stack) | 40-60h | Sprint 3 | 🟡 PLANNED |

---

## 🚀 PHASE 1: SAR/CTR Reporting Auto-Generation (16-24h)

### 1.1 Objective
Transform compliance reporting from draft generation to **automated FinCEN CTR/SAR submission** with intelligent trigger conditions.

### 1.2 Deliverables
- ✅ SAR/CTR trigger automation service
- ✅ FinCEN CTR form auto-population
- ✅ SAR threshold logic engine
- ✅ Batch export to regulatory portals
- ✅ Filing status tracking
- ✅ API endpoints for filing operations
- ✅ 100% unit test coverage

### 1.3 Files to Create/Modify

#### New Files
```
src/api/src/services/
├── sarCtrAutomationService.ts         # SAR/CTR trigger automation
├── finCenCtRGenerator.ts              # FinCEN CTR form auto-population
├── sarThresholdEngine.ts              # SAR suspicious activity triggers
└── __tests__/
    ├── sarCtrAutomationService.test.ts
    ├── finCenCtRGenerator.test.ts
    └── sarThresholdEngine.test.ts

src/api/src/types/
├── sar-ctr.types.ts                  # Type definitions for SAR/CTR

config/
├── sar-triggers/
│   ├── us-fincen.yaml               # US FinCEN trigger rules
│   ├── ae-uae-fiu.yaml              # UAE FIU trigger rules
│   ├── in-fiu-ind.yaml              # India FIU trigger rules
│   └── sa-safiu.yaml                # Saudi SAFIU trigger rules

sql/
├── sar-ctr-schema.sql               # SAR/CTR database tables
```

#### Modify Existing Files
- `complianceReportingSystem.ts` - Add auto-filing methods
- `reportRoutes.ts` - Add SAR/CTR filing endpoints
- `transactionMonitoringService.ts` - Integrate SAR trigger detection
- `database.ts` - Add SAR/CTR flag tracking
- `types/errors.ts` - Add SAR/CTR-specific errors

### 1.4 Implementation Details

#### 1.4.1 SAR Trigger Conditions
```typescript
// Automatic SAR generation when ANY of:
- AML risk score ≥ 70 (unusual activity)
- Hawala/informal transfer indicators ≥ 80
- Sanctions list match detected
- Transaction amount exceeds pattern baseline by 300%
- Structuring pattern detected (multiple transfers just below reporting threshold)
- Counterparty is high-risk jurisdiction (FATF grey list)
- Manual escalation by compliance officer
```

#### 1.4.2 CTR Auto-Population Fields
```typescript
// Auto-extract from transaction data:
{
  ctrVersion: "2.0",
  filerId: "CLIENT_ID",
  reportingBank: "banking_institution",
  currency: "USD",
  amount: aggregated_sum, // Auto from transactions > $10k
  entityName: from_entity.name,
  entityType: "individual" | "business",
  sourceCountry: from_address.country,
  destinationCountry: to_address.country,
  transactionCount: number_of_txs,
  reportingDate: Date.now(),
  filingDeadline: Date.now() + (15 * 24 * 60 * 60 * 1000), // 15 days
}
```

#### 1.4.3 Filing Status Workflow
```
DRAFT → PENDING_REVIEW → SUBMITTED → ACKNOWLEDGED (by FIU)
         ↓                            ↓
      REJECTED ← ← ← ← ← ← ← ← ← ← ACKNOWLEDGED_WITH_CORRECTION
                                      ↓
                                   CLOSED
```

### 1.5 API Endpoints (New)

```typescript
// SAR Creation & Filing
POST   /api/v1/reports/sar/auto-generate
  → Auto-create SAR based on transactions + rules
  → Returns: { sarId, draftId, triggers[], narrative }
  
POST   /api/v1/reports/sar/submit
  → Submit SAR draft to FIU (jurisdiction-aware)
  → Returns: { filingId, reference, status, submittedAt }

GET    /api/v1/reports/sar/history
  → List all SARs (with filters: status, date, jurisdiction)
  → Returns: { sars[], pagination }

GET    /api/v1/reports/sar/{sarId}
  → Get detailed SAR record + filing status
  → Returns: { sarDetails, filingStatus, acknowledgmentDate }

// CTR Creation & Filing
POST   /api/v1/reports/ctr/auto-generate
  → Auto-populate CTR form from transactions
  → Returns: { ctrId, formData, estimatedAmount, deadline }

POST   /api/v1/reports/ctr/submit
  → Submit CTR to FinCEN (US) or equiv banking authority
  → Returns: { filingId, reference, status, ackNumber }

GET    /api/v1/reports/ctr/pending
  → List CTRs awaiting submission deadline
  → Returns: { ctrs[], urgency[], deadlinesMissed }

// Batch Operations
POST   /api/v1/reports/batch-submit
  → Submit multiple SARs/CTRs in bulk
  → Returns: { submittedCount, failedCount, results[] }

POST   /api/v1/reports/trigger-rules/test
  → Test current transactions against SAR/CTR triggers
  → Returns: { matched[], riskFactors[], recommendations }
```

### 1.6 Database Schema (New Tables)

```sql
CREATE TABLE sar_reports (
  id UUID PRIMARY KEY,
  entity_id UUID NOT NULL,
  jurisdiction_code CHAR(2) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  aml_score DECIMAL(5,2),
  hawala_score DECIMAL(5,2),
  narrative TEXT,
  transaction_ids UUID[] NOT NULL,
  status VARCHAR(50) DEFAULT 'DRAFT',
  filing_id UUID,
  filing_reference VARCHAR(100),
  submitted_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (entity_id) REFERENCES kyc_records(id)
);

CREATE TABLE ctr_reports (
  id UUID PRIMARY KEY,
  entity_id UUID NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  threshold_amount NUMERIC(20,2),
  aggregated_amount NUMERIC(20,2),
  transaction_ids UUID[] NOT NULL,
  narrative TEXT,
  filing_deadline TIMESTAMP,
  status VARCHAR(50) DEFAULT 'DRAFT',
  filing_id UUID,
  filing_reference VARCHAR(100),
  submitted_at TIMESTAMP,
  ack_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (entity_id) REFERENCES kyc_records(id)
);

CREATE TABLE sar_ctr_filing_audit (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL,
  report_type VARCHAR(10),
  filing_target VARCHAR(100),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  change_reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMP DEFAULT NOW(),
  response_data JSONB
);

CREATE INDEX idx_sar_entity ON sar_reports(entity_id);
CREATE INDEX idx_sar_status ON sar_reports(status);
CREATE INDEX idx_ctr_entity ON ctr_reports(entity_id);
CREATE INDEX idx_ctr_deadline ON ctr_reports(filing_deadline);
```

### 1.7 Trigger Rule Examples (YAML Configuration)

**File: `config/sar-triggers/us-fincen.yaml`**
```yaml
jurisdiction: US
filingTarget: FinCEN BSA E-Filing
triggers:
  amlScoreHigh:
    condition: aml_score >= 70
    narrative: "High-risk AML score indicates potential suspicious activity"
    escalationDays: 30
  
  sanctionsHit:
    condition: sanctions_matches.length > 0
    narrative: "Entity matches US OFAC sanctions list"
    escalationDays: 1  # Immediate escalation
  
  structuring:
    condition: |
      transactions.filter(t => t.amount < 10000).length >= 3 &&
      transactions.every(t => t.timestamp within 30 days)
    narrative: "Pattern consistent with structuring (smurfing) to evade reporting"
    escalationDays: 14
  
  abnormalVelocity:
    condition: current_tx_amount > baseline_avg * 3
    narrative: "Transaction amount is 300% above baseline for entity"
    escalationDays: 14
  
  manualEscalation:
    condition: manual_flag === true
    narrative: "Escalated by compliance officer"
    escalationDays: 30
```

### 1.8 Testing Strategy

#### Unit Tests (100% coverage)
```typescript
describe('SAR/CTR Auto-Generation', () => {
  // 12 tests covering:
  // - Trigger condition evaluation (aml_score, sanctioning, structuring, etc.)
  // - SAR draft generation
  // - CTR form auto-population
  // - Filing reference generation
  // - Status transitions
  // - Error handling (network, validation)
  // - Jurisdiction-specific rules application
  // - Audit trail creation
  // - Batch processing
  // - Idempotency
  // - Rate limiting
  // - Concurrent filing safety
});
```

### 1.9 Success Criteria
- ✅ 100% unit test coverage (12+ tests)
- ✅ All 10 API endpoints functional
- ✅ SAR/CTR auto-generation for all 4 jurisdictions
- ✅ Database schema and migrations applied
- ✅ Filing status persists and updates correctly
- ✅ Audit trail complete for compliance
- ✅ Performance: < 2s for SAR generation, < 1s for CTR auto-population
- ✅ Zero hardcoded API keys (uses env vars)

---

## 🎯 PHASE 2: Continuous Monitoring Alerts & Webhooks (12-20h)

### 2.1 Objective
Enable **real-time alert distribution** via email/SMS/Slack and **automated re-screening** cycles.

### 2.2 Deliverables
- Alert routing service (multi-channel dispatch)
- Webhook integration framework
- Re-screening scheduler (30-day cycles)
- Custom alert threshold configuration
- Alert suppression rules (reduce noise)
- Delivery status tracking

### 2.3 Files to Create
```
src/api/src/services/
├── alertDispatchService.ts           # Email/SMS/Slack dispatch
├── webhookService.ts                 # Outbound webhooks
├── reScreeningScheduler.ts           # 30-day auto re-screening
└── __tests__/
    ├── alertDispatchService.test.ts
    ├── webhookService.test.ts
    └── reScreeningScheduler.test.ts
```

### 2.4 Key Features
- Multi-channel alerts: Email, SMS, Slack, Webhook
- Alert suppression rules (deduplicate)
- Resend logic for failed deliveries
- Custom threshold per client
- 30-day re-screening automation
- Alert history and audit trail

### 2.5 API Endpoints
```
POST   /api/v1/alerts/configure
GET    /api/v1/alerts/settings
POST   /api/v1/webhooks/register
GET    /api/v1/webhooks/deliveries
POST   /api/v1/monitoring/rescreening/schedule
```

---

## 📋 PHASE 3: No-Code Workflow Builder (40-60h)

### 3.1 Objective
Provide **visual rule designer** for compliance officers to create custom workflows without coding.

### 3.2 Components
- **Frontend** (React UI): Drag-drop workflow builder with rule blocks
- **Backend**: Workflow execution engine + custom rule evaluator
- **Persistence**: Workflow versioning + deployment history

### 3.3 Files to Create
```
src/api/src/services/
├── workflowBuilderService.ts        # Create/manage workflows
├── workflowExecutorService.ts       # Execute custom workflows
└── __tests__/
    ├── workflowBuilderService.test.ts
    └── workflowExecutorService.test.ts

src/web/components/
├── WorkflowBuilder.tsx              # Main builder UI
├── RuleBlock.tsx                    # Draggable rule block
├── ConditionEditor.tsx              # Condition editor
├── ActionEditor.tsx                 # Action selector
└── WorkflowPreview.tsx              # Test/preview rules
```

### 3.4 Workflow Block Types
- **Condition Blocks**: AML score, KYC status, Sanctions match, Transaction amount
- **Action Blocks**: Approve, Reject, Escalate, Send Alert, Update Risk Score
- **Logic Blocks**: AND, OR, NOT, IF-THEN-ELSE
- **Integration Blocks**: Call external API, Webhook trigger

### 3.5 API Endpoints
```
POST   /api/v1/workflows/create
GET    /api/v1/workflows/{workflowId}
POST   /api/v1/workflows/{workflowId}/publish
POST   /api/v1/workflows/{workflowId}/test
GET    /api/v1/workflows/versions/{workflowId}
```

---

## 📅 Timeline & Resource Allocation

```
Week 1 (Mar 3-7):   Phase 1 - SAR/CTR Implementation
├─ Mon-Tue: Service layer + types (4h)
├─ Wed: API endpoints + routes (3h)
├─ Thu: Database schema + migrations (2h)
└─ Fri: Unit tests + validation (3h)

Week 2 (Mar 10-14): Phase 2 - Alert Distribution
├─ Mon-Tue: Alert dispatch service (4h)
├─ Wed: Webhook framework (3h)
├─ Thu: Re-screening scheduler (3h)
└─ Fri: Integration tests (2h)

Week 3+ (Mar 17+): Phase 3 - Workflow Builder
├─ Week 3: Backend workflow service (30h)
├─ Week 4: Frontend builder UI (25h)
└─ Week 5: Integration + E2E tests (15h)
```

---

## 🔄 Dependencies & Blockers

### Phase 1
- ✅ No external blockers
- Depends on: complianceReportingSystem, transactionMonitoringService
- Database: PostgreSQL (migration needed)

### Phase 2
- Depends on: Phase 1 (SAR/CTR foundation)
- External: Email service (SMTP), SMS provider (Twilio), Slack app
- Config: Alert channels in .env

### Phase 3
- Depends on: Phase 1 + 2 (all services must exist)
- Requires: Frontend framework (React already present)
- UI Library: Ant Design or react-flow for workflow diagram

---

## 💾 Database Migration Plan

**Phase 1 Migration:**
```sql
-- Run after Phase 1 deployment:
npm run db:migrate -- --version=phase1-sar-ctr

-- Creates:
- sar_reports table
- ctr_reports table
- sar_ctr_filing_audit table
- 3 indices
- 4 trigger functions (audit trail)
```

**Phase 2 Migration:**
```sql
-- Creates:
- alert_configurations table
- webhook_deliveries table
- alert_suppression_rules table
- re_screening_schedules table
```

**Phase 3 Migration:**
```sql
-- Creates:
- workflows table
- workflow_blocks table
- workflow_versions table
- workflow_deployments table
```

---

## ✅ Acceptance Criteria per Phase

### Phase 1 Acceptance
- [ ] All 10 API endpoints responsive and tested
- [ ] SAR auto-generation triggers correctly on rule match
- [ ] CTR form auto-populated with 95%+ accuracy
- [ ] Filing status visible in UI
- [ ] Audit trail complete and queryable
- [ ] Zero test failures (100% pass rate)
- [ ] 80%+ code coverage
- [ ] Performance benchmarks met (< 2s SAR gen)

### Phase 2 Acceptance
- [ ] Alerts dispatch via email/SMS/Slack
- [ ] Webhooks successfully delivered to client endpoints
- [ ] 30-day re-screening runs automatically
- [ ] Custom thresholds configurable per client
- [ ] Alert suppression working (no duplicates)
- [ ] Delivery tracking and retry logic functional
- [ ] 80%+ code coverage

### Phase 3 Acceptance
- [ ] Workflow builder UI fully responsive
- [ ] Drag-drop functionality smooth
- [ ] Workflows deployable and executable
- [ ] Test mode validates rules before deployment
- [ ] Workflow versioning + rollback capability
- [ ] Custom rules execute with same correctness as hardcoded logic
- [ ] 80%+ code coverage

---

## 🚀 Deployment Strategy

### Phase 1
```bash
# Step 1: Database migrations
npm run db:migrate

# Step 2: New services deployment
npm run build
docker-compose up -d

# Step 3: Test endpoints
npm run test -- sar-ctr.*.test.ts

# Step 4: Production deploy (with SAR/CTR go-live)
```

### Phase 2
```bash
# Minimal downtime:
# 1. Deploy alert service
# 2. Configure channels
# 3. Enable webhooks per client (gradual rollout)
```

### Phase 3
```bash
# Feature flag deployment:
# 1. Deploy workflow service (disabled)
# 2. Enable for beta users
# 3. Full rollout after stabilization
```

---

## 📊 Success Metrics

| Metric | Target | Phase |
|--------|--------|-------|
| SAR Auto-Generation Accuracy | 95%+ | 1 |
| CTR Form Completion | 99%+ | 1 |
| Filing Status Accuracy | 100% | 1 |
| Alert Delivery Success Rate | 99%+ | 2 |
| Re-screening Automation | 100% scheduled | 2 |
| Workflow Builder Adoption | 50%+ of officers | 3 |
| Custom Workflow Accuracy | 99%+ | 3 |
| Code Coverage (All Phases) | 80%+ | All |
| Production Uptime | 99.9%+ | All |

---

## 🎓 Implementation Notes

- **Phase 1** is critical path - enables compliance reporting
- **Phase 2** improves UX and reduces manual work
- **Phase 3** is competitive differentiator - NO other RegTech has this
- Each phase is independently deployable
- Backward compatibility maintained throughout
- No breaking changes to existing APIs

---

**Document Version:** 1.0  
**Created:** March 1, 2026  
**Owner:** AI Code Generation Agent  
**Status:** ACTIVE IMPLEMENTATION - Phase 1 Starting
