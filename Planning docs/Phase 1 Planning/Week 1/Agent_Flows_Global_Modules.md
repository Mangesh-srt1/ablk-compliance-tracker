# Agent Flows and Global Modules

## Overview
This document outlines the proposed agent flows using LangChain.js and LangGraph for global compliance automation in Ableka Lumina. The system will use hierarchical agents to handle multi-jurisdictional KYC/AML/fraud detection across SEBI (India), GDPR/PSD2 (EU), FinCEN/OFAC (US), and FATF standards.

## LangGraph Nodes
LangGraph will orchestrate the flow with nodes representing decision points and actions:
- **Input Parser Node**: Parse user query (e.g., entity ID, jurisdiction, transaction data).
- **Jurisdiction Router Node**: Detect or route based on entity location (India, EU, US, APAC).
- **KYC Verification Node**: Sub-nodes for each jurisdiction (e.g., SEBI KYC, GDPR Consent).
- **AML Screening Node**: Check against sanctions lists (OFAC, EU sanctions).
- **Fraud Detection Node**: Analyze transaction anomalies using ML.
- **Reporting Node**: Generate compliance report with flags and recommendations.
- **Localization Node**: Translate outputs to user language (5+ languages).
- **ReAct Loop Node**: Iterative reasoning for complex cases (e.g., escalate to human if uncertainty > threshold).

## Global Modules
Modular design for scalability and updates:
- **KYC Module**: Unified interface with jurisdiction-specific adapters. Integrates with providers like Ballerine, Jumio. Supports global standards (FATF).
- **AML Module**: Sanctions screening using Marble, Chainalysis. Includes PEP checks.
- **Fraud Module**: Custom tools for blockchain analysis (ethers.js/web3.js for Ethereum, Besu, Solana, Polygon).
- **Localization Module**: i18n for UI and reports (English, Hindi, German, etc.).
- **RAG Module**: PGVector for regulatory docs; cron ingestion for updates.
- **API Module**: Express.js with WebSocket for real-time updates.

## Flow Diagram (Text Representation)
```
User Query (e.g., "Check KYC for Indian entity")
    |
    v
Input Parser -> Jurisdiction Detection (India)
    |
    v
SEBI KYC Node -> Verify Documents (UIDAI/Aadhaar)
    | (Pass)
    v
AML Screening (FIU-IND, OFAC)
    | (No flags)
    v
Fraud Detection (Transaction Analysis)
    | (Low risk)
    v
Reporting Node -> Generate Report (Localized)
    |
    v
Output: Compliance Report
```

## Integrations
- **Blockchain Status Tool**: ethers.js for on-chain verification.
- **Provider APIs**: Ballerine for KYC, Marble for AML.
- **Reasoning**: Grok 4.1 for complex decision-making in ReAct loop.

## Assumptions
- Agents handle 90% of cases autonomously; human override for edge cases.
- Multi-tenant isolation via API keys.