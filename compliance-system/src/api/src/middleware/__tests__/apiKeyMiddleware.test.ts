/**
 * API Key & Product/Scope Middleware Unit Tests
 * Validates authenticateApiKey, requireProduct, and requireScope middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  authenticateApiKey,
  requireProduct,
  requireScope,
} from '../authMiddleware';

// Mock the database so no real DB connection is needed
jest.mock('../../config/database');
// Mock Redis so no real Redis connection is needed
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue(undefined),
  }),
  configureRedis: jest.fn(),
}));

import db from '../../config/database';

function mockResponse(): Partial<Response> & { status: jest.Mock; json: jest.Mock } {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
}

// ---------------------------------------------------------------------------
// authenticateApiKey
// ---------------------------------------------------------------------------
describe('authenticateApiKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when X-API-Key header is absent', async () => {
    const req = { headers: {}, ip: '127.0.0.1', path: '/test' } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateApiKey(req, res as Response, next);
    await new Promise((r) => setImmediate(r));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'API_KEY_MISSING' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when the API key is not found in the database', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const req = {
      headers: { 'x-api-key': 'invalid-key' },
      ip: '127.0.0.1',
      path: '/test',
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateApiKey(req, res as Response, next);
    await new Promise((r) => setImmediate(r));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'API_KEY_INVALID' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and populate req.user for a valid API key', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'key-uuid-001',
          tenant_id: 'TENANT_123',
          products: ['PE', 'COMPLIANCE'],
          allowed_scopes: ['pe:read', 'compliance:read'],
        },
      ],
      rowCount: 1,
    });

    const req = {
      headers: { 'x-api-key': 'test-api-key-tenant-123' },
      ip: '127.0.0.1',
      path: '/v1/pe/holdings',
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateApiKey(req, res as Response, next);
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect((req as any).user).toMatchObject({
      tenant: 'TENANT_123',
      products: expect.arrayContaining(['PE', 'COMPLIANCE']),
      role: 'api_client',
    });
  });

  it('should set scope on req.user as a space-separated string', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'key-uuid-002',
          tenant_id: 'TENANT_456',
          products: ['COMPLIANCE'],
          allowed_scopes: ['compliance:read', 'compliance:write'],
        },
      ],
      rowCount: 1,
    });

    const req = {
      headers: { 'x-api-key': 'some-key' },
      ip: '127.0.0.1',
      path: '/test',
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateApiKey(req, res as Response, next);
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalled();
    expect((req as any).user.scope).toBe('compliance:read compliance:write');
  });
});

// ---------------------------------------------------------------------------
// requireProduct
// ---------------------------------------------------------------------------
describe('requireProduct', () => {
  it('should call next() when user has the required product', () => {
    const req = {
      user: {
        id: 'u1',
        role: 'api_client',
        permissions: [],
        iat: 0,
        exp: 9999999999,
        tenant: 'TENANT_123',
        products: ['PE', 'COMPLIANCE'],
      },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireProduct('PE')(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks the required product', () => {
    const req = {
      user: {
        id: 'u1',
        role: 'api_client',
        permissions: [],
        iat: 0,
        exp: 9999999999,
        tenant: 'TENANT_123',
        products: ['COMPLIANCE'],
      },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireProduct('PE')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PRODUCT_ACCESS_DENIED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user has no products array', () => {
    const req = {
      user: { id: 'u1', role: 'analyst', permissions: [], iat: 0, exp: 9999999999 },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireProduct('PE')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when req.user is not set', () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireProduct('PE')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireScope
// ---------------------------------------------------------------------------
describe('requireScope', () => {
  it('should call next() when the token scope includes the required scope', () => {
    const req = {
      user: {
        id: 'u1',
        role: 'api_client',
        permissions: [],
        iat: 0,
        exp: 9999999999,
        scope: 'pe:read pe:write compliance:read',
      },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireScope('pe:write')(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when token does not include the required scope', () => {
    const req = {
      user: {
        id: 'u1',
        role: 'api_client',
        permissions: [],
        iat: 0,
        exp: 9999999999,
        scope: 'compliance:read',
      },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireScope('pe:write')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INSUFFICIENT_SCOPE' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user has no scope field', () => {
    const req = {
      user: { id: 'u1', role: 'analyst', permissions: [], iat: 0, exp: 9999999999 },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireScope('compliance:read')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when req.user is not set', () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireScope('pe:read')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});
