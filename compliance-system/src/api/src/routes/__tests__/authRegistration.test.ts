/**
 * Unit tests for the self-registration OTP flow:
 *   POST /api/auth/register
 *   POST /api/auth/verify-otp
 *   POST /api/auth/resend-otp
 */

import express from 'express';
import request from 'supertest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../config/database');
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue(undefined),
  }),
  configureRedis: jest.fn(),
}));

import db from '../../config/database';
import { getRedisClient } from '../../config/redis';
import authRoutes from '../authRoutes';

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/', authRoutes);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockDbEmpty() {
  (db.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

function mockDbRows(rows: object[]) {
  (db.query as jest.Mock).mockResolvedValueOnce({ rows, rowCount: rows.length });
}

function mockRedisGet(value: string | null) {
  const redis = getRedisClient();
  (redis.get as jest.Mock).mockResolvedValueOnce(value);
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset redis mock
  const redis = getRedisClient();
  (redis.get as jest.Mock).mockResolvedValue(null);
  (redis.set as jest.Mock).mockResolvedValue('OK');
  (redis.del as jest.Mock).mockResolvedValue(1);
});

// ─── POST /register ───────────────────────────────────────────────────────────

describe('POST /register', () => {
  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/register').send({
      email: 'not-an-email',
      full_name: 'Test User',
      password: 'securePass1',
      role: 'read_only',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for password shorter than 8 chars', async () => {
    const res = await request(app).post('/register').send({
      email: 'user@example.com',
      full_name: 'Test User',
      password: 'short',
      role: 'read_only',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid role', async () => {
    const res = await request(app).post('/register').send({
      email: 'user@example.com',
      full_name: 'Test User',
      password: 'securePass1',
      role: 'superadmin',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for global admin role (not self-registerable)', async () => {
    const res = await request(app).post('/register').send({
      email: 'user@example.com',
      full_name: 'Test User',
      password: 'securePass1',
      role: 'admin',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    // DB: SELECT finds existing user
    mockDbRows([{ id: 'existing-uuid' }]);

    const res = await request(app).post('/register').send({
      email: 'existing@example.com',
      full_name: 'Test User',
      password: 'securePass1',
      role: 'read_only',
    });
    expect(res.status).toBe(409);
  });

  it.each([
    'tenant_admin',
    'compliance_officer',
    'compliance_analyst',
    'operator',
    'read_only',
  ])('returns 201 for valid role: %s', async (role) => {
    mockDbEmpty();                          // SELECT – no existing user
    mockDbEmpty();                          // INSERT – user created

    const res = await request(app).post('/register').send({
      email: `user+${role}@example.com`,
      full_name: 'Test User',
      password: 'securePass123',
      role,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('verification code');
  });

  it('includes debug_otp when NODE_ENV is not production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    mockDbEmpty(); // SELECT
    mockDbEmpty(); // INSERT

    const res = await request(app).post('/register').send({
      email: 'otp@example.com',
      full_name: 'Test User',
      password: 'securePass123',
      role: 'read_only',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('debug_otp');
    expect(res.body.data.debug_otp).toMatch(/^\d{6}$/);

    process.env.NODE_ENV = original;
  });
});

// ─── POST /verify-otp ─────────────────────────────────────────────────────────

describe('POST /verify-otp', () => {
  it('returns 400 for non-numeric OTP', async () => {
    const res = await request(app).post('/verify-otp').send({
      email: 'user@example.com',
      otp: 'abcdef',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for OTP not 6 digits', async () => {
    const res = await request(app).post('/verify-otp').send({
      email: 'user@example.com',
      otp: '123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    mockDbEmpty(); // SELECT returns nothing

    const res = await request(app).post('/verify-otp').send({
      email: 'noone@example.com',
      otp: '123456',
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when account is already verified', async () => {
    mockDbRows([
      { id: 'uid', email: 'user@example.com', role: 'read_only',
        permissions: [], tenant_id: null, products: [], is_email_verified: true },
    ]);

    const res = await request(app).post('/verify-otp').send({
      email: 'user@example.com',
      otp: '123456',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_VERIFIED');
  });

  it('returns 401 when OTP is invalid (Redis returns null)', async () => {
    mockDbRows([
      { id: 'uid', email: 'user@example.com', role: 'read_only',
        permissions: [], tenant_id: null, products: [], is_email_verified: false },
    ]);
    // Redis get returns null → OTP not found / expired
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app).post('/verify-otp').send({
      email: 'user@example.com',
      otp: '999999',
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 + JWT on correct OTP', async () => {
    const crypto = require('crypto');
    const correctOtp = '654321';
    const hashedOtp = crypto.createHash('sha256').update(correctOtp).digest('hex');

    // SELECT user
    mockDbRows([
      { id: 'uid', email: 'user@example.com', role: 'read_only',
        permissions: [], tenant_id: null, products: [], is_email_verified: false },
    ]);
    // Redis returns matching hash
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(hashedOtp);
    // UPDATE to mark verified
    mockDbEmpty();

    // Set JWT_SECRET for signing
    process.env.JWT_SECRET = 'test-secret';

    const res = await request(app).post('/verify-otp').send({
      email: 'user@example.com',
      otp: correctOtp,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe('user@example.com');
  });
});

// ─── POST /resend-otp ─────────────────────────────────────────────────────────

describe('POST /resend-otp', () => {
  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/resend-otp').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 200 (with neutral message) when user is not found', async () => {
    mockDbEmpty(); // user not found

    const res = await request(app).post('/resend-otp').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 (with neutral message) when user is already verified', async () => {
    mockDbRows([{ id: 'uid', is_email_verified: true }]);

    const res = await request(app).post('/resend-otp').send({ email: 'done@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 and sends new OTP for unverified account', async () => {
    mockDbRows([{ id: 'uid', is_email_verified: false }]);

    process.env.NODE_ENV = 'test';

    const res = await request(app).post('/resend-otp').send({ email: 'unverified@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('debug_otp');
    expect(res.body.data.debug_otp).toMatch(/^\d{6}$/);
  });
});
