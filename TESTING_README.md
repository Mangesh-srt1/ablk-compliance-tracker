# Testing Infrastructure Documentation

## Overview

This document describes the unit testing infrastructure for Ableka Lumina compliance system. The project uses **Jest** as the test runner with **TypeScript** support via **ts-jest**.

**Test Coverage Target: 75-80% across all services**

## Test Structure

```
src/
├── api/
│   ├── jest.config.js                 # Jest configuration
│   ├── jest.setup.js                  # Global setup, mocks, custom matchers
│   └── src/
│       └── __tests__/
│           ├── fixtures/
│           │   ├── mockData.ts        # Mock users, KYC, AML, transactions
│           │   └── database.ts        # Mock database client
│           └── unit/
│               └── services/
│                   ├── kycService.test.ts   # 15 test cases
│                   └── amlService.test.ts   # 15 test cases
│
└── agents/
    ├── jest.config.js                # Jest configuration
    ├── jest.setup.js                 # Global setup for LangChain agents
    └── src/
        └── __tests__/
            ├── fixtures/
            │   └── agentMocks.ts      # Agent mock implementations
            └── unit/
                └── supervisorAgent.test.ts  # 16 test cases
```

## Running Tests

### Run All Tests
```bash
# From compliance-system directory
npm test

# Run tests in specific service
cd src/api && npm test
cd src/agents && npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage Report
```bash
npm run test:coverage

# Open HTML coverage report
# Open coverage/lcov-report/index.html in browser
```

### Run Specific Test File
```bash
npm test -- kycService.test.ts
npm test -- amlService.test.ts
npm test -- supervisorAgent.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="KYC"
npm test -- --testNamePattern="AML"
npm test -- --testNamePattern="Agent"
```

## Test Files

### 1. KYC Service Tests (`src/api/src/__tests__/unit/services/kycService.test.ts`)

**File:** 15 test cases | **Target Coverage:** 85%

**Test Categories:**
- ✅ Happy Path (3 tests)
  - Valid entity passes India KYC
  - Valid entity passes EU KYC
  - Valid entity passes US KYC

- ✅ Edge Cases (4 tests)
  - Missing document triggers flag
  - Underage entity (<18) REJECTED
  - EU underage entity (<16) REJECTED
  - Missing email requires review

- ✅ Error Handling (1 test)
  - Invalid jurisdiction throws error

- ✅ Processing Time (1 test)
  - Measures and returns processing time

- ✅ Recommendations (1 test)
  - Includes recommendations in result

- ✅ Age Calculation (2 tests)
  - Correctly calculates adult age
  - Boundary case: exactly 18 years old

- ✅ Idempotency (1 test)
  - Same request produces same result

- ✅ Multi-Document Support (1 test)
  - Handles multiple documents

**Run:**
```bash
npm test -- kycService.test.ts
```

### 2. AML Service Tests (`src/api/src/__tests__/unit/services/amlService.test.ts`)

**File:** 15 test cases | **Target Coverage:** 85%

**Test Categories:**
- ✅ Risk Scoring (3 tests)
  - LOW-RISK entity with clean screening
  - MEDIUM-RISK entity with velocity anomaly
  - HIGH-RISK entity with multiple flags

- ✅ Screening & Detection (2 tests)
  - Sanctions list match detected
  - PEP (Politically Exposed Person) detection

- ✅ Error Handling (1 test)
  - Invalid jurisdiction throws error

- ✅ Processing Time (1 test)
  - Measures and returns processing time

- ✅ Recommendations (1 test)
  - Risk-appropriate recommendations

- ✅ Transaction Pattern Analysis (4 tests)
  - Single transaction (normal velocity)
  - Burst pattern (multiple TXs in short window)
  - Round-trip pattern (A→B→A suspicious)
  - Structuring detection (small amounts to avoid thresholds)

- ✅ Idempotency (1 test)
  - Consistent risk scoring

- ✅ Jurisdiction-Specific Scoring (1 test)
  - India stricter thresholds than US

**Run:**
```bash
npm test -- amlService.test.ts
```

### 3. Agent Orchestration Tests (`src/agents/src/__tests__/unit/supervisorAgent.test.ts`)

**File:** 16 test cases | **Target Coverage:** 80%

**Test Categories:**
- ✅ Workflow Orchestration (4 tests)
  - Full KYC check workflow
  - Full AML check workflow
  - Full compliance check (KYC + AML + SEBI)
  - Sequential agent processing

- ✅ Risk Score Aggregation (2 tests)
  - Multiple agent scores combined
  - Handling missing agent results

- ✅ State Transitions (3 tests)
  - State progresses through workflow (init → kyc → aml → decision)
  - Escalation when risk exceeds threshold
  - Rejection with critical flags

- ✅ Parallel vs Sequential (1 test)
  - Execution time comparison

- ✅ Error Handling & Resilience (3 tests)
  - Graceful degradation if KYC fails
  - All agents fail → escalate
  - Timeout handling

- ✅ Result Recommendations (2 tests)
  - Approval recommendations
  - Escalation recommendations

- ✅ Idempotency (1 test)
  - Deterministic results (same input → same output)

**Run:**
```bash
npm test -- supervisorAgent.test.ts
```

## Test Fixtures

### Mock Data (`src/api/src/__tests__/fixtures/mockData.ts`)

Provides realistic test data:
- **mockUsers** - Compliance officer, analyst accounts
- **mockKYCRecords** - Approved, pending, rejected KYC checks from AE/US/IN
- **mockAMLRecords** - Low-risk, high-risk AML assessments
- **mockComplianceChecks** - Approved, escalated, rejected compliance decisions
- **mockTransactions** - Valid and suspicious transaction examples
- **mockJurisdictionRules** - AE/US/IN jurisdiction configurations

### Database Fixtures (`src/api/src/__tests__/fixtures/database.ts`)

Mocks database client:
- `MockDatabaseClient` - Simulates PostgreSQL pool
- `MockTransaction` - Simulates database transactions
- `TestResultBuilder` - Helper to build query results

### Agent Fixtures (coming)
To mock LangChain agents with consistent state management

## Jest Configuration

### API Service Configuration (`src/api/jest.config.js`)

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: { lines: 75, functions: 75, branches: 70 }
  }
}
```

### Agents Configuration (`src/agents/jest.config.js`)

Similar to API, but with 15000ms timeout for LangChain operations.

## Jest Setup

### Global Mocks (`jest.setup.js`)

Both services include:
- Environment variables for testing
- Winston logger mocks
- LangChain module mocks
- Custom Jest matchers
- Global test utilities

### Custom Matchers

**API Service:**
```typescript
expect(riskScore).toBeValidRiskScore()  // 0-100
expect(status).toBeValidStatus()        // APPROVED/REJECTED/etc
expect(result).toHaveComplianceResult() // Has required fields
```

**Agents Service:**
```typescript
expect(result).toBeValidComplianceResult()
expect(state).toBeValidAgentState()
expect(score).toBeWithinRiskThreshold(70)
```

### Global Test Utilities

```typescript
// Create mocks
const mockKyc = createMockDatabasePool()
const mockRedis = createMockRedisClient()

// Create test data
const user = mockUsers.compliance_officer
const kycRecord = mockKYCRecords.approved_ae
```

## Coverage Reports

### Generate Coverage Report
```bash
npm run test:coverage
```

### Coverage Thresholds

**API Service:**
- Lines: 75%
- Functions: 75%
- Branches: 70%
- Services (KYC/AML): 80% minimum

**Agents Service:**
- Lines: 75%
- Functions: 75%
- Branches: 70%
- Agents: 80% minimum

### View Report

```bash
# Open HTML report
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html # Windows
xdg-open coverage/lcov-report/index.html # Linux
```

## Test-Driven Development (TDD) Workflow

### 1. Write Failing Test
```bash
npm run test:watch
# Edit kycService.test.ts to add new test
```

### 2. Implement Minimum Code to Pass
```typescript
// In kycService.ts
if (age < 18) {
  // Add validation logic
}
```

### 3. Refactor for Clarity
- Extract helper methods
- Remove duplication
- Improve variable names

### 4. Run Full Test Suite
```bash
npm test
```

### 5. Check Coverage
```bash
npm run test:coverage
```

## Mocking Strategies

### Database Mocking
```typescript
const mockDb = createMockDatabasePool()
mockDb.query.mockResolvedValue({ rows: [...], rowCount: 1 })
```

### Service Mocking
```typescript
jest.mock('../../services/kycService')
const mockKycService = KycService as jest.MockedClass<typeof KycService>
```

### External API Mocking
```typescript
jest.mock('../../services/providers/kycProviderManager')
mockKycProvider.verify.mockResolvedValue({ status: 'APPROVED' })
```

## Running Tests in CI/CD

### GitHub Actions
Tests run automatically on:
- Every push to main
- Every pull request
- Pre-commit via Husky

Configuration: `.github/workflows/ci.yml`

```bash
# CI runs
npm run lint
npm run typecheck  
npm run test:ci    # With coverage report
# Enforces 80% coverage minimum
```

## Troubleshooting

### Common Issues

**Test Timeout:**
```typescript
// Increase timeout for slow tests
it('test', async () => { ... }, 10000)

// Or in jest.config.js
testTimeout: 10000
```

**Mock Not Working:**
```typescript
// Ensure mock is hoisted (before jest.mock)
jest.mock('module')  // Must be at top

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})
```

**TypeScript Errors:**
```bash
# Ensure tsconfig.json has correct settings
npm run typecheck  # Verify TypeScript compilation
```

**Coverage Not Calculated:**
```bash
# Check jest.config.js has correct collectCoverageFrom
npm run test:coverage -- --detectOpenHandles
```

## Best Practices

### ✅ Do
- Write tests BEFORE implementing features (TDD)
- Test all code paths (happy, edge, error cases)
- Use meaningful test descriptions
- Mock external dependencies (APIs, databases)
- Keep tests independent (no test A depends on test B)
- Aim for 80%+ coverage on critical services

### ❌ Don't
- Test implementation details (private methods)
- Create interdependent tests
- Use real external APIs in tests
- Write tests after code (unless fixing bugs)
- Ignore failing tests
- Skip coverage targets

## Next Steps

- [ ] Add integration tests with real database (PostgreSQL test container)
- [ ] Add E2E tests with real external APIs (Ballerine, Marble)
- [ ] Set up GitHub Actions CI/CD pipeline
- [ ] Add performance benchmarks for compliance checks
- [ ] Add property-based testing with fast-check
- [ ] Create test metrics dashboard

## References

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Library](https://testing-library.com/)
- [Copilot Instructions - Testing](../../.github/copilot-instructions.md#-unit-testing-critical-priority)
