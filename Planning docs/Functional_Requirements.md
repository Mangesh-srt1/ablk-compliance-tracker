# Functional Requirements Document (FRD) for Ableka Lumina

**Document Version**: 1.15  
**Date**: February 28, 2026  
**Prepared By**: AI Assistant  
**Approved By**: [To be filled]  
**Project**: Ableka Lumina (AI-Driven RegTech SaaS Platform)  

## 1. Introduction
### 1.1 Purpose
This Functional Requirements Document (FRD) outlines the detailed functional requirements for Ableka Lumina, an AI-powered RegTech SaaS platform designed for the fintech industry. It provides KYC/AML/fraud detection via APIs, supporting multi-jurisdictional compliance (SEBI, EU AI Act, FinCEN, etc.) and multi-blockchain integrations (Ethereum, Besu, Solana, etc.).

### 1.2 Scope
- **In-Scope**: AI-driven KYC/AML/fraud detection for fintech apps (lending, payments, crypto exchanges) via API (REST/WebSocket). Includes hierarchical agents with ReAct loops for reasoning. Jurisdictions: India (SEBI/DPDP), EU (GDPR/PSD2), US (FinCEN/OFAC), APAC (FATF). Modules: KYC, AML, Fraud, Compliance Tracker, Portal UI, Demo Client. Integrations: Ballerine, Marble, Jumio, Chainalysis, ethers.js/web3.js. Tech Stack: Node.js, LangChain.js, Grok 4.1, PGVector, Express.js, React, AWS. Features: Multi-tenant SaaS, localization (5+ languages), WebSocket, rate limiting, subscriptions.
- **Out-of-Scope**: Non-finance sectors, manual compliance, on-premise, legacy beyond APIs, languages beyond 5.
- **Global Expansion**: Multi-jurisdictional with routing, localization, global providers.

### 1.3 Assumptions
- Clients have API integration capabilities.
- Global regulatory data is accessible via RAG.
- LLM (Grok 4.1) handles reasoning without hallucinations via grounding.
- Users access portal via web browser.
- **Global Assumptions**: Clients operate in multiple jurisdictions; data residency laws (e.g., GDPR for EU) are respected; global sanctions lists (OFAC, EU) are integrated.

### 1.4 Dependencies
- Third-party APIs: Ballerine (KYC), Marble (AML), ethers.js (blockchain).
- Infra: AWS Fargate/ECS, Aurora PG, Redis.
- UI Framework: React for portal/demo.
- **Global Additions**: Jumio/Veriff (global KYC), Chainalysis (crypto AML), OFAC/EU Sanctions APIs, real-time FX APIs (e.g., OpenExchangeRates).

### 1.5 Compliance Fundamentals
As a developer new to compliance but strong in tech, focus on these **10 high-level fundamentals** for building your AI compliance system. This covers **why** rules exist, **what** triggers violations, and **how** your LangGraph agents enforce them—SEBI/RBI/DPDP tailored for Indian fintech + ERC-1400 tokenization. [castellum](https://www.castellum.ai/insights/kyc-aml-fundamentals-for-fintechs-2024)

### 1. KYC (Know Your Customer) - Identity Gatekeeper
   - **Purpose**: Verify "who is this person?" to prevent fraud/identity theft
   - **Triggers**: Onboarding, high-value txs (>₹50k), PEP status
   - **Docs**: Aadhaar/PAN + liveness (eKYC/video); expiry 2-10yrs
   - **Your Agent**: Ballerine tool → "BLOCK if expired"
   - **Violation**: ₹1Cr+ fine per false onboarding

### 2. AML (Anti-Money Laundering) - Criminal Cash Detector
   - **Red Flags**: 
     | Pattern | Example | Agent Action |
     |---------|---------|--------------|
     | Velocity | 20 txs ₹1.9L (<₹2L limit) | Pattern Agent flags |
     | Layering | Rapid small→large | Marble score >85% |
     | Structuring | Round amounts | DT model BLOCK |
   - **Reporting**: STR to FIU-IND within 7 days (>₹10L suspicious)
   - **Fine**: Up to 3x laundered amount

### 3. ERC-1400 Compliance (Your Tokens)
   ```
   canTransfer(from, to, amount, partition) → partition rules
   - Investor quotas (e.g., max 10% fund)
   - Custodian locks
   - KYC-gated transfers
   Agent: ethers.js + partition check → REVERT
   ```

### 4. SEBI Master Circulars (Key Rules)
   - **17A**: Velocity monitoring; CTR >₹10L daily
   - **Investor Protection**: Partitioned tokens (retail/institutional)
   - **Disclosure**: NIL returns monthly (agent PDF gen)

### 5. DPDP Act (Data Privacy - Your PII Nightmare)
   ```
   Aadhaar/KYC → Encrypt AES-256 → Mumbai storage
   Consent expiry → Auto-BLOCK txs
   Breach → Notify 72hrs (template ready)
   Fine: 4% global revenue
   ```

### 6. Risk-Based Approach (RBA)
   ```
   Low Risk: eKYC + basic AML
   High Risk: Video KYC + EDD + PEP screening
   Agent Logic: if PEPs or HVI → Deep dive
   ```

### 7. Transaction Monitoring Thresholds
   | Amount | Action |
   |--------|--------|
   | ₹50k+ | Enhanced KYC |
   | ₹10L+ | CTR to FIU |
   | ₹2L x20 | STR velocity |

### 8. Reporting Hierarchy
   ```
   Tx → AgentCore → Compliance Tracker → 
   Dashboard → Weekly SEBI → Quarterly Audit
   ```

### 9. Audit Trail Requirements
   - **Immutable**: LangSmith traces + Besu proofs
   - **Retention**: 10 years (SEBI)
   - **Format**: PDF/CSV with timestamps

### 10. Penalties (Motivation)
   ```
   OKX fined $505M (2025) → Weak KYC
   Paytm ₹43Cr (2024) → Data residency
   Your Goal: AgentCore = 99.9% compliance
   ```

## Developer Action Plan
```
1. Build KYC gate first (Ballerine + expiry)
2. Add AML patterns (velocity DT model)
3. ERC-1400 hooks (partition checks)
4. SEBI RAG (rules ingestion)
5. DPDP encryption (AES-256 middleware)
```

**Pro Tip**: Start with synthetic breaches—test agent BLOCKs before live txs. This foundation prevents 95% violations automatically. [sanctionscanner](https://www.sanctionscanner.com/blog/aml-kyc-compliance-guide-for-fintech-industry-1149)

### 1.6 Global Compliance Modules
To make Ableka Lumina a global product, the following enhancements ensure multi-jurisdictional support, localization, and scalable compliance automation.

#### Jurisdictional Modules
- **EU Module**: GDPR (data privacy), PSD2 (payments), AMLD5 (anti-money laundering). Agents check for consent management, PSD2 SCA, and EU sanctions (via OFAC integration).
- **US Module**: FinCEN CTR/STR reporting, OFAC sanctions screening, Reg D/S exemptions for crypto. Agents enforce velocity limits ($10k+ CTR) and PEP checks.
- **Global FATF Standards**: Unified AML thresholds, risk-based KYC, and cross-border tx monitoring. Agents use RAG for 200+ country regs.
- **Other Regions**: APAC (MAS in Singapore, ASIC in Australia), LATAM (Brazil's LGPD), Middle East (DIFC regs).

#### Localization Features
- **Multi-Language Support**: UI and reports in English, Spanish, French, German, Hindi. Agent responses localized via LLM.
- **Currency Handling**: Auto-convert thresholds (e.g., ₹50k to €40k equivalent) using real-time FX rates.
- **Data Residency**: Configurable storage regions (Mumbai for India, Frankfurt for EU) with geo-fencing.

#### Global Integrations
- **KYC/AML Providers**: Expand beyond Ballerine/Marble to include Jumio (global KYC), Chainalysis (crypto AML), and local providers (e.g., Veriff for EU).
- **Sanctions Screening**: Integrate OFAC, EU, UN lists via APIs; real-time checks on txs.
- **Blockchain Support**: Add Solana, Polygon, Avalanche alongside Ethereum/Besu; ERC-1400 analogs (e.g., Solana token standards).

#### Agent Enhancements
- **Jurisdiction-Aware RAG**: Vector store partitioned by region; agents query relevant regs (e.g., "EU GDPR" for EU clients).
- **Hierarchical Agents**: Global Supervisor routes to regional agents (e.g., EU Agent for GDPR checks).
- **Cross-Border Logic**: Flag txs involving sanctioned entities; auto-escalate for manual review.

#### Reporting & Audit
- **Global Templates**: Localized reports (e.g., EU AML reports in French); auto-submission to regulators via APIs.
- **Audit Trails**: Immutable logs with geo-timestamps; 10-year retention per jurisdiction (e.g., 7 years for EU).

#### UI/Portal Enhancements
- **Jurisdiction Selection**: Onboarding allows multi-region setup; dashboard filters by jurisdiction.
- **Global Demo Client**: Simulate scans for US/EU wallets; show region-specific flags.

#### Security & Compliance
- **Global Penalties Awareness**: Agents cite fines (e.g., €20M for GDPR breaches) to motivate compliance.
- **Zero-Trust Global**: MFA with region-specific auth (e.g., EU eIDAS).

**Implementation Priority**: Start with EU/US modules; add languages incrementally. This positions Ableka Lumina as a global RegTech leader.

### 1.7 Project Scope Outline
Based on initial research (Indian regs: SEBI/DPDP; EU/US regs: GDPR/PSD2/FinCEN/OFAC) and agent flow designs, the project scope for Ableka Lumina is outlined below. This ensures logical sequencing from planning to implementation.

#### In-Scope
- **Core Platform**: API-first SaaS with LangChain.js agents for KYC/AML/fraud detection across blockchains (Ethereum, Besu, Solana, Polygon) and jurisdictions (India, EU, US, global FATF).
- **Key Features**: Hierarchical agents (Supervisor → KYC/AML/Compliance), Compliance Tracker automation (90% reduction in manual tasks), multi-tenant SaaS with tiers (Free/Pro/Enterprise).
- **UI/Portal**: Ableka portal for client management, demo client for testing, with multi-language support (English, Spanish, French, German, Hindi) and localization.
- **Global Modules**: Jurisdiction-aware RAG, sanctions screening (OFAC/EU), data residency (GDPR/DPDP), auto-reporting to regulators.
- **Integrations**: Third-party APIs (Ballerine, Marble, Jumio, Chainalysis, ethers.js), blockchain hooks (ERC-1400 partitions).
- **Compliance Automation**: Real-time tx monitoring, velocity checks, consent management, breach notifications.

#### Out-of-Scope
- End-user mobile/web apps for customers.
- Hardware integrations or on-premise deployments.
- Non-fintech verticals (e.g., healthcare compliance).
- Manual overrides beyond agent recommendations.

#### Assumptions
- Clients integrate via APIs; global regs remain stable.
- LLM (Grok 4.1) provides accurate reasoning with grounding.
- Infra scales to 100k+ scans/day via AWS.

#### Dependencies
- Completion of Phase 1 research and design.
- Access to global API providers and regulatory docs.

#### Timeline and Budget
- 6-9 months: Planning (Weeks 1-4), MVP (5-12), Integrations (13-20), Testing (21-24), Launch (25-28), Iteration (Months 7-9).
- Budget: $70k-$160k (solo: $35k via Grok-assisted coding).

This scope aligns with FRD sections 1.2-1.6 and ensures global product viability.

## 2. User Roles and Personas
- **Fintech Developer**: Integrates APIs into apps (e.g., crypto exchange).
- **Compliance Officer**: Reviews agent outputs for audits.
- **Admin (Ableka)**: Manages tenants, monitors usage.
- **End-User (Indirect)**: Customers of fintech apps (e.g., investors submitting wallets).
- **Compliance Tracker**: Monitors regulatory adherence, transaction compliance, and risk metrics in a FinTrackPro-style fintech platform (financial tracking + RegTech automation). Oversees Besu tokenization for SEBI/DPDP compliance.

### 2.1 Compliance Tracker Responsibilities
#### Daily Monitoring (80% Automated)
- **AML/KYC Alerts**: Review agent-flagged txs (velocity, layering, synthetics) from LangGraph workflow.
- **Threshold Breaches**: Track partition restrictions (ERC-1400), custodian limits, investor quotas.
- **Real-time Dashboard**: AgentCore traces + anomaly scores (<3s SLA); escalate risk>85%.

#### Regulatory Tracking
| Compliance Item | Frequency | Action |
|----------------|-----------|--------|
| **SEBI Rule 17A** | Daily | Velocity checks; report >₹50L patterns |
| **DPDP Act** | Real-time | PII residency (Mumbai region); consent expiry |
| **ERC-1400** | Per tx | Partition compliance (canTransfer hooks) |
| **Audit Trail** | 90 days | LangSmith traces → PDF exports |

#### Agent Oversight
```
Input: Besu tx event → Compliance Tracker Agent
├── Validate: KYC status + partition rules
├── Score: DT+SHAP anomaly (velocity 45%, KYC fail 30%)
├── Report: "BLOCK: Investor quota exceeded" 
└── Escalate: Human review if confidence <95%
```

#### Reporting & Filings
- **Weekly**: High-risk summary (Grafana dashboard).
- **Monthly**: SEBI NIL returns (agent-generated).
- **Quarterly**: Full audit package (on-chain proofs + agent traces).

#### Incident Response
- T+5min: Pause rogue agents via Lambda.
- T+72h: SEBI notification (template ready).
- Customer alerts: Auto-mailer for affected investors.

#### Tech Implementation
```yaml
Role: compliance-tracker@ableka.com
Permissions: read:txs,kyc,agent-traces | write:reports,alerts
Tools: LangGraph dashboard + Ballerine status + CloudWatch
Alerts: PagerDuty (risk>90%) + Slack (daily digest)
```

#### Automation Architecture (90% Reduction in Manual Effort)
```
Besu Tx Event → EventBridge → LangGraph AgentCore
├── Pattern Agent: Velocity/anomaly scoring
├── KYC Agent: Ballerine status + expiry
├── Compliance Agent: SEBI rules RAG
└── Reporter: Auto-reports + alerts
```

#### Step-by-Step Automation Implementation
1. **Event Ingestion (AWS EventBridge)**  
   ```yaml
   # eventbridge-rule.yaml
   Rule:
     EventPattern:
       source: ["besu.tx"]
       detail-type: ["NewTransaction"]
     Targets:
       - Arn: !GetAtt AgentCoreInvokeLambda.Arn
   ```

2. **LangGraph Compliance Workflow**  
   Extend AML graph for Compliance Tracker:  
   - Daily: SEBI 17A velocity reports  
   - Real-time: Partition breaches (ERC-1400)  
   - Weekly: Audit trail exports  
   Add cron scheduler.

3. **Key Automations Table**  
   | Manual Task | Automation | Tech | ROI |  
   |-------------|------------|------|-----|  
   | **Tx Velocity Check** | Cron + DT model | LangGraph Pattern Agent | 42x faster |  
   | **KYC Expiry** | Ballerine webhook | KYC Agent | Zero misses |  
   | **SEBI Reporting** | RAG + PDF gen | Reporter Agent | Auto-NIL |  
   | **Audit Trails** | LangSmith export | Checkpointing | 99.9% compliant |  
   | **Alerts** | PagerDuty integration | Threshold nodes | T+5min response |

4. **Dashboard Automation**  
   ```javascript
   // React dashboard (Grok-generated)
   <ComplianceTracker>
     <RealTimeAlerts />     // AgentCore streams
     <VelocityHeatmap />    // Grafana iframe
     <SEBIReports />        // Auto-generated PDFs
     <AuditExports />       // One-click LangSmith
   </ComplianceTracker>
   ```

5. **Deployment (Zero Manual)**  
   1. CDK deploy (Grok generates)  
   2. EventBridge connects Besu→Agents  
   3. Compliance Tracker = Dashboard viewer

#### Sample AgentCore Schedule
```yaml
cron-jobs:
  daily-velocity: "0 9 * * ?"     # SEBI 17A
  weekly-audit: "0 10 * * 1"     # Reports
  kyc-expiry: "0 */6 * * *"       # 6hr sweeps
```

#### Integration with KYC/AML Agents (Hierarchical LangGraph Orchestration)
```
Besu Tx → Compliance Tracker (Supervisor)
├── Route: High-value? → KYC Agent → AML Agent
├── Merge: Scores + explanations
└── Output: Auto-report + dashboard
```

#### LangGraph Implementation
```python
# compliance_tracker_graph.py
from langgraph.graph import StateGraph
class TrackerState(TypedDict):
    tx_hash: str
    kyc_result: Dict
    aml_score: float
    compliance_status: str  # PASS/BLOCK/REVIEW

# Supervisor: Compliance Tracker
def tracker_node(state):
    if state["amount"] > 5000000:  # ₹50L SEBI threshold
        return {"next": "kyc_agent"}
    return {"compliance_status": "PASS"}

# KYC Agent Integration
def kyc_agent(state):
    kyc_result = ballerine_tool.invoke({"entity_id": state["sender"]})
    state["kyc_result"] = kyc_result
    return state

# AML Agent Integration  
def aml_agent(state):
    aml_score = marble_tool.invoke({"txs": state["recent_txs"]})
    state["aml_score"] = aml_score
    if state["kyc_result"]["status"] == "expired" or aml_score > 0.85:
        state["compliance_status"] = "BLOCK"
    return state

# Graph Assembly
graph.add_conditional_edges("tracker", tracker_node, {
    "kyc_agent": "kyc_agent",
    "end": END
})
graph.add_edge("kyc_agent", "aml_agent")
graph.add_edge("aml_agent", END)
```

#### API Integration Layer
```yaml
# Compliance Tracker Dashboard API
POST /compliance/track
Body: {tx_hash: "0xabc...", sender: "0x123..."}
Response:
{
  "status": "BLOCK",
  "kyc": {"verified": false, "expiry": "2026-03-01"},
  "aml_score": 0.92,
  "explanation": "Velocity 45% + expired KYC [SHAP]",
  "sebi_rule": "17A(5)"
}
```

#### Real-Time Dashboard (React)
```
Compliance Tracker View:
├── Live Feed: 47 txs screened (99.8% PASS)
├── Alerts: 2 BLOCKED (₹12Cr volume)
├── KYC Failures: 1 (Auto-escalate)
└── Reports: SEBI NIL [Download PDF]
```

#### Event-Driven Flow
```
1. Besu tx → EventBridge (tx_hash)
2. Compliance Tracker supervisor receives
3. Parallel: KYC + Pattern analysis
4. Sequential: AML scoring if risky
5. Tracker merges → Dashboard + Archive
```

#### Monitoring & Alerts
```
Slack/PagerDuty:
🚨 Compliance BLOCK: tx 0xabc
- KYC: Expired (Ballerine)
- AML: 92% (Marble) 
- Action: Custodian review required
```

**ROI**: 100% automation; Compliance Tracker reviews 1% escalations vs. 100% manual. Deploy via CDK in 2 days.

## 3. Functional Requirements
### 3.1 Authentication and Authorization
**FR-1.1: API Key Management**  
- **Description**: Clients obtain API keys via Ableka portal for authentication.  
- **Steps**:  
  1. Client signs up on Ableka portal.  
  2. Selects tier (Free/Pro/Enterprise).  
  3. Receives API key and secret via email.  
  4. Uses key in Authorization header for all requests.  
- **Acceptance Criteria**: Key rotation every 90 days; invalid keys return 401 error.  
- **Priority**: High.

**FR-1.2: Multi-Tenant Isolation**  
- **Description**: Each client has isolated data and usage limits.  
- **Steps**:  
  1. API requests include tenant ID in headers.  
  2. System validates tenant against DB.  
  3. Enforce rate limits (e.g., 10 req/min for Free tier).  
- **Acceptance Criteria**: No data leakage between tenants; usage dashboards per tenant.

### 3.2 Core AI Agent Functionality
**FR-2.1: Agent Query Processing**  
- **Description**: Process natural language queries for compliance checks.  
- **Steps**:  
  1. Receive POST /agent with query (e.g., "Check KYC for wallet 0x123").  
  2. Parse query using Zod schema.  
  3. Invoke ReAct loop: Plan → Tool Call → Observe → Report.  
  4. Return JSON response with status, risks, citations.  
- **Acceptance Criteria**: Response <2s; accuracy >90%; grounded in RAG.

**FR-2.2: RAG for Regulatory Knowledge**  
- **Description**: Retrieve relevant rules from vector store.  
- **Steps**:  
  1. Ingest docs (SEBI PDFs, EU regs, US FinCEN, global FATF) via cron job.  
  2. Embed using OpenAI; store in PGVector with jurisdiction tags.  
  3. Agent queries vector store for context based on client region.  
  4. Cite sources in output (e.g., "Per SEBI Rule 17A" or "GDPR Art. 5").  
- **Acceptance Criteria**: Ingestion handles 1000+ docs; similarity search top-3 results; multi-language embeddings.

**FR-2.3: Custom Tools Integration**  
- **Description**: Wrap third-party APIs as agent tools.  
- **Steps**:  
  1. Define DynamicTool for Ballerine (KYC check).  
  2. On tool call: Authenticate with Ballerine API.  
  3. Fetch data; parse response.  
  4. Feed back to agent for reasoning.  
- **Acceptance Criteria**: Tools handle errors (retries); mock for testing.

### 3.3 API Endpoints
**FR-3.1: /kyc-check**  
- **Description**: Verify KYC for entity.  
- **Steps**:  
  1. POST with {entityId, country, docs}.  
  2. Call Ballerine API.  
  3. Return {status: "approved", score: 95}.  
- **Acceptance Criteria**: Supports global countries; handles failures.

**FR-3.2: /aml-score**  
- **Description**: Assess AML risk.  
- **Steps**:  
  1. POST with {customerId, amount, txHistory}.  
  2. Call Marble API.  
  3. Return {risk: "low", action: "monitor"}.  
- **Acceptance Criteria**: Real-time scoring; bias checks.

**FR-3.3: /fraud-detect**  
- **Description**: Detect anomalies in txs.  
- **Steps**:  
  1. POST with tx data.  
  2. Agent analyzes velocity/layering.  
  3. Return {anomaly: true, reason: "High velocity"}.  
- **Acceptance Criteria**: <5% false positives.

**FR-3.4: /scan**  
- **Description**: Full compliance scan.  
- **Steps**:  
  1. POST with wallet/tx details.  
  2. Chain tools: KYC → AML → Blockchain.  
  3. Return comprehensive report.  
- **Acceptance Criteria**: WebSocket for real-time updates.

### 3.4 Multi-Agent Orchestration
**FR-4.1: CrewAI Workflow**  
- **Description**: Hierarchical agents for complex checks.  
- **Steps**:  
  1. Supervisor agent routes to KYC/AML agents.  
  2. Agents collaborate; merge outputs.  
  3. Final report with traces.  
- **Acceptance Criteria**: Handles 10+ concurrent scans.

### 3.5 Monitoring and Reporting
**FR-5.1: Usage Dashboards**  
- **Description**: Per-tenant analytics.  
- **Steps**:  
  1. Log all API calls in DB.  
  2. Aggregate by tenant (scans/day, errors).  
  3. Expose via portal.  
- **Acceptance Criteria**: Real-time updates; export CSV.

**FR-5.5: Hierarchical Agent Integration**  
- **Description**: Compliance Tracker as supervisor routes txs to KYC/AML agents via LangGraph.  
- **Steps**:  
  1. Receive Besu tx via EventBridge.  
  2. Supervisor routes based on amount/threshold.  
  3. KYC and AML agents process in parallel/sequence.  
  4. Merge results with XAI explanations.  
  5. Output to dashboard/API with status and alerts.  
- **Acceptance Criteria**: 100% automation; real-time merges; SEBI audit-ready.

### 3.6 Security and Compliance
**FR-6.1: Data Encryption**  
- **Description**: Protect PII in transit/at-rest.  
- **Steps**:  
  1. Use TLS 1.3 for APIs.  
  2. Encrypt DB with KMS.  
  3. Tokenize sensitive fields.  
- **Acceptance Criteria**: Passes pen tests.

**FR-6.2: Regulatory Reporting**  
- **Description**: Auto-generate reports (e.g., SEBI NIL, EU AML, US CTR).  
- **Steps**:  
  1. Agent flags high-risk based on jurisdiction.  
  2. Queue for human review or auto-submit via APIs.  
  3. Export PDF/JSON with citations and localization.  
- **Acceptance Criteria**: Compliant with global regs; supports 10+ languages.

### 3.7 PE & RWA Tokenization Compliance *(NEW – v1.15)*

> **Detail**: Full specifications for each requirement below are in [`Planning docs/PE_RWA_Tokenization_FRD.md`](./PE_RWA_Tokenization_FRD.md).  
> **Codebase Impact**: `compliance-system/src/api/src/routes/peTokenizationRoutes.ts`, `compliance-system/src/api/src/services/peTokenizationService.ts`, `compliance-system/src/api/src/services/oracleVerificationService.ts`.

**FR-7.1: Corporate KYB (Know Your Business) with UBO Tracing** *(NEW)*
- **Description**: Verify corporate entities investing in tokenized assets by tracing their Ultimate Beneficial Ownership (UBO) chain, preventing shell-company abuse.
- **Steps**:
  1. POST `/api/v1/kyb-check` with corporate registration, ownership structure, and jurisdiction.
  2. Load jurisdiction-specific KYB rules (UBO threshold: AE/EU 25%+, IN 10%+ per PMLA).
  3. For each UBO meeting threshold, trigger individual KYC (FR-3.1).
  4. Verify no circular ownership or shell-company indicators.
  5. Return `{ status, kybScore, uboChain, reasoning }`.
- **Acceptance Criteria**: UBO chain depth ≥ 5 levels; corporate registry checks for AE/IN/US; results stored in `kyc_checks` table with `entity_type = 'corporate'`.
- **Priority**: High (MVP).
- **Regulatory Reference**: FATF R.24, UAE AML Decree-Law No.20/2018, EU AMLD5 Art.30.

**FR-7.2: Enhanced Due Diligence (EDD) for High-Risk Investors** *(NEW)*
- **Description**: Automatically trigger additional verification for high-risk investors (PEPs, FATF grey-listed countries, large investments).
- **Steps**:
  1. Trigger when KYC risk score ≥ 60, PEP match detected, investment > $1M USD, or FATF grey/black-listed country.
  2. Collect additional documents (source of wealth, 6-month bank statements, professional references).
  3. Run AI analysis on documents and adverse media check.
  4. Route to compliance officer for manual sign-off.
  5. Store EDD record in `kyc_checks` with `check_type = 'EDD'`.
- **Acceptance Criteria**: EDD workflow completes within 5 business days; all triggers documented in audit log; compliance officer sign-off required before APPROVED status.
- **Priority**: High.
- **Regulatory Reference**: FATF R.19, UAE CBUAE Notice 2021/2, SEBI Master Circular AML.

**FR-7.3: Accredited/Qualified Investor Verification** *(NEW)*
- **Description**: Verify investors meet minimum accreditation thresholds before they can hold restricted tokenized securities.
- **Steps**:
  1. Load thresholds from jurisdiction YAML (US: $200k income or $1M net worth; UAE: $500k investable assets; India: ₹1 crore minimum).
  2. Validate submitted financial documents against thresholds.
  3. AI model assesses self-certification plausibility.
  4. Issue investor classification: `APPROVED` / `CONDITIONAL` / `REJECTED`.
  5. Link classification to token whitelist (FR-7.4).
- **Acceptance Criteria**: Threshold values sourced exclusively from YAML config; no hardcoded values; classification linked to token transfer whitelist.
- **Priority**: High.
- **Regulatory Reference**: US SEC 17 CFR 230.501, UAE DFSA PIB 2.7, SEBI AIF Reg 4.

**FR-7.4: Token Transfer Whitelist & Compliance Gate** *(NEW)*
- **Description**: Ensure only KYC-verified, jurisdiction-eligible investors can receive tokenized asset transfers, enforced at the API layer before any on-chain transaction.
- **Steps**:
  1. POST `/api/compliance/transfer-check` with `{ from, to, amount, tokenType, jurisdiction }`.
  2. Verify both sender and receiver on compliance whitelist.
  3. Check receiver's jurisdiction eligibility for this token type.
  4. Check holding limits (FR-7.5) and lock-up periods (FR-7.6).
  5. Run AML screening (FR-3.2) on transfer amount.
  6. Return `{ status, riskScore, checks: { kyc_sender, kyc_recipient, aml, whitelist, geofence, amount } }`.
- **Acceptance Criteria**: Response < 2 seconds (P95); restricted jurisdictions configurable via YAML; both-party KYC required.
- **Priority**: High (MVP).
- **Regulatory Reference**: FATF R.10, UAE DFSA CIR 5.3, SEBI AIF Reg 13.

**FR-7.5: Investor Holding Limit Enforcement** *(NEW)*
- **Description**: Prevent any single investor from exceeding jurisdiction-defined concentration limits in a tokenized asset.
- **Steps**:
  1. On each transfer request, retrieve investor's current token holdings.
  2. Calculate projected holding if transfer proceeds.
  3. Compare against YAML-configured limits (AE DFSA: 20% max; SEBI AIF: 33% max).
  4. If limit exceeded: auto-REJECT with `HOLDING_LIMIT_EXCEEDED` reason code.
  5. Update holding register in real-time.
- **Acceptance Criteria**: Limit check completes within transfer check SLA (2s); configurable per-token and per-jurisdiction; real-time holding register updated atomically.
- **Priority**: High.

**FR-7.6: Lock-Up Period & Vesting Schedule Enforcement** *(NEW)*
- **Description**: Block token transfers during mandatory lock-up periods for PE fund tokens; support cliff, linear, and milestone-based vesting schedules.
- **Steps**:
  1. On transfer request, check `token_lifecycle` table for lock-up end date and vesting status.
  2. If `current_date < lockup_end_date`: REJECT with `LOCKUP_ACTIVE`.
  3. For vested tokens: calculate vested amount and reject transfers exceeding vested balance.
  4. Notify investor proactively when lock-up expires.
- **Acceptance Criteria**: Accurate to the day; all blocked transfers logged with reason; lock-up end date configurable at token issuance.
- **Priority**: High (MVP).
- **Regulatory Reference**: UAE DFSA CIR 5.4, SEBI AIF Reg 12.

**FR-7.7: Corporate Action Compliance (Dividend, Redemption, Capital Call)** *(NEW)*
- **Description**: Validate all corporate actions (dividend distribution, token redemption, capital call) against regulatory requirements before they execute.
- **Sub-requirements**:
  - **FR-7.7a Dividend**: Verify distributable profits (via oracle), check KYC-currency of all recipients, apply jurisdiction-specific withholding tax.
  - **FR-7.7b Redemption**: Verify investor is within redemption window, no pending SAR filings, redemption ≤ vested holding; EDD for redemptions > $500k.
  - **FR-7.7c Capital Call**: Validate within committed capital limits; verify notice period compliance (AE: 10 days, IN: 21 days per YAML); flag calls > 50% committed capital for review.
- **Acceptance Criteria**: Each corporate action type returns `{ approved, reason, withholdingTax? }` within 5 seconds; notice-period rules sourced from YAML.
- **Priority**: Medium (Phase 2).
- **Regulatory Reference**: SEBI LODR, UAE DFSA CIR 6.1, FATF R.10.

**FR-7.8: Hawala & Velocity Pattern Detection** *(EXTENDED – existing FR-3.3 enhanced)*
- **Description**: Detect PE fund-specific hawala-like layering patterns in tokenized asset transactions. Extends the existing fraud detection (FR-3.3) with PE-specific patterns.
- **Patterns Detected**: Structuring (sub-threshold splits within 24h), round-tripping (within 48h), fan-out/fan-in entropy anomalies, mirror trading across jurisdictions.
- **Steps**:
  1. On each transaction, retrieve 30-day transaction history for sender/receiver.
  2. Run pattern detection algorithms (structuring, round-trip graph, entropy analysis).
  3. Return `{ flagged, hawalaScore, patterns, recommendation }`.
  4. If `hawalaScore ≥ 80`: trigger STR workflow (FR-7.12).
- **Acceptance Criteria**: < 5% false positive rate; all pattern types independently configurable on/off per jurisdiction YAML; results stored in `aml_checks` table.
- **Priority**: High.
- **Regulatory Reference**: FATF Typology 2023, UAE CBUAE AML Regulation 2020.

**FR-7.9: Cross-Chain Compliance Monitoring** *(NEW)*
- **Description**: Provide a unified compliance view across all client-approved blockchain networks (permissioned Besu for PE, Ethereum/Solana for public RWA).
- **Steps**:
  1. Accept monitoring requests specifying blockchain type (`permissioned` | `public`) and client-provided RPC endpoint.
  2. For `public` chains: additionally query Chainalysis for wallet risk score.
  3. Aggregate cross-chain activity per investor across all monitored networks.
  4. Alert on: cross-chain bridging, anonymous mixing services, unusual cross-chain velocity.
- **Acceptance Criteria**: Single API call returns consolidated investor activity across all monitored chains; cross-chain alerts generated within 1 second of event detection; no blockchain infrastructure provisioned by the platform.
- **Priority**: Medium (Phase 2).
- **Codebase Impact**: `compliance-system/src/agents/src/blockchain/` (besu, ethereum providers), `compliance-system/src/api/src/services/blockchainMonitor.ts`.

**FR-7.10: Property Valuation Oracle Integration** *(NEW)*
- **Description**: Verify that on-chain token price/supply is consistent with current off-chain property valuations, preventing inflated tokenization fraud.
- **Steps**:
  1. Trigger on token issuance or large transfer (> $1M).
  2. Query client-provided property valuation oracle endpoint.
  3. Retrieve NAV; compare `tokenSupply × tokenPrice` vs. oracle NAV.
  4. If discrepancy > `maxDiscrepancyPercent` (from YAML): ESCALATE with `VALUATION_DISCREPANCY` flag.
  5. Log oracle result with timestamp for audit.
- **Acceptance Criteria**: Discrepancy threshold configurable per YAML; oracle query timeout of 10 seconds; all oracle queries logged immutably.
- **Priority**: Medium (Phase 2).
- **Codebase Impact**: `compliance-system/src/api/src/services/oracleVerificationService.ts`.

**FR-7.11: Double-Dipping Prevention** *(NEW)*
- **Description**: Prevent the same underlying real-world asset from being tokenized on multiple platforms simultaneously, creating fraudulent duplicate claims.
- **Steps**:
  1. On asset registration, extract unique identifier (title deed, fund registration number, land registry ID).
  2. Query internal `asset_registry` table for duplicate.
  3. Query external property registries (client-provided: UAE DLD, India state registry, Saudi Aqari).
  4. If duplicate found: REJECT with `DUPLICATE_ASSET`.
  5. If unique: register asset and issue uniqueness certificate.
- **Acceptance Criteria**: 100% prevention of exact-match duplicates; external registry check with configurable timeout; uniqueness certificate stored in audit log.
- **Priority**: Medium (Phase 2).
- **Regulatory Reference**: UAE DFSA PIB 2.6, SEBI AIF Reg 24.

**FR-7.12: Automated STR/SAR Filing** *(EXTENDED – existing FR-6.2 enhanced)*
- **Description**: Automatically draft and submit Suspicious Transaction Reports (STR/SAR) to relevant financial intelligence units when suspicious activity is detected. Extends FR-6.2 with jurisdiction-specific filing integrations.
- **Trigger Conditions**: AML risk score ≥ 70, hawala score ≥ 80, any sanctions hit, or manual escalation.
- **Filing Targets**:
  - AE: UAE FIU via goAML platform
  - IN: FIU-IND submission API
  - US: FinCEN BSA E-Filing
  - SA: SAFIU Saudi Financial Intelligence Unit
- **Steps**:
  1. LangChain agent generates STR/SAR narrative from transaction data and AML flags.
  2. Compliance officer review (auto-file for `auto_file_threshold` as set in YAML).
  3. Submit to appropriate authority; store `{ filingId, status, filingReference }`.
  4. Retain filing record for 5 years (FATF R.11 minimum).
- **Acceptance Criteria**: Draft generated within 30 seconds of trigger; jurisdiction-specific form fields populated correctly; filing reference stored in `compliance_checks` table.
- **Priority**: High.

**FR-7.13: Compliance Case Management** *(NEW)*
- **Description**: Structured workflow to investigate, document, and resolve compliance cases from initial detection through final resolution.
- **Case Types**: Suspicious activity, Failed KYC, Sanctions hit, Corporate action dispute, Data breach.
- **Steps**:
  1. Case created automatically from alerts or manually by compliance officer.
  2. AI agent populates case with evidence (transaction history, KYC records, similar cases via PGVector similarity search).
  3. Case assigned to compliance officer (round-robin or by expertise).
  4. Investigation workflow: evidence gathering → AI-assisted analysis → decision (close/escalate/report).
  5. Regulatory report generated if required (FR-7.12, FR-6.2).
  6. Case closed with full audit trail.
- **Case Status States**: `OPEN` → `INVESTIGATING` → `PENDING_INFO` → `RESOLVED` | `REPORTED`.
- **Acceptance Criteria**: Case history fully queryable; PGVector similarity search returns top-5 similar cases; full audit trail with timestamps for each state transition.
- **Priority**: Medium (Phase 2).
- **Codebase Impact**: New route `compliance-system/src/api/src/routes/caseManagementRoutes.ts` (to be implemented).

---

### 3.8 Security Hardening Requirements *(NEW – v1.15)*

> **Detail**: Full gap analysis in [`Planning docs/security-standards-coverage-analysis.md`](./security-standards-coverage-analysis.md).  
> **Codebase Impact**: `compliance-system/src/api/src/middleware/`, `compliance-system/src/api/src/config/`, `compliance-system/src/api/src/utils/sqlLoader.ts`.

**FR-8.1: Multi-Factor Authentication (MFA)** *(NEW)*
- **Description**: Require a second authentication factor for compliance officers and admin users accessing sensitive compliance data.
- **Steps**:
  1. After successful password login, prompt for TOTP (authenticator app) code.
  2. Validate TOTP within ±30-second window.
  3. Store MFA enrollment status in `users` table.
  4. Enforce MFA for roles: `admin`, `compliance_officer`.
- **Acceptance Criteria**: MFA required before accessing `/api/v1/compliance/*` endpoints for elevated roles; backup recovery codes generated at enrollment; compliant with eIDAS (EU).
- **Priority**: High.

**FR-8.2: JWT Token Blacklisting on Logout** *(NEW)*
- **Description**: Invalidate JWT tokens immediately on logout or forced revocation, preventing reuse of stolen tokens.
- **Steps**:
  1. On `POST /auth/logout`: add `jti` (JWT ID) to Redis blacklist with TTL = remaining token lifetime.
  2. `authMiddleware.ts` checks blacklist on every request.
  3. Admin can force-revoke all tokens for a user (e.g., suspected breach).
- **Acceptance Criteria**: Revoked token returns 401 within 100ms; blacklist entries auto-expire from Redis; no memory leaks from expired entries.
- **Priority**: High.
- **Codebase Impact**: `compliance-system/src/api/src/middleware/authMiddleware.ts`, `compliance-system/src/api/src/config/redis.ts`.

**FR-8.3: SQL Query Externalization** *(NEW)*
- **Description**: Move all inline SQL queries to external `.sql` files loaded via `SqlQueryLoader`, eliminating injection risk if parameterization ever fails.
- **Steps**:
  1. Create `compliance-system/src/api/src/sql/{domain}/` directory structure (kyc/, aml/, compliance/, audit/).
  2. Extract all inline SQL from service files to corresponding `.sql` files.
  3. Use `SqlQueryLoader.load()` utility for all database queries.
  4. Path-traversal protection: validate resolved path stays within `sql/` directory.
- **Acceptance Criteria**: Zero inline SQL strings in service files; `SqlQueryLoader` throws on path-traversal attempts; all SQL files reviewed and parameterized correctly.
- **Priority**: High.
- **Codebase Impact**: All `compliance-system/src/api/src/services/*.ts` files; `compliance-system/src/api/src/utils/sqlLoader.ts` (already scaffolded).

**FR-8.4: API Rate Limiting Policy** *(CLARIFIED – extends existing FR-1.2)*
- **Description**: Define and enforce request rate limits per tier and per endpoint category to prevent abuse and ensure fair usage.
- **Limits**:
  | Tier | General API | Auth endpoints | Compliance scans |
  |------|------------|----------------|-----------------|
  | Free | 60 req/min | 10 req/min | 100/month total |
  | Pro | 600 req/min | 30 req/min | 10,000/month |
  | Enterprise | Custom | Custom | Unlimited |
- **Steps**:
  1. Rate limiter reads tier from JWT claims.
  2. Per-IP and per-API-key counters stored in Redis with sliding window.
  3. Return `429 Too Many Requests` with `Retry-After` header when exceeded.
- **Acceptance Criteria**: Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) present on all responses; limits enforced within ±5% accuracy.
- **Priority**: High.
- **Codebase Impact**: `compliance-system/src/api/src/middleware/rateLimiter.ts` (already scaffolded).

---

### 3.9 Webhook Notifications *(NEW – v1.15)*

> **Codebase Impact**: New `compliance-system/src/api/src/routes/webhookRoutes.ts` and `compliance-system/src/api/src/services/webhookService.ts` (to be implemented).

**FR-9.1: Client Webhook Registration & Delivery** *(NEW)*
- **Description**: Allow clients to register HTTPS webhook URLs to receive real-time notifications when compliance events occur (e.g., KYC REJECTED, AML ESCALATED, STR filed).
- **Steps**:
  1. `POST /api/v1/webhooks` to register: `{ url, events: string[], secret }`.
  2. Ableka signs payload with HMAC-SHA256 using client secret; delivers via POST.
  3. Retry with exponential backoff (3 retries, 30s/120s/300s intervals) on delivery failure.
  4. Client acknowledges with HTTP 200; non-200 triggers retry.
  5. `GET /api/v1/webhooks/{id}/logs` to view delivery history.
- **Supported Event Types**: `kyc.approved`, `kyc.rejected`, `kyc.escalated`, `aml.flagged`, `transfer.blocked`, `str.filed`, `case.opened`.
- **Acceptance Criteria**: Webhook delivered within 5 seconds of event; HMAC signature verifiable by client; delivery log retained for 30 days.
- **Priority**: Medium (Phase 2).

---

### 3.10 Subscription & SaaS Billing Management *(CLARIFIED – v1.15)*

> **Codebase Impact**: New `compliance-system/src/api/src/routes/billingRoutes.ts` and Stripe integration (to be implemented, Phase 5).

**FR-10.1: Tiered Subscription Management** *(CLARIFIED)*
- **Description**: Manage client subscriptions (Free/Pro/Enterprise) with usage metering, enforcement, and Stripe billing integration.
- **Steps**:
  1. Client selects tier during onboarding (UI-1.1).
  2. Scan usage metered per tenant in real-time; stored in `usage_metrics` table.
  3. When Free tier scan limit reached: return `429` with upgrade prompt.
  4. Stripe webhooks update subscription status on payment events.
  5. Usage reports available via `GET /api/v1/billing/usage`.
- **Acceptance Criteria**: Usage counter updated within 1 second of each scan; overage billed at $0.01–$0.05 per scan; subscription changes take effect immediately.
- **Priority**: Medium (Phase 5).

---

## 4. UI Flows and User Interfaces
### 4.1 Ableka Portal (Web App for Clients/Admins)
**UI-1.1: Client Onboarding Flow**  
- **Description**: Web portal for signup and API key management.  
- **Steps**:  
  1. User visits ableka.com/signup.  
  2. Enters org details (name, industry, jurisdiction).  
  3. Selects tier (Free: 100 scans/mo; Pro: $99/mo, 10k scans; Enterprise: custom).  
  4. Verifies email; receives API key/secret.  
  5. Dashboard shows usage limits, docs link.  
- **Wireframe**: Signup form → Tier selection → Confirmation page.  
- **Acceptance Criteria**: Stripe integration for payments; email sent within 5min.

**UI-1.2: Scan Initiation Flow (Demo Client)**  
- **Description**: Test scans via portal before API integration.  
- **Steps**:  
  1. Logged-in client clicks "New Scan" in dashboard.  
  2. Selects scan type: KYC, AML, Fraud, Full Compliance.  
  3. Inputs data: Wallet address, entity ID, tx amount, country.  
  4. Clicks "Scan"; shows progress spinner.  
  5. Displays results: Status (Compliant/Flagged), score, recommendations.  
- **Wireframe**: Form with fields → Progress modal → Results card with drill-down.  
- **Acceptance Criteria**: Real-time updates via WebSocket; export PDF.

**UI-1.3: Results Viewing and Drill-Down**  
- **Description**: Detailed view of scan results.  
- **Steps**:  
  1. From results page, click "View Details".  
  2. See breakdown: KYC status, AML score, fraud flags.  
  3. Citations: Links to regs (e.g., SEBI Rule).  
  4. Actions: Flag for review, re-scan, or report generation.  
- **Wireframe**: Tabbed view (Summary/Details/Audit).  
- **Acceptance Criteria**: Searchable history; alerts for high-risk.

**UI-1.4: Admin Dashboard**  
- **Description**: For Ableka team to manage tenants.  
- **Steps**:  
  1. Admin logs in; sees tenant list.  
  2. View usage metrics (scans/day, errors).  
  3. Edit tiers, suspend accounts.  
  4. Monitor system health (uptime, latency).  
- **Wireframe**: Table with filters → Charts for metrics.  
- **Acceptance Criteria**: Role-based access; real-time alerts.

### 4.2 Demo Client UI (React App)
**UI-2.1: Wallet Scan Flow**  
- **Description**: Simulate scanning a crypto wallet.  
- **Steps**:  
  1. Enter wallet address (e.g., 0x123...).  
  2. Select jurisdiction (India/US/EU).  
  3. Click "Scan for Compliance".  
  4. Agent checks: KYC (Ballerine), AML (Marble), token status (blockchain).  
  5. Output: "Compliant - Low risk; Partition: SEBI-approved".  
- **Wireframe**: Input form → Loading animation → Result summary.  
- **Acceptance Criteria**: Handles invalid addresses; shows error messages.

**UI-2.2: Transaction Anomaly Detection Flow**  
- **Description**: Detect fraud in tx data.  
- **Steps**:  
  1. Upload tx CSV or enter details (amount, velocity).  
  2. Agent analyzes: Layering, velocity > threshold.  
  3. Flags anomalies: "High risk - Potential money laundering".  
  4. Recommendations: "Escalate to compliance team".  
- **Wireframe**: Upload/file input → Analysis progress → Flagged items list.  
- **Acceptance Criteria**: Supports bulk scans; visual charts for anomalies.

**UI-2.3: Report Generation Flow**  
- **Description**: Export compliance reports.  
- **Steps**:  
  1. After scan, click "Generate Report".  
  2. Select format (PDF/JSON).  
  3. Include: Scan ID, date, results, citations.  
  4. Download or email.  
- **Wireframe**: Modal with options → Download button.  
- **Acceptance Criteria**: PDF with Ableka branding; audit trail included.

## 5. Non-Functional Requirements
- **Performance**: 95% uptime; <2s response globally.
- **Scalability**: Handle 10k scans/day across regions; auto-scale to 100k during peaks.
- **Security**: Zero-trust; quarterly audits; GDPR-compliant data handling.
- **Usability**: OpenAPI docs; SDKs in JS/Python; multi-language support (5+ languages).
- **Global Compliance**: Data residency enforcement; geo-redundant infra (AWS regions: US-East, EU-West, AP-South).

## 6. User Stories
- As a fintech dev, I want /kyc-check API so I can onboard users compliantly.
- As a compliance officer, I want audit trails so I can prove adherence.
- As a Compliance Tracker, I want real-time dashboards so I can monitor SEBI/DPDP adherence and escalate risks.
- As a global fintech operator, I want jurisdiction-specific scans so I can comply with EU GDPR and US OFAC simultaneously.
- *(NEW)* As a compliance officer, I want the system to trace corporate UBO structures automatically (FR-7.1) so I can detect shell-company abuse without manual research.
- *(NEW)* As a compliance officer, I want lock-up and holding-limit enforcement (FR-7.5, FR-7.6) so I can ensure PE token transfers comply with DFSA/SEBI concentration rules automatically.
- *(NEW)* As a compliance officer, I want automated STR draft generation (FR-7.12) so I can submit suspicious transaction reports to FIU-IND/UAE FIU with 80% less manual effort.
- *(NEW)* As a platform security engineer, I want JWT token blacklisting (FR-8.2) and SQL query externalization (FR-8.3) so I can close the security gaps identified in the audit.
- *(NEW)* As a fintech developer client, I want webhook notifications (FR-9.1) so I can receive real-time alerts when KYC/AML decisions affect my users without polling the API.

## 7. Functional Requirements Gap Analysis *(NEW – v1.15)*

This section documents the gap assessment performed against existing documentation and implementation.

### 7.1 Coverage Assessment Methodology

The following sources were reviewed:
- `Planning docs/Functional_Requirements.md` (this document, v1.13 before this update)
- `Planning docs/PE_RWA_Tokenization_FRD.md` (v1.0, specialized PE/RWA module)
- `Planning docs/MASTER_IMPLEMENTATION_PLAN.md` (40-week roadmap)
- `Planning docs/Implementation_Audit.md` (pre-implementation gap audit)
- `Planning docs/security-standards-coverage-analysis.md` (security controls analysis)
- `Planning docs/PROJECT_ANALYSIS_ALIGNMENT_REPORT.md` (architecture alignment)
- `compliance-system/src/` (actual implementation)

### 7.2 Identified Gaps

| Gap # | Area | Gap Description | Addressed In | Codebase Status |
|-------|------|----------------|--------------|-----------------|
| G-01 | Corporate Compliance | No FR for KYB/UBO corporate entity verification | FR-7.1 (new) | `kycService.ts` handles individual only |
| G-02 | Enhanced Due Diligence | EDD flow not described in main FRD | FR-7.2 (new) | Not implemented |
| G-03 | Investor Classification | Accredited investor thresholds not in main FRD | FR-7.3 (new) | Not implemented |
| G-04 | Token Lifecycle | No FRs for transfer whitelist, holding limits, lock-up, or corporate actions | FR-7.4–7.7 (new) | `peTokenizationService.ts` partially covers |
| G-05 | Hawala Detection | Only general fraud detection described; PE-specific hawala patterns missing | FR-7.8 (extended) | `amlPatternDetector.ts` has velocity checks |
| G-06 | Cross-Chain Compliance | No unified multi-chain compliance view described in main FRD | FR-7.9 (new) | `blockchainMonitor.ts` covers individual chains |
| G-07 | Oracle Verification | No FRs for property valuation oracle, double-dipping, or source-of-funds oracle | FR-7.10–7.11 (new) | `oracleVerificationService.ts` scaffolded |
| G-08 | Case Management | No structured case lifecycle management FR | FR-7.13 (new) | Not implemented |
| G-09 | STR/SAR Filing | FR-6.2 covers general regulatory reporting; jurisdiction-specific STR filing integration missing | FR-7.12 (extended) | `complianceReportingSystem.ts` partially covers |
| G-10 | MFA | Security analysis identified MFA as missing; no FR existed | FR-8.1 (new) | Not implemented |
| G-11 | Token Blacklisting | Security analysis identified JWT token blacklisting as missing | FR-8.2 (new) | Not implemented |
| G-12 | SQL Externalization | Security analysis flagged inline SQL as a risk; no FR mandated externalization | FR-8.3 (new) | `sqlLoader.ts` utility scaffolded; services have inline SQL |
| G-13 | Rate Limiting | FR-1.2 mentions rate limits conceptually; no per-tier policy documented | FR-8.4 (clarified) | `rateLimiter.ts` scaffolded |
| G-14 | Webhook Notifications | No client notification mechanism described | FR-9.1 (new) | Not implemented |
| G-15 | Billing & SaaS Metering | Subscription tiers mentioned but no FR for billing lifecycle or usage metering | FR-10.1 (clarified) | Not implemented |

### 7.3 Requirements Traceability

The table below maps each new requirement to the relevant existing documentation and the planned implementation module.

| FR # | Documented In | Implemented In | Priority |
|------|--------------|----------------|---------|
| FR-7.1 (KYB) | PE_RWA_Tokenization_FRD FR-102 | `kycService.ts` + new KYB endpoint | P0 MVP |
| FR-7.2 (EDD) | PE_RWA_Tokenization_FRD FR-103 | `kycService.ts` + EDD workflow | P1 |
| FR-7.3 (Accredited Investor) | PE_RWA_Tokenization_FRD FR-105 | `kycService.ts` + jurisdiction YAML | P1 |
| FR-7.4 (Transfer Whitelist) | PE_RWA_Tokenization_FRD FR-201 | `peTokenizationRoutes.ts` + `complianceService.ts` | P0 MVP |
| FR-7.5 (Holding Limits) | PE_RWA_Tokenization_FRD FR-202 | `peTokenizationService.ts` | P1 |
| FR-7.6 (Lock-Up) | PE_RWA_Tokenization_FRD FR-203 | `peTokenizationService.ts` | P0 MVP |
| FR-7.7 (Corporate Actions) | PE_RWA_Tokenization_FRD FR-204 | `peTokenizationService.ts` | P1 |
| FR-7.8 (Hawala) | PE_RWA_Tokenization_FRD FR-302 | `amlPatternDetector.ts` (extend) | P1 |
| FR-7.9 (Cross-Chain) | PE_RWA_Tokenization_FRD FR-303 | `blockchainMonitor.ts` + `multiJurisdictionalMonitor.ts` | P2 |
| FR-7.10 (Oracle) | PE_RWA_Tokenization_FRD FR-401 | `oracleVerificationService.ts` | P1 |
| FR-7.11 (Double-Dipping) | PE_RWA_Tokenization_FRD FR-402 | `oracleVerificationService.ts` | P1 |
| FR-7.12 (STR Filing) | PE_RWA_Tokenization_FRD FR-501 | `complianceReportingSystem.ts` (extend) | P0 MVP |
| FR-7.13 (Case Mgmt) | PE_RWA_Tokenization_FRD FR-503 | New `caseManagementRoutes.ts` (to be built) | P1 |
| FR-8.1 (MFA) | security-standards-coverage-analysis.md | `authMiddleware.ts` (extend) | P1 |
| FR-8.2 (Token Blacklist) | security-standards-coverage-analysis.md | `authMiddleware.ts` + `redis.ts` | P1 |
| FR-8.3 (SQL Externalization) | security-standards-coverage-analysis.md | All service files + `sqlLoader.ts` | P1 |
| FR-8.4 (Rate Limiting) | Implied in FR-1.2 | `rateLimiter.ts` (complete per policy) | P0 MVP |
| FR-9.1 (Webhooks) | — (new) | New `webhookRoutes.ts` + `webhookService.ts` | P1 |
| FR-10.1 (Billing) | UI-1.1 (portal onboarding) | New `billingRoutes.ts` + Stripe (Phase 5) | P2 |

### 7.4 No-Change Confirmation

The following existing FRs were reviewed and confirmed **complete and traceable**:

| FR # | Status | Notes |
|------|--------|-------|
| FR-1.1 (API Key Management) | ✅ Complete | `authMiddleware.ts` implements |
| FR-1.2 (Multi-Tenant Isolation) | ✅ Complete (policy gap clarified in FR-8.4) | `authMiddleware.ts` |
| FR-2.1 (Agent Query Processing) | ✅ Complete | `supervisorAgent.ts`, `agentRoutes.ts` |
| FR-2.2 (RAG for Regulatory Knowledge) | ✅ Complete | `ragService.ts` |
| FR-2.3 (Custom Tools Integration) | ✅ Complete | `compliance-system/src/agents/src/tools/` (kycTool, amlTool, etc.) |
| FR-3.1 (/kyc-check) | ✅ Complete | `kycRoutes.ts` + `kycService.ts` |
| FR-3.2 (/aml-score) | ✅ Complete | `amlRoutes.ts` + `amlService.ts` |
| FR-3.3 (/fraud-detect) | ✅ Complete | `fraudRoutes.ts` + `fraudDetectionService.ts` |
| FR-3.4 (/scan) | ✅ Complete | `scanRoutes.ts` + `advancedComplianceScanner.ts` |
| FR-4.1 (Multi-Agent Orchestration) | ✅ Complete | `supervisorAgent.ts` + `agentOrchestrator.ts` |
| FR-5.1 (Usage Dashboards) | ✅ Complete | `analyticsRoutes.ts` + `analyticsService.ts` |
| FR-5.5 (Hierarchical Agent Integration) | ✅ Complete | `complianceGraphAgent.ts` + `complianceGraph.ts` |
| FR-6.1 (Data Encryption) | ✅ Complete | `encryptionService.ts` + KMS via CDK |
| FR-6.2 (Regulatory Reporting) | ⚠️ Partial – jurisdiction-specific STR integrations addressed in FR-7.12 | `complianceReportingSystem.ts` |

---

## 8. Testing Requirements

- Unit: Jest for tools.
- E2E: Cypress for API flows.
- Load: 1k concurrent users.
- *(NEW)* Unit tests for all new FR-7.x, FR-8.x, FR-9.x requirements (≥ 80% coverage per existing TDD mandate).
- *(NEW)* Integration tests for token transfer whitelist (FR-7.4) covering edge cases: lock-up active, holding limit exceeded, restricted jurisdiction.
- *(NEW)* Security regression tests for JWT blacklisting (FR-8.2) and rate limiting (FR-8.4).

## 9. Change Log
- v1.0: Initial draft based on project plan.
- v1.1: Added global compliance modules, multi-jurisdictional support, localization, and enhanced integrations for EU/US expansion.
- v1.2: Added project scope outline (section 1.7) based on Phase 1, Week 1 research and designs for logical sequencing.
- v1.3: Finalized FRD with Phase 1 outputs (PRD draft, OpenAPI spec, wireframes, tech spec, compliance audit) from Weeks 2-4.
- v1.4: Aligned with detailed per-day goals across all project phases (2-6) for enhanced execution tracking.
- v1.5: Enhanced Phase 2 per-day goals with granular daily tasks for precise implementation.
- v1.6: Enhanced Phase 3 per-day goals with granular daily tasks for integrations and features.
- v1.7: Enhanced Phase 4 per-day goals with granular daily tasks for testing and compliance.
- v1.8: Enhanced Phase 5 per-day goals with granular daily tasks for deployment and launch.
- v1.9: Enhanced Phase 6 per-week goals with granular weekly tasks for iteration and expansion.
- v1.10: Updated scope section with refined in-scope/out-scope based on Phase 1 Week 1 deliverables.
- v1.11: Added user journeys and API design drafts from Phase 1 Week 2.
- v1.12: Added provider evaluations, UI wireframes/designs, localization plan, and proxy design from Phase 1 Week 3.
- v1.13: Finalized FRD with PRD draft, OpenAPI spec, wireframes, tech spec, and compliance audit from Phase 1 Week 4.
- v1.14: Completed Phase 3 Week 14 (Multi-Agent Setup) with comprehensive agent architecture, communication protocols, reasoning and tool integration, learning and adaptation, and deployment/testing frameworks. Consolidated Phase 3 documentation folders - merged "Phase 3 Integrations" and "Phase 3 Advanced Features & Integrations" with the latter being authoritative.
- v1.15: *(NEW)* Conducted full functional requirements gap analysis against existing documentation and implementation. Added new sections 3.7–3.10 covering 15 identified gaps: PE & RWA Tokenization Compliance (FR-7.1–7.13), Security Hardening (FR-8.1–8.4), Webhook Notifications (FR-9.1), and Subscription Billing (FR-10.1). Added Gap Analysis (Section 7) with traceability matrix. Updated user stories (Section 6) with 5 new stories. Extended testing requirements (Section 8) with new test mandates. Renumbered Change Log to Section 9. All new requirements explicitly marked `*(NEW)*` or `*(EXTENDED)*` with codebase impact notes.