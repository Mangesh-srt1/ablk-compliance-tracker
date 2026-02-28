# Ableka Lumina – Next Course of Actions (Manual / Human-Only Tasks)

This document lists the tasks that **AI cannot perform automatically** and require human intervention, credentials, external access, or legal/business judgment.

---

## 🔐 1. Secrets & Credentials Setup

AI cannot create, provision, or inject real API keys. A human must:

| Action | Where |
|--------|-------|
| Set `BALLERINE_API_KEY` | `.env.local` → Ballerine dashboard |
| Set `MARBLE_API_KEY` | `.env.local` → Marble dashboard |
| Set `CHAINALYSIS_API_KEY` | `.env.local` → Chainalysis enterprise portal |
| Set `GROK_API_KEY` | `.env.local` → xAI API console |
| Set `JWT_SECRET` (≥ 64 random bytes) | `.env.local` → `openssl rand -hex 32` |
| Set `DATABASE_URL` with production credentials | `.env.local` |
| Set `REDIS_PASSWORD` for production Redis | `.env.local` |
| Rotate all keys that existed in plain-text in `.env` | Immediately |

---

## 🏗️ 2. Infrastructure Provisioning

AI cannot provision cloud infrastructure. A human must:

- Deploy PostgreSQL 16 with **pgvector** extension for production (use `pgvector/pgvector:pg16` image or RDS with `pg_vector` enabled)
- Provision Redis with TLS and AUTH for production
- Set up Kubernetes cluster / ECS / App Runner and deploy the CDK stacks in `compliance-system/cdk/`
- Configure a managed reverse proxy (AWS ALB / Nginx) with TLS termination in front of port 3000/3002
- Configure VPC, security groups, and private subnets so the database is not publicly reachable
- Set up AWS Secrets Manager or HashiCorp Vault and update `docker-compose.yml` to pull secrets from the vault instead of `.env`

---

## 🔗 3. Blockchain RPC Endpoint Configuration

AI cannot access or configure client-specific blockchain infrastructure. A human must:

- Obtain permissioned Hyperledger Besu RPC endpoints from the client and add to `.env.local`:
  ```
  BESU_RPC_URL=https://validator-1.client.internal:8545
  BESU_BACKUP_RPC_URL=https://validator-2.client.internal:8545
  ```
- Obtain an Infura / Alchemy project ID if public Ethereum monitoring is required:
  ```
  ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/<CLIENT_PROJECT_ID>
  ```
- Record client approval for each blockchain being monitored in the `client_approved_monitoring` table
- Validate that the RPC endpoints are reachable from the deployed environment

---

## 🧑‍⚖️ 4. Legal & Compliance Review

AI cannot perform legal or regulatory analysis. A human must:

- Review jurisdiction YAML files (`config/jurisdictions/*.yaml`) with a qualified compliance officer for each jurisdiction (DFSA / AE, SEBI / IN, SEC-Reg D / US, GDPR / EU)
- Obtain legal sign-off before enabling live KYC/AML checks in production
- Ensure the privacy policy and data retention policies comply with GDPR (EU), PDPA (India), and DIFC regulations (UAE)
- Set up a documented process for handling Subject Access Requests (SAR) under GDPR
- Implement a formal escalation SLA (e.g., all ESCALATED decisions must be reviewed within 24 hours)

---

## 🔬 5. Penetration Testing & Security Audit

AI cannot conduct external penetration testing. A human must:

- Engage a third-party security firm to conduct a full pen test of the API endpoints and WebSocket stream
- Run OWASP ZAP / Burp Suite against the staging environment to catch injection, CSRF, and authentication bypass
- Audit JWT implementation: verify `RS256` is used in production (not `HS256` with a shared secret), token rotation, and refresh-token blacklisting
- Review rate-limiting configuration for all compliance endpoints (`/api/kyc-check`, `/api/aml-score`) to prevent abuse
- Test the WebSocket stream for authentication bypass and message injection

---

## 🧪 6. External API Integration Testing

AI cannot call live third-party APIs. A human must:

- Test Ballerine KYC sandbox with real test identities and document the expected response schemas
- Test Marble AML sandbox with sample transaction sets
- Test Chainalysis sandbox with known flagged wallets to verify sanctions matching
- Verify The Graph subgraph queries return correct on-chain data for the target contracts
- Document any discrepancies between sandbox responses and the current integration code

---

## 🚀 7. CI/CD Pipeline & Secrets Injection

AI cannot configure repository secrets or deploy pipelines. A human must:

- Add the following secrets to GitHub Actions (Settings → Secrets → Actions):
  - `BALLERINE_API_KEY`, `MARBLE_API_KEY`, `CHAINALYSIS_API_KEY`, `GROK_API_KEY`
  - `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (for CDK deploy)
- Review `.github/workflows/ci.yml` and configure the deployment stage to use the CDK stacks
- Enable GitHub branch protection rules: require CI to pass before merge to `main`

---

## 📊 8. SonarQube / SAST Setup

AI cannot create SonarQube projects or tokens. A human must:

- Create a SonarQube project named `ablk-compliance-system`
- Generate a SonarQube user token and add it as `SONAR_TOKEN` GitHub secret
- Update `compliance-system/sonar-project.properties` with the correct `sonar.token`
- Run the first analysis: `cd compliance-system && npm run sonar`
- Review and resolve HIGH and CRITICAL findings before the first production release

---

## 🗄️ 9. Database Migration to pgvector (Production)

AI cannot run database migrations against a live database. A human must:

- For production: replace the Alpine PostgreSQL image with `pgvector/pgvector:pg16`
- Run the migration to convert `BYTEA` embedding columns to `vector(1536)` type:
  ```sql
  ALTER TABLE decision_vectors ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector;
  ```
- Update `config/sql/init-database.sql` to enable the extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- Seed production compliance rules from the jurisdiction YAML files via `npm run db:seed`

---

## 👤 10. Initial Admin User Creation

AI cannot create real user accounts. A human must:

- After the database is running, create the first admin account:
  ```sql
  INSERT INTO users (id, email, password_hash, role, created_at)
  VALUES (gen_random_uuid(), 'admin@yourcompany.com', '<bcrypt_hash>', 'admin', NOW());
  ```
- Generate the bcrypt hash securely: `node -e "const b=require('bcrypt');b.hash('InitialPwd!',12).then(console.log)"`
- Enforce password change on first login and enable MFA for all compliance officer accounts

---

## 📋 Summary Checklist

| # | Task | Owner | Urgency |
|---|------|-------|---------|
| 1 | Rotate and inject all API secrets | DevOps / CTO | 🔴 Critical |
| 2 | Provision production infrastructure (K8s, RDS, Redis) | DevOps | 🔴 Critical |
| 3 | Configure blockchain RPC endpoints per client | DevOps + Client | 🟠 High |
| 4 | Legal/compliance review of jurisdiction rules | Legal + Compliance Officer | 🟠 High |
| 5 | Penetration test | Security firm | 🟠 High |
| 6 | Live external API integration test (sandbox) | Backend Engineer | 🟠 High |
| 7 | CI/CD pipeline secrets & deployment stage | DevOps | 🟡 Medium |
| 8 | SonarQube project setup and first analysis | DevOps / Lead Engineer | 🟡 Medium |
| 9 | pgvector migration for production DB | DBA | 🟡 Medium |
| 10 | Initial admin user creation | DBA / Admin | 🟡 Medium |

---

*Generated by Copilot Audit – 2026-02-28. Review with the engineering lead before acting.*
