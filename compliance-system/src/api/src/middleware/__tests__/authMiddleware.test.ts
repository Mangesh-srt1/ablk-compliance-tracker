/**
 * AuthMiddleware Unit Tests
 * Validates JWT authentication and RBAC authorization middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticateToken,
  requireRole,
  requirePermission,
  requireAdmin,
  requireComplianceOfficer,
  JWTPayload,
} from '../authMiddleware';

const TEST_SECRET = 'test-jwt-secret-for-unit-tests-only';

function buildValidPayload(overrides: Partial<JWTPayload> = {}): JWTPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'user-001',
    email: 'test@compliance.com',
    role: 'analyst',
    permissions: ['compliance:READ'],
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

function signToken(payload: JWTPayload, secret: string = TEST_SECRET): string {
  return jwt.sign(payload, secret);
}

function mockResponse(): Partial<Response> & { status: jest.Mock; json: jest.Mock } {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticateToken', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_SECRET: TEST_SECRET };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should call next() for a valid bearer token', () => {
    const payload = buildValidPayload();
    const token = signToken(payload);

    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.id).toBe('user-001');
  });

  it('should return 401 when no authorization header is provided', () => {
    const req = { headers: {}, ip: '127.0.0.1', path: '/test', method: 'GET' } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TOKEN_MISSING' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header has no token', () => {
    const req = { headers: { authorization: 'Bearer ' }, ip: '127.0.0.1', path: '/test', method: 'GET' } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for a token signed with the wrong secret', () => {
    const payload = buildValidPayload();
    const token = signToken(payload, 'wrong-secret');

    const req = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1' } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TOKEN_INVALID' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for a malformed (non-JWT) token', () => {
    const req = { headers: { authorization: 'Bearer notajwttoken' }, ip: '127.0.0.1' } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an expired token', () => {
    const payload = buildValidPayload({ exp: Math.floor(Date.now() / 1000) - 3600 });
    // Sign with ignoreExpiration=false (default) - jwt.sign ignores payload.exp override,
    // so we pass expiresIn explicitly as a very short time in the past.
    const token = jwt.sign(
      { ...payload, exp: Math.floor(Date.now() / 1000) - 3600 },
      TEST_SECRET
    );

    const req = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1' } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    // jwt.verify will throw TokenExpiredError; middleware returns 401
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 500 when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;

    const payload = buildValidPayload();
    const token = signToken(payload);

    const req = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1', path: '/test', method: 'GET' } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CONFIG_ERROR' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach the decoded user to req.user', () => {
    const payload = buildValidPayload({ role: 'admin', permissions: ['compliance:READ', 'compliance:WRITE'] });
    const token = signToken(payload);

    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res as Response, next);

    expect(req.user).toMatchObject({
      id: 'user-001',
      email: 'test@compliance.com',
      role: 'admin',
      permissions: expect.arrayContaining(['compliance:READ', 'compliance:WRITE']),
    });
  });
});

describe('requireRole', () => {
  it('should call next() when user has the required role', () => {
    const req = { user: { id: 'u1', role: 'admin', permissions: [] } } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireRole('admin')(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user has a different role', () => {
    const req = { user: { id: 'u1', role: 'analyst', permissions: [] } } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireRole('admin')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INSUFFICIENT_ROLE' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when req.user is not set', () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireRole('admin')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_REQUIRED' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requirePermission', () => {
  it('should call next() when user has the required permission', () => {
    const req = {
      user: { id: 'u1', role: 'analyst', permissions: ['compliance:READ', 'compliance:WRITE'] },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requirePermission('compliance:READ')(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user lacks the required permission', () => {
    const req = {
      user: { id: 'u1', role: 'analyst', permissions: ['compliance:READ'] },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requirePermission('compliance:WRITE')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INSUFFICIENT_PERMISSION' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when req.user is not set', () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requirePermission('compliance:READ')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_REQUIRED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user has an empty permissions array', () => {
    const req = {
      user: { id: 'u1', role: 'analyst', permissions: [] },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requirePermission('compliance:READ')(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('should allow admin role', () => {
    const req = { user: { id: 'u1', role: 'admin', permissions: [] } } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny non-admin role', () => {
    const req = { user: { id: 'u1', role: 'analyst', permissions: [] } } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireAdmin(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireComplianceOfficer', () => {
  it('should allow admin role', () => {
    const req = { user: { id: 'u1', role: 'admin', permissions: [] } } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireComplianceOfficer(req, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow compliance_officer role', () => {
    const req = {
      user: { id: 'u1', role: 'compliance_officer', permissions: [] },
    } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireComplianceOfficer(req, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny analyst role', () => {
    const req = { user: { id: 'u1', role: 'analyst', permissions: [] } } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireComplianceOfficer(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'COMPLIANCE_ACCESS_REQUIRED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when req.user is not set', () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireComplianceOfficer(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should deny client role', () => {
    const req = { user: { id: 'u1', role: 'client', permissions: [] } } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn() as NextFunction;

    requireComplianceOfficer(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
