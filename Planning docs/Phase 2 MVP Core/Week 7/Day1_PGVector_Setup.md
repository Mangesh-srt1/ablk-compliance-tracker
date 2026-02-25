# Day 1: Setup PGVector Database

## Objective
Set up PostgreSQL with PGVector for vector storage.

## Steps
1. Install PostgreSQL and pgvector extension.
2. Create database: `createdb ableka_rag`
3. Enable extension: `psql -d ableka_rag -c "CREATE EXTENSION vector;"`

## Notes
- PGVector for embeddings storage.