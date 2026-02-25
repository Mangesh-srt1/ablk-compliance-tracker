# Functional Requirements Document (FRD) for Ableka Lumina

**Document Version**: 1.13  
**Date**: February 23, 2026  
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

## 7. Testing Requirements
- Unit: Jest for tools.
- E2E: Cypress for API flows.
- Load: 1k concurrent users.

## 8. Change Log
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
- v1.14: Completed Phase 3 Week 14 (Multi-Agent Setup) with comprehensive agent architecture, communication protocols, reasoning and tool integration, learning and adaptation, and deployment/testing frameworks. Consolidated Phase 3 documentation folders - merged "Phase 3 Integrations" and "Phase 3 Advanced Features & Integrations" with the latter being authoritative.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\Functional_Requirements.md