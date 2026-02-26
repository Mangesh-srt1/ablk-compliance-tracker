# Testing Quick Start Guide

This guide helps developers run, debug, and maintain unit tests for the Ableka Lumina compliance system.

## Quick Start (3 commands)

```bash
# 1. Navigate to service
cd src/api  # or src/agents

# 2. Run all tests
npm test

# 3. Run with coverage report
npm run test:coverage
```

## Test Structure

**Test files are located in:**

```
src/api/src/__tests__/unit/services/
├── setupVerification.test.ts    ✅ Infrastructure tests (22 tests - PASSING)
├── kycService.test.ts           🔧 KYC validation tests (15 tests - IN PROGRESS)
├── amlService.test.ts           🔧 AML risk tests (15 tests - IN PROGRESS)
└── fixtures/
    ├── mockData.ts              📦 Test data factories
    └── database.ts              📦 Database mock

src/agents/src/__tests__/unit/
└── supervisorAgent.test.ts      🔧 Agent orchestration (16 tests - IN PROGRESS)
```

## Running Tests

### Run All Tests

```bash
cd src/api
npm test
```

### Run Single Test File

```bash
npm test -- kycService.test.ts
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should approve"
```

### Run with Coverage Report

```bash
npm run test:coverage
```

Output: `coverage/lcov-report/index.html` (open in browser)

### Watch Mode (re-run on file changes)

```bash
npm test -- --watch
```

### Debug Tests

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
# Then open: chrome://inspect in Chrome DevTools
```

## Test Infrastructure Status

### ✅ Infrastructure Tests (22/22 Passing)

File: `setupVerification.test.ts`

Validates:

- Mock data available and correct
- Jest custom matchers working
- Global test utilities initialized
- Test database and Redis mocks functional
- Environment variables configured

**Run:** `npm test -- setupVerification.test.ts`

### 🔧 KYC Service Tests (Currently Failing - Needs Mocking)

File: `kycService.test.ts` (432 lines, 15 test cases)

Test Coverage:

- **Happy Paths** (3 tests): India, EU, US KYC validation
- **Edge Cases** (4 tests): Missing docs, underage, GDPR issues
- **Error Handling** (1 test): Invalid jurisdiction
- **Processing** (1 test): Timing measurement
- **Other** (6 tests): Recommendations, age validation, idempotency

**Why Failing:** Service implementation needs to be properly mocked.
See section "Fixing Failing Tests" below.

### 🔧 AML Service Tests (Currently Failing - Needs Mocking)

File: `amlService.test.ts` (478 lines, 15 test cases)

Test Coverage:

- **Risk Scoring** (3 tests): LOW, MEDIUM, HIGH risk
- **Screening** (2 tests): Sanctions, PEP detection
- **Pattern Analysis** (4 tests): Velocity, burst, round-trip, structuring
- **Other** (6 tests): Error handling, recommendations, jurisdiction thresholds

**Why Failing:** Service implementation needs to be properly mocked.

### 🔧 Supervisor Agent Tests (Currently Failing - Needs Mocking)

File: `supervisorAgent.test.ts` (503 lines, 16 test cases)

Test Coverage:

- **Workflow Orchestration** (4 tests): KYC, AML, full, sequential
- **Risk Aggregation** (2 tests): Combined scores, missing agents
- **State Transitions** (3 tests): Workflow states, escalation, rejection
- **Error Handling** (3 tests): Tool failures, timeouts, all-fail scenarios
- **Other** (4 tests): Performance, recommendations, idempotency

**Why Failing:** Agent implementation needs to be properly mocked.

## Fixing Failing Tests

### Option 1: Create Proper Mocks (Recommended)

For unit tests, mock the service at module level:

```typescript
// In test file
jest.mock('../../../services/kycService');
const mockKycService = jest.mocked(KycService);

beforeEach(() => {
  mockKycService.verify.mockResolvedValue({
    status: 'VERIFIED',
    confidence: 0.98,
  });
});
```

### Option 2: Mock Implementation with jest.mock()

```typescript
jest.mock('../../../services/kycService', () => ({
  KycService: jest.fn().mockImplementation(() => ({
    verify: jest.fn().mockResolvedValue({
      status: 'VERIFIED',
      confidence: 0.98,
    }),
  })),
}));
```

### Option 3: Use Test Doubles from Fixtures

```typescript
import * as mockData from '../../fixtures/mockData';

beforeEach(() => {
  const mockKyc = mockData.mockKYCRecords.approved_ae;
  // Use mockKyc in tests
});
```

## Common Jest Patterns

### Mock a Service

```typescript
jest.mock('../../../services/myService');
const MockedService = require('../../../services/myService');

beforeEach(() => {
  MockedService.someMethod.mockResolvedValue({ result: 'test' });
});
```

### Mock a Database Query

```typescript
jest.mock('../../../config/database');
const db = require('../../../config/database');

beforeEach(() => {
  db.query.mockResolvedValue({
    rows: [{ id: 1, name: 'Test' }],
    rowCount: 1,
  });
});
```

### Mock Redis

```typescript
jest.mock('../../../config/redis');
const redis = require('../../../config/redis');

beforeEach(() => {
  redis.get.mockResolvedValue('cached-value');
  redis.set.mockResolvedValue('OK');
});
```

### Test Error Handling

```typescript
it('should handle errors gracefully', async () => {
  MockedService.verify.mockRejectedValue(new Error('Service timeout'));

  expect(() => service.process()).rejects.toThrow('Service timeout');
});
```

### Use Test Data

```typescript
import * as mockData from '../../fixtures/mockData';

it('should process approved user', () => {
  const user = mockData.mockUsers.compliance_officer;
  expect(user.role).toBe('compliance_officer');
});
```

## Jest Configuration

### API Service Config

File: `src/api/jest.config.js`

```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      lines: 75,       // Minimum 75% coverage
      functions: 75,
      branches: 75,
      statements: 75,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'js', 'json'],
}
```

### Agents Service Config

File: `src/agents/jest.config.js`

Same as API but with `testTimeout: 15000` (for LangChain operations)

### Setup File

File: `src/api/jest.setup.js`

Includes:

- **Global Test Utilities:** `global.testUtils` with helper functions
- **Default Mocks:** Database, Redis, SqlLoader
- **Custom Matchers:** `toBeValidRiskScore()`, `toBeValidStatus()`, etc.
- **Environment Setup:** Sets NODE_ENV=test, LOG_LEVEL=error

## Debugging Tests

### Add console.log

```typescript
it('should work', () => {
  console.log('Debug value:', myVar);
  expect(myVar).toBe(expected);
});
```

**Run:** `npm test -- --verbose`

### Use debugger

```typescript
it('should work', () => {
  debugger; // Pauses execution
  expect(myVar).toBe(expected);
});
```

**Run:** `node --inspect-brk node_modules/.bin/jest --runInBand`

### Check Mock Calls

```typescript
it('should call database', async () => {
  await service.getData();

  // Verify called
  expect(db.query).toHaveBeenCalled();
  expect(db.query).toHaveBeenCalledWith('SELECT ...', []);

  // Check call count
  expect(db.query).toHaveBeenCalledTimes(1);
});
```

## Coverage Reports

### Generate Report

```bash
npm run test:coverage
```

**Output:** `coverage/lcov-report/index.html`

### View in Terminal

```bash
npm run test:coverage -- --verbose
# Shows line-by-line coverage
```

### Check Coverage Threshold

Coverage must be ≥75% to pass CI/CD:

- Lines: 75%
- Functions: 75%
- Branches: 75%
- Statements: 75%

If below threshold, tests fail with:

```
FAIL Test suites: X failed
ERROR: Coverage thresholds not met
```

## GitHub Actions CI/CD

### Automatic on Every Push

File: `.github/workflows/ci.yml`

Runs:

1. `npm run lint` - ESLint
2. `npm run typecheck` - TypeScript
3. `npm test:ci` - Jest with coverage
4. Uploads to Codecov

### Local CI Simulation

```bash
npm run lint
npm run typecheck
npm run test:ci
```

### View Results

- GitHub: Actions tab → Latest workflow run
- Codecov: https://codecov.io/ (after setup)

## Test Data (Fixtures)

### Using Mock Data

File: `src/__tests__/fixtures/mockData.ts`

```typescript
import * as mockData from '../../fixtures/mockData';

// Users
const admin = mockData.mockUsers.admin;
const officer = mockData.mockUsers.compliance_officer;

// KYC Records
const approvedAE = mockData.mockKYCRecords.approved_ae;
const rejectedUS = mockData.mockKYCRecords.rejected_us;

// AML Records
const lowRisk = mockData.mockAMLRecords.low_risk;
const highRisk = mockData.mockAMLRecords.high_risk;

// Transactions
const validTx = mockData.mockTransactions.valid_transfer;

// Jurisdiction Rules
const aeRules = mockData.mockJurisdictionRules.AE;
const usRules = mockData.mockJurisdictionRules.US;
```

### Creating Custom Test Data

```typescript
const customUser = mockData.createMockDatabasePool();
const customDb = mockData.createMockRedisClient();
const customBallerine = customData.createMockBallerineClient();
```

## Troubleshooting

### Error: "Cannot find module"

**Cause:** Incorrect relative path

**Fix:** Check directory structure:

```
From: src/__tests__/unit/services/kycService.test.ts
To:   src/services/kycService.ts
Path: ../../../services/kycService  ✅ (3 levels up)
```

### Error: "Mock is not a constructor"

**Cause:** Service class not properly mocked

**Fix:** Use `jest.mocked()` for proper types:

```typescript
jest.mock('../../../services/kycService');
const MockKycService = jest.mocked(KycService);
```

### Error: "Test timeout"

**Cause:** Async operation slow or mocked incorrectly

**Fix:** Increase timeout:

```typescript
it('should work', async () => {
  // test code
}, 10000); // 10 second timeout
```

Or mock faster:

```typescript
mockService.method.mockResolvedValue(result);
```

### Tests Pass Locally but Fail in CI

**Cause:** Environment differences

**Check:**

- All mocks are in jest.setup.js
- No hardcoded paths (use relative)
- All dependencies in package.json
- Test doesn't rely on Docker services

### Coverage Below Threshold

**Cause:** Not enough test cases

**Check:**

- Happy path tests
- Error cases
- Edge cases
- All branches (if/else, switch)

**Fix:**

```bash
npm run test:coverage -- --verbose
# Shows which lines aren't covered
```

## Best Practices

### ✅ Do's

- Write tests BEFORE code (TDD)
- Mock external APIs and databases
- Use consistent naming: `should...` for test names
- Test one thing per test case
- Use fixtures for repeated test data
- Check error cases and edge cases
- Keep tests under 100ms (unless integration test)
- Use descriptive assertion messages

### ❌ Don'ts

- Don't test implementation details
- Don't have side effects between tests
- Don't hardcode paths or credentials
- Don't skip tests (use `.skip` deliberately)
- Don't test multiple things in one test
- Don't use `setTimeout` for timing (use Jest mock timers)
- Don't make external API calls in unit tests
- Don't log sensitive data (use redaction)

## Next Steps

1. **Fix KYC Service Tests**
   - Create proper service mocks
   - Verify all 15 test cases pass
   - Achieve 80%+ coverage

2. **Fix AML Service Tests**
   - Create proper service mocks
   - Verify all 15 test cases pass
   - Achieve 80%+ coverage

3. **Fix Supervisor Agent Tests**
   - Create proper agent mocks
   - Verify all 16 test cases pass
   - Achieve 80%+ coverage

4. **Create Integration Tests** (Week 2)
   - Real database connections
   - Real service interactions
   - Full workflow testing

5. **Setup Codecov** (Week 2)
   - `npm install --save-dev codecov`
   - Add to GitHub Actions
   - Set PR checks for coverage

## Resources

- **Jest Docs:** https://jestjs.io/docs/getting-started
- **TypeScript + Jest:** https://jestjs.io/docs/getting-started#using-typescript
- **Mocking in Jest:** https://jestjs.io/docs/mock-functions
- **Testing Best Practices:** https://jestjs.io/docs/tutorial-react

## Questions?

For testing questions or issues:

1. Check this guide's troubleshooting section
2. Review existing test examples
3. Check Jest documentation
4. Ask the team in code review
