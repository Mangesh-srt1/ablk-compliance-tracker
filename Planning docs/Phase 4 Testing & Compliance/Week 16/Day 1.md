# Day 1: Setup Cypress for API Tests

## Objectives
- Install and configure Cypress for end-to-end testing of the Ableka Lumina API
- Set up test environment with proper configuration for API endpoints
- Create initial test structure for automated API validation
- Integrate Cypress with the existing Node.js monorepo
- Establish testing patterns for global compliance API workflows

## Implementation Details

### Cypress Installation and Configuration
Cypress is a modern end-to-end testing framework that provides fast, reliable testing for anything that runs in a browser. For API testing, we'll use Cypress's built-in HTTP request capabilities and assertion library.

### Test Environment Setup
- Configure Cypress to work with the Express.js API server
- Set up test data fixtures for different jurisdictions (SEBI, GDPR, FinCEN)
- Create environment-specific configurations for development, staging, and production
- Implement proper cleanup and teardown procedures

### API Test Structure
- Organize tests by endpoint functionality (/kyc-check, /aml-score, /fraud-detect)
- Include tests for different HTTP methods (GET, POST, PUT, DELETE)
- Add tests for error handling and edge cases
- Implement tests for multi-tenant isolation and jurisdiction routing

## Code Implementation

### 1. Install Cypress Dependencies
```bash
npm install --save-dev cypress @cypress/code-coverage istanbul-lib-coverage
```

### 2. Cypress Configuration
Create `cypress.config.js` in the root directory:

```javascript
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on, config) {
      // implement node event listeners here
      require('@cypress/code-coverage/task')(on, config)
      return config
    },
    env: {
      apiKey: 'test-api-key-123',
      baseUrl: 'http://localhost:3000'
    },
    retries: {
      runMode: 2,
      openMode: 0
    },
    video: false,
    screenshotOnRunFailure: true
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite'
    }
  }
})
```

### 3. Support File Configuration
Create `cypress/support/e2e.js`:

```javascript
// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global test data
Cypress.env('testData', {
  indianEntity: {
    entityId: 'IN123456789',
    jurisdiction: 'SEBI',
    entityType: 'individual',
    name: 'Rajesh Kumar',
    pan: 'ABCDE1234F',
    aadhaar: '1234-5678-9012'
  },
  euEntity: {
    entityId: 'EU987654321',
    jurisdiction: 'GDPR',
    entityType: 'business',
    name: 'European FinTech Ltd',
    taxId: 'EU123456789',
    country: 'Germany'
  },
  usEntity: {
    entityId: 'US456789123',
    jurisdiction: 'FinCEN',
    entityType: 'individual',
    name: 'John Smith',
    ssn: '123-45-6789',
    address: '123 Main St, New York, NY'
  }
})

// Global beforeEach hook
beforeEach(() => {
  // Reset API state before each test
  cy.request('POST', '/api/test/reset')
})
```

### 4. Custom Commands
Create `cypress/support/commands.js`:

```javascript
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

/// <reference types="cypress" />

// Custom command for API authentication
Cypress.Commands.add('login', (apiKey = Cypress.env('apiKey')) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { apiKey }
  }).then((response) => {
    expect(response.status).to.eq(200)
    Cypress.env('authToken', response.body.token)
  })
})

// Custom command for making authenticated API requests
Cypress.Commands.add('apiRequest', (method, url, body = null) => {
  const token = Cypress.env('authToken')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  return cy.request({
    method,
    url,
    headers,
    body,
    failOnStatusCode: false
  })
})

// Custom command for KYC check
Cypress.Commands.add('kycCheck', (entityData) => {
  return cy.apiRequest('POST', '/api/kyc-check', entityData)
})

// Custom command for AML scoring
Cypress.Commands.add('amlScore', (entityData) => {
  return cy.apiRequest('POST', '/api/aml-score', entityData)
})

// Custom command for fraud detection
Cypress.Commands.add('fraudDetect', (transactionData) => {
  return cy.apiRequest('POST', '/api/fraud-detect', transactionData)
})

// Custom command for compliance tracking
Cypress.Commands.add('complianceTrack', (entityId, jurisdiction) => {
  return cy.apiRequest('GET', `/api/compliance/track/${entityId}?jurisdiction=${jurisdiction}`)
})
```

### 5. Test Fixtures
Create `cypress/fixtures/test-data.json`:

```json
{
  "indianKycRequest": {
    "entityId": "IN123456789",
    "jurisdiction": "SEBI",
    "entityType": "individual",
    "personalInfo": {
      "name": "Rajesh Kumar",
      "pan": "ABCDE1234F",
      "aadhaar": "1234-5678-9012",
      "dob": "1985-06-15",
      "address": "123 MG Road, Mumbai, Maharashtra 400001"
    },
    "documents": [
      {
        "type": "pan_card",
        "number": "ABCDE1234F",
        "issuedDate": "2020-01-01"
      },
      {
        "type": "aadhaar_card",
        "number": "1234-5678-9012",
        "issuedDate": "2015-01-01"
      }
    ]
  },
  "euKycRequest": {
    "entityId": "EU987654321",
    "jurisdiction": "GDPR",
    "entityType": "business",
    "businessInfo": {
      "name": "European FinTech Ltd",
      "taxId": "EU123456789",
      "country": "Germany",
      "registrationNumber": "HRB 123456",
      "address": "Musterstraße 123, 80331 München, Germany"
    },
    "authorizedPersons": [
      {
        "name": "Hans Mueller",
        "role": "CEO",
        "nationality": "German",
        "idNumber": "DE123456789"
      }
    ]
  },
  "usKycRequest": {
    "entityId": "US456789123",
    "jurisdiction": "FinCEN",
    "entityType": "individual",
    "personalInfo": {
      "name": "John Smith",
      "ssn": "123-45-6789",
      "dob": "1980-03-20",
      "address": "123 Main Street, New York, NY 10001",
      "citizenship": "USA"
    },
    "documents": [
      {
        "type": "drivers_license",
        "number": "NY123456789",
        "state": "NY",
        "issuedDate": "2018-01-01",
        "expiryDate": "2025-01-01"
      }
    ]
  },
  "amlTransaction": {
    "transactionId": "TXN123456789",
    "amount": 50000,
    "currency": "USD",
    "sender": {
      "entityId": "US456789123",
      "account": "123456789012"
    },
    "receiver": {
      "entityId": "EU987654321",
      "account": "DE123456789012"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "description": "Wire transfer for investment"
  },
  "fraudTransaction": {
    "transactionId": "TXN987654321",
    "amount": 1000000,
    "currency": "EUR",
    "sender": {
      "entityId": "UNKNOWN",
      "account": "XX123456789"
    },
    "receiver": {
      "entityId": "IN123456789",
      "account": "IN987654321"
    },
    "timestamp": "2024-01-15T14:20:00Z",
    "description": "High value suspicious transfer",
    "flags": ["unusual_amount", "unknown_sender"]
  }
}
```

### 6. Initial API Test Suite
Create `cypress/e2e/api/kyc-check.cy.js`:

```javascript
describe('KYC Check API Tests', () => {
  before(() => {
    cy.login()
  })

  it('should successfully perform KYC check for Indian entity', () => {
    cy.fixture('test-data').then((data) => {
      cy.kycCheck(data.indianKycRequest).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('entityId', 'IN123456789')
        expect(response.body).to.have.property('status', 'approved')
        expect(response.body).to.have.property('jurisdiction', 'SEBI')
        expect(response.body).to.have.property('riskScore').and.be.a('number')
        expect(response.body).to.have.property('checks').and.be.an('array')
        expect(response.body.checks).to.include('pan_verification')
        expect(response.body.checks).to.include('aadhaar_verification')
      })
    })
  })

  it('should successfully perform KYC check for EU entity', () => {
    cy.fixture('test-data').then((data) => {
      cy.kycCheck(data.euKycRequest).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('entityId', 'EU987654321')
        expect(response.body).to.have.property('status', 'approved')
        expect(response.body).to.have.property('jurisdiction', 'GDPR')
        expect(response.body).to.have.property('riskScore').and.be.a('number')
        expect(response.body).to.have.property('checks').and.be.an('array')
        expect(response.body.checks).to.include('tax_id_verification')
        expect(response.body.checks).to.include('business_registration')
      })
    })
  })

  it('should successfully perform KYC check for US entity', () => {
    cy.fixture('test-data').then((data) => {
      cy.kycCheck(data.usKycRequest).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('entityId', 'US456789123')
        expect(response.body).to.have.property('status', 'approved')
        expect(response.body).to.have.property('jurisdiction', 'FinCEN')
        expect(response.body).to.have.property('riskScore').and.be.a('number')
        expect(response.body).to.have.property('checks').and.be.an('array')
        expect(response.body.checks).to.include('ssn_verification')
        expect(response.body.checks).to.include('drivers_license_verification')
      })
    })
  })

  it('should handle KYC check for high-risk entity', () => {
    const highRiskEntity = {
      entityId: 'HR123456789',
      jurisdiction: 'SEBI',
      entityType: 'individual',
      personalInfo: {
        name: 'High Risk Individual',
        pan: 'XXXXX0000X',
        aadhaar: '0000-0000-0000',
        dob: '1970-01-01',
        address: 'Unknown Address'
      }
    }

    cy.kycCheck(highRiskEntity).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'rejected')
      expect(response.body).to.have.property('riskScore').and.be.above(0.7)
      expect(response.body).to.have.property('reasons').and.be.an('array')
      expect(response.body.reasons).to.include('incomplete_documentation')
    })
  })

  it('should return 400 for invalid KYC request', () => {
    const invalidRequest = {
      entityId: '',
      jurisdiction: 'INVALID'
    }

    cy.apiRequest('POST', '/api/kyc-check', invalidRequest).then((response) => {
      expect(response.status).to.eq(400)
      expect(response.body).to.have.property('error', 'Invalid request parameters')
    })
  })

  it('should return 401 for unauthenticated request', () => {
    cy.fixture('test-data').then((data) => {
      cy.request({
        method: 'POST',
        url: '/api/kyc-check',
        body: data.indianKycRequest,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401)
        expect(response.body).to.have.property('error', 'Unauthorized')
      })
    })
  })
})
```

### 7. Package.json Test Scripts
Update `package.json` to include Cypress commands:

```json
{
  "scripts": {
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:e2e:api": "cypress run --spec 'cypress/e2e/api/**/*.cy.js'",
    "test:coverage": "nyc report --reporter=html"
  }
}
```

## Testing and Validation

### Running the Tests
```bash
# Open Cypress Test Runner
npm run test:e2e:open

# Run all API tests
npm run test:e2e:api

# Run all tests with coverage
npm run test:e2e && npm run test:coverage
```

### Test Results Validation
- All API endpoints should return proper HTTP status codes
- Response bodies should match expected schemas
- Authentication should work correctly
- Error handling should be consistent
- Jurisdiction-specific logic should be validated

### Integration with CI/CD
Add the following to your GitHub Actions workflow:

```yaml
- name: Run E2E Tests
  run: npm run test:e2e:api
  env:
    CYPRESS_BASE_URL: ${{ secrets.CYPRESS_BASE_URL }}
    CYPRESS_API_KEY: ${{ secrets.CYPRESS_API_KEY }}
```

## Next Steps
- Day 2 will focus on writing comprehensive E2E tests for the /kyc-check endpoint
- Subsequent days will cover UI testing, load testing, and security validation
- Integration with the full testing suite will be completed by Week 20

This Cypress setup provides a solid foundation for comprehensive API testing across all jurisdictions and compliance workflows in the Ableka Lumina platform.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 16\Day 1.md