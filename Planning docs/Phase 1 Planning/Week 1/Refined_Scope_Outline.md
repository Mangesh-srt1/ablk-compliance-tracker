# Refined Scope Outline for Ableka Lumina

## In-Scope (Refined)
- **Core Functionality**: AI-driven KYC/AML/fraud detection for fintech apps (lending, payments, crypto exchanges) via API (REST/WebSocket). Includes hierarchical agents with ReAct loops for reasoning.
- **Jurisdictions**: India (SEBI/DPDP), EU (GDPR/PSD2), US (FinCEN/OFAC), with extension to APAC (FATF standards). Jurisdiction routing based on entity location.
- **Modules**: KYC (global with local variants), AML (sanctions screening), Fraud (blockchain anomaly detection), Compliance Tracker (real-time monitoring), Portal UI (onboarding, scan initiation, results), Demo Client (wallet scans, reports).
- **Integrations**: Ballerine (KYC), Marble (AML), Jumio (global KYC), Chainalysis (AML), ethers.js/web3.js for blockchains (Ethereum, Besu, Solana, Polygon). World-Check for sanctions.
- **Tech Stack**: Node.js, LangChain.js, Grok 4.1, PGVector (RAG), Express.js (API), React (UI), AWS (Fargate/ECS, Aurora PG, Redis, EventBridge), Docker, Cypress/Jest (testing), Stripe (payments).
- **Features**: Multi-tenant SaaS with API keys, localization (English, Hindi, German, French, Spanish), real-time WebSocket, rate limiting, subscription tiers ($99/mo Pro).
- **Deliverables**: PRD (Week 4), MVP API + Portal (Week 12), Full SaaS + Tracker (Week 20), Launch (Week 28), Iteration (Months 7-9).

## Out-of-Scope (Refined)
- Non-finance sectors.
- Manual compliance (only automated).
- On-premise (cloud-only).
- Legacy integrations beyond standard APIs.
- Languages beyond initial 5; additional via plugins.

## Assumptions (Refined)
- Team: Solo lead dev initially, scale to 3-5 devs.
- Budget: $70k-$160k; adjust based on phase progress.
- Risks: Mitigate via RAG for regs, testing for accuracy.
- Success Metrics: 90% accuracy, <2min response, 95% uptime, 100+ clients, ROI via fines prevention.
- Dependencies: Provider API access; global reg stability.

## Timeline (Refined)
- Phase 1 (Weeks 1-4): Planning - $5k (includes research and design).
- Phase 2 (Weeks 5-12): MVP Core - $25k-$45k (setup, RAG, agents, UI).
- Phase 3 (Weeks 13-16): Integrations - $20k (providers, blockchains).
- Phase 4 (Weeks 17-20): Testing - $10k (unit, sims, demo).
- Phase 5 (Weeks 21-28): Deployment - $15k (AWS, CI/CD).
- Phase 6 (Weeks 29-36): Iteration - $10k-$20k (feedback, scaling).
- Total: 6-9 months; buffer for delays.

## Budget Breakdown (Refined)
- Development: $42k-$96k (coding, testing).
- APIs/Tools: $14k-$32k (Ballerine, etc., subscriptions).
- Infrastructure: $14k-$32k (AWS costs).
- Contingency: $7k-$16k (10%).

## Alignment with FRD
- Matches global modules in FRD v1.9.
- Scope limited to fintech for focus.
- Budget/timeline realistic for solo/team.