# Ableka Lumina - Complete API Integration Guide

**Last Updated**: February 27, 2026  
**API Version**: 1.0.0  
**WebSocket Protocol**: Enabled for real-time monitoring

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [API Endpoints Guide](#api-endpoints-guide)
4. [WebSocket Monitoring](#websocket-monitoring)
5. [Code Examples](#code-examples)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Get JWT Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "compliance@example.com",
    "password": "secure-password"
  }'
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "email": "compliance@example.com",
    "role": "compliance_officer"
  }
}
```

### 2. Perform KYC Check

```bash
curl -X POST http://localhost:3000/api/kyc-check \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityId": "entity-abc123",
    "jurisdiction": "AE",
    "documents": [{
      "type": "passport",
      "data": "base64-encoded-document-data",
      "metadata": {
        "filename": "ahmed-passport.jpg",
        "contentType": "image/jpeg"
      }
    }],
    "entityData": {
      "name": "Ahmed Al Maktoum",
      "dateOfBirth": "1985-03-15",
      "nationality": "AE"
    }
  }'
```

### 3. Monitor WebSocket Alerts

```javascript
const token = "YOUR_JWT_TOKEN";
const wallet = "0xabcd1234567890abcd1234567890abcd12345678";

const ws = new WebSocket(
  `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${token}`
);

ws.onopen = () => {
  console.log('Connected to monitoring stream');
  // Send heartbeat every 10 seconds
  setInterval(() => {
    ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
  }, 10000);
};

ws.onmessage = (event) => {
  const alert = JSON.parse(event.data);
  console.log('Compliance Alert:', alert);
  
  // Handle alert
  if (alert.severity === 'CRITICAL') {
    // Take action
    triggerCompleteFreeze(alert.wallet);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from monitoring stream');
};
```

---

## Authentication

### JWT Token Format

All protected endpoints require a Bearer token in the Authorization header:

```bash
Authorization: Bearer <jwt-token>
```

### Token Structure

```json
{
  "id": "user-123",
  "email": "officer@example.com",
  "role": "compliance_officer",
  "permissions": [
    "kyc:execute",
    "aml:execute",
    "compliance:read",
    "compliance:write"
  ],
  "iat": 1709027400,
  "exp": 1709031000
}
```

### Token Management

**Obtain Token**:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

**Refresh Token**:
```bash
POST /api/auth/refresh-token
Authorization: Bearer <expired-token>
Content-Type: application/json

{
  "token": "<expired-token>"
}
```

### Role-Based Access Control (RBAC)

**Available Roles**:

| Role | Permissions | Use Case |
|------|-----------|----------|
| `admin` | All permissions | System administration |
| `compliance_officer` | kyc:*, aml:*, compliance:* | Decision making |
| `analyst` | Read-only access | Monitoring & reporting |
| `auditor` | Reports, audit logs | Compliance auditing |

---

## API Endpoints Guide

### KYC (Know Your Customer)

#### POST /api/kyc-check
Perform KYC verification for an entity.

**Authorization**: `kyc:execute`

**Supported Jurisdictions**: AE, US, EU, IN

**Document Types**:
- aadhaar
- passport
- drivers_license
- national_id
- utility_bill
- bank_statement

**Example**:
```json
POST /api/kyc-check
Authorization: Bearer <token>

{
  "entityId": "ent-123",
  "jurisdiction": "AE",
  "documents": [{
    "type": "passport",
    "data": "base64-data",
    "metadata": {
      "filename": "passport.jpg",
      "contentType": "image/jpeg",
      "size": 2048
    }
  }],
  "entityData": {
    "name": "Full Name",
    "dateOfBirth": "1980-01-15",
    "nationality": "AE",
    "address": "Dubai, UAE"
  }
}
```

**Response (200)**:
```json
{
  "success": true,
  "checkId": "kyc-chk-abc123",
  "entityId": "ent-123",
  "status": "APPROVED",
  "riskScore": 18,
  "confidence": 0.98,
  "jurisdictionRules": [
    { "rule": "Valid Passport Required", "passed": true },
    { "rule": "No PEP Match", "passed": true },
    { "rule": "No Sanctions Match", "passed": true }
  ],
  "reasoning": "Entity passed all jurisdiction-specific requirements",
  "timestamp": "2026-02-27T10:30:00Z"
}
```

---

### AML (Anti-Money Laundering)

#### POST /api/aml-score
Perform AML risk screening with transaction analysis.

**Authorization**: `aml:execute`

**Transaction Types**: deposit, withdrawal, transfer, payment, exchange

**Example**:
```json
POST /api/aml-score
Authorization: Bearer <token>

{
  "entityId": "ent-123",
  "jurisdiction": "US",
  "transactions": [{
    "id": "tx-abc123",
    "amount": 50000,
    "currency": "USD",
    "counterparty": "John Doe",
    "counterpartyId": "ent-456",
    "timestamp": "2026-02-27T10:00:00Z",
    "type": "transfer",
    "description": "Payment for consulting services"
  }],
  "entityData": {
    "name": "Business Corp",
    "country": "US",
    "businessType": "Consulting"
  }
}
```

**Response (200)**:
```json
{
  "success": true,
  "checkId": "aml-chk-xyz789",
  "entityId": "ent-123",
  "riskScore": 35,
  "flags": ["NORMAL_VELOCITY", "NO_SANCTIONS_MATCH"],
  "sanctionsMatch": false,
  "pepMatch": false,
  "reasonin": "Low-risk profile with normal transaction patterns",
  "timestamp": "2026-02-27T10:30:00Z"
}
```

---

### Compliance Management

#### GET /api/compliance/checks
Get compliance check history with pagination and filters.

**Authorization**: `compliance:read`

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 20)
- `status`: APPROVED, REJECTED, ESCALATED, PENDING
- `jurisdiction`: AE, US, EU, IN
- `riskLevel`: LOW, MEDIUM, HIGH, CRITICAL

**Example**:
```bash
GET /api/compliance/checks?page=1&limit=20&status=PENDING&jurisdiction=AE
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "entityId": "ent-123",
      "jurisdiction": "AE",
      "status": "PENDING",
      "kycStatus": "PENDING",
      "amlStatus": "APPROVED",
      "overallRiskScore": 25,
      "createdAt": "2026-02-27T10:00:00Z",
      "updatedAt": "2026-02-27T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### POST /api/compliance/approve/{id}
Approve a compliance check.

**Authorization**: `compliance:write` + `compliance_officer` role

**Example**:
```bash
POST /api/compliance/approve/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "All verification checks passed"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Check approved",
  "checkId": "550e8400-e29b-41d4-a716-446655440000",
  "approvedBy": "user-123",
  "approvedAt": "2026-02-27T10:35:00Z"
}
```

#### POST /api/compliance/reject/{id}
Reject a compliance check.

**Authorization**: `compliance:write` + `compliance_officer` role

**Example**:
```bash
POST /api/compliance/reject/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Sanctions list match detected - OFAC SDN"
}
```

---

### Reports & Analytics

#### GET /api/reports/compliance
Generate compliance report with date range filtering.

**Authorization**: `reports:read`

**Query Parameters**:
- `startDate`: ISO 8601 date (required)
- `endDate`: ISO 8601 date (required)
- `jurisdiction`: Filter by jurisdiction
- `format`: json, pdf, csv (default: json)

**Example**:
```bash
GET /api/reports/compliance?startDate=2026-01-01T00:00:00Z&endDate=2026-02-27T23:59:59Z&format=json
Authorization: Bearer <token>
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-01T00:00:00Z",
      "end": "2026-02-27T23:59:59Z"
    },
    "summary": {
      "totalChecks": 2547,
      "approved": 2412,
      "rejected": 89,
      "escalated": 46,
      "approvalRate": 94.7
    },
    "byJurisdiction": {
      "AE": { "total": 612, "approved": 598, "rejected": 14 },
      "US": { "total": 801, "approved": 741, "rejected": 60 },
      "EU": { "total": 734, "approved": 679, "rejected": 55 },
      "IN": { "total": 400, "approved": 394, "rejected": 6 }
    },
    "riskDistribution": {
      "LOW": 1800,
      "MEDIUM": 650,
      "HIGH": 95,
      "CRITICAL": 2
    }
  }
}
```

---

## WebSocket Monitoring

### Connection

**URL Pattern**:
```
ws://localhost:3000/api/stream/monitoring/{wallet}?token={jwt_token}
```

**Example**:
```javascript
const wallet = "0xabcd1234567890abcd1234567890abcd12345678";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const ws = new WebSocket(
  `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${token}`
);
```

### Client Commands

#### HEARTBEAT
Keep connection alive.

```json
{
  "type": "HEARTBEAT"
}
```

#### FILTER
Filter alerts by jurisdiction.

```json
{
  "type": "FILTER",
  "jurisdiction": "AE"
}
```

#### REQUEST_CACHE
Request all queued alerts.

```json
{
  "type": "REQUEST_CACHE"
}
```

### Server Messages

#### Alert Message

```json
{
  "alertId": "alert-1709029200000-abc123def",
  "wallet": "0xabcd1234567890abcd1234567890abcd12345678",
  "entityId": "entity-12345",
  "jurisdiction": "AE",
  "alertType": "SANCTIONS",
  "severity": "HIGH",
  "message": "Wallet matched against OFAC sanctions list",
  "riskScore": 87,
  "details": {
    "matchedList": "OFAC_SDN",
    "matchedName": "Ahmed Al Maktoum",
    "confidence": 0.95,
    "matchedDate": "2026-02-27T10:15:00Z"
  },
  "timestamp": "2026-02-27T10:30:00Z",
  "requiresAction": true
}
```

### Alert Types

| Type | Severity | Action |
|------|----------|--------|
| KYC | Variable | Review verification status |
| AML | Variable | Review risk assessment |
| FRAUD | HIGH/CRITICAL | Investigate pattern |
| SANCTIONS | CRITICAL | Freeze account immediately |
| VELOCITY | MEDIUM/HIGH | Review transaction pattern |
| PATTERN | HIGH | Investigate anomaly |

---

## Code Examples

### Python Integration

```python
import requests
import json
from websocket import WebSocketApp

# Get JWT token
response = requests.post(
    'http://localhost:3000/api/auth/login',
    json={
        'email': 'officer@example.com',
        'password': 'password'
    }
)
token = response.json()['token']

# Perform KYC check
headers = {'Authorization': f'Bearer {token}'}
kyc_response = requests.post(
    'http://localhost:3000/api/kyc-check',
    headers=headers,
    json={
        'entityId': 'entity-123',
        'jurisdiction': 'AE',
        'documents': [...],
        'entityData': {...}
    }
)
print(f"KYC Status: {kyc_response.json()['status']}")

# WebSocket monitoring
def on_message(ws, message):
    alert = json.loads(message)
    print(f"Alert: {alert['alertType']} - {alert['message']}")

def on_open(ws):
    ws.send(json.stringify({'type': 'HEARTBEAT'}))

ws = WebSocketApp(
    f'ws://localhost:3000/api/stream/monitoring/0xABC...?token={token}',
    on_message=on_message,
    on_open=on_open
)
ws.run_forever()
```

### JavaScript/Node.js Integration

```javascript
const axios = require('axios');
const WebSocket = require('ws');

// Get JWT token
async function getToken() {
  const response = await axios.post(
    'http://localhost:3000/api/auth/login',
    {
      email: 'officer@example.com',
      password: 'password'
    }
  );
  return response.data.token;
}

// Perform KYC check
async function performKYCCheck(token, entityData) {
  const response = await axios.post(
    'http://localhost:3000/api/kyc-check',
    {
      entityId: 'entity-123',
      jurisdiction: 'AE',
      documents: [...],
      entityData: {...}
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
}

// WebSocket monitoring
async function monitorWallet(token, wallet) {
  const ws = new WebSocket(
    `ws://localhost:3000/api/stream/monitoring/${wallet}?token=${token}`
  );

  ws.on('open', () => {
    console.log('Connected to monitoring');
    setInterval(() => {
      ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
    }, 10000);
  });

  ws.on('message', (data) => {
    const alert = JSON.parse(data);
    console.log(`Alert: ${alert.alertType} - ${alert.message}`);
    
    if (alert.severity === 'CRITICAL') {
      takeComplianceAction(alert);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

// Main
(async () => {
  const token = await getToken();
  const kycResult = await performKYCCheck(token, {...});
  await monitorWallet(token, '0xABC...');
})();
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "officer@example.com",
    "password": "password"
  }' | jq '.token'

# KYC Check
TOKEN="your-jwt-token"
curl -X POST http://localhost:3000/api/kyc-check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "entityId": "entity-123",
  "jurisdiction": "AE",
  "documents": [...],
  "entityData": {...}
}
EOF

# Get Compliance Checks
curl -X GET "http://localhost:3000/api/compliance/checks?status=PENDING" \
  -H "Authorization: Bearer $TOKEN"

# WebSocket monitoring with wscat
wscat -c "ws://localhost:3000/api/stream/monitoring/0xABC...?token=$TOKEN"
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | Invalid parameters or validation error |
| 401 | Unauthorized | JWT token missing or invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |
| 503 | Service Unavailable | Dependency failure |

### Error Response Format

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "details": {
    "field": "jurisdiction",
    "error": "Must be one of: AE, US, EU, IN"
  }
}
```

### Common Errors

**Missing JWT Token**:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Missing or invalid authorization header"
}
```

**Invalid Document Type**:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid document type",
  "details": {
    "field": "documents[0].type",
    "error": "Must be one of: aadhaar, passport, drivers_license, ..."
  }
}
```

**Rate Limit Exceeded**:
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

## Best Practices

### 1. Token Management
- ✅ Refresh tokens before expiration
- ✅ Store tokens securely (not in localStorage)
- ✅ Use HTTPS for all requests
- ❌ Don't hardcode tokens in code

### 2. Error Handling
- ✅ Handle 401/403 errors by refreshing token
- ✅ Implement exponential backoff for retries
- ✅ Log errors for debugging
- ❌ Don't expose full error messages to users

### 3. WebSocket Usage
- ✅ Send HEARTBEAT every 10 seconds
- ✅ Reconnect on unexpected disconnection
- ✅ Use exponential backoff for reconnection
- ❌ Don't leave idle connections open

### 4. Rate Limiting
- ✅ Implement request queuing
- ✅ Monitor 429 responses
- ✅ Batch requests when possible
- ❌ Don't hammer endpoints with rapid requests

### 5. Data Validation
- ✅ Validate all input data locally
- ✅ Check response structure before processing
- ✅ Verify timestamps are in ISO 8601 format
- ❌ Don't assume API response format

---

## Troubleshooting

### WebSocket Connection Fails

**Problem**: `Connection refused` error

**Solution**:
1. Verify API server is running: `curl http://localhost:3000/api/health`
2. Check JWT token is valid and not expired
3. Verify wallet address format (40 hex chars after 0x)
4. Check browser console for detailed error

**Problem**: `Unauthorized` error

**Solution**:
1. Ensure JWT token is provided: `?token=YOUR_TOKEN`
2. Verify token hasn't expired (15-minute expiration)
3. Get new token: `POST /api/auth/login`
4. Pass in Authorization header instead of query param

### KYC Check Timeout

**Problem**: Request takes >30 seconds or times out

**Solution**:
1. Ballerine KYC provider might be slow
2. Implement timeout and retry logic
3. Check API logs for errors: `tail logs/kyc-routes.log`
4. Verify Ballerine API key is valid

### Rate Limiting

**Problem**: Receiving 429 responses

**Solution**:
1. Current limit: 100 requests/minute per IP
2. Implement exponential backoff
3. Contact support for higher limits if needed
4. Batch similar requests

### Database Connection Issues

**Problem**: `GET /api/health` shows database disconnected

**Solution**:
1. Verify PostgreSQL is running: `docker ps`
2. Check connection string in .env
3. Verify network connectivity
4. Restart database: `docker-compose restart postgres`

---

## Support & Documentation

- **API Documentation**: [OpenAPI Spec](./docs/openapi.yaml)
- **WebSocket Guide**: [WebSocket Monitoring](../docs/WEBSOCKET-GUIDE.md)
- **Security**: [Security Best Practices](../docs/API-SECURITY.md)
- **Postman Collection**: [Download](../docs/postman-collection.json)
- **Support Email**: api-support@ableka-lumina.com

---

**Version**: 1.0.0  
**Last Updated**: February 27, 2026  
**Status**: ✅ Production Ready
