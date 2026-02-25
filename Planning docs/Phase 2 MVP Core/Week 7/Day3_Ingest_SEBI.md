# Day 3: Ingest SEBI Docs via Cron

## Objective
Set up cron job to ingest SEBI documents.

## Steps
1. Install node-cron: `npm install node-cron`
2. Create ingester script.

## src/ingest.ts
```typescript
import cron from 'node-cron';
import { fetchSebiDocs } from './fetchers/sebi';

cron.schedule('0 0 * * *', async () => {
  const docs = await fetchSebiDocs();
  // Process and store in PGVector
});
```

## Notes
- Daily ingestion.