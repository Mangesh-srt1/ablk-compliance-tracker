# Day 3: Install LangChain.js and Grok API Integration

## Objective
Install LangChain.js for agent orchestration and integrate Grok API for reasoning.

## Steps
1. In packages/agent: `cd packages/agent`
2. Install LangChain: `npm install langchain @langchain/openai`
3. For Grok, since it's xAI, use OpenAI-compatible API or custom integration. Assuming Grok API key.

## Updated packages/agent/package.json
```json
{
  "name": "@ableka-lumina/agent",
  "version": "1.0.0",
  "description": "Agent package",
  "main": "index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "langchain": "^0.0.200",
    "@langchain/openai": "^0.0.14"
  },
  "devDependencies": {
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1",
    "jest": "^29.5.0"
  }
}
```

## Grok Integration (src/grok.ts)
```typescript
import { OpenAI } from '@langchain/openai';

const grok = new OpenAI({
  openAIApiKey: process.env.GROK_API_KEY, // Assuming Grok uses OpenAI-compatible API
  modelName: 'grok-1', // Adjust model name
});

export const callGrok = async (prompt: string) => {
  const response = await grok.call(prompt);
  return response;
};
```

## Basic Agent Skeleton (src/agent.ts)
```typescript
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { callGrok } from './grok';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a compliance agent.'],
  ['human', '{input}'],
]);

const agent = await createOpenAIFunctionsAgent({
  llm: grok, // Use Grok
  tools: [], // Add tools later
  prompt,
});

const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools: [],
});

export const runAgent = async (input: string) => {
  const result = await executor.call({ input });
  return result.output;
};
```

## Verification
- Set GROK_API_KEY in .env.
- Test: `runAgent("What is KYC?")` should return a response.

## Notes
- LangChain handles agent loops.
- Grok provides reasoning; integrate tools in later days.