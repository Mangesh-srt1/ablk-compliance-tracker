# Day 7: Create API Gateway Mock (Express Routes)

## Objective
Set up mock API Gateway routes in Express for routing to providers.

## Steps
1. In packages/api/src/index.ts, add routes.

## Updated src/index.ts
```typescript
import express from 'express';
import { initiateKyc } from './services/jumio';
import { getRiskScore } from './services/chainalysis';

const app = express();
app.use(express.json());

app.post('/kyc-check', async (req, res) => {
  const { entityId, jurisdiction } = req.body;
  // Mock routing
  if (jurisdiction === 'IN') {
    const result = await initiateKyc({ entityId });
    res.json(result);
  } else {
    res.json({ status: 'mock', entityId });
  }
});

app.post('/aml-score', async (req, res) => {
  const { entityId } = req.body;
  const score = await getRiskScore(entityId);
  res.json(score);
});

app.listen(3000, () => console.log('API Gateway running'));
```

## Notes
- Mock for now; full routing in later phases.