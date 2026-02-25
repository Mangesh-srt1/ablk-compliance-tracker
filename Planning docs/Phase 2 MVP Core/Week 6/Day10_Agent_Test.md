# Day 10: Test Agent with Mock Data

## Objective
Test the agent with mock inputs.

## Steps
1. Create test in packages/agent.

## test/agent.test.js
```javascript
const { runAgent } = require('./dist/agent');

test('Agent responds to KYC query', async () => {
  const result = await runAgent('Check KYC for user123');
  expect(result).toContain('KYC');
});
```

## Run
- `npm test`

## Notes
- Mock data; real tests later.