# Day 5: Generate Embeddings with OpenAI

## Objective
Use OpenAI to generate embeddings for docs.

## Steps
1. Install openai: `npm install openai`

## src/embeddings.ts
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const generateEmbedding = async (text: string) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
};
```

## Integrate into ingester.