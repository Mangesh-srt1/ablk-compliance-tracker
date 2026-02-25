# Day 6: Integrate Chainalysis AML API

## Objective
Integrate Chainalysis AML API for crypto transaction risk assessment.

## Steps
1. Sign up for Chainalysis and get API key.
2. In packages/api, create service.

## Chainalysis Service (src/services/chainalysis.ts)
```typescript
import axios from 'axios';

const CHAINALYSIS_BASE_URL = 'https://api.chainalysis.com/api/v1';
const CHAINALYSIS_API_KEY = process.env.CHAINALYSIS_API_KEY;

export const getRiskScore = async (address: string) => {
  const response = await axios.get(`${CHAINALYSIS_BASE_URL}/addresses/${address}`, {
    headers: {
      'Authorization': `Bearer ${CHAINALYSIS_API_KEY}`,
    },
  });
  return response.data;
};
```

## Test
```typescript
import { getRiskScore } from './services/chainalysis';

const test = async () => {
  const score = await getRiskScore('0x123...');
  console.log('Risk score:', score);
};
```

## Notes
- Chainalysis for AML in crypto; integrate into agent.