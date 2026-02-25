# Day 9: Add Grok Reasoning Loop

## Objective
Integrate Grok for iterative reasoning in the agent.

## Steps
1. Update agent to use ReAct loop.

## Updated src/agent.ts
```typescript
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { callGrok } from './grok';

const tools = []; // Add tools

const executor = await initializeAgentExecutorWithOptions(tools, { call: callGrok }, {
  agentType: 'openai-functions',
  verbose: true,
});

export const runAgent = async (input: string) => {
  const result = await executor.call({ input });
  return result.output;
};
```

## Notes
- ReAct for reasoning; verbose for debugging.