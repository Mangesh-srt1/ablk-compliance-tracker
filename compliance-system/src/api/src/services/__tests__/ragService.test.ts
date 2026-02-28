/**
 * RAG Service Unit Tests
 */

import { RAGService, ComplianceDocument } from '../ragService';

// Mock the database module
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

// Mock winston to suppress log output during tests
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

import db from '../../config/database';

const mockQuery = db.query as jest.Mock;

const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  content: 'KYC requirements for AE jurisdiction',
  jurisdiction: 'AE',
  document_type: 'regulation',
  embedding: null,
  metadata: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  total_count: '1',
  ...overrides,
});

describe('RAGService', () => {
  let service: RAGService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RAGService();
  });

  // ─── ingestDocument ──────────────────────────────────────────────────────────

  describe('ingestDocument', () => {
    it('should store a document and return it with id', async () => {
      const row = makeRow();
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const doc: ComplianceDocument = {
        content: 'KYC requirements for AE jurisdiction',
        jurisdiction: 'AE',
        documentType: 'regulation',
      };

      const result = await service.ingestDocument(doc);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO compliance_documents'),
        expect.arrayContaining([doc.content, doc.jurisdiction, doc.documentType])
      );
      expect(result.id).toBe(1);
      expect(result.jurisdiction).toBe('AE');
      expect(result.documentType).toBe('regulation');
    });

    it('should propagate metadata when provided', async () => {
      const meta = { source: 'DFSA', version: '2024' };
      const row = makeRow({ metadata: meta });
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await service.ingestDocument({
        content: 'Rule content',
        jurisdiction: 'AE',
        documentType: 'rule',
        metadata: meta,
      });

      expect(result.metadata).toEqual(meta);
    });

    it('should throw and log error on DB failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.ingestDocument({ content: 'x', jurisdiction: 'AE', documentType: 'rule' })
      ).rejects.toThrow('DB error');
    });
  });

  // ─── queryDocuments ───────────────────────────────────────────────────────────

  describe('queryDocuments', () => {
    it('should return documents matching the query', async () => {
      const row = makeRow({ total_count: '1' });
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await service.queryDocuments('KYC', 'AE', 5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['AE', '%KYC%', 5])
      );
      expect(result.documents).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.jurisdiction).toBe('AE');
      expect(result.query).toBe('KYC');
    });

    it('should return empty result when no rows match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.queryDocuments('no_match', 'US', 10);

      expect(result.documents).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should cap limit at 100', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.queryDocuments('q', 'AE', 999);

      const callArgs = mockQuery.mock.calls[0][1];
      expect(callArgs[2]).toBe(100);
    });

    it('should throw on DB failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('query failed'));

      await expect(service.queryDocuments('q', 'AE')).rejects.toThrow('query failed');
    });
  });

  // ─── getDocumentsByJurisdiction ───────────────────────────────────────────────

  describe('getDocumentsByJurisdiction', () => {
    it('should return all documents for the jurisdiction', async () => {
      const rows = [makeRow(), makeRow({ id: 2 })];
      mockQuery.mockResolvedValueOnce({ rows });

      const docs = await service.getDocumentsByJurisdiction('AE');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE jurisdiction = $1'),
        ['AE']
      );
      expect(docs).toHaveLength(2);
    });

    it('should return empty array when no documents exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const docs = await service.getDocumentsByJurisdiction('XY');
      expect(docs).toHaveLength(0);
    });
  });

  // ─── deleteDocument ───────────────────────────────────────────────────────────

  describe('deleteDocument', () => {
    it('should delete an existing document', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await expect(service.deleteDocument(1)).resolves.toBeUndefined();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM compliance_documents'),
        [1]
      );
    });

    it('should throw when document is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      await expect(service.deleteDocument(999)).rejects.toThrow('not found');
    });
  });

  // ─── healthCheck ─────────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return true when DB is reachable', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const healthy = await service.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return false when DB is unreachable', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection refused'));

      const healthy = await service.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
