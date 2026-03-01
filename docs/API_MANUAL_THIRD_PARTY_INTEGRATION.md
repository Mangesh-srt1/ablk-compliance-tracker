# Ableka Lumina Compliance Platform - API Documentation & Integration Manual

**Version:** 1.0  
**Last Updated:** March 2, 2026  
**API Base URL:** `http://localhost:4000/api/v1`  
**Platform:** Ableka Lumina AI Compliance Engine  
**Target Audience:** Third-Party Integrators, Vendors, Partners  
**Document Classification:** Technical Integration Guide

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication & Security](#2-authentication--security)
3. [Getting Started](#3-getting-started)
4. [Compliance Check Endpoints](#4-compliance-check-endpoints)
5. [Real-Time Monitoring](#5-real-time-monitoring)
6. [Workflow Management](#6-workflow-management)
7. [Reporting & Analytics](#7-reporting--analytics)
8. [Error Handling](#8-error-handling)
9. [Rate Limiting & Quotas](#9-rate-limiting--quotas)
10. [Data Format Specifications](#10-data-format-specifications)
11. [Integration Patterns](#11-integration-patterns)
12. [Best Practices](#12-best-practices)
13. [Troubleshooting](#13-troubleshooting)
14. [Code Examples](#14-code-examples)
15. [Webhook Configuration](#15-webhook-configuration)

---

## 1. API Overview

### 1.1 What is Ableka Lumina API?

The **Ableka Lumina Compliance API** is a RESTful web service enabling automated KYC (Know Your Customer), AML (Anti-Money Laundering), and fraud detection integration into third-party systems.

**Key Capabilities:**

| Capability | Description | Use Case |
|-----------|-------------|----------|
| **KYC Verification** | Identity verification via multiple providers | Onboard new users/entities |
| **AML Screening** | Money laundering risk assessment with AI scoring | Continuous monitoring |
| **Sanctions Screening** | Check against global sanctions lists | Compliance enforcement |
| **Transfer Compliance** | Transaction approval/rejection | Payment gateways |
| **Blockchain Monitoring** | Real-time transaction monitoring | DeFi/blockchain apps |
| **Workflow Automation** | Create custom compliance workflows | Custom business logic |
| **Real-Time Alerts** | Instant notification of compliance issues | Risk management |
| **Batch Processing** | Process multiple checks simultaneously | Bulk imports |
| **Reporting** | Generate compliance reports | Regulatory reporting |
| **Webhook Events** | Real-time event notifications | Reactive systems |

### 1.2 API Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Third-Party Client/Vendor System                │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS/REST
                     ↓
┌─────────────────────────────────────────────────────────┐
│    Ableka Lumina API Gateway (Rate Limiter, Auth)       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Compliance   │  │  Real-Time   │  │  Reporting   │   │
│  │ Checks API   │  │  Monitoring  │  │  & Analytics │   │
│  │              │  │  (WebSocket) │  │   API        │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ LangChain.js │  │  PostgreSQL  │  │    Redis     │   │
│  │ AI Agents    │  │  Database    │  │    Cache     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Ballerine   │  │    Marble    │  │ Chainalysis │   │
│  │  (KYC)       │  │   (AML)      │  │ (Sanctions) │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Supported Jurisdictions

**API Supports Compliance Rules for:**

| Code | Jurisdiction | Regulator | Rules Engine |
|------|--------------|-----------|--------------|
| **AE** | UAE - Dubai | DFSA | DFSA Rulebook |
| **US** | United States | SEC/FinCEN | Reg D, AML PATRIOT Act |
| **IN** | India | SEBI | SEBI Regulations |
| **SG** | Singapore | MAS | AML/CFT Guidelines |
| **UK** | United Kingdom | FCA | FCA Handbook |
| **EU** | European Union | EBA/ESMA | MiFID II, GDPR |
| **HK** | Hong Kong | SFC | Code of Conduct |

**Custom Jurisdictions:** Available upon request

### 1.4 Available Data Sources

**KYC:**
- Ballerine (document verification + liveness)
- Multiple identity document types supported
- Liveness detection (AI-based)

**AML:**
- Marble AI risk scoring engine
- Transaction history analysis
- Counterparty screening
- Beneficial ownership detection

**Sanctions:**
- OFAC SDN (US)
- UN Security Council lists
- EU sanctions databases
- Country-specific lists
- Updates: Real-time (within 24 hours)

**Blockchain:**
- Chainalysis (public blockchains)
- ethers.js provider integration
- Custom RPC endpoint support

---

## 2. Authentication & Security

### 2.1 API Key Management

**Three Authentication Methods:**

#### Method 1: JWT Bearer Token (Recommended)

**Most secure, suitable for long-lived integrations**

**Token Characteristics:**
- Type: JWT (JSON Web Token)
- Expiration: 15 minutes
- Refresh: Via `/api/v1/auth/refresh-token` endpoint
- Scope: User role-based

**Obtaining Token:**

**Endpoint:**
```
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "vendor@company.com",
  "password": "secure_password_12345",
  "grant_type": "password"
}
```

**Request Headers:**
```
Content-Type: application/json
User-Agent: ComplianceApp/1.0
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "kyc:read aml:read sanctions:check transfer:approve"
}
```

**Token Structure Example** (decoded):
```json
{
  "sub": "vendor_user_123",
  "email": "vendor@company.com",
  "role": ["compliance_officer", "vendor_integration"],
  "scope": ["kyc:read", "aml:read", "sanctions:check", "transfer:approve"],
  "iat": 1709433600,
  "exp": 1709434500
}
```

**Using Token in Requests:**

```bash
curl -X POST http://localhost:4000/api/v1/compliance/transfer-check \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**Token Refresh:**

When current token expires (or < 5 min remaining):

**Endpoint:**
```
POST /api/v1/auth/refresh-token
```

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

---

#### Method 2: API Key (Legacy, Limited Scope)

**Simpler but less secure, suitable for server-to-server integrations**

**Obtaining API Key:**

1. Go to: API Settings > Generate Key
2. Name: "Integration Name" (e.g., "PE Token Platform")
3. Permissions: Select scopes (kyc:read, aml:read, etc.)
4. Expiration: Choose (30 days, 90 days, 1 year, never)
5. Copy key (shown only once!)

**API Key Format:**
```
ak_prod_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o
```

**Using API Key:**

```bash
curl -X POST http://localhost:4000/api/v1/compliance/transfer-check \
  -H "X-API-Key: ak_prod_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**API Key Best Practices:**
- ✅ Store in environment variables (not code)
- ✅ Rotate every 90 days
- ✅ Use separate keys for dev/prod
- ✅ Monitor usage via dashboard
- ❌ Don't share or commit to GitHub
- ❌ Don't use in client-side code

---

#### Method 3: OAuth 2.0 (For User Delegation)

**Advanced: When users grant permission to your app**

**OAuth 2.0 Flow:**

```
┌────────────────────────────────┐
│   Your App                     │
│ (Redirects to Ableka login)    │
└────────────┬───────────────────┘
             │ 1. Redirect to:
             │   /oauth/authorize?client_id=...
             ↓
┌────────────────────────────────┐
│  Ableka Lumina OAuth Server    │
│  (User Login & Consent)        │
└────────────┬───────────────────┘
             │ 2. User grants permission
             │ 3. Redirect back with code
             ↓
┌────────────────────────────────┐
│   Your App Backend             │
│ (Exchange code for token)      │
└────────────┬───────────────────┘
             │ 4. POST /oauth/token
             │    with code + secret
             ↓
┌────────────────────────────────┐
│  Ableka Lumina OAuth Server    │
│ (Issues access token)          │
└────────────┬───────────────────┘
             │ 5. Returns access_token
             ↓
┌────────────────────────────────┐
│   Your App                     │
│ (Can access user's data)       │
└────────────────────────────────┘
```

**OAuth Configuration:**

Contact Ableka Lumina to register your OAuth app:
- **Client ID:** Provided by Ableka
- **Client Secret:** Keep confidential!
- **Redirect URIs:** Your callback URLs (e.g., https://yourapp.com/oauth/callback)

---

### 2.2 Security Protocols

**Protocol Requirements:**

| Aspect | Requirement |
|--------|------------|
| **Transport** | HTTPS/TLS 1.3 minimum |
| **Encryption** | AES-256-GCM for payload encryption |
| **Signing** | RS256 for JWT signatures |
| **CORS** | Restricted to registered origins |
| **CSRF** | X-CSRF-Token required for state-changing operations |
| **Rate Limit Headers** | Include in all responses |

**TLS Certificate:**

```bash
# Verify certificate (production)
openssl s_client -connect localhost:4000 -showcerts
```

**SSL/TLS Verification:**

```bash
# Disable SSL verification (dev only!)
curl -k -X POST https://localhost:4000/api/v1/...

# Enable SSL verification (production)
curl --cacert /path/to/cert.pem -X POST https://localhost:4000/api/v1/...
```

---

### 2.3 Request Signing (Webhook Verification)

**For Webhook Payloads: Verify Authenticity**

**Header:** `X-Ableka-Signature`

**Signature Algorithm:**

```
HMAC-SHA256(
  key=webhook_secret,
  message=request_body
)
```

**Example Python Verification:**

```python
import hmac
import hashlib
import json

# From webhook request headers
signature = request.headers.get('X-Ableka-Signature')
webhook_secret = 'whk_1a2b3c4d5e6f...'

# Reconstruct signature
body = request.get_data()
expected_signature = hmac.new(
    webhook_secret.encode(),
    body,
    hashlib.sha256
).hexdigest()

# Verify
if not hmac.compare_digest(signature, expected_signature):
    return {"error": "Invalid signature"}, 401
```

---

### 2.4 Secure Credential Handling

**Best Practices:**

**✅ DO:**
```bash
# Store in environment variables
export ABLEKA_API_KEY="ak_prod_1a2b3c..."
export ABLEKA_WEBHOOK_SECRET="whk_1a2b3c..."

# Use in code
api_key = os.environ.get('ABLEKA_API_KEY')
```

**✅ DO:**
```bash
# Use .env file (git-ignored)
ABLEKA_API_KEY=ak_prod_1a2b3c...
ABLEKA_WEBHOOK_SECRET=whk_1a2b3c...

# Load in application
from dotenv import load_dotenv
load_dotenv()
```

**❌ DON'T:**
```python
# Hardcoded credentials (SECURITY RISK!)
api_key = "ak_prod_1a2b3c..."  # NEVER!

# Commit to GitHub
git add secrets.json  # NEVER!

# Log credentials
logger.info(f"API Key: {api_key}")  # NEVER!
```

---

### 2.5 RBAC (Role-Based Access Control)

**User Roles & Permissions:**

| Role | Allowed Actions | Use Case |
|------|-----------------|----------|
| **vendor_integration** | Read-only KYC/AML/Sanctions | Third-party integrations |
| **compliance_officer** | Submit checks, review, escalate | Internal staff |
| **admin** | All operations including system config | Administrative access |
| **analyst** | View-only reports and analytics | Analytics team |
| **api_client** | Machine-to-machine integrations | Service accounts |

**Checking Permissions:**

```bash
# Get current user info (includes roles)
curl -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "user_id": "usr_123",
  "email": "vendor@company.com",
  "roles": ["vendor_integration"],
  "permissions": [
    "kyc:read",
    "aml:read",
    "sanctions:check",
    "transfer:check"
  ],
  "rate_limit": {
    "requests_per_hour": 1000,
    "requests_per_day": 10000
  }
}
```

---

## 3. Getting Started

### 3.1 Development Environment Setup

**Prerequisites:**

```bash
# Required installations
npm >= 18.0.0
Node.js >= 20.0.0
curl >= 7.64.0
git >= 2.25.0

# For Python integrations
python >= 3.8
pip >= 21.0

# For JavaScript integrations
npm install --save axios      # HTTP client
npm install --save dotenv     # Environment variables
npm install --save jsonwebtoken  # JWT handling
```

**Environment Variables File (.env):**

```bash
# API Configuration
ABLEKA_API_BASE_URL=http://localhost:4000/api/v1
ABLEKA_AUTH_URL=http://localhost:4000/api/v1/auth

# Authentication
ABLEKA_API_KEY=ak_prod_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o
ABLEKA_JWT_SECRET=your_jwt_secret_from_login

# Webhook Configuration
ABLEKA_WEBHOOK_SECRET=whk_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o
ABLEKA_WEBHOOK_URL=https://yourapp.com/webhooks/compliance

# Development
DEBUG=true
LOG_LEVEL=debug
ENVIRONMENT=development
```

### 3.2 Testing Initial Connection

**Test 1: Health Check**

```bash
curl -X GET http://localhost:4000/api/health
```

**Expected Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-02T10:30:00Z",
  "version": "1.0.0"
}
```

---

**Test 2: Get API Info**

```bash
curl -X GET http://localhost:4000/api/v1/info
```

**Expected Response (200 OK):**
```json
{
  "api_version": "1.0.0",
  "platform": "Ableka Lumina",
  "supported_jurisdictions": ["AE", "US", "IN", "SG", "UK"],
  "endpoints": 45,
  "rate_limits": {
    "requests_per_hour": 1000,
    "requests_per_day": 10000
  }
}
```

---

**Test 3: Authenticate**

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@company.com",
    "password": "secure_password"
  }'
```

**Expected Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

---

**Test 4: Submit Test Compliance Check**

```bash
curl -X POST http://localhost:4000/api/v1/compliance/transfer-check \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to_address": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
    "amount": 50000,
    "currency": "USD",
    "jurisdiction": "AE",
    "from_name": "John Doe",
    "to_name": "ABC Corp"
  }'
```

**Expected Response (200 OK):**
```json
{
  "check_id": "chk_1a2b3c4d5e6f",
  "status": "APPROVED",
  "risk_score": 18,
  "confidence": 0.96,
  "reasoning": "Entity verified via KYC, no AML flags, compliant with DFSA regulations",
  "timestamp": "2026-03-02T10:35:00Z",
  "processing_time_ms": 2341
}
```

✅ **All tests passed? You're ready to integrate!**

### 3.3 SDKs & Client Libraries

**Official SDKs Available:**

| Language | Library | Installation |
|----------|---------|--------------|
| **JavaScript** | `@ableka/compliance-sdk` | `npm install @ableka/compliance-sdk` |
| **Python** | `ableka-compliance` | `pip install ableka-compliance` |
| **Go** | `github.com/ableka/compliance-go` | `go get github.com/ableka/compliance-go` |
| **Java** | `com.ableka:compliance-client` | Maven/Gradle dependency |
| **C#/.NET** | `Ableka.Compliance` | NuGet package |

**Using JavaScript SDK:**

```javascript
const { AbldkaComplianceClient } = require('@ableka/compliance-sdk');

const client = new AblekaComplianceClient({
  apiKey: process.env.ABLEKA_API_KEY,
  baseUrl: 'http://localhost:4000/api/v1'
});

// Simple one-line API call
const result = await client.submitTransferCheck({
  from_address: '0x742d35...',
  to_address: '0x8626f8...',
  amount: 50000,
  currency: 'USD',
  jurisdiction: 'AE',
  from_name: 'John Doe',
  to_name: 'ABC Corp'
});

console.log(result);
```

---

## 4. Compliance Check Endpoints

### 4.1 Submit Transfer Compliance Check

**Create a compliance check for a blockchain transfer**

**Endpoint:**
```
POST /api/v1/compliance/transfer-check
```

**Request Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
X-Request-ID: unique-request-id (optional, for tracing)
X-Client-Name: YourAppName (optional, for analytics)
```

**Request Body Schema:**

```json
{
  "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "to_address": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
  "amount": 50000,
  "currency": "USD",
  "jurisdiction": "AE",
  "from_name": "John Michael Doe",
  "to_name": "ABC Corporation Limited",
  "blockchain_type": "public",
  "transaction_hash": "0xabc123def456...",
  "metadata": {
    "source_of_funds": "verified",
    "investor_type": "qualified",
    "transaction_source": "mobile_app",
    "user_id": "ext_user_123",
    "custom_field_1": "custom_value"
  },
  "documents": [
    {
      "type": "passport",
      "url": "https://storage.example.com/doc1.pdf",
      "verification_status": "uploaded"
    }
  ]
}
```

**Field Descriptions:**

| Field | Type | Required | Format | Description |
|-------|------|----------|--------|-------------|
| **from_address** | string | ✅ | 0x + 40 hex chars | Wallet address sending funds (checksum validated) |
| **to_address** | string | ✅ | 0x + 40 hex chars | Wallet address receiving funds |
| **amount** | number | ✅ | Positive decimal | Transfer amount (no commas) |
| **currency** | string | ✅ | ISO 4217 code | USD, EUR, GBP, AED, INR, SGD, etc. |
| **jurisdiction** | string | ✅ | Country code | AE, US, IN, SG, UK (2-letter ISO) |
| **from_name** | string | ✅ | Text | Full legal name of sender |
| **to_name** | string | ✅ | Text | Full legal name of recipient |
| **blockchain_type** | string | ❌ | public, permissioned | Default: public |
| **transaction_hash** | string | ❌ | 0x + hex | Blockchain transaction hash |
| **metadata.source_of_funds** | string | ❌ | verified, pending | Funds origin verification |
| **metadata.investor_type** | string | ❌ | qualified, accredited | Investor classification |
| **metadata.custom_field_1** | any | ❌ | Any JSON | Custom data (max 5 fields) |
| **documents** | array | ❌ | Array of objects | Supporting documents |

**Validation Rules:**

```
from_address:
  - Must be valid Ethereum address (checksum validated)
  - Cannot equal to_address
  
amount:
  - Minimum: 1
  - Maximum: Jurisdiction-dependent (AE: 1,000,000,000 AED)
  
currency:
  - Must be supported ISO code
  - Affects jurisdiction rules applied
  
jurisdiction:
  - Must be in enabled_jurisdictions
  - Determines compliance rules
  - Cannot be overridden (based on addresses)
  
from_name / to_name:
  - Min length: 2 characters
  - Max length: 255 characters
  - Must not be just numbers
  - Special characters allowed: hyphen, apostrophe, space
```

**cURL Example:**

```bash
curl -X POST http://localhost:4000/api/v1/compliance/transfer-check \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: req_20260302_001" \
  -d '{
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to_address": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
    "amount": 50000,
    "currency": "USD",
    "jurisdiction": "AE",
    "from_name": "John Michael Doe",
    "to_name": "ABC Corporation Limited",
    "blockchain_type": "public",
    "metadata": {
      "source_of_funds": "verified",
      "investor_type": "qualified"
    }
  }'
```

**Success Response (200 OK):**

```json
{
  "check_id": "chk_1a2b3c4d5e6f",
  "status": "APPROVED",
  "risk_score": 18,
  "confidence": 0.96,
  "components": {
    "kyc": {
      "status": "VERIFIED",
      "risk_score": 5,
      "verified_on": "2026-03-01T10:00:00Z"
    },
    "aml": {
      "status": "CLEAR",
      "risk_score": 12,
      "flags": []
    },
    "sanctions": {
      "status": "NO_MATCH",
      "risk_score": 0,
      "lists_checked": 5
    },
    "jurisdiction": {
      "status": "COMPLIANT",
      "risk_score": 1,
      "rules_verified": 4
    }
  },
  "reasoning": "Entity successfully verified via Ballerine KYC. No AML red flags detected. Wallet not on any sanctions lists. Transaction amount (50,000 USD) within DFSA limits for qualified investors. Approved for processing.",
  "timestamp": "2026-03-02T10:35:00Z",
  "processing_time_ms": 2341,
  "expires_at": "2026-04-02T10:35:00Z"
}
```

**Response Field Explanations:**

| Field | Format | Explanation |
|-------|--------|-------------|
| **check_id** | string | Unique identifier for this check (use for later reference) |
| **status** | APPROVED, ESCALATED, REJECTED, PROCESSING | Overall decision |
| **risk_score** | 0-100 | Weighted risk assessment |
| **confidence** | 0.0-1.0 | AI confidence in decision (0.96 = 96%) |
| **components.*.status** | enum | Status of each check component |
| **components.*.risk_score** | 0-100 | Individual component risk | | **reasoning** | string | Human-readable explanation from AI |
| **timestamp** | ISO 8601 | When check was processed |
| **processing_time_ms** | integer | Total processing time in milliseconds |
| **expires_at** | ISO 8601 | When this decision expires (usually 30 days) |

---

**Error Responses:**

**Bad Request (400):**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid wallet address format",
  "code": "INVALID_ADDRESS",
  "field": "from_address",
  "details": [
    {
      "field": "from_address",
      "issue": "Checksum validation failed",
      "suggested_value": "0x742D35cc6634C0532925a3b844Bc9e7595f0bEb"
    }
  ]
}
```

**Unauthorized (401):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired JWT token",
  "code": "AUTH_FAILED",
  "hint": "Get new token via /auth/login or /auth/refresh-token"
}
```

**Insufficient Permissions (403):**
```json
{
  "error": "FORBIDDEN",
  "message": "Your role (vendor_integration) lacks required permission: transfer:approve",
  "code": "INSUFFICIENT_PERMISSIONS",
  "required_permissions": ["transfer:approve"],
  "your_permissions": ["kyc:read", "aml:read", "sanctions:check"]
}
```

**Rate Limited (429):**
```json
{
  "error": "RATE_LIMITED",
  "message": "You have exceeded your rate limit of 1000 requests per hour",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after_seconds": 3600,
  "limit_info": {
    "limit": 1000,
    "window": "hour",
    "requests_made": 1000,
    "reset_at": "2026-03-02T11:35:00Z"
  }
}
```

**Server Error (500):**
```json
{
  "error": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred while processing your request",
  "code": "INTERNAL_ERROR",
  "request_id": "req_20260302_001",
  "timestamp": "2026-03-02T10:35:00Z",
  "support_email": "support@ableka.com"
}
```

---

### 4.2 Get Compliance Check Status

**Retrieve previously-submitted check results**

**Endpoint:**
```
GET /api/v1/compliance/transfer-check/{check_id}
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| **check_id** | string | ✅ | Check ID returned from submission |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| **include_reasoning** | boolean | true | Include AI reasoning explanation |
| **include_components** | boolean | true | Include breakdown of each check |
| **include_history** | boolean | false | Include audit trail |

**cURL Example:**

```bash
curl -X GET "http://localhost:4000/api/v1/compliance/transfer-check/chk_1a2b3c4d5e6f?include_reasoning=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Success Response (200 OK):**

```json
{
  "check_id": "chk_1a2b3c4d5e6f",
  "status": "APPROVED",
  "risk_score": 18,
  "confidence": 0.96,
  "submitted_at": "2026-03-02T10:30:00Z",
  "processed_at": "2026-03-02T10:30:02Z",
  "processing_time_ms": 2341,
  "expires_at": "2026-04-02T10:30:00Z",
  "components": {...},
  "reasoning": "Entity successfully verified via Ballerine KYC...",
  "verified_by": "ai_agent_v1",
  "last_updated_at": "2026-03-02T10:30:02Z"
}
```

---

### 4.3 Batch Submit (Bulk Check Processing)

**Submit 10-1,000 compliance checks in single request**

**Endpoint:**
```
POST /api/v1/compliance/batch-transfer-checks
```

**Request Body:**

```json
{
  "batch_id": "batch_ext_20260302_001",
  "checks": [
    {
      "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "to_address": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
      "amount": 50000,
      "currency": "USD",
      "jurisdiction": "AE",
      "from_name": "John Doe",
      "to_name": "ABC Corp"
    },
    {
      "from_address": "0xabcdef1234567890abcdef1234567890abcdef12",
      "to_address": "0x1234567890abcdef1234567890abcdef12345678",
      "amount": 100000,
      "currency": "EUR",
      "jurisdiction": "UK",
      "from_name": "Jane Smith",
      "to_name": "XYZ Ltd"
    }
  ],
  "processing_mode": "async",
  "webhook_url": "https://yourapp.com/webhooks/batch-complete"
}
```

**Field Description:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **batch_id** | string | ❌ | Your internal batch identifier |
| **checks** | array | ✅ | Array of check objects (2-1000 items) |
| **processing_mode** | sync, async | ❌ | sync = wait for all results, async = webhook callback |
| **webhook_url** | string | ❌ | Required if processing_mode=async |

**Sync Processing (Wait for Results):**

```bash
curl -X POST http://localhost:4000/api/v1/compliance/batch-transfer-checks \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "batch_001",
    "checks": [...],
    "processing_mode": "sync"
  }'

# Response arrives after all checks complete (may take 30+ seconds)
```

**Sync Response (200 OK):**

```json
{
  "batch_id": "batch_001",
  "batch_submission_id": "bsub_1a2b3c4d",
  "total_checks": 2,
  "completed": 2,
  "pending": 0,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "check_id": "chk_1a2b3c4d5e6f",
      "status": "APPROVED",
      "risk_score": 18,
      "processing_time_ms": 2341
    },
    {
      "index": 1,
      "check_id": "chk_9z8y7x6w5v4u",
      "status": "ESCALATED",
      "risk_score": 45,
      "processing_time_ms": 2189
    }
  ],
  "batch_processing_time_ms": 5234,
  "summary": {
    "approved": 1,
    "escalated": 1,
    "rejected": 0,
    "average_risk_score": 31.5
  }
}
```

**Async Processing (Webhook Callback):**

```bash
curl -X POST http://localhost:4000/api/v1/compliance/batch-transfer-checks \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "batch_001",
    "checks": [...],
    "processing_mode": "async",
    "webhook_url": "https://yourapp.com/webhooks/batch-complete"
  }'

# Immediate response:
{
  "batch_submission_id": "bsub_1a2b3c4d",
  "status": "ACCEPTED",
  "message": "Batch accepted. Results will be sent to webhook_url",
  "estimated_completion_time_seconds": 45
}
```

**Webhook POST (sent when batch completes):**

```json
{
  "event_type": "batch_completed",
  "batch_submission_id": "bsub_1a2b3c4d",
  "batch_id": "batch_001",
  "timestamp": "2026-03-02T10:35:45Z",
  "results": [...],
  "summary": {...}
}
```

---

### 4.4 KYC Verification Endpoint

**Standalone KYC verification (identity check only)**

**Endpoint:**
```
POST /api/v1/kyc/verify
```

**Request Body:**

```json
{
  "entity_type": "individual",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+1-555-123-4567",
  "date_of_birth": "1990-05-15",
  "nationality": "US",
  "jurisdiction": "US",
  "document": {
    "type": "passport",
    "number": "N12345678",
    "country": "US",
    "issue_date": "2020-01-01",
    "expiry_date": "2030-01-01"
  },
  "address": {
    "street": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "source_of_funds": "employment",
  "pep_check": true,
  "sanctions_check": true
}
```

**Response (200 OK):**

```json
{
  "kyc_id": "kyc_1a2b3c4d",
  "status": "VERIFIED",
  "confidence": 0.98,
  "verified_fields": {
    "name": true,
    "document": true,
    "address": true,
    "date_of_birth": true
  },
  "risk_score": 5,
  "pep_match": false,
  "sanctions_match": false,
  "verified_on": "2026-03-02T10:35:00Z",
  "expires_on": "2027-03-02T10:35:00Z"
}
```

---

### 4.5 AML Risk Assessment

**Standalone AML risk scoring**

**Endpoint:**
```
POST /api/v1/aml/assess-risk
```

**Request Body:**

```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "entity_name": "John Doe",
  "jurisdiction": "US",
  "transaction_history": [
    {
      "tx_hash": "0x123...",
      "amount": 10000,
      "currency": "USD",
      "timestamp": "2026-03-01T10:00:00Z",
      "counterparty": "ABC Corp",
      "type": "transfer"
    }
  ],
  "include_velocity_check": true,
  "include_pattern_analysis": true
}
```

**Response (200 OK):**

```json
{
  "aml_id": "aml_1a2b3c4d",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "risk_score": 18,
  "risk_level": "LOW",
  "flags": [],
  "analyses": {
    "velocity": {
      "score": 10,
      "assessment": "Transactions within normal pattern"
    },
    "patterns": {
      "score": 15,
      "assessment": "Clean transaction history"
    },
    "source_of_funds": {
      "score": 5,
      "assessment": "Legitimate sources identified"
    }
  },
  "assessed_on": "2026-03-02T10:35:00Z"
}
```

---

### 4.6 Sanctions Screening

**Check wallet against global sanctions lists**

**Endpoint:**
```
POST /api/v1/sanctions/screen
```

**Request Body:**

```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "entity_name": "John Doe",
  "jurisdiction": "AE",
  "lists_to_check": ["OFAC_SDN", "UN_SECURITY_COUNCIL", "EU_SANCTIONS", "DFSA_PERSONS"]
}
```

**Response (200 OK - No Match):**

```json
{
  "screening_id": "scr_1a2b3c4d",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "entity_name": "John Doe",
  "status": "NO_MATCH",
  "risk_score": 0,
  "matches": [],
  "lists_checked": 4,
  "last_updated": "2026-03-02T08:00:00Z",
  "screened_on": "2026-03-02T10:35:00Z"
}
```

**Response (200 OK - Match Found):**

```json
{
  "screening_id": "scr_9z8y7x6w",
  "wallet_address": "0x999d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "entity_name": "Sanctioned Entity",
  "status": "MATCH_FOUND",
  "risk_score": 100,
  "matches": [
    {
      "list": "OFAC_SDN",
      "entry_name": "Sanctioned Entity Inc",
      "entry_id": "SDN123456",
      "match_confidence": 0.98,
      "designation_date": "2020-01-15",
      "program": "Iran Sanctions"
    }
  ],
  "lists_checked": 4,
  "screened_on": "2026-03-02T10:35:00Z"
}
```

---

## 5. Real-Time Monitoring

### 5.1 WebSocket Connection (Real-Time Alerts)

**Connect to real-time alert stream**

**Endpoint:**
```
WS ws://localhost:4000/api/v1/stream/monitoring
```

**Connection Headers:**

```
Authorization: Bearer {JWT_TOKEN}
X-Wallet-Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb (optional)
X-Jurisdiction: AE (optional)
```

**JavaScript Example:**

```javascript
const ws = new WebSocket('ws://localhost:4000/api/v1/stream/monitoring', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'X-Wallet-Address': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
  }
});

ws.onopen = () => {
  console.log('Connected to monitoring stream');
  
  // Subscribe to alerts for specific wallet
  ws.send(JSON.stringify({
    action: 'subscribe',
    wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    alert_types: ['HIGH_RISK', 'SANCTIONS_MATCH', 'UNUSUAL_PATTERN']
  }));
};

ws.onmessage = (event) => {
  const alert = JSON.parse(event.data);
  console.log('Alert received:', alert);
  
  // Handle alert
  if (alert.type === 'HIGH_RISK') {
    // Take action
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Monitoring stream closed');
  // Implement reconnection logic
};
```

**Alert Message Format:**

```json
{
  "event_type": "alert",
  "alert_id": "alrt_1a2b3c4d",
  "alert_type": "HIGH_RISK_TRANSACTION",
  "severity": "HIGH",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "transaction": {
    "hash": "0xabc123...",
    "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
    "amount": 500000,
    "currency": "USD",
    "timestamp": "2026-03-02T10:35:00Z"
  },
  "risk_score": 78,
  "reason": "Transaction amount 10x normal pattern. New counterparty. Requires verification.",
  "recommended_action": "ESCALATE_FOR_REVIEW",
  "timestamp": "2026-03-02T10:35:01Z"
}
```

### 5.2 Streaming Transactions (Blockchain Monitoring)

**Real-time monitoring of transactions on blockchain**

**WebSocket Action:**

```javascript
ws.send(JSON.stringify({
  action: 'start_monitoring',
  blockchain_type: 'public',
  wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  contract_address: '0xToken123...' // optional
}));
```

**Transaction Event:**

```json
{
  "event_type": "transaction_detected",
  "transaction": {
    "hash": "0xabc123def456...",
    "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
    "value": "500000000000000000",
    "value_usd": 500000,
    "gas_price": "20000000000",
    "block_number": 18500000,
    "block_timestamp": "2026-03-02T10:35:00Z",
    "status": "pending"
  },
  "compliance_check_status": "IN_PROGRESS",
  "timestamp": "2026-03-02T10:35:01Z"
}
```

---

## 6. Workflow Management

### 6.1 Create Workflow

**Endpoint:**
```
POST /api/v1/workflows
```

**Request Body:**

```json
{
  "name": "High-Value AE Transfers - Senior Review",
  "description": "Auto-escalate UAE transfers over $500K",
  "trigger": "on_risk_score_calculation",
  "conditions": {
    "logic": "AND",
    "rules": [
      {
        "field": "jurisdiction",
        "operator": "equals",
        "value": "AE"
      },
      {
        "field": "amount",
        "operator": "greater_than",
        "value": 500000
      },
      {
        "field": "risk_score",
        "operator": "greater_than",
        "value": 30
      }
    ]
  },
  "actions": [
    {
      "type": "change_status",
      "value": "ESCALATED"
    },
    {
      "type": "assign_to_user",
      "value": "senior_officer_123"
    },
    {
      "type": "send_notification",
      "channel": "email",
      "recipient": "compliance@company.com",
      "subject": "High-Value AE Transfer Requires Review"
    }
  ],
  "sla_hours": 2,
  "enabled": true
}
```

**Response (201 Created):**

```json
{
  "workflow_id": "wf_1a2b3c4d",
  "name": "High-Value AE Transfers - Senior Review",
  "status": "ACTIVE",
  "created_at": "2026-03-02T10:35:00Z",
  "triggered_count": 0
}
```

---

### 6.2 List Workflows

**Endpoint:**
```
GET /api/v1/workflows
```

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| **limit** | integer | 20 |
| **offset** | integer | 0 |
| **status** | ACTIVE, DISABLED, DRAFT | All |

**Response (200 OK):**

```json
{
  "workflows": [
    {
      "workflow_id": "wf_1a2b3c4d",
      "name": "High-Value AE Transfers - Senior Review",
      "status": "ACTIVE",
      "trigger_count": 156,
      "created_at": "2026-03-02T10:35:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

### 6.3 Test Workflow

**Endpoint:**
```
POST /api/v1/workflows/{workflow_id}/test
```

**Request Body:**

```json
{
  "test_data": {
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "to_address": "0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12",
    "amount": 600000,
    "currency": "USD",
    "jurisdiction": "AE",
    "risk_score": 45,
    "from_name": "John Doe",
    "to_name": "ABC Corp"
  }
}
```

**Response (200 OK):**

```json
{
  "test_result": "SUCCESS",
  "conditions_met": true,
  "conditions_matched": [
    {"rule": "jurisdiction = AE", "result": true},
    {"rule": "amount > 500000", "result": true},
    {"rule": "risk_score > 30", "result": true}
  ],
  "actions_executed": [
    {"action": "change_status", "status": "EXECUTED"},
    {"action": "assign_to_user", "status": "EXECUTED"},
    {"action": "send_notification", "status": "SIMULATED"}
  ],
  "execution_time_ms": 234
}
```

---

## 7. Reporting & Analytics

### 7.1 Get Compliance Summary

**Endpoint:**
```
GET /api/v1/reports/compliance-summary
```

**Query Parameters:**

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| **from_date** | ISO 8601 | ❌ | 30 days ago |
| **to_date** | ISO 8601 | ❌ | Today |
| **jurisdiction** | string | ❌ | All |
| **status** | string | ❌ | All |

**Example:**
```bash
curl -X GET "http://localhost:4000/api/v1/reports/compliance-summary?from_date=2026-02-01&to_date=2026-03-02&jurisdiction=AE" \
  -H "Authorization: Bearer ..."
```

**Response (200 OK):**

```json
{
  "report_id": "rep_1a2b3c4d",
  "period": {
    "from": "2026-02-01",
    "to": "2026-03-02"
  },
  "summary": {
    "total_checks": 1234,
    "approved": 867,
    "escalated": 287,
    "rejected": 80,
    "approval_rate": 70.25,
    "escalation_rate": 23.25,
    "rejection_rate": 6.50
  },
  "by_jurisdiction": {
    "AE": {
      "total": 450,
      "approved": 315,
      "escalated": 109,
      "rejected": 26
    },
    "US": {
      "total": 400,
      "approved": 280,
      "escalated": 92,
      "rejected": 28
    }
  },
  "risk_statistics": {
    "average_risk_score": 32.4,
    "median_risk_score": 28,
    "high_risk_count": 127,
    "critical_alerts": 3
  },
  "generated_at": "2026-03-02T10:40:00Z"
}
```

---

### 7.2 Generate Custom Report

**Endpoint:**
```
POST /api/v1/reports/generate
```

**Request Body:**

```json
{
  "report_name": "March 2026 Compliance Report",
  "report_type": "compliance_summary",
  "date_range": {
    "from": "2026-03-01",
    "to": "2026-03-02"
  },
  "filters": {
    "jurisdiction": ["AE", "US"],
    "status": ["APPROVED", "ESCALATED"],
    "min_risk_score": 20,
    "max_risk_score": 80
  },
  "sections": [
    "executive_summary",
    "metrics",
    "risk_breakdown",
    "top_entities",
    "alerts",
    "detailed_data"
  ],
  "format": "pdf",
  "include_charts": true
}
```

**Response (200 OK):**

```json
{
  "report_id": "rep_1a2b3c4d",
  "status": "PROCESSING",
  "estimated_completion_seconds": 15,
  "download_url": "https://localhost:4000/api/v1/reports/rep_1a2b3c4d/download"
}
```

**Polling for Completion:**

```bash
curl -X GET http://localhost:4000/api/v1/reports/rep_1a2b3c4d/status \
  -H "Authorization: Bearer ..."

# Response while processing
{
  "report_id": "rep_1a2b3c4d",
  "status": "PROCESSING",
  "progress": 65,
  "estimated_seconds_remaining": 8
}

# Response when complete
{
  "report_id": "rep_1a2b3c4d",
  "status": "COMPLETE",
  "file_size_bytes": 2456789,
  "download_url": "https://localhost:4000/api/v1/reports/rep_1a2b3c4d/download"
}
```

---

## 8. Error Handling

### 8.1 Error Response Format

**Standard Error Response:**

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "code": "SPECIFIC_ERROR_CODE",
  "status": 400,
  "timestamp": "2026-03-02T10:35:00Z",
  "request_id": "req_20260302_001",
  "details": {
    "field": "from_address",
    "issue": "Invalid checksum",
    "suggested_fix": "Use correct checksum: 0x742D35cc..."
  }
}
```

---

### 8.2 HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| **200** | OK | Successful request |
| **201** | Created | Resource created successfully |
| **400** | Bad Request | Invalid input data |
| **401** | Unauthorized | Missing/invalid authentication |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate resource |
| **422** | Unprocessable Entity | Validation failed |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Server Error | Unexpected server error |
| **502** | Bad Gateway | Service unavailable/down |
| **503** | Service Unavailable | Maintenance mode |

---

### 8.3 Common Error Codes

| Error Code | HTTP Status | Cause | Solution |
|-----------|------------|-------|----------|
| **INVALID_ADDRESS** | 400 | Malformed wallet address | Use valid 0x format |
| **INVALID_JWT** | 401 | Expired/invalid token | Refresh token via /auth/refresh-token |
| **INVALID_API_KEY** | 401 | Invalid API key | Check key in environment variables |
| **INSUFFICIENT_PERMISSIONS** | 403 | Role lacks permission | Contact admin for role upgrade |
| **CHECK_NOT_FOUND** | 404 | Check ID doesn't exist | Verify check_id is correct |
| **VALIDATION_ERROR** | 422 | Required field missing | Include all required fields |
| **RATE_LIMIT_EXCEEDED** | 429 | Too many requests | Wait before retry (see retry_after) |
| **EXTERNAL_API_ERROR** | 502 | Ballerine/Marble down | Retry in 30 seconds |
| **DATABASE_ERROR** | 500 | DB connection issue | Retry in 60 seconds |

---

### 8.4 Retry Strategy

**Implement Exponential Backoff:**

```javascript
async function makeRequest(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = parseInt(retryAfter) * 1000;
        console.log(`Rate limited. Waiting ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.log(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 9. Rate Limiting & Quotas

### 9.1 Rate Limit Headers

**Every API response includes rate limit information:**

```bash
curl -i -X POST http://localhost:4000/api/v1/compliance/transfer-check \
  -H "Authorization: Bearer ..."
```

**Response Headers:**

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1709433600
X-RateLimit-Retry-After: 300

{...response body...}
```

**Header Meanings:**

| Header | Meaning | Example |
|--------|---------|---------|
| **X-RateLimit-Limit** | Total requests allowed in window | 1000 |
| **X-RateLimit-Remaining** | Requests remaining in window | 987 |
| **X-RateLimit-Reset** | Unix timestamp when limit resets | 1709433600 |
| **X-RateLimit-Retry-After** | Seconds to wait before retrying | 300 |

---

### 9.2 Rate Limit Tiers

**Tier-based quotas by integration type:**

| Tier | Requests/Hour | Requests/Day | Concurrent | Price |
|------|---------------|-------------|-----------|-------|
| **Starter** | 100 | 1,000 | 5 | Free |
| **Professional** | 1,000 | 10,000 | 25 | $500/month |
| **Enterprise** | 10,000 | 100,000 | 100 | Custom |
| **Custom** | Unlimited | Unlimited | Unlimited | Custom |

**Check Current Limits:**

```bash
curl -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer ..."

# Response includes:
{
  "rate_limit": {
    "tier": "Professional",
    "requests_per_hour": 1000,
    "requests_per_day": 10000,
    "concurrent_requests": 25
  }
}
```

---

### 9.3 Quota Management

**Monitor Quota Usage:**

```bash
curl -X GET http://localhost:4000/api/v1/quotas/usage \
  -H "Authorization: Bearer ..."

# Response
{
  "current_hour": {
    "requests": 156,
    "limit": 1000,
    "remaining": 844,
    "percent_used": 15.6
  },
  "current_day": {
    "requests": 2341,
    "limit": 10000,
    "remaining": 7659,
    "percent_used": 23.41
  },
  "resets_at": "2026-03-02T11:35:00Z"
}
```

---

## 10. Data Format Specifications

### 10.1 Wallet Address Format

**Ethereum Address Standard:**

```
Format: 0x + 40 hexadecimal characters
Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Length: 42 characters total

Requirements:
- Must start with "0x"
- Must be valid hexadecimal
- Checksum must be valid (mixed case)
- Cannot be smart contract (for certain operations)
```

**Address Validation:**

```javascript
const ethers = require('ethers');

function validateAddress(address) {
  try {
    const checksummed = ethers.getAddress(address);
    return {
      valid: true,
      checksum: checksummed,
      message: 'Address valid'
    };
  } catch (error) {
    return {
      valid: false,
      message: error.message
    };
  }
}

// Test
console.log(validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'));
// { valid: true, checksum: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', ... }

console.log(validateAddress('742d35Cc6634C0532925a3b844Bc9e7595f0bEb'));
// { valid: false, message: 'invalid address' }
```

---

### 10.2 Transaction Hash Format

**Blockchain Transaction Hash:**

```
Format: 0x + 64 hexadecimal characters
Example: 0xabc123def456789012345678901234567890123456789012345678901234567x
Length: 66 characters total

Requirements:
- Must start with "0x"
- Must be valid hexadecimal
- Can be pending, confirmed, or failed
```

---

### 10.3 Amount & Currency Formats

**Numeric Amount:**

```
Format: Decimal number without commas
Minimum: 0.01
Maximum: Depends on jurisdiction (usually 999,999,999)

Examples:
✅ Correct: 50000, 50000.50, 0.01, 999999999
❌ Wrong: 50,000, $50000, USD50000, 1e10
```

**Currency Codes:**

```
ISO 4217 Standard

Common:
- USD: United States Dollar
- EUR: Euro
- GBP: British Pound
- JPY: Japanese Yen
- CHF: Swiss Franc
- CNY: Chinese Yuan
- AED: United Arab Emirates Dirham
- INR: Indian Rupee
- SGD: Singapore Dollar
```

---

### 10.4 Date/Time Formats

**ISO 8601 Standard:**

```
Format: YYYY-MM-DDTHH:mm:ssZ (UTC)
Example: 2026-03-02T10:35:00Z

JavaScript example:
new Date().toISOString()
// "2026-03-02T10:35:45.123Z"

Python example:
from datetime import datetime, timezone
datetime.now(timezone.utc).isoformat()
# '2026-03-02T10:35:45.123456+00:00'
```

---

## 11. Integration Patterns

### 11.1 Synchronous Integration (Request-Response)

**When you need immediate results:**

```
Client → POST /compliance/transfer-check → Wait 2-5s → Response
```

**Use Case:** Real-time transaction approval/rejection

**Code Example:**

```javascript
const axios = require('axios');

async function checkCompliance(transferData) {
  try {
    const response = await axios.post(
      'http://localhost:4000/api/v1/compliance/transfer-check',
      transferData,
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Compliance check failed:', error.response?.data);
    throw error;
  }
}

// Usage
try {
  const result = await checkCompliance({
    from_address: '0x742d35...',
    to_address: '0x8626f8...',
    amount: 50000,
    currency: 'USD',
    jurisdiction: 'AE',
    from_name: 'John Doe',
    to_name: 'ABC Corp'
  });
  
  if (result.status === 'APPROVED') {
    // Proceed with transaction
  } else if (result.status === 'ESCALATED') {
    // Hold transaction pending review
  } else {
    // Block transaction
  }
} catch (error) {
  // Handle error
}
```

---

### 11.2 Asynchronous Integration (Webhooks)

**When you don't need immediate results:**

```
Client → POST /compliance/transfer-check
            { processing_mode: "async" }
            ↓
Client ← Immediate 202 Accepted Response
            ↓
[Processing continues...]
            ↓
Server → POST {your_webhook_url} with results
```

**Use Case:** Batch processing, background operations

**Code Example (Client):**

```javascript
async function submitForAsyncReview(transferData) {
  try {
    const response = await axios.post(
      'http://localhost:4000/api/v1/compliance/transfer-check',
      {
        ...transferData,
        processing_mode: 'async',
        webhook_url: 'https://yourapp.com/webhooks/compliance-result'
      },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`
        }
      }
    );
    
    return response.data; // { check_id, status: 'PROCESSING' }
  } catch (error) {
    console.error('Failed to submit check:', error);
    throw error;
  }
}
```

**Code Example (Webhook Handler):**

```javascript
const express = require('express');
const crypto = require('crypto');

app.post('/webhooks/compliance-result', (req, res) => {
  // Verify webhook signature
  const signature = req.headers['x-ableka-signature'];
  const body = JSON.stringify(req.body);
  const secret = process.env.ABLEKA_WEBHOOK_SECRET;
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(signature, expected)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process result
  const { check_id, status, risk_score } = req.body;
  
  console.log(`Compliance check ${check_id}: ${status} (risk: ${risk_score})`);
  
  // Update your database
  updateTransactionStatus(check_id, status);
  
  // Send notification to user
  if (status === 'REJECTED') {
    sendRejectionEmail(check_id);
  }
  
  res.json({ received: true });
});
```

---

### 11.3 Webhook Retry Logic

**If your webhook fails, Ableka will retry:**

```
Attempt 1: Immediate
Attempt 2: 5 seconds later
Attempt 3: 30 seconds later
Attempt 4: 5 minutes later
Attempt 5: 30 minutes later

After 5 failed attempts: Webhook disabled
```

**Make your webhook idempotent:**

```javascript
// DON'T do this (processes multiple times)
app.post('/webhooks/compliance-result', (req, res) => {
  updateBalance(req.body.check_id); // Called 5 times = 5x balance update!
  res.json({ ok: true });
});

// DO this instead (safe for retries)
app.post('/webhooks/compliance-result', async (req, res) => {
  const { check_id, status } = req.body;
  
  // Check if already processed
  const existing = await db.query(
    'SELECT * FROM compliance_results WHERE check_id = $1',
    [check_id]
  );
  
  if (existing.length > 0) {
    // Already processed, return success to stop retries
    return res.json({ already_processed: true });
  }
  
  // First time: process and store
  await processCompliance(check_id, status);
  await db.query(
    'INSERT INTO compliance_results (check_id, status) VALUES ($1, $2)',
    [check_id, status]
  );
  
  res.json({ processed: true });
});
```

---

## 12. Best Practices

### 12.1 Security Best Practices

**Authentication:**

```javascript
✅ DO:
- Store JWT tokens in secure httpOnly cookies
- Refresh token every 15 minutes
- Use HTTPS/TLS in production
- Implement token rotation

// Secure token storage (server-side session)
app.post('/login', (req, res) => {
  const token = generateJWT(user);
  res.cookie('token', token, {
    httpOnly: true,      // Prevent JS access
    secure: true,        // HTTPS only
    sameSite: 'Strict',  // CSRF protection
  });
  res.json({ success: true });
});

❌ DON'T:
- Store tokens in localStorage
- Commit API keys to GitHub
- Log sensitive data
- Use HTTP in production
```

**Data Handling:**

```javascript
✅ DO:
- Encrypt sensitive fields in database
- Validate all input (whitelist, not blacklist)
- Use prepared statements for SQL
- Log all compliance decisions for audit

❌ DON'T:
- Store raw PII (encrypt at rest)
- Trust user input
- Build SQL queries with string concatenation
- Expose detailed error messages to users
```

---

### 12.2 Error Handling Best Practices

```javascript
// ✅ Good error handling
async function submitCheck(data) {
  try {
    const response = await checkCompliance(data);
    return response;
  } catch (error) {
    if (error.response?.status === 429) {
      // Rate limited: implement backoff
      const retryAfter = error.response.headers['retry-after'];
      throw new RateLimitError(`Retry after ${retryAfter}s`);
    } else if (error.response?.status === 400) {
      // Validation error: log and show user
      logger,.error('Validation failed:', error.response.data);
      throw new ValidationError(error.response.data.message);
    } else if (error.code === 'ECONNREFUSED') {
      // Connection error: retry
      throw new TemporaryError('Service unavailable, retrying...');
    } else {
      // Unknown error: log full context
      logger.error({
        message: error.message,
        stack: error.stack,
        context: { data }
      });
      throw error;
    }
  }
}

// ❌ Bad error handling
async function submitCheck(data) {
  try {
    return await checkCompliance(data);
  } catch (error) {
    console.log(error); // Too vague
    throw error;
  }
}
```

---

### 12.3 Performance Optimization

**Batch Processing:**

```javascript
// ❌ Inefficient: 1,000 sequential requests (5,000+ seconds)
for (let i = 0; i < 1000; i++) {
  await submitCheck(data[i]);
}

// ✅ Efficient: 1 batch request (5 seconds)
await submitBatchChecks(data);

// ✅ Efficient: Parallel with rate limit respect
const batchSize = 50;
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  await Promise.all(batch.map(d => submitCheck(d)));
  await sleep(1000); // Rate limit respect
}
```

**Caching:**

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 min TTL

async function checkCompliance(data) {
  // Check cache first
  const cacheKey = JSON.stringify(data);
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  // Not cached: fetch from API
  const result = await apiCall(data);
  
  // Cache result
  cache.set(cacheKey, result);
  
  return result;
}
```

---

## 13. Troubleshooting

### 13.1 Common Integration Issues

**Issue: 401 Unauthorized**

```
Error: {"error": "INVALID_JWT", "message": "Token expired"}

Solution:
1. Check token expiration: jwt.io decode token
2. Refresh token via /auth/refresh-token
3. Implement automatic refresh 5 minutes before expiry

Code:
const tokenExp = jwt.decode(token).exp * 1000;
if (Date.now() > tokenExp - 300000) { // 5 min window
  token = await refreshToken(refreshToken);
}
```

---

**Issue: 422 Validation Error**

```
Error: {"error": "VALIDATION_ERROR", "details": [...]}

Solution:
1. Review error details field
2. Check wallet address checksum
3. Verify amount format (no commas, decimals OK)
4. Ensure all required fields present

Example fix:
const addressFixed = ethers.getAddress(address); // Fix checksum
```

---

**Issue: 429 Rate Limited**

```
Error: {"error": "RATE_LIMIT_EXCEEDED", "retry_after_seconds": 3600}

Solution:
1. Check X-RateLimit-Remaining header
2. Implement exponential backoff
3. Upgrade to higher tier if persistent
4. Use batch endpoints for bulk submissions
```

---

## 14. Code Examples

### 14.1 Complete Node.js Integration Example

```javascript
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuration
const ABLEKA_BASE_URL = process.env.ABLEKA_API_BASE_URL;
const ABLEKA_API_KEY = process.env.ABLEKA_API_KEY;
const WEBHOOK_SECRET = process.env.ABLEKA_WEBHOOK_SECRET;

let currentJWT = null;
let jwtExpiry = null;

// Authenticate and get JWT
async function authenticate() {
  if (currentJWT && jwtExpiry && Date.now() < jwtExpiry - 300000) {
    return currentJWT;
  }
  
  try {
    const response = await axios.post(`${ABLEKA_BASE_URL}/auth/login`, {
      email: process.env.ABLEKA_EMAIL,
      password: process.env.ABLEKA_PASSWORD
    });
    
    currentJWT = response.data.access_token;
    jwtExpiry = Date.now() + (response.data.expires_in * 1000);
    return currentJWT;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

// Submit compliance check
async function submitComplianceCheck(transferData) {
  const token = await authenticate();
  
  try {
    const response = await axios.post(
      `${ABLEKA_BASE_URL}/compliance/transfer-check`,
      transferData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const err = new Error(`Rate limited. Retry after ${retryAfter}s`);
      err.retryAfter = retryAfter;
      throw err;
    }
    throw error;
  }
}

// Submit check via API endpoint
app.post('/api/transfercheck', async (req, res) => {
  try {
    const result = await submitComplianceCheck(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint (receives compliance results)
app.post('/webhooks/compliance', (req, res) => {
  const sig = req.headers['x-ableka-signature'];
  const body = JSON.stringify(req.body);
  
  // Verify signature
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(sig, expected)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  const { check_id, status, risk_score } = req.body;
  console.log(`✓ Check ${check_id}: ${status} (Risk: ${risk_score})`);
  
  // TODO: Update your database
  // updateTransaction(check_id, status);
  
  res.json({ received: true });
});

app.listen(3000, () => console.log('Server running on :3000'));
```

---

### 14.2 Python Integration Example

```python
import requests
import os
import json
import hmac
import hashlib
from datetime import datetime, timedelta


class AblekaComplianceClient:
    def __init__(self):
        self.base_url = os.getenv('ABLEKA_API_BASE_URL')
        self.api_key = os.getenv('ABLEKA_API_KEY')
        self.token = None
        self.token_expiry = None
    
    def authenticate(self):
        """Get JWT token"""
        if self.token and self.token_expiry > datetime.now():
            return self.token
        
        response = requests.post(
            f'{self.base_url}/auth/login',
            json={
                'email': os.getenv('ABLEKA_EMAIL'),
                'password': os.getenv('ABLEKA_PASSWORD')
            }
        )
        response.raise_for_status()
        
        data = response.json()
        self.token = data['access_token']
        self.token_expiry = datetime.now() + timedelta(
            seconds=data['expires_in']
        )
        return self.token
    
    def submit_transfer_check(self, transfer_data):
        """Submit compliance check"""
        token = self.authenticate()
        
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(
            f'{self.base_url}/compliance/transfer-check',
            json=transfer_data,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        return response.json()


# Usage
if __name__ == '__main__':
    client = AblekaComplianceClient()
    
    transfer_data = {
        'from_address': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        'to_address': '0x8626f8abCD0A929B9c8f5F08E5B5C6A3f7dD9e12',
        'amount': 50000,
        'currency': 'USD',
        'jurisdiction': 'AE',
        'from_name': 'John Doe',
        'to_name': 'ABC Corp'
    }
    
    result = client.submit_transfer_check(transfer_data)
    print(json.dumps(result, indent=2))
```

---

## 15. Webhook Configuration

### 15.1 Setting Up Webhooks

**Register Webhook URL:**

```bash
curl -X POST http://localhost:4000/api/v1/webhooks \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/webhooks/compliance",
    "events": [
      "compliance_check.completed",
      "compliance_check.escalated",
      "alert.created"
    ],
    "active": true
  }'

# Response
{
  "webhook_id": "whk_1a2b3c4d",
  "url": "https://yourapp.com/webhooks/compliance",
  "secret": "whk_secret_1a2b3c4d...",
  "events": [...],
  "active": true
}
```

---

### 15.2 Webhook Event Types

**Available Events:**

| Event | Triggered When |
|-------|---|
| **compliance_check.submitted** | New check created |
| **compliance_check.processing** | Check entered processing |
| **compliance_check.completed** | Check finished (any status) |
| **compliance_check.approved** | Check approved auto |
| **compliance_check.escalated** | Check escalated for review |
| **compliance_check.rejected** | Check rejected |
| **alert.created** | High-risk alert generated |
| **alert.acknowledged** | Alert acknowledged by officer |
| **workflow.executed** | Workflow action triggered |
| **batch.completed** | Batch processing finished |

---

### 15.3 Webhook Best Practices

```javascript
// ✅ DO: Idempotent webhook handler
app.post('/webhooks/compliance', async (req, res) => {
  const { check_id, status } = req.body;
  
  // Check if already processed
  const existing = await db.query(
    'SELECT id FROM processed_webhooks WHERE check_id = $1',
    [check_id]
  );
  
  if (existing.length > 0) {
    // Return success to prevent retries
    return res.json({ already_processed: true });
  }
  
  // Process
  await updateTransaction(check_id, status);
  
  // Record processing
  await db.query(
    'INSERT INTO processed_webhooks (check_id) VALUES ($1)',
    [check_id]
  );
  
  res.json({ success: true });
});

// ✅ DO: Verify webhook signature
app.post('/webhooks/compliance', (req, res) => {
  const signature = req.headers['x-ableka-signature'];
  const body = req.rawBody; // Capture raw body
  const secret = process.env.ABLEKA_WEBHOOK_SECRET;
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(signature, expected)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Safe to process
  res.json({ received: true });
});

// ✅ DO: Return quickly
app.post('/webhooks/compliance', async (req, res) => {
  res.json({ received: true }); // Respond immediately
  
  // Process asynchronously
  setImmediate(async () => {
    try {
      await processWebhook(req.body);
    } catch (error) {
      logger.error('Webhook processing failed:', error);
    }
  });
});

// ❌ DON'T: Long-running operations in webhook
app.post('/webhooks/compliance', async (req, res) => {
  // BAD: blocks response
  await expensiveDatabaseMigration();
  await slowExternalAPICall();
  res.json({ completed: true }); // Response delayed 30+ seconds
});
```

---

## Document Information

**API Documentation Version:** 1.0  
**Last Updated:** March 2, 2026  
**API Version Documented:** 1.0  
**Maintained By:** Ableka Lumina Engineering  
**Support Email:** api-support@ableka.com  

---

## Appendix: Quick Reference

### Endpoint Summary

**Authentication:**
- `POST /auth/login` - Get JWT token
- `POST /auth/refresh-token` - Refresh expired token

**Compliance Checks:**
- `POST /compliance/transfer-check` - Submit single check
- `GET /compliance/transfer-check/{check_id}` - Get check status
- `POST /compliance/batch-transfer-checks` - Batch submission

**Standalone Checks:**
- `POST /kyc/verify` - Identity verification only
- `POST /aml/assess-risk` - AML scoring only
- `POST /sanctions/screen` - Sanctions check only

**Workflows:**
- `POST /workflows` - Create workflow
- `GET /workflows` - List workflows
- `POST /workflows/{id}/test` - Test workflow

**Reports:**
- `GET /reports/compliance-summary` - Summary report
- `POST /reports/generate` - Custom report generation

**Monitoring:**
- `WS /stream/monitoring` - Real-time alerts & monitoring

---

**End of API Documentation**

*For integration support, contact: integration@ableka.com*
