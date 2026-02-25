# Day 5: Integrate Jumio KYC API (Test Auth)

## Objective
Integrate Jumio KYC API for global KYC checks, focusing on authentication and basic test.

## Steps
1. Sign up for Jumio account and get API credentials (token, secret).
2. In packages/api, install if needed: `npm install axios` (already done).
3. Create Jumio service.

## Jumio Service (src/services/jumio.ts)
```typescript
import axios from 'axios';

const JUMIO_BASE_URL = 'https://netverify.com/api/v4';
const JUMIO_TOKEN = process.env.JUMIO_TOKEN;
const JUMIO_SECRET = process.env.JUMIO_SECRET;

export const initiateKyc = async (data: any) => {
  const response = await axios.post(`${JUMIO_BASE_URL}/initiate`, data, {
    headers: {
      'Authorization': `Bearer ${JUMIO_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  return response.data;
};

export const getKycStatus = async (scanId: string) => {
  const response = await axios.get(`${JUMIO_BASE_URL}/scans/${scanId}`, {
    headers: {
      'Authorization': `Bearer ${JUMIO_TOKEN}`,
    },
  });
  return response.data;
};
```

## Test Auth
```typescript
// In a test file or script
import { initiateKyc } from './services/jumio';

const testKyc = async () => {
  try {
    const result = await initiateKyc({ /* sample data */ });
    console.log('Jumio auth successful:', result);
  } catch (error) {
    console.error('Auth failed:', error);
  }
};

testKyc();
```

## Verification
- Set env vars: JUMIO_TOKEN, JUMIO_SECRET.
- Run test to confirm API access.

## Notes
- Jumio handles global KYC; integrate into agent tools later.
- Ready for Chainalysis in Week 6.