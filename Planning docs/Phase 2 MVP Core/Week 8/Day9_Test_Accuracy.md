# Day 9: Test Query Accuracy

## Objective
Test RAG query accuracy.

## Steps
1. Create test queries.

## test/rag.test.js
```javascript
test('Query returns relevant SEBI docs', async () => {
  const response = await axios.get('/rules?query=KYC&jurisdiction=SEBI');
  expect(response.data.length).toBeGreaterThan(0);
});
```

## Notes
- Manual check relevance.