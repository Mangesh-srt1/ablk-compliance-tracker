/**
 * Unit tests for the self-registration OTP flow:
 *   POST /api/auth/register
 *   POST /api/auth/verify-otp
 *   POST /api/auth/resend-otp
 */

import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../config/database');
jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
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

/** Pre-hashed version of 'correctPassword' with bcrypt cost 1 (fast in tests). */
let TEST_HASH: string;
beforeAll(async () => {
  TEST_HASH = await bcrypt.hash('correctPassword', 1);
});

beforeEach(() => {
  jest.clearAllMocks();
  // Reset redis mock
  const redis = getRedisClient();
  (redis.get as jest.Mock).mockResolvedValue(null);
  (redis.set as jest.Mock).mockResolvedValue('OK');
  (redis.del as jest.Mock).mockResolvedValue(1);
  (redis.incr as jest.Mock).mockResolvedValue(1);   // first request in window
  (redis.expire as jest.Mock).mockResolvedValue(1);
});

// JWT_SECRET is set once for all tests that need it (avoids env pollution per-test)
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

// ─── POST /login ──────────────────────────────────────────────────────────────

describe('POST /login', () => {
  it('returns 401 for a pending_approval user (not yet approved by admin)', async () => {
    // DB returns no rows because the query now filters is_active=true AND approval_status='approved'
    mockDbEmpty();

    const res = await request(app).post('/login').send({
      email: 'pending@example.com',
      password: 'securePass1',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for completely unknown email', async () => {
    mockDbEmpty();

    const res = await request(app).post('/login').send({
      email: 'nobody@example.com',
      password: 'securePass1',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    mockDbRows([{ id: 'uid', email: 'user@example.com', password_hash: TEST_HASH, role: 'read_only' }]);

    const res = await request(app).post('/login').send({
      email: 'user@example.com',
      password: 'wrongPassword',
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with JWT for an approved, active user', async () => {
    mockDbRows([{ id: 'uid', email: 'user@example.com', password_hash: TEST_HASH, role: 'read_only' }]);

    const res = await request(app).post('/login').send({
      email: 'user@example.com',
      password: 'correctPassword',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
  });
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

  it('returns 200 with pending approval state on correct OTP', async () => {
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
    // UPDATE to mark verified + pending_approval
    mockDbEmpty();

    const res = await request(app).post('/verify-otp').send({
      email: 'user@example.com',
      otp: correctOtp,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // No JWT is issued – account awaits admin approval
    expect(res.body.data).not.toHaveProperty('token');
    expect(res.body.data.requiresAdminApproval).toBe(true);
    expect(res.body.data.user.email).toBe('user@example.com');
    expect(res.body.data.message).toMatch(/pending approval/i);
  });
});

// ─── POST /resend-otp ─────────────────────────────────────────────────────────

describe('POST /resend-otp', () => {
  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/resend-otp').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    // incr returns > OTP_RATE_LIMIT (5)
    (getRedisClient().incr as jest.Mock).mockResolvedValueOnce(6);

    const res = await request(app).post('/resend-otp').send({ email: 'limited@example.com' });
    expect(res.status).toBe(429);
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

// ─── Admin approval endpoints ─────────────────────────────────────────────────

/**
 * Helper: generate a signed JWT for the test admin user.
 * This mirrors what the real login endpoint would produce.
 * JWT_SECRET is set in beforeAll above.
 */
function makeAdminToken(): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      id: 'admin-uid',
      email: 'admin@platform.com',
      role: 'admin',
      permissions: ['*'],
      jti: 'admin-jti-1',
    },
    'test-secret',
    { expiresIn: '1h', issuer: 'compliance-api', audience: 'compliance-client' }
  );
}

function makeUserToken(role = 'read_only'): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      id: 'user-uid',
      email: 'user@example.com',
      role,
      permissions: [],
      jti: 'user-jti-1',
    },
    'test-secret',
    { expiresIn: '1h', issuer: 'compliance-api', audience: 'compliance-client' }
  );
}

describe('GET /admin/pending-users', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/admin/pending-users');
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by a non-admin user', async () => {
    const token = makeUserToken('compliance_officer');
    // JWT verification uses real JWT_SECRET; Redis blacklist check returns null (not blacklisted)
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/admin/pending-users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with list of pending users for admin', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null); // not blacklisted

    const pendingUsers = [
      {
        id: 'pending-uid-1',
        email: 'newuser@example.com',
        full_name: 'New User',
        role: 'compliance_analyst',
        tenant_id: null,
        approval_status: 'pending_approval',
        is_email_verified: true,
        created_at: new Date().toISOString(),
      },
    ];
    mockDbRows(pendingUsers);

    const res = await request(app)
      .get('/admin/pending-users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0].approval_status).toBe('pending_approval');
    expect(res.body.data.total).toBe(1);
  });
});

describe('POST /admin/approve/:userId', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/admin/approve/some-uid');
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by non-admin', async () => {
    const token = makeUserToken('tenant_admin');
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/admin/approve/some-uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when user does not exist', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);
    mockDbEmpty(); // SELECT returns nothing

    const res = await request(app)
      .post('/admin/approve/nonexistent-uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when user is already approved', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);
    mockDbRows([{ id: 'uid', email: 'user@example.com', full_name: 'User', role: 'read_only', approval_status: 'approved' }]);

    const res = await request(app)
      .post('/admin/approve/uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_APPROVED');
  });

  it('returns 200 and activates user on successful approval (admin JWT)', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);
    // Promise.all fires user query and admin-bootstrap query simultaneously:
    mockDbRows([{ id: 'uid', email: 'user@example.com', full_name: 'User', role: 'read_only', approval_status: 'pending_approval' }]); // 1st: user SELECT
    mockDbRows([{ is_bootstrap_admin: false }]); // 2nd: admin bootstrap SELECT
    mockDbEmpty(); // 3rd: UPDATE (approve user)

    const res = await request(app)
      .post('/admin/approve/uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/approved/i);
    expect(res.body.data.user.email).toBe('user@example.com');
  });

  it('suspends the bootstrap admin and blacklists token after approving a user', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null); // not blacklisted
    // Promise.all fires user query and admin-bootstrap query simultaneously:
    mockDbRows([{ id: 'uid', email: 'user@example.com', full_name: 'User', role: 'operator', approval_status: 'pending_approval' }]); // 1st: user SELECT
    mockDbRows([{ is_bootstrap_admin: true }]); // 2nd: admin bootstrap SELECT
    mockDbEmpty(); // 3rd: UPDATE (approve user)
    mockDbEmpty(); // 4th: UPDATE (suspend bootstrap admin)
    // Redis set (blacklist) → already mocked to return 'OK'

    const res = await request(app)
      .post('/admin/approve/uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Token should have been blacklisted
    expect(getRedisClient().set as jest.Mock).toHaveBeenCalledWith(
      expect.stringContaining('jwt_blacklist:'),
      '1',
      'EX',
      expect.any(Number)
    );
  });
});

describe('POST /admin/reject/:userId', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/admin/reject/some-uid');
    expect(res.status).toBe(401);
  });

  it('returns 403 when called by non-admin', async () => {
    const token = makeUserToken('compliance_officer');
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/admin/reject/some-uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when user does not exist', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);
    mockDbEmpty();

    const res = await request(app)
      .post('/admin/reject/nonexistent-uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when user is already rejected', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);
    mockDbRows([{ id: 'uid', email: 'user@example.com', full_name: 'User', role: 'read_only', approval_status: 'rejected' }]);

    const res = await request(app)
      .post('/admin/reject/uid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_REJECTED');
  });

  it('returns 200 on successful rejection', async () => {
    const token = makeAdminToken();
    (getRedisClient().get as jest.Mock).mockResolvedValueOnce(null);
    mockDbRows([{ id: 'uid', email: 'user@example.com', full_name: 'User', role: 'read_only', approval_status: 'pending_approval' }]);
    mockDbEmpty(); // UPDATE

    const res = await request(app)
      .post('/admin/reject/uid')
      .send({ reason: 'Incomplete information' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/rejected/i);
  });
});
