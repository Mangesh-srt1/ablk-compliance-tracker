# User Journeys for Ableka Lumina

## Overview
This document maps user journeys for key personas: Fintech Developers and Compliance Officers/Admins. Journeys are designed for multi-jurisdictional clients (India, EU, US) to highlight pain points like complexity and how Ableka Lumina addresses them.

## Persona 1: Fintech Developers
### Journey: Onboard Client → Scan Entity → Get Report
1. **Onboard**: Developer registers via API key on Ableka Portal. Selects jurisdiction (e.g., India for SEBI compliance).
2. **Integrate API**: Calls /kyc-check with entityId and jurisdiction. Pain point: Manual handling of multi-jurisdiction rules.
3. **Scan**: System triggers agent flow (KYC → AML → Fraud). Real-time WebSocket updates.
4. **Report**: Receives JSON report with flags, scores, recommendations. Pain point: Interpreting global regs.
5. **Iterate**: Adjust based on feedback; use Compliance Tracker for ongoing monitoring.

**Pain Points Addressed**:
- Multi-jurisdiction complexity: Jurisdiction router automates routing.
- Integration time: Simple REST/WebSocket APIs.
- Accuracy: AI agents reduce false positives.

### Variations
- **Indian Client**: Focus on SEBI/DPDP; eKYC via Aadhaar.
- **EU Client**: GDPR consent checks; PSD2 open banking.
- **US Client**: FinCEN SARs; OFAC sanctions screening.

## Persona 2: Compliance Officers/Admins
### Journey: Login Portal → Review Alerts → Generate Reports
1. **Login**: Access Ableka Portal with admin credentials. Dashboard shows global client scans.
2. **Review Alerts**: Compliance Tracker flags anomalies (e.g., high AML score). Drill down to entity details.
3. **Investigate**: View agent reasoning logs; escalate if needed.
4. **Generate Reports**: Export jurisdiction-specific reports (e.g., SEBI-compliant PDF).
5. **Monitor**: Set up real-time alerts for breaches.

**Pain Points Addressed**:
- Manual monitoring: Automated tracker reduces workload.
- Multi-jurisdiction oversight: Unified portal with localization.
- Reporting delays: On-demand generation.

### Compliance Tracker Workflows
- **Real-Time Monitoring**: WebSocket pushes alerts for tx anomalies.
- **Batch Scans**: API for bulk entity checks.
- **Audit Trails**: Logs all agent actions for compliance audits.