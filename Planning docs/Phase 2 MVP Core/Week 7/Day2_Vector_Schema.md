# Day 2: Configure Vector Storage Schema

## Objective
Create schema for storing documents and vectors.

## SQL
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT,
  jurisdiction VARCHAR(10),
  embedding VECTOR(1536)
);

CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

## Notes
- 1536 for OpenAI embeddings.