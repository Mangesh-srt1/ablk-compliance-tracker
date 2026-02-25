# Day 2: Write E2E Tests for /kyc-check Endpoint

## Objectives
- Create comprehensive end-to-end tests for the KYC check API endpoint
- Cover all jurisdiction-specific scenarios (SEBI, GDPR, FinCEN)
- Test various entity types (individual, business, high-risk)
- Validate response schemas and error handling
- Ensure compliance with global regulatory requirements
- Implement data-driven testing for scalability

## Implementation Details

### Test Coverage Strategy
The /kyc-check endpoint is critical for the Ableka Lumina platform as it handles Know Your Customer verification across multiple jurisdictions. Tests must cover:

- Successful KYC approvals for different entity types
- Rejection scenarios for high-risk entities
- Jurisdiction-specific validation rules
- Document verification workflows
- Error handling for invalid inputs
- Performance under various loads
- Integration with external KYC providers (Ballerine, Jumio)

### Test Data Management
- Use fixtures for consistent test data across jurisdictions
- Implement data factories for generating test variations
- Include edge cases and boundary conditions
- Maintain test data isolation between test runs

### Response Validation
- Validate JSON schema compliance
- Check business logic accuracy
- Verify jurisdiction-specific requirements
- Ensure proper error messaging

## Code Implementation

### 1. Enhanced Test Data Fixtures
Update `cypress/fixtures/kyc-test-data.json`:

```json
{
  "sebiIndividualApproved": {
    "entityId": "IN001234567",
    "jurisdiction": "SEBI",
    "entityType": "individual",
    "personalInfo": {
      "name": "Amit Sharma",
      "pan": "ABCDE1234F",
      "aadhaar": "1234-5678-9012",
      "dob": "1985-06-15",
      "gender": "Male",
      "address": "123 Rajaji Nagar, Bangalore, Karnataka 560010",
      "phone": "+91-9876543210",
      "email": "amit.sharma@example.com"
    },
    "documents": [
      {
        "type": "pan_card",
        "number": "ABCDE1234F",
        "issuedDate": "2020-03-15",
        "verified": true
      },
      {
        "type": "aadhaar_card",
        "number": "1234-5678-9012",
        "issuedDate": "2010-01-01",
        "verified": true
      }
    ],
    "expectedResponse": {
      "status": "approved",
      "riskScore": 0.1,
      "checks": ["pan_verification", "aadhaar_verification", "name_match", "address_verification"]
    }
  },
  "sebiBusinessApproved": {
    "entityId": "IN009876543",
    "jurisdiction": "SEBI",
    "entityType": "business",
    "businessInfo": {
      "name": "TechFin Solutions Pvt Ltd",
      "cin": "U72900KA2020PTC123456",
      "pan": "AAACT1234F",
      "gstin": "29AAACT1234F1Z5",
      "incorporationDate": "2020-01-15",
      "address": "456 MG Road, Bangalore, Karnataka 560001",
      "phone": "+91-9876543211",
      "email": "contact@techfin.com"
    },
    "authorizedPersons": [
      {
        "name": "Rajesh Kumar",
        "pan": "FGHIJ5678K",
        "designation": "Director",
        "verified": true
      }
    ],
    "expectedResponse": {
      "status": "approved",
      "riskScore": 0.15,
      "checks": ["cin_verification", "pan_verification", "gst_verification", "director_kyc"]
    }
  },
  "gdprIndividualApproved": {
    "entityId": "EU001234567",
    "jurisdiction": "GDPR",
    "entityType": "individual",
    "personalInfo": {
      "name": "Marie Dubois",
      "taxId": "FR12345678901",
      "dob": "1982-09-20",
      "nationality": "French",
      "address": "15 Rue de la Paix, Paris 75002, France",
      "phone": "+33-1-23-45-67-89",
      "email": "marie.dubois@example.fr"
    },
    "documents": [
      {
        "type": "national_id",
        "number": "123456789012",
        "issuedDate": "2015-05-10",
        "verified": true
      },
      {
        "type": "passport",
        "number": "FR123456789",
        "issuedDate": "2018-03-15",
        "expiryDate": "2028-03-15",
        "verified": true
      }
    ],
    "consent": {
      "dataProcessing": true,
      "marketing": false,
      "thirdPartySharing": true,
      "timestamp": "2024-01-15T10:00:00Z"
    },
    "expectedResponse": {
      "status": "approved",
      "riskScore": 0.05,
      "checks": ["id_verification", "address_verification", "consent_validation", "pep_check"]
    }
  },
  "fincenIndividualApproved": {
    "entityId": "US001234567",
    "jurisdiction": "FinCEN",
    "entityType": "individual",
    "personalInfo": {
      "name": "John Anderson",
      "ssn": "123-45-6789",
      "dob": "1975-11-30",
      "citizenship": "USA",
      "address": "789 Oak Street, Chicago, IL 60601",
      "phone": "+1-312-555-0123",
      "email": "john.anderson@example.com"
    },
    "documents": [
      {
        "type": "drivers_license",
        "number": "IL123456789",
        "state": "IL",
        "issuedDate": "2019-01-15",
        "expiryDate": "2025-01-15",
        "verified": true
      },
      {
        "type": "social_security_card",
        "number": "123-45-6789",
        "verified": true
      }
    ],
    "expectedResponse": {
      "status": "approved",
      "riskScore": 0.08,
      "checks": ["ssn_verification", "drivers_license_verification", "address_verification", "ofac_check"]
    }
  },
  "highRiskEntity": {
    "entityId": "HR001234567",
    "jurisdiction": "SEBI",
    "entityType": "individual",
    "personalInfo": {
      "name": "Unknown Person",
      "pan": "XXXXX0000X",
      "aadhaar": "0000-0000-0000",
      "dob": "1900-01-01",
      "address": "Unknown"
    },
    "expectedResponse": {
      "status": "rejected",
      "riskScore": 0.95,
      "reasons": ["incomplete_documentation", "invalid_identifiers", "high_risk_indicators"]
    }
  },
  "invalidRequest": {
    "entityId": "",
    "jurisdiction": "INVALID",
    "expectedError": "Invalid jurisdiction or missing required fields"
  }
}
```

### 2. Comprehensive KYC Test Suite
Create `cypress/e2e/api/kyc-check-comprehensive.cy.js`:

```javascript
describe('KYC Check API - Comprehensive Tests', () => {
  beforeEach(() => {
    cy.login()
  })

  context('SEBI Jurisdiction - Individual Entities', () => {
    it('should approve valid Indian individual KYC', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.sebiIndividualApproved
        const expected = request.expectedResponse

        cy.kycCheck(request).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.entityId).to.eq(request.entityId)
          expect(response.body.jurisdiction).to.eq('SEBI')
          expect(response.body.entityType).to.eq('individual')
          expect(response.body.status).to.eq(expected.status)
          expect(response.body.riskScore).to.be.closeTo(expected.riskScore, 0.1)
          expect(response.body.checks).to.include.members(expected.checks)
          expect(response.body).to.have.property('timestamp')
          expect(response.body).to.have.property('processingTime').and.be.a('number')
        })
      })
    })

    it('should validate PAN card verification', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.sebiIndividualApproved

        cy.kycCheck(request).then((response) => {
          expect(response.body.checks).to.include('pan_verification')
          expect(response.body.verificationDetails).to.have.property('pan')
          expect(response.body.verificationDetails.pan).to.have.property('verified', true)
          expect(response.body.verificationDetails.pan).to.have.property('nameMatch', true)
        })
      })
    })

    it('should validate Aadhaar card verification', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.sebiIndividualApproved

        cy.kycCheck(request).then((response) => {
          expect(response.body.checks).to.include('aadhaar_verification')
          expect(response.body.verificationDetails).to.have.property('aadhaar')
          expect(response.body.verificationDetails.aadhaar).to.have.property('verified', true)
          expect(response.body.verificationDetails.aadhaar).to.have.property('biometricMatch', true)
        })
      })
    })
  })

  context('SEBI Jurisdiction - Business Entities', () => {
    it('should approve valid Indian business KYC', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.sebiBusinessApproved
        const expected = request.expectedResponse

        cy.kycCheck(request).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.entityId).to.eq(request.entityId)
          expect(response.body.jurisdiction).to.eq('SEBI')
          expect(response.body.entityType).to.eq('business')
          expect(response.body.status).to.eq(expected.status)
          expect(response.body.riskScore).to.be.closeTo(expected.riskScore, 0.1)
          expect(response.body.checks).to.include.members(expected.checks)
        })
      })
    })

    it('should validate CIN and GST verification', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.sebiBusinessApproved

        cy.kycCheck(request).then((response) => {
          expect(response.body.checks).to.include('cin_verification')
          expect(response.body.checks).to.include('gst_verification')
          expect(response.body.verificationDetails).to.have.property('business')
          expect(response.body.verificationDetails.business).to.have.property('cinVerified', true)
          expect(response.body.verificationDetails.business).to.have.property('gstVerified', true)
        })
      })
    })
  })

  context('GDPR Jurisdiction - Individual Entities', () => {
    it('should approve valid EU individual KYC with consent', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.gdprIndividualApproved
        const expected = request.expectedResponse

        cy.kycCheck(request).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.entityId).to.eq(request.entityId)
          expect(response.body.jurisdiction).to.eq('GDPR')
          expect(response.body.entityType).to.eq('individual')
          expect(response.body.status).to.eq(expected.status)
          expect(response.body.riskScore).to.be.closeTo(expected.riskScore, 0.1)
          expect(response.body.checks).to.include.members(expected.checks)
        })
      })
    })

    it('should validate GDPR consent requirements', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.gdprIndividualApproved

        cy.kycCheck(request).then((response) => {
          expect(response.body).to.have.property('gdprCompliance')
          expect(response.body.gdprCompliance).to.have.property('consentValidated', true)
          expect(response.body.gdprCompliance).to.have.property('dataProcessingConsent', true)
          expect(response.body.gdprCompliance).to.have.property('retentionPolicy', '7_years')
        })
      })
    })

    it('should reject KYC without proper consent', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = { ...data.gdprIndividualApproved }
        delete request.consent

        cy.kycCheck(request).then((response) => {
          expect(response.status).to.eq(400)
          expect(response.body.error).to.include('GDPR consent required')
        })
      })
    })
  })

  context('FinCEN Jurisdiction - Individual Entities', () => {
    it('should approve valid US individual KYC', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.fincenIndividualApproved
        const expected = request.expectedResponse

        cy.kycCheck(request).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.entityId).to.eq(request.entityId)
          expect(response.body.jurisdiction).to.eq('FinCEN')
          expect(response.body.entityType).to.eq('individual')
          expect(response.body.status).to.eq(expected.status)
          expect(response.body.riskScore).to.be.closeTo(expected.riskScore, 0.1)
          expect(response.body.checks).to.include.members(expected.checks)
        })
      })
    })

    it('should perform OFAC sanctions screening', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.fincenIndividualApproved

        cy.kycCheck(request).then((response) => {
          expect(response.body.checks).to.include('ofac_check')
          expect(response.body.verificationDetails).to.have.property('sanctions')
          expect(response.body.verificationDetails.sanctions).to.have.property('ofacClear', true)
          expect(response.body.verificationDetails.sanctions).to.have.property('lastChecked')
        })
      })
    })
  })

  context('High-Risk and Rejection Scenarios', () => {
    it('should reject high-risk entities', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.highRiskEntity
        const expected = request.expectedResponse

        cy.kycCheck(request).then((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.status).to.eq(expected.status)
          expect(response.body.riskScore).to.be.closeTo(expected.riskScore, 0.1)
          expect(response.body.reasons).to.include.members(expected.reasons)
          expect(response.body).to.have.property('recommendedActions').and.be.an('array')
        })
      })
    })

    it('should handle entities with incomplete documentation', () => {
      const incompleteEntity = {
        entityId: 'INC001234567',
        jurisdiction: 'SEBI',
        entityType: 'individual',
        personalInfo: {
          name: 'Incomplete Person'
        }
      }

      cy.kycCheck(incompleteEntity).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.status).to.eq('pending')
        expect(response.body.reasons).to.include('incomplete_documentation')
        expect(response.body.requiredDocuments).to.be.an('array')
        expect(response.body.requiredDocuments).to.include('pan_card')
        expect(response.body.requiredDocuments).to.include('aadhaar_card')
      })
    })
  })

  context('Error Handling and Edge Cases', () => {
    it('should return 400 for invalid jurisdiction', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request = data.invalidRequest

        cy.apiRequest('POST', '/api/kyc-check', request).then((response) => {
          expect(response.status).to.eq(400)
          expect(response.body.error).to.eq(request.expectedError)
        })
      })
    })

    it('should handle malformed JSON requests', () => {
      cy.request({
        method: 'POST',
        url: '/api/kyc-check',
        headers: {
          Authorization: `Bearer ${Cypress.env('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: '{invalid json',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.error).to.include('Invalid JSON')
      })
    })

    it('should enforce rate limiting', () => {
      cy.fixture('kyc-test-data').then((data) => {
        // Make multiple rapid requests
        const requests = []
        for (let i = 0; i < 15; i++) {
          requests.push(cy.kycCheck(data.sebiIndividualApproved))
        }

        cy.wrap(Promise.all(requests)).then((responses) => {
          const rateLimited = responses.filter(r => r.status === 429)
          expect(rateLimited.length).to.be.greaterThan(0)
        })
      })
    })

    it('should handle concurrent requests properly', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const request1 = cy.kycCheck(data.sebiIndividualApproved)
        const request2 = cy.kycCheck(data.gdprIndividualApproved)
        const request3 = cy.kycCheck(data.fincenIndividualApproved)

        cy.wrap(Promise.all([request1, request2, request3])).then((responses) => {
          responses.forEach((response) => {
            expect(response.status).to.eq(200)
            expect(response.body).to.have.property('entityId')
            expect(response.body).to.have.property('status')
          })
        })
      })
    })
  })

  context('Performance and Timing', () => {
    it('should complete KYC checks within acceptable time limits', () => {
      cy.fixture('kyc-test-data').then((data) => {
        const startTime = Date.now()

        cy.kycCheck(data.sebiIndividualApproved).then((response) => {
          const endTime = Date.now()
          const processingTime = endTime - startTime

          expect(processingTime).to.be.lessThan(5000) // 5 seconds max
          expect(response.body.processingTime).to.be.lessThan(3000) // 3 seconds server-side
        })
      })
    })

    it('should handle large document payloads', () => {
      const largeEntity = {
        entityId: 'LARGE001234567',
        jurisdiction: 'SEBI',
        entityType: 'business',
        businessInfo: {
          name: 'Large Corporation Ltd',
          cin: 'U72900KA2020PTC123456',
          pan: 'AAACT1234F'
        },
        documents: Array(50).fill().map((_, i) => ({
          type: `document_${i}`,
          number: `DOC${i.toString().padStart(3, '0')}`,
          content: 'Large base64 encoded content would go here...'.repeat(100),
          verified: true
        }))
      }

      cy.kycCheck(largeEntity).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.status).to.eq('approved')
        expect(response.body.processingTime).to.be.lessThan(10000) // 10 seconds for large payload
      })
    })
  })
})
```

### 3. Test Utilities and Helpers
Create `cypress/support/kyc-helpers.js`:

```javascript
// KYC-specific test utilities

Cypress.Commands.add('validateKycResponse', (response, expectedStatus = 'approved') => {
  expect(response.status).to.eq(200)
  expect(response.body).to.have.property('entityId')
  expect(response.body).to.have.property('jurisdiction')
  expect(response.body).to.have.property('status', expectedStatus)
  expect(response.body).to.have.property('riskScore').and.be.a('number')
  expect(response.body).to.have.property('checks').and.be.an('array')
  expect(response.body).to.have.property('timestamp')
  expect(response.body).to.have.property('processingTime').and.be.a('number')

  if (expectedStatus === 'approved') {
    expect(response.body.riskScore).to.be.below(0.5)
  } else if (expectedStatus === 'rejected') {
    expect(response.body.riskScore).to.be.above(0.7)
    expect(response.body).to.have.property('reasons').and.be.an('array')
  }
})

Cypress.Commands.add('generateTestEntity', (jurisdiction, entityType = 'individual') => {
  const baseEntity = {
    entityId: `${jurisdiction.substring(0, 2).toUpperCase()}${Date.now()}`,
    jurisdiction,
    entityType
  }

  if (jurisdiction === 'SEBI') {
    if (entityType === 'individual') {
      return {
        ...baseEntity,
        personalInfo: {
          name: 'Test Indian User',
          pan: 'TESTP1234A',
          aadhaar: '1234-5678-9999',
          dob: '1990-01-01',
          address: 'Test Address, Mumbai'
        }
      }
    }
  } else if (jurisdiction === 'GDPR') {
    return {
      ...baseEntity,
      personalInfo: {
        name: 'Test EU User',
        taxId: 'TEST123456789',
        dob: '1990-01-01',
        address: 'Test Address, Berlin'
      },
      consent: {
        dataProcessing: true,
        timestamp: new Date().toISOString()
      }
    }
  } else if (jurisdiction === 'FinCEN') {
    return {
      ...baseEntity,
      personalInfo: {
        name: 'Test US User',
        ssn: '123-45-9999',
        dob: '1990-01-01',
        address: 'Test Address, New York'
      }
    }
  }

  return baseEntity
})

Cypress.Commands.add('bulkKycCheck', (entities) => {
  const requests = entities.map(entity => cy.kycCheck(entity))
  return cy.wrap(Promise.all(requests))
})
```

### 4. Performance Test Suite
Create `cypress/e2e/api/kyc-performance.cy.js`:

```javascript
describe('KYC Check API - Performance Tests', () => {
  beforeEach(() => {
    cy.login()
  })

  it('should handle 100 concurrent KYC requests', () => {
    const entities = []
    for (let i = 0; i < 100; i++) {
      entities.push(cy.generateTestEntity('SEBI'))
    }

    const startTime = Date.now()

    cy.bulkKycCheck(entities).then((responses) => {
      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Validate all responses
      responses.forEach((response) => {
        cy.validateKycResponse(response)
      })

      // Performance assertions
      expect(totalTime).to.be.lessThan(60000) // 60 seconds max for 100 requests
      const avgTime = totalTime / responses.length
      expect(avgTime).to.be.lessThan(2000) // 2 seconds average per request

      // Log performance metrics
      cy.log(`Total time: ${totalTime}ms`)
      cy.log(`Average time: ${avgTime}ms`)
      cy.log(`Requests per second: ${1000 / avgTime}`)
    })
  })

  it('should maintain performance under sustained load', () => {
    const testDuration = 30000 // 30 seconds
    const startTime = Date.now()
    let requestCount = 0

    const makeRequest = () => {
      if (Date.now() - startTime < testDuration) {
        cy.generateTestEntity('SEBI').then((entity) => {
          cy.kycCheck(entity).then((response) => {
            expect(response.status).to.eq(200)
            requestCount++
            makeRequest() // Continue the load
          })
        })
      } else {
        cy.log(`Completed ${requestCount} requests in ${testDuration}ms`)
        cy.log(`Average RPS: ${requestCount / (testDuration / 1000)}`)
      }
    }

    makeRequest()
  })

  it('should handle mixed jurisdiction load', () => {
    const jurisdictions = ['SEBI', 'GDPR', 'FinCEN']
    const entities = []

    for (let i = 0; i < 30; i++) {
      const jurisdiction = jurisdictions[i % jurisdictions.length]
      entities.push(cy.generateTestEntity(jurisdiction))
    }

    const startTime = Date.now()

    cy.bulkKycCheck(entities).then((responses) => {
      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Group by jurisdiction for analysis
      const byJurisdiction = responses.reduce((acc, response) => {
        const jur = response.body.jurisdiction
        if (!acc[jur]) acc[jur] = []
        acc[jur].push(response)
        return acc
      }, {})

      // Validate performance per jurisdiction
      Object.entries(byJurisdiction).forEach(([jurisdiction, responses]) => {
        const avgTime = responses.reduce((sum, r) => sum + r.body.processingTime, 0) / responses.length
        cy.log(`${jurisdiction}: ${responses.length} requests, avg ${avgTime}ms`)
        expect(avgTime).to.be.lessThan(3000)
      })

      expect(totalTime).to.be.lessThan(45000) // 45 seconds for mixed load
    })
  })
})
```

## Testing and Validation

### Running the Comprehensive Tests
```bash
# Run all KYC tests
npm run test:e2e:api -- --spec "cypress/e2e/api/kyc-check*.cy.js"

# Run with video recording for debugging
npm run test:e2e:api -- --spec "cypress/e2e/api/kyc-check*.cy.js" --record

# Run performance tests separately
npm run test:e2e:api -- --spec "cypress/e2e/api/kyc-performance.cy.js"
```

### Test Coverage Metrics
- Jurisdiction coverage: SEBI, GDPR, FinCEN (100%)
- Entity type coverage: Individual, Business (100%)
- Response scenarios: Approved, Rejected, Pending (100%)
- Error conditions: Invalid input, rate limiting, malformed requests (100%)
- Performance scenarios: Concurrent requests, sustained load, mixed jurisdictions (100%)

### Integration with Test Reporting
Add test results reporting to your CI/CD pipeline:

```yaml
- name: Run KYC API Tests
  run: |
    npm run test:e2e:api -- --spec "cypress/e2e/api/kyc-check*.cy.js" --reporter junit --reporter-options "mochaFile=test-results/kyc-tests.xml"
    npm run test:e2e:api -- --spec "cypress/e2e/api/kyc-performance.cy.js" --reporter json --reporter-options "outputFile=test-results/kyc-performance.json"
  env:
    CYPRESS_BASE_URL: ${{ secrets.CYPRESS_BASE_URL }}
    CYPRESS_API_KEY: ${{ secrets.CYPRESS_API_KEY }}
```

## Next Steps
- Day 3 will focus on testing UI onboarding flows
- Day 4 will cover scan initiation and results testing
- Day 5 will implement comprehensive load testing (1k scans)
- Integration with the full E2E testing suite will continue through Week 17

This comprehensive test suite ensures the /kyc-check endpoint meets all global compliance requirements and performs reliably under various conditions.</content>
<parameter name="filePath">c:\Users\Mange\work\ablk-compliance-tracker\docs\Phase 4 Testing & Compliance\Week 16\Day 2.md