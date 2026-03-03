/**
 * Tenant Management Routes Unit Tests
 * Validates tenant registration, user onboarding, API key generation, and OAuth client generation.
 */

import express from 'express';
import request from 'supertest';

// Mock deps before importing routes
jest.mock('../../config/database');
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue(undefined),
  }),
  configureRedis: jest.fn(),
}));
jest.mock('../../middleware/authMiddleware', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
  requireRole: (_role: string) => (_req: any, _res: any, next: any) => next(),
}));

import db from '../../config/database';
import tenantManagementRoutes from '../tenantManagementRoutes';

const app = express();
app.use(express.json());
app.use('/', tenantManagementRoutes);

function mockDbInsert(row: object) {
  (db.query as jest.Mock).mockResolvedValueOnce({ rows: [row], rowCount: 1 });
}

function mockDbEmpty() {
  (db.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

beforeEach(() => jest.clearAllMocks());

// ─── POST /  (register tenant) ────────────────────────────────────────────────
describe('POST / (register tenant)', () => {
  it('should return 400 for an invalid tenant ID format', async () => {
    const res = await request(app).post('/').send({ id: 'bad id!', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('should register a tenant and return 201', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 }); // insert OK
    const res = await request(app)
      .post('/')
      .send({ id: 'TENANT_TEST', name: 'Test Tenant' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('TENANT_TEST');
  });

  it('should return 409 when tenant ID already exists', async () => {
    (db.query as jest.Mock).mockRejectedValueOnce({ code: '23505' });
    const res = await request(app)
      .post('/')
      .send({ id: 'TENANT_TEST', name: 'Duplicate' });
    expect(res.status).toBe(409);
  });
});

// ─── POST /:tenantId/users (onboard user) ─────────────────────────────────────
describe('POST /:tenantId/users (onboard user)', () => {
  it('should return 400 for invalid email', async () => {
    const res = await request(app)
      .post('/TENANT_TEST/users')
      .send({ email: 'not-an-email', full_name: 'Alice', role: 'analyst' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid role', async () => {
    const res = await request(app)
      .post('/TENANT_TEST/users')
      .send({ email: 'alice@test.com', full_name: 'Alice', role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('should create a user and return 201', async () => {
    mockDbInsert({
      id: 'uuid-user-001',
      email: 'alice@test.com',
      full_name: 'Alice Smith',
      role: 'analyst',
      tenant_id: 'TENANT_TEST',
      products: ['PE'],
      created_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/TENANT_TEST/users')
      .send({
        email: 'alice@test.com',
        full_name: 'Alice Smith',
        role: 'analyst',
        products: ['PE'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('alice@test.com');
  });

  it('should include temporary_password notice when no password provided', async () => {
    mockDbInsert({
      id: 'uuid-user-002',
      email: 'bob@test.com',
      full_name: 'Bob Jones',
      role: 'compliance_officer',
      tenant_id: 'TENANT_TEST',
      products: [],
      created_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/TENANT_TEST/users')
      .send({ email: 'bob@test.com', full_name: 'Bob Jones', role: 'compliance_officer' });

    expect(res.status).toBe(201);
    expect(res.body.data.temporary_password).toBeDefined();
    expect(res.body.notice).toContain('will not be shown again');
  });
});

// ─── POST /:tenantId/api-keys ─────────────────────────────────────────────────
describe('POST /:tenantId/api-keys', () => {
  it('should return 400 when products array is empty', async () => {
    const res = await request(app)
      .post('/TENANT_TEST/api-keys')
      .send({ products: [], allowed_scopes: ['pe:read'] });
    expect(res.status).toBe(400);
  });

  it('should generate an API key and return it once', async () => {
    mockDbInsert({
      id: 'uuid-key-001',
      key_prefix: 'lmk_live_xxxxx',
      tenant_id: 'TENANT_TEST',
      products: ['PE'],
      allowed_scopes: ['pe:read'],
      rate_limit_per_min: 60,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/TENANT_TEST/api-keys')
      .send({ products: ['PE'], allowed_scopes: ['pe:read'] });

    expect(res.status).toBe(201);
    // api_key (full key) should be present in creation response
    expect(res.body.data.api_key).toBeDefined();
    expect(res.body.data.api_key).toMatch(/^lmk_live_/);
    expect(res.body.notice).toContain('not be shown again');
  });

  it('should store a key_hash not the plaintext in DB query', async () => {
    mockDbInsert({
      id: 'uuid-key-002',
      key_prefix: 'lmk_live_yyyyy',
      tenant_id: 'TENANT_TEST',
      products: ['COMPLIANCE'],
      allowed_scopes: ['compliance:read'],
      rate_limit_per_min: 60,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    await request(app)
      .post('/TENANT_TEST/api-keys')
      .send({ products: ['COMPLIANCE'], allowed_scopes: ['compliance:read'] });

    // Verify that the INSERT was called with a 64-char hex hash (SHA-256)
    const insertCall = (db.query as jest.Mock).mock.calls[0];
    const params = insertCall[1] as string[];
    // params[2] = key_hash (64 hex chars)
    expect(params[2]).toMatch(/^[a-f0-9]{64}$/);
    // params[1] (api_key column in DB) should NOT be the full raw key
    expect(params[1]).not.toMatch(/^lmk_live_[a-f0-9]{32}$/);
  });
});

// ─── POST /:tenantId/oauth-clients ────────────────────────────────────────────
describe('POST /:tenantId/oauth-clients', () => {
  it('should generate client_id and return client_secret once', async () => {
    mockDbInsert({
      id: 'uuid-client-001',
      client_id: 'client_TENANT_TEST_abcd1234',
      tenant_id: 'TENANT_TEST',
      products: ['PE', 'COMPLIANCE'],
      allowed_scopes: ['pe:read', 'compliance:read'],
      is_active: true,
      created_at: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/TENANT_TEST/oauth-clients')
      .send({ products: ['PE', 'COMPLIANCE'], allowed_scopes: ['pe:read', 'compliance:read'] });

    expect(res.status).toBe(201);
    expect(res.body.data.client_id).toBeDefined();
    // client_secret should be present in creation response only
    expect(res.body.data.client_secret).toBeDefined();
    expect(res.body.data.client_secret.length).toBeGreaterThan(16);
    expect(res.body.notice).toContain('will not be shown again');
  });

  it('should not return client_secret in list endpoint', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: 'uuid-client-001',
          client_id: 'client_TENANT_TEST_abcd1234',
          tenant_id: 'TENANT_TEST',
          products: ['PE'],
          allowed_scopes: ['pe:read'],
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ],
      rowCount: 1,
    });

    const res = await request(app).get('/TENANT_TEST/oauth-clients');

    expect(res.status).toBe(200);
    expect(res.body.data[0].client_secret).toBeUndefined();
    expect(res.body.data[0].client_id).toBeDefined();
  });
});

// ─── DELETE /:tenantId/api-keys/:keyId ────────────────────────────────────────
describe('DELETE /:tenantId/api-keys/:keyId', () => {
  it('should return 404 when key not found', async () => {
    mockDbEmpty();
    const res = await request(app).delete('/TENANT_TEST/api-keys/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('should revoke an existing key', async () => {
    mockDbInsert({ id: 'uuid-key-001' });
    const res = await request(app).delete('/TENANT_TEST/api-keys/uuid-key-001');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
