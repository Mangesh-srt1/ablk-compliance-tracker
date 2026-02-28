-- Vector store for compliance documents (RAG pipeline)
-- Using BYTEA for embeddings (dev-compatible, no pgvector extension needed)
-- Production: Replace with pgvector extension
CREATE TABLE IF NOT EXISTS compliance_documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  jurisdiction VARCHAR(10) NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'regulation',
  embedding BYTEA,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_docs_jurisdiction ON compliance_documents(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_type ON compliance_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_compliance_docs_content ON compliance_documents USING gin(to_tsvector('english', content));
