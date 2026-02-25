# API Design Draft for Ableka Lumina

## Overview
Ableka Lumina exposes APIs via Express.js for KYC/AML/fraud detection. Multi-tenant isolation via API keys. Jurisdiction-aware logic routes to local modules.

## Core API Endpoints (Day 3)

### /kyc-check (POST)
- **Purpose**: Perform KYC verification for an entity.
- **Params**:
  - entityId (string): Unique ID of the entity (e.g., wallet address, user ID).
  - jurisdiction (string): "IN" (India), "EU", "US".
  - documents (array): Base64-encoded docs (e.g., Aadhaar for IN).
- **Response**: JSON with status ("PASS"/"FAIL"), flags (e.g., "Expired Doc"), score (0-100).
- **Logic**: Routes to SEBI KYC (IN), GDPR Consent (EU), FinCEN CDD (US). Uses Ballerine/Jumio.

### /aml-score (POST)
- **Purpose**: Calculate AML risk score.
- **Params**:
  - entityId (string).
  - jurisdiction (string).
  - transactions (array): List of tx data (amount, counterparty).
- **Response**: JSON with score (0-100), flags (e.g., "PEP Match"), recommendations.
- **Logic**: Screens against OFAC/EU sanctions; uses Marble/Chainalysis.

## Advanced API Endpoints (Day 4)

### /fraud-detect (POST)
- **Purpose**: Detect fraud in transactions.
- **Params**:
  - entityId (string).
  - txData (object): Blockchain tx details (via ethers.js).
- **Response**: JSON with risk level ("LOW"/"HIGH"), anomalies (e.g., "Velocity > Threshold").
- **WebSocket Support**: Real-time updates via /ws/fraud.

### /compliance/track (POST)
- **Purpose**: Start compliance tracking for ongoing monitoring.
- **Params**:
  - entityId (string).
  - interval (string): "daily"/"real-time".
- **Response**: Subscription ID; WebSocket stream for alerts.
- **Logic**: Integrates with Compliance Tracker; risk scoring based on anomalies.

## General Features
- **Authentication**: API key in header.
- **Rate Limiting**: 10 req/min per tenant.
- **Errors**: 400 for invalid params, 429 for rate limit, 500 for server errors.
- **Multi-Tenant**: Isolated data per client; jurisdiction routing.