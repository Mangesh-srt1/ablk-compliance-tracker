# Scope Outline for Ableka Lumina

## In-Scope
- **Core Functionality**: AI-driven KYC/AML/fraud detection for fintech apps (lending, payments, crypto exchanges) via API (REST/WebSocket).
- **Jurisdictions**: India (SEBI/DPDP), EU (GDPR/PSD2), US (FinCEN/OFAC), with extension to APAC (FATF standards).
- **Modules**: KYC, AML, Fraud, Compliance Tracker (automated monitoring), Portal UI (onboarding, reports), Demo Client.
- **Integrations**: Ballerine, Marble, Jumio, Chainalysis, ethers.js/web3.js for blockchains (Ethereum, Besu, Solana, Polygon).
- **Tech Stack**: Node.js, LangChain.js, Grok 4.1, PGVector, Express.js, React, AWS (Fargate/ECS, Aurora PG, Redis, EventBridge).
- **Features**: Multi-tenant SaaS, localization (5+ languages), real-time WebSocket updates, rate limiting (10 req/min).
- **Deliverables**: MVP API + Portal (Week 12), Full SaaS (Week 20), Launch (Week 28).

## Out-of-Scope
- Non-finance sectors (e.g., healthcare, retail).
- Manual compliance consulting (only automated tools).
- On-premise deployments (cloud-only).
- Legacy system integrations beyond APIs.
- Non-English languages beyond initial 5.

## Assumptions
- Team: 1 lead dev + 2-4 freelancers.
- Budget: $70k-$160k (dev 60%, APIs 20%, infra 20%).
- Risks: LLM hallucinations mitigated via RAG; reg changes via modular design.
- Success Metrics: 90% accuracy, <2min scans, 95% uptime, 100+ API clients.
- Dependencies: Access to provider APIs (test accounts available).

## Timeline
- Phase 1 (Weeks 1-4): Planning - $5k.
- Phase 2 (Weeks 5-12): MVP Core - $25k-$45k.
- Phase 3 (Weeks 13-16): Integrations - $20k.
- Phase 4 (Weeks 17-20): Testing - $10k.
- Phase 5 (Weeks 21-28): Deployment - $15k.
- Phase 6 (Weeks 29-36): Iteration - $10k-$20k.
- Total: 6-9 months.

## Budget Breakdown
- Development: $42k-$96k.
- APIs/Tools: $14k-$32k.
- Infrastructure: $14k-$32k.
- Contingency: 10%.