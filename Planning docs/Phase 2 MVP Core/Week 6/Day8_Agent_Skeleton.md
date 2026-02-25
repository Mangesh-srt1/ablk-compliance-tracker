# Day 8: Build Basic Agent Skeleton (LangChain Agent Class)

## Objective
Create a basic LangChain agent class for compliance checks.

## Steps
1. In packages/agent/src/agent.ts, expand.

## Updated src/agent.ts
```typescript
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { callGrok } from './grok';

class ComplianceAgent {
  private executor: AgentExecutor;

  constructor() {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a compliance agent for KYC/AML.'],
      ['human', '{input}'],
    ]);

    const agent = createOpenAIFunctionsAgent({
      llm: { call: callGrok }, // Wrap Grok
      tools: [], // Add later
      prompt,
    });

    this.executor = AgentExecutor.fromAgentAndTools({
      agent,
      tools: [],
    });
  }

  async run(input: string) {
    return await this.executor.call({ input });
  }
}

export const complianceAgent = new ComplianceAgent();
```

## Notes
- Class-based for reusability.