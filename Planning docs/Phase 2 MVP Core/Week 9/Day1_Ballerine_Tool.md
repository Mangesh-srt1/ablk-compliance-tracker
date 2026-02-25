# Day 1: Implement ballerineKYC() Tool

## Objective
Create LangChain tool for Ballerine KYC.

## Steps
1. In agent, add tool.

## src/tools/ballerine.ts
```typescript
import { Tool } from 'langchain/tools';
import axios from 'axios';

export class BallerineKYCTool extends Tool {
  name = 'ballerineKYC';
  description = 'Check KYC using Ballerine';

  async _call(input: string) {
    const result = await axios.post('https://api.ballerine.com/kyc', { entityId: input });
    return JSON.stringify(result.data);
  }
}
```

## Add to agent tools.