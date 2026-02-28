/**
 * RAG (Retrieval-Augmented Generation) Service
 * Stores and queries compliance documents using PostgreSQL with BYTEA embeddings.
 * Dev: text-based LIKE search fallback (no pgvector required).
 * Production: replace BYTEA with pgvector for similarity search.
 */

import winston from 'winston';
import db from '../config/database';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/rag.log' }),
  ],
});

export interface ComplianceDocument {
  id?: number;
  content: string;
  jurisdiction: string;
  documentType: string; // 'regulation', 'rule', 'guideline'
  embedding?: Buffer;   // BYTEA storage in dev
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RAGQueryResult {
  documents: ComplianceDocument[];
  totalCount: number;
  jurisdiction: string;
  query: string;
}

export class RAGService {
  /**
   * Ingest a compliance document into the vector store.
   */
  async ingestDocument(doc: ComplianceDocument): Promise<ComplianceDocument> {
    try {
      logger.info('Ingesting compliance document', {
        jurisdiction: doc.jurisdiction,
        documentType: doc.documentType,
      });

      const result = await db.query<{
        id: number;
        content: string;
        jurisdiction: string;
        document_type: string;
        embedding: Buffer | null;
        metadata: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO compliance_documents
           (content, jurisdiction, document_type, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          doc.content,
          doc.jurisdiction,
          doc.documentType,
          doc.embedding ?? null,
          doc.metadata ? JSON.stringify(doc.metadata) : null,
        ]
      );

      const row = result.rows[0];
      logger.info('Document ingested successfully', { id: row.id });
      return this.rowToDocument(row);
    } catch (error) {
      logger.error('Failed to ingest document', {
        error: error instanceof Error ? error.message : String(error),
        jurisdiction: doc.jurisdiction,
      });
      throw error;
    }
  }

  /**
   * Query documents using full-text LIKE search (dev fallback).
   * Production upgrade path: replace with pgvector cosine similarity.
   */
  async queryDocuments(
    query: string,
    jurisdiction: string,
    limit = 10
  ): Promise<RAGQueryResult> {
    try {
      logger.info('Querying compliance documents', { query: query.substring(0, 100), jurisdiction, limit });

      const safeLimit = Math.min(Math.max(1, limit), 100);
      const result = await db.query<{
        id: number;
        content: string;
        jurisdiction: string;
        document_type: string;
        embedding: Buffer | null;
        metadata: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
        total_count: string;
      }>(
        `SELECT *, COUNT(*) OVER() AS total_count
         FROM compliance_documents
         WHERE jurisdiction = $1
           AND content ILIKE $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [jurisdiction, `%${query}%`, safeLimit]
      );

      const documents = result.rows.map((r) => this.rowToDocument(r));
      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

      return { documents, totalCount, jurisdiction, query };
    } catch (error) {
      logger.error('Failed to query documents', {
        error: error instanceof Error ? error.message : String(error),
        jurisdiction,
      });
      throw error;
    }
  }

  /**
   * Get all compliance documents for a given jurisdiction.
   */
  async getDocumentsByJurisdiction(jurisdiction: string): Promise<ComplianceDocument[]> {
    try {
      logger.info('Fetching documents by jurisdiction', { jurisdiction });

      const result = await db.query<{
        id: number;
        content: string;
        jurisdiction: string;
        document_type: string;
        embedding: Buffer | null;
        metadata: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT * FROM compliance_documents
         WHERE jurisdiction = $1
         ORDER BY created_at DESC`,
        [jurisdiction]
      );

      return result.rows.map((r) => this.rowToDocument(r));
    } catch (error) {
      logger.error('Failed to fetch documents by jurisdiction', {
        error: error instanceof Error ? error.message : String(error),
        jurisdiction,
      });
      throw error;
    }
  }

  /**
   * Delete a compliance document by ID.
   */
  async deleteDocument(id: number): Promise<void> {
    try {
      logger.info('Deleting compliance document', { id });

      const result = await db.query('DELETE FROM compliance_documents WHERE id = $1', [id]);

      if (result.rowCount === 0) {
        throw new Error(`Document with id ${id} not found`);
      }

      logger.info('Document deleted successfully', { id });
    } catch (error) {
      logger.error('Failed to delete document', {
        error: error instanceof Error ? error.message : String(error),
        id,
      });
      throw error;
    }
  }

  /**
   * Health check: verify DB connectivity.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await db.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('RAG service health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private rowToDocument(row: {
    id: number;
    content: string;
    jurisdiction: string;
    document_type: string;
    embedding: Buffer | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    updated_at: Date;
  }): ComplianceDocument {
    return {
      id: row.id,
      content: row.content,
      jurisdiction: row.jurisdiction,
      documentType: row.document_type,
      embedding: row.embedding ?? undefined,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const ragService = new RAGService();
export default ragService;
