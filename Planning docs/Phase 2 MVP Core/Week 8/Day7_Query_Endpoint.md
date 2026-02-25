# Day 7: Build Query Endpoint (/rules)

## Objective
Create API endpoint to query rules.

## Steps
1. In API, add route.

## src/index.ts
```typescript
app.get('/rules', async (req, res) => {
  const { query, jurisdiction } = req.query;
  // Generate embedding, search PGVector
  const embedding = await generateEmbedding(query);
  const results = await pg.query('SELECT * FROM documents WHERE jurisdiction = $1 ORDER BY embedding <=> $2 LIMIT 5', [jurisdiction, embedding]);
  res.json(results.rows);
});
```

## Notes
- Vector similarity search.