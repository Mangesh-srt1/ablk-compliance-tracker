# Testing Quick Reference for Ableka Lumina

**For the comprehensive testing guide, see:** [TESTING_QUICKSTART.md](../../TESTING_QUICKSTART.md)

## TL;DR - Run Tests Right Now

```bash
cd compliance-system/src/api
npm test
```

That's it! Tests will run and show you what passes/fails.

## What Tests Exist?

| Test File | Status | Count | Purpose |
|-----------|--------|-------|---------|
| `setupVerification.test.ts` | ✅ PASSING | 22 | Test infrastructure (mocks, fixtures, utils) |
| `kycService.test.ts` | 🔧 In Progress | 15 | KYC validation logic |
| `amlService.test.ts` | 🔧 In Progress | 15 | AML risk scoring |
| `supervisorAgent.test.ts` | 🔧 In Progress | 16 | Agent orchestration |
| **Total** | **1 passing / 3 in progress** | **68 test cases** | Compliance validation |

## Common Commands

```bash
# Inside compliance-system/src/api or src/agents:

npm test                              # Run all tests
npm test -- kycService.test.ts        # Run one file
npm test -- --watch                   # Auto-rerun on changes
npm run test:coverage                 # Generate coverage report
npm test -- --verbose                 # Detailed output
npm test -- --testNamePattern="kyc"   # Run matching test names
```

## Test Paths (Module Resolution)

The tricky part: relative paths for imports.

**Rule:** Count directory levels from test file to target:

```
Test file:     src/__tests__/unit/services/kycService.test.ts
Target file:   src/services/kycService.ts

From test, to reach src/services/: go UP 3 levels
✅ Correct:    import { ... } from '../../../services/kycService'
❌ Wrong:      import { ... } from '../../services/kycService'
```

**Quick check:**
- From `unit/services/test.ts` to `services/file.ts` → `../../../` (3 levels)
- From `unit/test.ts` to `services/file.ts` → `../../` (2 levels)
- From `unit/test.ts` to `__tests__/fixtures/data.ts` → `../../` (2 levels)

## Fixing Test Failures

### Error: "Cannot find module"
```
✅ Fix: Check relative paths with proper directory counting
```

### Error: "Mock is not a constructor"
```typescript
// Wrong:
import { KycService } from '../../../services/kycService';

// Correct:
jest.mock('../../../services/kycService');
const MockKycService = jest.mocked(KycService);
```

### Error: "Timeout"
```typescript
// Wrong - mock doesn't return promise:
mockDb.query.mockReturnValue({ rows: [] });

// Correct - mock returns promise:
mockDb.query.mockResolvedValue({ rows: [] });
```

### Coverage Below 75%
```
✅ Fix: Add tests for error cases, edge cases, and all code branches
```

## Mock Factories Available

```typescript
import * as mockData from '../../fixtures/mockData';

// Create mocks
mockData.createMockDatabasePool()    // Mock PostgreSQL
mockData.createMockRedisClient()     // Mock Redis
mockData.createMockBallerineClient() // Mock KYC provider

// Use test data
mockData.mockUsers.compliance_officer
mockData.mockKYCRecords.approved_ae
mockData.mockAMLRecords.low_risk
mockData.mockTransactions.valid_transfer
mockData.mockJurisdictionRules.AE
```

## Custom Matchers

```typescript
expect(riskScore).toBeValidRiskScore();      // 0-100
expect(status).toBeValidStatus();            // PASS/FAIL/ESCALATE
expect(result).toHaveComplianceResult();     // Has required fields
```

## File Locations

```
📁 compliance-system/
├── 📁 src/api/
│   ├── 📁 src/__tests__/
│   │   ├── 📁 unit/services/
│   │   │   ├── setupVerification.test.ts     ✅ Infrastructure
│   │   │   ├── kycService.test.ts            🔧 KYC logic
│   │   │   ├── amlService.test.ts            🔧 AML logic
│   │   │   └── 📁 fixtures/
│   │   │       ├── mockData.ts
│   │   │       └── database.ts
│   ├── jest.config.js                       ⚙️ Config
│   └── jest.setup.js                        ⚙️ Global setup
│
├── 📁 src/agents/
│   ├── 📁 src/__tests__/
│   │   ├── 📁 unit/
│   │   │   └── supervisorAgent.test.ts      🔧 Agent orchestration
│   ├── jest.config.js
│   └── jest.setup.js
│
└── TESTING_QUICKSTART.md                    📖 Full guide (400 lines)
```

## Coverage Report

```bash
npm run test:coverage
# Output: coverage/lcov-report/index.html
# Open in browser to see which lines aren't tested
```

**Minimum coverage: 75%** (Lines, Functions, Branches, Statements)

##  Debug a Test

**Option 1: Add logging**
```typescript
it('should work', () => {
  console.log('Debug value:', myValue);
  expect(myValue).toBe(expected);
});
// Run: npm test -- --verbose
```

**Option 2: Use debugger**
```typescript
it('should work', () => {
  debugger;  // Pauses execution
  expect(myValue).toBe(expected);
});
// Run: node --inspect-brk node_modules/.bin/jest --runInBand
// Then open: chrome://inspect
```

**Option 3: Check mock calls**
```typescript
it('should call database', async () => {
  await service.getData();
  expect(db.query).toHaveBeenCalled();       // Was it called?
  expect(db.query).toHaveBeenCalledWith(...); // With these args?
  expect(db.query).toHaveBeenCalledTimes(1); // How many times?
});
```

## Git Workflow with Tests

```bash
# Before commit:
npm test                    # All tests pass?
npm run test:coverage       # Coverage ≥75%?
npm run lint                # No lint errors?
npm run typecheck           # No TypeScript errors?

# Then commit:
git add -A
git commit -m "feat: add KYC validation with complete tests"
git push origin feature-branch
```

GitHub Actions will run tests on push. Merge blocked if tests fail.

## Quick Testing Checklist

- [ ] Test runs: `npm test`
- [ ] Setup verification passes: `npm test -- setupVerification`
- [ ] Coverage ≥75%: `npm run test:coverage`
- [ ] No console.log() left in code
- [ ] No hardcoded credentials/paths
- [ ] Tests grouped in describe() blocks
- [ ] Meaningful test names with "should..."
- [ ] Both success AND failure cases tested

## Next Steps (Week 2)

- [ ] Fix KYC service test mocking (make all 15 pass)
- [ ] Fix AML service test mocking (make all 15 pass)
- [ ] Fix agent test mocking (make all 16 pass)
- [ ] Create integration tests with real database
- [ ] Set up Codecov integration for coverage tracking
- [ ] Create performance benchmarks

## Get Help

1. **Check fixture data:** Look in `mockData.ts` for available test data
2. **Check how mocks work:** See jest.setup.js for examples
3. **Stuck?** Read `TESTING_QUICKSTART.md` (400+ lines, comprehensive)
4. **Need Mock pattern?** Search codebase for `jest.mock(` examples

---

**Last Updated:** February 26, 2026  
**Test Infrastructure:** ✅ Functional (paths fixed, mocks added)  
**Total Test Cases:** 68 (22 passing ✅, 46 in progress 🔧)
