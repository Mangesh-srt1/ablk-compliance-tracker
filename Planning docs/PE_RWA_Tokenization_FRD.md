# PE & Real-Estate Tokenization Compliance Platform
## Functional Requirements Document (FRD)

**Document Version**: 1.0  
**Date**: February 28, 2026  
**Project**: Ableka Lumina – PE & RWA Tokenization Compliance Module  
**Architecture**: AI-driven compliance engine integrated with existing Ableka Lumina platform

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Platform Context](#2-platform-context)
3. [Feature Benchmark Matrix](#3-feature-benchmark-matrix)
4. [Domain FR-100: Customer & Asset Onboarding](#4-domain-fr-100-customer--asset-onboarding-kyckyb-edd)
5. [Domain FR-200: Token Issuance & Lifecycle Controls](#5-domain-fr-200-token-issuance--lifecycle-controls)
6. [Domain FR-300: Transaction Monitoring & Real-Time Risk Scoring](#6-domain-fr-300-transactionp2p-monitoring--real-time-risk-scoring)
7. [Domain FR-400: Oracle & Off-Chain Ownership Verification](#7-domain-fr-400-oracle--off-chain-ownership-verification)
8. [Domain FR-500: Reporting & Case Management](#8-domain-fr-500-reporting--case-management)
9. [Domain FR-600: Governance & Configuration](#9-domain-fr-600-governance--configuration)
10. [Non-Functional Requirements (NFR)](#10-non-functional-requirements-nfr)
11. [Feature Roadmap](#11-feature-roadmap)
12. [Regulatory Traceability Matrix](#12-regulatory-traceability-matrix)

---

## 1. Executive Summary

Ableka Lumina's PE & RWA Tokenization Compliance Module extends the core AI compliance engine to serve **private equity fund managers** and **real-estate asset tokenization platforms** that issue, manage, and trade tokenized securities.

### Key Principles (from RegTech Book & industry analysis)
- **Automation over Manual**: All compliance controls prefer automated verification (AI agents) over human-in-the-loop flows.
- **Explainability**: Every decision must produce a human-readable rationale for regulatory audit.
- **Jurisdiction-first routing**: Rules are loaded dynamically from YAML config (no hardcoded logic).
- **Blockchain-agnostic**: The compliance module integrates with any blockchain via client-provided RPC. No on-chain logic is deployed by Ableka Lumina.

### Supported Asset Classes
- **Private Equity (PE)** tokens — tokenized LP interests in closed-end funds
- **Real Estate Investment Tokens** — fractional ownership of commercial/residential property
- **REIT tokens** — digital units in Saudi/UAE/India REITs
- **Debt instruments** — tokenized private credit, mezzanine debt

### Supported Jurisdictions (Tokenization-specific)
| Code | Jurisdiction | Regulator | Key Framework |
|------|-------------|-----------|----------------|
| `AE` | UAE / Dubai | DFSA, SCA, ADGM | Digital Securities Regime |
| `SA` | Saudi Arabia | Saudi CMA | REIT Regulation, DLT Framework |
| `IN` | India | SEBI, RBI | AIF Category II/III, PMLA |
| `SG` | Singapore | MAS | MAS Digital Token Framework |
| `US` | United States | SEC, FINRA | Reg D, Reg A+, Reg S |
| `EU` | European Union | ESMA | MiCA, AIFMD, MiFID II |

---

## 2. Platform Context

### 2.1 Ableka Lumina Architecture Positioning

```
┌─────────────────────────────────────────────────────────────────────┐
│                   PE / RWA Tokenization Platform                    │
│          (Client: Tokenization Portal, Token Smart Contracts)       │
└────────────────────────┬────────────────────────────────────────────┘
                         │  REST API / WebSocket
┌────────────────────────▼────────────────────────────────────────────┐
│                    Ableka Lumina API Gateway                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │     PE/RWA Tokenization Compliance Module (THIS FRD)        │   │
│   │  ┌──────────────┐ ┌────────────┐ ┌───────────┐ ┌────────┐  │   │
│   │  │ Onboarding   │ │  Lifecycle │ │ TX Monitor│ │ Oracle │  │   │
│   │  │ KYC/KYB/EDD  │ │  Controls  │ │  & Risk   │ │Verif.  │  │   │
│   │  └──────────────┘ └────────────┘ └───────────┘ └────────┘  │   │
│   │  ┌──────────────┐ ┌────────────────────────────────────────┐│   │
│   │  │  Reporting & │ │     Governance & Policy-as-Code        ││   │
│   │  │  Case Mgmt   │ │     (Jurisdiction YAML Config)         ││   │
│   │  └──────────────┘ └────────────────────────────────────────┘│   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Industry Benchmarks Analyzed

| Platform | KYC/AML | Token Lifecycle | Jurisdiction | Monitoring | Oracle |
|----------|---------|-----------------|-------------|------------|--------|
| **Tokeny (T-REX)** | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| **Zoniqx DyCIST** | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| **InvestaX** | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| **TRM Labs** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Bitbond** | ✅ | ✅ | ⚠️ | ⚠️ | ❌ |
| **Ableka Lumina (this)** | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ Full support | ⚠️ Partial | ❌ Not supported

### 2.3 Gap Analysis – Ableka Lumina vs. Competitors

**Gaps identified and addressed in this FRD:**
1. **Double-dipping prevention** (oracle verification) – most competitors lack this
2. **Hawala pattern detection** specific to PE fund flows
3. **Corporate action compliance** (dividend, redemption, capital call)
4. **REIT-specific Saudi CMA rules** (SAR thresholds)
5. **Explainable AI risk scoring** with audit trail for every decision

---

## 3. Feature Benchmark Matrix

### Features vs. My Platform

| Feature | Tokeny | Zoniqx | InvestaX | Ableka Lumina |
|---------|--------|--------|----------|---------------|
| Individual KYC (Ballerine) | ✅ | ✅ | ✅ | ✅ FR-101 |
| Corporate KYB (UBO tracing) | ✅ | ✅ | ✅ | ✅ FR-102 |
| Enhanced Due Diligence (EDD) | ⚠️ | ✅ | ✅ | ✅ FR-103 |
| PEP / Sanctions screening | ✅ | ✅ | ✅ | ✅ FR-104 |
| Accredited investor verification | ⚠️ | ✅ | ✅ | ✅ FR-105 |
| Token whitelist / transfer restrictions | ✅ | ✅ | ✅ | ✅ FR-201 |
| Holding limit enforcement | ⚠️ | ✅ | ⚠️ | ✅ FR-202 |
| Lock-up / vesting schedule | ✅ | ✅ | ✅ | ✅ FR-203 |
| Corporate action compliance | ⚠️ | ⚠️ | ⚠️ | ✅ FR-204 |
| Real-time AML transaction monitoring | ✅ | ✅ | ⚠️ | ✅ FR-301 |
| Velocity / hawala pattern detection | ❌ | ⚠️ | ❌ | ✅ FR-302 |
| Cross-chain monitoring | ❌ | ⚠️ | ❌ | ✅ FR-303 |
| Oracle / off-chain verification | ❌ | ⚠️ | ❌ | ✅ FR-401 |
| Double-dipping prevention | ❌ | ❌ | ❌ | ✅ FR-402 |
| Property valuation oracle | ❌ | ❌ | ❌ | ✅ FR-403 |
| SAR / STR automated filing | ⚠️ | ✅ | ⚠️ | ✅ FR-501 |
| Regulatory report generation | ⚠️ | ✅ | ⚠️ | ✅ FR-502 |
| Case management workflow | ⚠️ | ✅ | ⚠️ | ✅ FR-503 |
| Policy-as-code (YAML rules) | ❌ | ⚠️ | ❌ | ✅ FR-601 |
| Multi-jurisdiction router | ⚠️ | ✅ | ⚠️ | ✅ FR-602 |
| Audit log (immutable) | ✅ | ✅ | ✅ | ✅ FR-603 |

---

## 4. Domain FR-100: Customer & Asset Onboarding (KYC/KYB/EDD)

### FR-101: Individual Investor KYC

**Title**: Individual KYC for Tokenized Asset Investors  
**Inspired by**: *The RegTech Book* (Ch. 4 – Digital Identity); FATF Guidance on Digital Assets  

**User Story**: As a compliance officer, I want the system to automatically verify individual investors against identity documents and sanctions lists so that only eligible, verified investors can hold tokenized assets.

**Preconditions**:
- Investor onboarding API call received with name, DOB, address, documents, jurisdiction
- Jurisdiction is supported (AE, SA, IN, SG, US, EU)

**Main Flow**:
1. Extract jurisdiction from investor data
2. Load jurisdiction-specific KYC rules from `{jurisdiction}.yaml`
3. Submit identity documents to Ballerine (primary KYC provider)
4. Run PEP/Sanctions screening via OFAC + jurisdiction-specific list
5. Verify investor meets minimum age requirements (per jurisdiction YAML)
6. For tokenized assets: verify "accredited investor" / "qualified investor" status
7. Calculate KYC risk score (weighted: identity 40%, sanctions 35%, PEP 25%)
8. Store result in `kyc_checks` table with AI reasoning
9. Return: `{ status: APPROVED/REJECTED/ESCALATED, riskScore, reasoning, checkId }`

**Alternate Flows**:
- **Ballerine API timeout**: Fall back to cached result if within 24h; otherwise ESCALATE
- **PEP match**: Automatic ESCALATE with flag `PEP_MATCH`; require manual review
- **Sanctions hit**: Automatic REJECT with flag `SANCTIONS_MATCH`; log for regulatory reporting

**Data Elements**:
```typescript
interface KYCOnboardingRequest {
  entityId: string;                    // Unique investor ID
  jurisdiction: string;                // ISO 3166 code (AE, IN, US, etc.)
  entityType: 'individual' | 'corporate';
  fullName: string;
  dateOfBirth: string;                 // ISO 8601
  nationality: string;                 // ISO 3166
  residenceCountry: string;
  documents: KYCDocument[];
  investorType?: 'retail' | 'accredited' | 'qualified' | 'institutional';
  netWorthUSD?: number;                // For accreditation check
  annualIncomeUSD?: number;
}

interface KYCDocument {
  type: 'passport' | 'national_id' | 'drivers_license' | 'utility_bill' | 'aadhaar' | 'uae_id';
  documentNumber: string;
  expiryDate: string;
  issuingCountry: string;
  imageBase64?: string;                // For liveness check
}
```

**Regulatory Rationale**: FATF Recommendation 10 (CDD), UAE DFSA Rule RPP 7, SEBI AIF Regulation 17

---

### FR-102: Corporate Entity KYB (Know Your Business)

**Title**: Corporate KYB with UBO Tracing  
**Inspired by**: *Anti-Money Laundering in a Nutshell* (Ch. 6 – Corporate Structures)

**User Story**: As a compliance officer, I want to trace the Ultimate Beneficial Ownership (UBO) structure of corporate entities investing in tokenized assets, to prevent shell company abuse.

**Preconditions**:
- Entity type is 'corporate'
- Registration documents and ownership structure provided

**Main Flow**:
1. Load jurisdiction-specific KYB requirements (corporate registration, tax ID, UBO threshold)
2. Verify corporate registration via relevant registry (UAE MOE, India MCA, US Delaware)
3. Extract ownership structure from provided documents
4. Apply UBO identification threshold (AE: 25%+, EU: 25%+, IN: 10%+ per PMLA)
5. For each UBO (individual ≥ threshold): trigger FR-101 KYC check
6. Verify no circular ownership or shell-company indicators
7. Calculate KYB risk score
8. Return consolidated result with UBO chain

**Data Elements**:
```typescript
interface KYBRequest {
  entityId: string;
  jurisdiction: string;
  legalName: string;
  registrationNumber: string;
  registrationCountry: string;
  incorporationDate: string;
  businessType: 'llc' | 'corporation' | 'partnership' | 'trust' | 'fund';
  uboStructure: UBONode[];
  regulatedEntity: boolean;            // Is it a regulated fund?
  aifLicense?: string;                 // AIF/DFSA license number if regulated
}

interface UBONode {
  entityId: string;
  name: string;
  type: 'individual' | 'corporate';
  ownershipPercentage: number;
  controlType: 'direct' | 'indirect' | 'voting';
  children?: UBONode[];               // For nested corporate structures
}
```

**Regulatory Rationale**: FATF R.24, UAE AML/CFT Federal Decree-Law No.20/2018, EU AMLD5 Art.30

---

### FR-103: Enhanced Due Diligence (EDD) for High-Risk Investors

**Title**: AI-Automated Enhanced Due Diligence  
**Inspired by**: *Regtech, Suptech and Beyond* (Ch. 9 – AI in AML)

**User Story**: As a compliance officer, I want the system to automatically trigger Enhanced Due Diligence for high-risk investors (PEPs, high-risk jurisdictions, large investments) with explainable reasoning.

**Preconditions**:
- Standard KYC (FR-101) completed with risk score ≥ 60 OR PEP_MATCH flag
- Investment amount exceeds jurisdiction EDD threshold

**Triggers** (any one):
- KYC risk score ≥ 60
- PEP match detected
- Country of residence in FATF grey/black list
- Investment amount > $1M USD equivalent
- Source of funds cannot be verified through standard means

**Main Flow**:
1. Generate EDD request with pre-populated investor profile
2. Collect additional documentation:
   - Source of wealth declaration
   - Source of funds evidence (bank statements 6 months)
   - Business activity evidence
   - Professional references (for PE investors)
3. Run AI analysis on submitted documents (LangChain agent)
4. Check against adverse media database
5. Verify source of funds aligns with investment amount
6. Compliance officer review workflow (manual sign-off required)
7. Store EDD record with full audit trail

**Regulatory Rationale**: FATF R.19 (EDD), UAE CBUAE Notice 2021/2, SEBI Master Circular AML

---

### FR-104: PEP and Sanctions Screening

**Title**: Real-Time PEP/Sanctions Screening with Auto-Refresh  
**Inspired by**: TRM Labs approach; OFAC integration patterns

**User Story**: As a compliance officer, I want continuous PEP/sanctions screening for all investors and counterparties, with automatic alerts when status changes.

**Preconditions**:
- Entity is onboarded (KYC/KYB completed)
- Sanctions lists configured in jurisdiction YAML

**Main Flow**:
1. Screen against configured sanctions lists:
   - OFAC SDN (US mandatory)
   - UN Security Council (global)
   - DFSA Persons List (AE)
   - EU Consolidated Sanctions List (EU)
   - Saudi CMA list (SA)
2. Match using fuzzy name matching (Levenshtein distance ≤ 0.1)
3. Screen for PEP status using Ballerine/World-Check provider
4. Store result with match confidence score
5. Schedule re-screening every 24 hours (configurable per jurisdiction)
6. Alert compliance officer on any new match

**Regulatory Rationale**: FATF R.6 (targeted financial sanctions), UNSCR 1373

---

### FR-105: Accredited/Qualified Investor Verification

**Title**: Investor Classification for Tokenized Securities  
**Inspired by**: InvestaX investor verification; SEC Reg D requirements

**User Story**: As a compliance officer, I want to verify that investors meet the accredited/qualified investor thresholds before allowing them to invest in restricted tokenized PE/RE securities.

**Main Flow**:
1. Load investor classification thresholds from jurisdiction YAML:
   - US Reg D: $200k income (individual) or $1M net worth
   - UAE DFSA: $500k investable assets or "Professional Client"
   - Saudi CMA: SAR 200k investment for institutional, SAR 50k for HNW
   - India SEBI AIF: ₹1 crore minimum investment
2. Verify against submitted financial documents
3. AI model assesses self-certification plausibility
4. Issue investor classification token (APPROVED/CONDITIONAL/REJECTED)
5. Link classification to token whitelist (FR-201)

---

## 5. Domain FR-200: Token Issuance & Lifecycle Controls

### FR-201: Token Transfer Whitelist Management

**Title**: Compliance-Gated Token Transfer Whitelist  
**Inspired by**: Tokeny T-REX ERC-3643; Zoniqx DyCIST transfer controls

**User Story**: As a compliance officer, I want only KYC-verified, jurisdiction-eligible investors to receive tokenized asset transfers, enforced at the compliance API layer before any on-chain transaction.

**Preconditions**:
- Both sender and receiver have completed KYC (FR-101/FR-102)
- Token transfer request received with from/to addresses and amount

**Main Flow**:
1. Receive transfer check request: `POST /api/compliance/transfer-check`
2. Verify sender address is on compliance whitelist
3. Verify receiver address is on compliance whitelist
4. Check receiver's jurisdiction eligibility for this specific token type
5. Check holding limit compliance (FR-202)
6. Check lock-up period if applicable (FR-203)
7. Run AML screening on transfer (FR-301)
8. Calculate composite risk score
9. Decision: APPROVED / REJECTED / ESCALATED
10. Return: `{ status, riskScore, checks: {kyc_sender, kyc_recipient, aml, whitelist, geofence, amount} }`

**Validation Rules**:
```yaml
# ae-dubai.yaml (jurisdiction config)
transferControls:
  requireBothPartiesKYC: true
  maxSingleTransferUSD: 10000000  # $10M without enhanced review
  restrictedJurisdictions: ["IR", "KP", "SY", "CU"]  # OFAC
  requireComplianceOfficerApproval:
    thresholdUSD: 5000000
  geofenceEnabled: true
```

---

### FR-202: Investor Holding Limit Enforcement

**Title**: Per-Investor Token Holding Cap  
**Inspired by**: DFSA Asset Concentration Rules; SEBI portfolio limits

**User Story**: As a compliance officer, I want to prevent any single investor from exceeding jurisdiction-defined concentration limits in a tokenized asset.

**Main Flow**:
1. On each transfer request, retrieve investor's current holdings for this token
2. Calculate new holding if transfer is approved
3. Compare against configured limits (from jurisdiction YAML):
   - UAE DFSA: 20% max single investor concentration in a fund
   - SEBI AIF: No single investor > 33% of AIF corpus
4. If limit exceeded: auto-REJECT with `HOLDING_LIMIT_EXCEEDED` reason
5. Update holding register in real-time

---

### FR-203: Lock-Up Period & Vesting Schedule Enforcement

**Title**: PE Fund Lock-Up Period Compliance  
**Inspired by**: PE fund legal structures; UAE DIFC CIS Rules

**User Story**: As a compliance officer, I want the system to block token transfers during mandatory lock-up periods for PE fund tokens.

**Main Flow**:
1. On transfer request, check `token_lifecycle` table for lock-up end date
2. If current date < lock-up end date: REJECT with `LOCKUP_ACTIVE` reason
3. Support vesting schedules (linear, cliff, milestone-based)
4. Log all blocked transfers for audit trail
5. Notify investor when lock-up expires (proactive alert)

**Data Model**:
```typescript
interface TokenLifecycle {
  tokenId: string;
  fundId: string;
  issuanceDate: Date;
  lockupEndDate?: Date;
  vestingSchedule?: VestingSchedule;
  redemptionWindows: RedemptionWindow[];
  status: 'active' | 'locked' | 'redeemable' | 'expired';
}
```

---

### FR-204: Corporate Action Compliance (Dividend, Redemption, Capital Call)

**Title**: Compliance Controls for Corporate Actions  
**Inspired by**: *The RegTech Book* (Ch. 11 – Corporate Governance); SEBI LODR

**User Story**: As a compliance officer, I want the system to validate all corporate actions (dividend distribution, redemption, capital call) against regulatory requirements before they execute.

**Supported Corporate Actions**:

#### FR-204a: Dividend / Distribution Compliance
1. Verify fund has distributable profits (audited financials linked via oracle)
2. Check all recipient investors are KYC-current (not expired)
3. Apply withholding tax rules per jurisdiction pair (investor country × fund country)
4. Validate distribution amount ≤ distributable reserves
5. Generate dividend distribution compliance certificate

#### FR-204b: Redemption Request Compliance
1. Verify investor is within redemption window (not locked-up)
2. Check for any pending SAR/STR filings against investor
3. Verify redemption amount ≤ investor's vested holding
4. Run AML check on redemption (large redemptions > $500k trigger EDD)
5. Return: `{ approved: boolean, netAmount, withholdingTax, reason }`

#### FR-204c: Capital Call Compliance
1. Validate capital call is within committed capital limits
2. Verify investor has sufficient callable capital remaining
3. Confirm capital call notice period compliance (AE: 10 days, IN: 21 days per YAML)
4. Flag unusual capital calls (>50% of committed in single call) for review

---

## 6. Domain FR-300: Transaction/P2P Monitoring & Real-Time Risk Scoring

### FR-301: Real-Time AML Transaction Monitoring

**Title**: AI-Powered Transaction Risk Scoring  
**Inspired by**: *Anti-Money Laundering in a Nutshell* (Ch. 4 – Transaction Monitoring); Marble AML

**User Story**: As a compliance officer, I want every tokenized asset transaction to be automatically scored for AML risk using AI, with explainable flags.

**Main Flow**:
1. Receive transaction event (from blockchain listener or API)
2. Extract: from, to, amount, currency, token type, timestamp
3. Run parallel checks (LangChain agent, max 2s):
   - Amount threshold check (AE: >AED 55,000 triggers CTR)
   - Velocity check (FR-302)
   - Sanctions screening (FR-104, re-run)
   - Counterparty risk assessment (from `aml_checks` history)
   - Blockchain address reputation (Chainalysis if public chain)
4. Calculate composite AML risk score (0-100)
5. Decision thresholds (from jurisdiction YAML):
   - Score 0-29: APPROVED (auto-proceed)
   - Score 30-69: ESCALATED (compliance officer review queue)
   - Score 70-100: REJECTED (auto-block, trigger STR workflow)
6. Store in `aml_checks` table with reasoning
7. Return within 2 seconds (SLA)

**Risk Score Weights**:
```typescript
const riskWeights = {
  amountThreshold: 0.25,   // Large cash equivalent
  velocityScore: 0.20,     // Unusual frequency
  sanctionsMatch: 0.30,    // OFAC/UN match (highest weight)
  counterpartyRisk: 0.15,  // Historical counterparty AML score
  behavioralAnomaly: 0.10, // ML-based anomaly detection
};
```

---

### FR-302: Velocity & Hawala Pattern Detection

**Title**: Hawala-Pattern AML Detection for PE Token Flows  
**Inspired by**: FATF Typology 2023 (Virtual Asset Hawala); UAE FIU guidance

**User Story**: As a compliance officer, I want the system to detect hawala-like layering patterns in PE token transactions (structured transfers designed to evade reporting thresholds).

**Hawala Patterns Detected**:
1. **Structuring**: Multiple transfers just below reporting threshold within 24h
2. **Round-tripping**: Token transferred out and back within 48h through intermediaries
3. **Fan-out**: One large transfer split into many small equal transfers
4. **Fan-in**: Many small transfers aggregating to one large withdrawal
5. **Mirror trading**: Simultaneous buy/sell of same token amount in different jurisdictions

**Main Flow**:
1. On each transaction, pull last 30 days of transactions for sender/receiver
2. Run pattern detection algorithms:
   - Structuring: check if sum of 24h transactions ÷ single threshold > 0.85
   - Round-trip: graph analysis for circular flows within 48h
   - Fan-out/in: entropy analysis of transfer amounts
3. Calculate `hawalaScore` (0-100)
4. Return: `{ flagged: boolean, hawalaScore, patterns: string[], recommendation }`

**Regulatory Rationale**: FATF R.7 (wire transfer rules), UAE CBUAE AML Regulation 2020

---

### FR-303: Cross-Chain Compliance Monitoring

**Title**: Unified Compliance View Across Multiple Blockchains  
**Inspired by**: TRM Labs multi-chain approach

**User Story**: As a compliance officer, I want to see a unified compliance view of an investor's activity across all blockchains (permissioned Besu for PE, Ethereum for public RWA) without losing context.

**Main Flow**:
1. When monitoring request received, determine blockchain type:
   - `permissioned`: Hyperledger Besu (institutional PE)
   - `public`: Ethereum/Solana (retail-accessible assets)
2. Subscribe to events on client-provided RPC endpoint
3. For `public` chains: additionally query Chainalysis for wallet risk score
4. Aggregate cross-chain activity per investor wallet
5. Alert on: cross-chain bridging activity, anonymous chain mixing, unusual cross-chain velocity

---

## 7. Domain FR-400: Oracle & Off-Chain Ownership Verification

### FR-401: Property Valuation Oracle Integration

**Title**: Off-Chain Property Value Verification  
**Inspired by**: Investax RWA compliance checklist; property token standards

**User Story**: As a compliance officer, I want the system to verify that the on-chain token price/supply is consistent with current off-chain property valuations, to prevent inflated tokenization fraud.

**Main Flow**:
1. Receive token issuance or large transfer request (>$1M)
2. Query registered property valuation oracle (client-provided endpoint)
3. Retrieve current "Net Asset Value (NAV)" from oracle
4. Compare tokenized supply × token price vs. oracle NAV
5. If discrepancy > 10%: trigger compliance alert and ESCALATE transfer
6. Log oracle query result with timestamp for audit

**Data Elements**:
```typescript
interface OracleVerificationRequest {
  assetId: string;                       // Underlying real estate asset
  tokenContractAddress: string;
  tokenSupply: bigint;
  requestedTokenPrice: number;          // USD per token
  oracleEndpoint: string;               // Client-provided
  maxDiscrepancyPercent: number;        // From jurisdiction config
}

interface OracleVerificationResult {
  oracleNAV: number;                    // USD total NAV from oracle
  impliedTokenNAV: number;              // Supply × price
  discrepancyPercent: number;
  lastValuationDate: Date;
  valuerName: string;                   // Licensed valuer
  compliant: boolean;
}
```

---

### FR-402: Double-Dipping Prevention

**Title**: Cross-Platform Duplicate Tokenization Detection  
**Inspired by**: *The RegTech Book* (Ch. 16 – DLT Risks); Investax compliance checklist

**User Story**: As a compliance officer, I want to prevent the same underlying real-world asset from being tokenized more than once (double-dipping), which would create fraudulent duplicate claims.

**Preconditions**:
- Asset registration request received with asset details
- Asset has a unique identifier (property ID, fund registration number)

**Main Flow**:
1. Extract asset unique identifier (title deed number, fund registration, land registry ID)
2. Query internal asset registry: `asset_registry` table
3. If asset ID already registered with different token address: REJECT with `DUPLICATE_ASSET`
4. Query external property registries (client-provided):
   - UAE: Dubai Land Department API
   - India: State land registry
   - Saudi: Ministry of Justice Aqari
5. Verify asset legal title matches registered token issuer
6. Register new asset with token address and issue "uniqueness certificate"

**Regulatory Rationale**: Anti-fraud controls required by DFSA PIB 2.6, SEBI AIF Reg 24

---

### FR-403: Source of Funds Oracle Verification

**Title**: Automated Source of Funds Verification for Large Investments  
**Inspired by**: UAE CBUAE Guidance on Source of Funds

**User Story**: As a compliance officer, I want to automatically verify that large PE investments come from legitimate, tax-compliant sources by integrating with banking and financial data providers.

**Main Flow**:
1. Triggered for investments > $500k USD equivalent
2. Request investor to link bank account via open banking (if available in jurisdiction)
3. For jurisdictions without open banking: accept uploaded bank statements
4. Run AI analysis on bank statements:
   - Identify income sources
   - Verify cumulative balance sufficient for investment
   - Flag any cash deposits, structuring, or unusual patterns
5. Cross-reference with declared source of wealth (from EDD FR-103)
6. Score source of funds verification confidence (0-100)
7. APPROVE if score ≥ 75; ESCALATE if 50-74; REJECT if < 50

---

## 8. Domain FR-500: Reporting & Case Management

### FR-501: Automated STR/SAR Filing

**Title**: AI-Generated Suspicious Transaction Reports  
**Inspired by**: *Anti-Money Laundering in a Nutshell* (Ch. 8 – STR Filing); FATF R.20

**User Story**: As a compliance officer, I want the system to automatically draft STR/SAR reports when suspicious activity is detected, reducing manual effort by 80%.

**Trigger Conditions**:
- AML risk score ≥ 70 (auto-REJECTED transaction)
- Hawala pattern score ≥ 80
- Sanctions hit (any)
- Manual escalation by compliance officer

**Main Flow**:
1. LangChain agent generates STR/SAR draft:
   - Uses transaction details, AML flags, investor history
   - Generates narrative explanation of suspicious activity
   - Maps to regulatory form fields (per jurisdiction)
2. Compliance officer reviews draft (optional: AI can auto-file below threshold)
3. Submit to appropriate authority:
   - AE: UAE FIU via goAML platform
   - IN: FIU-IND submission
   - US: FinCEN via BSA E-Filing
   - SA: SAFIU Saudi Financial Intelligence Unit
4. Store filing record: `{ filingId, status, filingReference, retentionPeriod: '5 years' }`
5. Return: `{ filingId, status, regulatoryBody, retentionPeriod }`

**Filing Reference Format**: `STR-{JurisdictionCode}-{Timestamp}`  
**Retention**: 5 years (minimum, per FATF R.11)

---

### FR-502: Regulatory Report Generation

**Title**: Automated Regulatory Reporting for Tokenized Funds  
**Inspired by**: SEBI AIF Reporting; DFSA Periodic Returns; Saudi CMA fund reports

**Report Types Generated**:

| Report | Jurisdiction | Frequency | Authority |
|--------|-------------|-----------|-----------|
| AIF Quarterly Report | India | Quarterly | SEBI |
| CTR (Currency Transaction Report) | AE | Per transaction | CBUAE |
| Periodic Return | UAE DFSA | Quarterly | DFSA |
| Form D Notice | US | Per offering | SEC |
| AIFMD Annex IV | EU | Semi-annual | NCAs |
| Saudi CMA Fund Report | SA | Quarterly | Saudi CMA |

**Main Flow**:
1. Aggregate compliance data for reporting period
2. AI agent formats report per jurisdiction template
3. Validate completeness against regulatory checklist
4. Generate PDF + structured data (XML/JSON for e-filing)
5. Route to compliance officer for review
6. Archive with 5-year retention policy

---

### FR-503: Case Management Workflow

**Title**: Compliance Case Lifecycle Management  
**Inspired by**: Zoniqx case management; DFSA investigation requirements

**User Story**: As a compliance officer, I want a structured workflow to investigate, document, and resolve compliance cases from detection through resolution.

**Case Types**: Suspicious activity, Failed KYC, Sanctions hit, Corporate action dispute, Data breach

**Main Flow**:
1. Case created automatically from alert or manually
2. AI agent populates case with relevant evidence:
   - Transaction history
   - KYC/KYB records
   - Previous AML checks
   - Similar historical cases (using PGVector similarity search)
3. Compliance officer assigned (round-robin or by expertise)
4. Investigation workflow:
   - Evidence gathering (document request to investor)
   - AI-assisted analysis
   - Decision (close/escalate/report)
5. Regulatory reporting if required (FR-501/FR-502)
6. Case closed with full audit trail

**Case Status States**: `OPEN` → `INVESTIGATING` → `PENDING_INFO` → `RESOLVED` | `REPORTED`

---

## 9. Domain FR-600: Governance & Configuration

### FR-601: Policy-as-Code (Jurisdiction YAML Config)

**Title**: Declarative Compliance Rules via YAML  
**Inspired by**: Zoniqx DyCIST multi-jurisdictional features; *Regtech, Suptech* (Ch. 13 – RegTech Architecture)

**User Story**: As a compliance architect, I want to define jurisdiction-specific compliance rules in YAML files that the AI agent reads at runtime, without any code changes needed for new jurisdictions.

**YAML Schema**:
```yaml
# src/config/jurisdictions/ae-dubai.yaml
jurisdiction:
  code: AE
  name: "UAE - Dubai (DFSA)"
  regulator: DFSA
  
kyc:
  providers: [ballerine, world_check]
  minimumAge: 21
  documentRequirements:
    individual: [UAE_ID, PASSPORT]
    corporate: [TRADE_LICENSE, MOA, UBO_DECLARATION]
  pepScreeningRequired: true
  eddThresholdUSD: 500000
  accreditedInvestorThresholdUSD: 500000
  
aml:
  ctrThresholdAED: 55000          # UAE CTR threshold
  sarFilingAuthority: UAE_FIU
  goAMLIntegration: true
  sanctionsList: [OFAC_SDN, UN_SECURITY_COUNCIL, UAE_LOCAL_WATCH_LIST]
  velocityCheckEnabled: true
  hawalaDetectionEnabled: true
  
tokenization:
  transferRestrictions:
    requireBothPartiesKYC: true
    holdingLimitPercent: 20
    restrictedJurisdictions: [IR, KP, SY, CU, SD]
  lockupRules:
    defaultLockupDays: 365
    redemptionWindowDays: 30
  corporateActions:
    capitalCallNoticeDays: 10
    dividendWithholdingTax: 0.0   # UAE: 0% withholding
    redemptionAMLThresholdUSD: 500000
    
oracle:
  valuationOracle:
    provider: DLD  # Dubai Land Department
    maxDiscrepancyPercent: 10
    revaluationFrequencyDays: 90
  doubleCheckRegistry: true
  assetRegistryEndpoint: "https://api.dubailand.gov.ae/v1/properties"
  
reporting:
  periodicReturnFrequency: quarterly
  ctrFilingDeadlineHours: 24
  retentionYears: 5
  reportingAuthority: DFSA
  
governance:
  majorChangesRequireVote: true
  votingThreshold: 66
  auditLogRetentionYears: 7
```

---

### FR-602: Multi-Jurisdiction Compliance Router

**Title**: Intelligent Jurisdiction Routing  
**Inspired by**: Zoniqx DyCIST jurisdiction routing

**User Story**: As a platform operator, I want the compliance engine to automatically select the correct rules based on the investor/asset jurisdiction pair, without any manual intervention.

**Routing Logic**:
```typescript
// Jurisdiction routing priority order:
// 1. Asset jurisdiction (where the fund/property is registered)
// 2. Investor jurisdiction (where investor is resident)
// 3. Transaction jurisdiction (where transaction is occurring)
// If jurisdictions conflict: apply most restrictive rule set
```

**Main Flow**:
1. Extract jurisdiction from request (investor country, asset country)
2. Load applicable YAML configs for each jurisdiction
3. If jurisdictions differ: merge rules, applying most restrictive per dimension
4. Execute compliance checks with merged rule set
5. Log which jurisdiction rule applied for each check (audit trail)

---

### FR-603: Immutable Audit Log

**Title**: Tamper-Proof Compliance Decision Audit Trail  
**Inspired by**: *The RegTech Book* (Ch. 14 – Auditability); DFSA CIR audit requirements

**User Story**: As a regulator/auditor, I want a complete, immutable record of every compliance decision made by the system, including the AI reasoning, so I can audit the platform.

**Audit Log Entry**:
```typescript
interface AuditLogEntry {
  id: string;                          // UUID
  timestamp: Date;                     // ISO 8601, immutable
  entityId: string;                    // Who was checked
  checkType: 'KYC' | 'AML' | 'TRANSFER' | 'ORACLE' | 'SAR';
  decision: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  riskScore: number;
  reasoning: string;                   // AI-generated explanation
  rulesApplied: string[];             // List of YAML rules triggered
  jurisdictions: string[];
  complianceOfficerId?: string;        // If human reviewed
  immutableHash: string;               // SHA-256 of entry content
  previousHash: string;                // Chain for tamper detection
}
```

**Retention**: 7 years (exceeds most jurisdictional requirements)  
**Access**: Read-only to all authenticated users; only system can write

---

## 10. Non-Functional Requirements (NFR)

### NFR-001: Performance
| Metric | Requirement | Notes |
|--------|-------------|-------|
| KYC check response time | < 2 minutes | Full external provider round-trip |
| Transfer check (sync) | < 2 seconds | P95 latency |
| AML score calculation | < 500ms | Excluding external APIs |
| Real-time monitoring alert | < 1 second | From event detection |
| API availability | 99.9% uptime | Excluding maintenance windows |

### NFR-002: Security
- All data in transit encrypted (TLS 1.3)
- All data at rest encrypted (AES-256)
- PII data tokenized (never stored as plaintext in logs)
- JWT authentication with 15-minute expiry
- API rate limiting per client (1000 requests/minute pro tier)
- Zero-trust network: agents communicate over mTLS

### NFR-003: Scalability
- Horizontal scaling: API + Agent tiers independently scalable
- Target: 100,000 compliance scans/day (Phase 2)
- Database: Aurora PostgreSQL with read replicas
- Redis cache: 24-hour TTL for compliance decisions

### NFR-004: Compliance Data Handling
- GDPR Article 25 (Privacy by design): Minimal data collection
- DPDP Act India: Consent management for Indian investors
- Data residency: EU data stays in EU region (configurable per jurisdiction)
- Right to erasure: Compliance records anonymized after 7 years

### NFR-005: Auditability
- Every compliance decision logged with AI reasoning (FR-603)
- Audit logs are append-only (no update/delete via application)
- Log integrity verified via SHA-256 hash chain
- Export capability: CSV/PDF for regulatory submission

### NFR-006: Explainability
- All AI decisions include human-readable reasoning
- Risk scores broken down by component (FR-301 weighting)
- "Why was this flagged?" explanation for every alert
- No black-box decisions: every output traceable to input data

---

## 11. Feature Roadmap

### MVP Phase (Weeks 5-12) – Core Tokenization Compliance
| FR # | Feature | Priority |
|------|---------|---------|
| FR-101 | Individual KYC with Ballerine | P0 |
| FR-102 | Corporate KYB with UBO | P0 |
| FR-104 | PEP/Sanctions Screening | P0 |
| FR-201 | Token Transfer Whitelist | P0 |
| FR-203 | Lock-up Period Enforcement | P0 |
| FR-301 | Real-time AML Monitoring | P0 |
| FR-501 | SAR/STR Filing | P0 |
| FR-601 | Jurisdiction YAML Config (AE, IN, US) | P0 |
| FR-603 | Audit Log | P0 |

### Phase 2 (Weeks 13-20) – Advanced Features
| FR # | Feature | Priority |
|------|---------|---------|
| FR-103 | Enhanced Due Diligence | P1 |
| FR-105 | Accredited Investor Verification | P1 |
| FR-202 | Holding Limit Enforcement | P1 |
| FR-204 | Corporate Action Compliance | P1 |
| FR-302 | Hawala Pattern Detection | P1 |
| FR-401 | Property Valuation Oracle | P1 |
| FR-402 | Double-Dipping Prevention | P1 |
| FR-502 | Regulatory Report Generation | P1 |
| FR-503 | Case Management | P1 |
| FR-602 | Multi-Jurisdiction Router | P1 |

### Phase 3 (Weeks 21-40) – Differentiation
| FR # | Feature | Priority |
|------|---------|---------|
| FR-303 | Cross-Chain Monitoring | P2 |
| FR-403 | Source of Funds Oracle | P2 |
| Additional jurisdictions (SA, SG, EU) | - | P2 |
| Machine learning anomaly detection | - | P2 |
| Regulator sandbox integration | - | P2 |

---

## 12. Regulatory Traceability Matrix

| FR # | FATF | UAE DFSA | SEBI AIF | US SEC | EU AIFMD | Saudi CMA |
|------|------|----------|----------|--------|----------|-----------|
| FR-101 | R.10 | RPP 7 | Reg 17 | Rule 506 | Art.16 | Art.5 |
| FR-102 | R.24 | RPP 8 | Reg 10 | Rule 506(b) | Art.16 | Art.6 |
| FR-103 | R.19 | RPP 9 | Master Circ. | - | Art.18 | Art.8 |
| FR-104 | R.6 | RPP 4 | PMLA | OFAC | AMLD5 | CMA List |
| FR-105 | - | PIB 2.7 | Reg 4 | 17 CFR 230.501 | AIFMD | Art.13 |
| FR-201 | R.10 | CIR 5.3 | Reg 13 | Rule 144 | Art.14 | Art.9 |
| FR-202 | - | PIB 2.6 | Reg 14 | - | Art.15 | Art.11 |
| FR-203 | - | CIR 5.4 | Reg 12 | Rule 144 | Art.14 | Art.12 |
| FR-204 | R.10 | CIR 6.1 | Reg 15 | - | Art.18 | Art.14 |
| FR-301 | R.20 | AML Rule 24 | PMLA Sec.12 | BSA | AMLD5 | AML Reg |
| FR-302 | Typology 2023 | CBUAE 2020 | FIU-IND | FinCEN | AMLD6 | SAFIU |
| FR-401 | - | PIB 2.6 | SEBI Circular | SEC Reg A | - | Art.16 |
| FR-402 | R.17 | PIB 2.6 | Reg 24 | SEC Rule 10b-5 | MiCA | Art.20 |
| FR-501 | R.20 | AML Rule 25 | PMLA Sec.12 | BSA 31 CFR | AMLD5 | SAFIU |
| FR-502 | R.28 | DFSA Return | SEBI Circ. | Form D | AIFMD AnnIV | CMA Form |
| FR-601 | R.1 | CIR 1.2 | Reg 1 | - | Art.4 | Art.2 |
| FR-603 | R.11 | CIR 7.1 | PMLA Sec.12 | SEC 17a-4 | AMLD5 | Art.22 |

---

*Document End*  
**Next Steps**: See `Planning docs/Phase 2 MVP Core/` for implementation sprint plans. (See `Planning docs/MASTER_IMPLEMENTATION_PLAN.md` for the full project plan.)  
**Code Implementation**: See `compliance-system/src/api/src/routes/peTokenizationRoutes.ts` for API layer.
