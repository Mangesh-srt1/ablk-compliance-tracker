/**
 * OAuth2 Token Route Unit Tests
 * Validates the POST /oauth/token (client_credentials grant)
 */

import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock DB before importing the route
jest.mock('../../config/database');
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue(undefined),
  }),
  configureRedis: jest.fn(),
}));

import db from '../../config/database';
import oauthRoutes from '../oauthRoutes';

// Build a minimal Express app for testing
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', oauthRoutes);

const TEST_SECRET = 'test-oauth-jwt-secret';
const VALID_CLIENT_SECRET = 'super-secret-123';
let hashedSecret: string;

beforeAll(async () => {
  hashedSecret = await bcrypt.hash(VALID_CLIENT_SECRET, 10);
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.JWT_ISSUER = 'https://auth.abeleka.com';
  process.env.JWT_AUDIENCE = 'https://api.abeleka.com';
});

afterAll(() => {
  delete process.env.JWT_SECRET;
  delete process.env.JWT_ISSUER;
  delete process.env.JWT_AUDIENCE;
});

function mockDbClient(row: object | null) {
  (db.query as jest.Mock).mockResolvedValueOnce({
    rows: row ? [row] : [],
    rowCount: row ? 1 : 0,
  });
}

describe('POST /token (OAuth2 client_credentials)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 for an unsupported grant_type', async () => {
    const res = await request(app)
      .post('/token')
      .send('grant_type=password&client_id=c1&client_secret=s1')
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: expect.stringContaining('unsupported_grant_type') });
  });

  it('should return 400 when client_id is missing', async () => {
    const res = await request(app)
      .post('/token')
      .send('grant_type=client_credentials&client_secret=s1')
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: expect.stringContaining('client_id') });
  });

  it('should return 401 when client_id is not found in DB', async () => {
    mockDbClient(null); // DB returns no rows

    const res = await request(app)
      .post('/token')
      .send('grant_type=client_credentials&client_id=unknown&client_secret=secret')
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: expect.stringContaining('invalid_client') });
  });

  it('should return 401 when client_secret is wrong', async () => {
    mockDbClient({
      id: 'uuid-001',
      client_secret_hash: hashedSecret,
      tenant_id: 'TENANT_123',
      products: ['PE'],
      allowed_scopes: ['pe:read'],
    });

    const res = await request(app)
      .post('/token')
      .send('grant_type=client_credentials&client_id=client_TENANT_123&client_secret=wrong-secret')
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: expect.stringContaining('invalid_client') });
  });

  it('should return an access token for valid client credentials', async () => {
    mockDbClient({
      id: 'uuid-001',
      client_secret_hash: hashedSecret,
      tenant_id: 'TENANT_123',
      products: ['PE', 'COMPLIANCE'],
      allowed_scopes: ['pe:read', 'pe:write', 'compliance:read'],
    });

    const res = await request(app)
      .post('/token')
      .send(
        `grant_type=client_credentials&client_id=client_TENANT_123&client_secret=${VALID_CLIENT_SECRET}`
      )
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: expect.any(Number),
      scope: expect.stringContaining('pe:read'),
    });
  });

  it('should restrict scope to the requested subset', async () => {
    mockDbClient({
      id: 'uuid-001',
      client_secret_hash: hashedSecret,
      tenant_id: 'TENANT_123',
      products: ['PE', 'COMPLIANCE'],
      allowed_scopes: ['pe:read', 'pe:write', 'compliance:read'],
    });

    const res = await request(app)
      .post('/token')
      .send(
        `grant_type=client_credentials&client_id=client_TENANT_123&client_secret=${VALID_CLIENT_SECRET}&scope=pe:read`
      )
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('pe:read');
  });

  it('should return 400 when none of the requested scopes are permitted', async () => {
    mockDbClient({
      id: 'uuid-001',
      client_secret_hash: hashedSecret,
      tenant_id: 'TENANT_123',
      products: ['PE'],
      allowed_scopes: ['pe:read'],
    });

    const res = await request(app)
      .post('/token')
      .send(
        `grant_type=client_credentials&client_id=client_TENANT_123&client_secret=${VALID_CLIENT_SECRET}&scope=compliance:write`
      )
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: expect.stringContaining('invalid_scope') });
  });

  it('should encode tenant, products, sub, and scope in the JWT payload', async () => {
    mockDbClient({
      id: 'uuid-001',
      client_secret_hash: hashedSecret,
      tenant_id: 'TENANT_123',
      products: ['PE', 'COMPLIANCE'],
      allowed_scopes: ['pe:read', 'compliance:read'],
    });

    const res = await request(app)
      .post('/token')
      .send(
        `grant_type=client_credentials&client_id=client_TENANT_123&client_secret=${VALID_CLIENT_SECRET}`
      )
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(res.status).toBe(200);

    // Decode the JWT (without verifying signature in this unit test)
    const tokenParts = res.body.access_token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());

    expect(payload.sub).toBe('client_TENANT_123');
    expect(payload.tenant).toBe('TENANT_123');
    expect(payload.products).toEqual(expect.arrayContaining(['PE', 'COMPLIANCE']));
    expect(payload.scope).toContain('pe:read');
    expect(payload.scope).toContain('compliance:read');
  });
});
