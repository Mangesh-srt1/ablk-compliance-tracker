# Day 6: Implement Jurisdiction Tagging

## Objective
Tag documents by jurisdiction.

## Steps
1. Update ingester to add jurisdiction field.

## In ingest.ts
```typescript
const doc = { content, jurisdiction: 'SEBI', embedding };
```

## Notes
- For filtering.