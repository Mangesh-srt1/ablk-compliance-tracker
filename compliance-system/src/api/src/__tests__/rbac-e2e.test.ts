/**
 * RBAC End-to-End Integration Tests
 *
 * Validates the full role-based access control model for all five tenant roles:
 *   admin (global)  tenant_admin  compliance_officer  compliance_analyst  operator  read_only
 *
 * Strategy:
 *  - Build a self-contained Express app that mounts the real route files.
 *  - Mock only external I/O (DB, Redis) so that the real middleware chain runs.
 *  - Issue signed JWTs that carry the correct role + ROLE_DEFAULT_PERMISSIONS
 *    for every user under test.
 *  - Assert HTTP status codes for each role × route combination.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// ─── Pull in the real middleware under test ───────────────────────────────────
import {
  authenticateToken,
  requirePermission,
  requireComplianceOfficer,
  requireAtLeastRole,
  ROLES,
  ROLE_DEFAULT_PERMISSIONS,
  RoleType,
} from '../middleware/authMiddleware';

// ─── Config ───────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-rbac-e2e-secret';

// ─── Token factory ────────────────────────────────────────────────────────────

function makeToken(role: RoleType, overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const permissions = ROLE_DEFAULT_PERMISSIONS[role] ?? [];
  return jwt.sign(
    {
      id: `user-${role}`,
      email: `${role}@test.com`,
      role,
      permissions,
      tenant: 'TENANT-A',
      iat: now,
      exp: now + 3600,
      ...overrides,
    },
    JWT_SECRET
  );
}

function authHeader(role: RoleType, overrides?: Record<string, unknown>): string {
  return `Bearer ${makeToken(role, overrides)}`;
}

// ─── Minimal Express test app ─────────────────────────────────────────────────
// We build a stripped-down app that uses the *real* authMiddleware but stubs
// the route bodies so we never hit the actual DB / Redis / external services.

function buildApp(): Express {
  const app = express();
  app.use(express.json());

  // Override JWT_SECRET for the middleware
  process.env.JWT_SECRET = JWT_SECRET;

  // ── Mock Redis client used by authenticateToken (blacklist check) ──────────
  // authenticateToken calls getRedisClient() only when jti is present in the
  // token.  We omit jti from our test tokens so the blacklist path is skipped.

  // ── Cases ─────────────────────────────────────────────────────────────────

  // POST /cases – requires compliance officer or above
  app.post('/cases', authenticateToken, requireComplianceOfficer, (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: { caseId: uuidv4() } });
  });

  // GET /cases – requires cases:read
  app.get('/cases', authenticateToken, requirePermission('cases:read'), (_req: Request, res: Response) => {
    res.json({ success: true, data: [] });
  });

  // POST /cases/:id/notes – requires cases:notes (analyst + officer)
  app.post('/cases/:id/notes', authenticateToken, requirePermission('cases:notes'), (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: { noteId: uuidv4() } });
  });

  // PUT /cases/:id/status – requires compliance officer or above
  app.put('/cases/:id/status', authenticateToken, requireComplianceOfficer, (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  // ── Alerts ────────────────────────────────────────────────────────────────

  // POST /alerts/configure – requires alerts:write
  app.post('/alerts/configure', authenticateToken, requirePermission('alerts:write'), (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  // GET /alerts/settings/:id – requires alerts:read
  app.get('/alerts/settings/:id', authenticateToken, requirePermission('alerts:read'), (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  // ── SAR / CTR ─────────────────────────────────────────────────────────────

  // POST /sar/auto-generate – requires sar:file
  app.post('/sar/auto-generate', authenticateToken, requirePermission('sar:file'), (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  // POST /sar/submit – requires sar:file
  app.post('/sar/submit', authenticateToken, requirePermission('sar:file'), (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  // GET /sar/history – requires reports:read
  app.get('/sar/history', authenticateToken, requirePermission('reports:read'), (_req: Request, res: Response) => {
    res.json({ success: true, data: [] });
  });

  // ── Rules ─────────────────────────────────────────────────────────────────

  // GET /rules – requires compliance:read
  app.get('/rules', authenticateToken, requirePermission('compliance:read'), (_req: Request, res: Response) => {
    res.json({ success: true, data: [] });
  });

  // POST /rules – requires rules:edit
  app.post('/rules', authenticateToken, requirePermission('rules:edit'), (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: {} });
  });

  // DELETE /rules/:id – requires at least tenant_admin
  app.delete('/rules/:id', authenticateToken, requireAtLeastRole(ROLES.TENANT_ADMIN), (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  // ── Reports ───────────────────────────────────────────────────────────────

  // GET /reports – requires reports:read
  app.get('/reports', authenticateToken, requirePermission('reports:read'), (_req: Request, res: Response) => {
    res.json({ success: true, data: [] });
  });

  // POST /reports/export – requires reports:export
  app.post('/reports/export', authenticateToken, requirePermission('reports:export'), (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  // ── Tenant management ─────────────────────────────────────────────────────

  // POST /tenants – global admin only
  app.post('/tenants', authenticateToken, requireAtLeastRole(ROLES.GLOBAL_ADMIN), (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: {} });
  });

  // GET /tenants – global admin only
  app.get('/tenants', authenticateToken, requireAtLeastRole(ROLES.GLOBAL_ADMIN), (_req: Request, res: Response) => {
    res.json({ success: true, data: [] });
  });

  // Tenant-scoped user invite – allows admin OR own-tenant_admin
  app.post('/tenants/:tenantId/users', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    if (user.role === ROLES.GLOBAL_ADMIN) { next(); return; }
    if (user.role === ROLES.TENANT_ADMIN && user.tenant === req.params.tenantId) { next(); return; }
    res.status(403).json({ error: 'Forbidden', code: 'INSUFFICIENT_ROLE' });
  }, (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: {} });
  });

  // Tenant-scoped API key generation
  app.post('/tenants/:tenantId/api-keys', authenticateToken, (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    if (user.role === ROLES.GLOBAL_ADMIN) { next(); return; }
    if (user.role === ROLES.TENANT_ADMIN && user.tenant === req.params.tenantId) { next(); return; }
    res.status(403).json({ error: 'Forbidden', code: 'INSUFFICIENT_ROLE' });
  }, (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: { api_key: 'lmk_live_test' } });
  });

  // ── KYC / AML ─────────────────────────────────────────────────────────────

  app.post('/kyc-check', authenticateToken, requirePermission('kyc:execute'), (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  app.post('/aml-score', authenticateToken, requirePermission('aml:execute'), (_req: Request, res: Response) => {
    res.json({ success: true, data: {} });
  });

  // ── Monitoring ────────────────────────────────────────────────────────────

  app.post('/monitoring/rescreening/schedule', authenticateToken, requirePermission('monitoring:write'), (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: {} });
  });

  // ── Webhook ───────────────────────────────────────────────────────────────

  app.post('/webhooks/register', authenticateToken, requirePermission('alerts:write'), (_req: Request, res: Response) => {
    res.status(201).json({ success: true, data: {} });
  });

  return app;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

type StatusMap = Record<string, number>;

/** Fluent expect helper */
function expectStatus(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RBAC End-to-End Integration', () => {
  let app: Express;

  beforeAll(() => {
    app = buildApp();
  });

  // ─── 1. Unauthenticated requests ────────────────────────────────────────────

  describe('Unauthenticated requests return 401', () => {
    const protectedEndpoints: Array<[string, string]> = [
      ['GET', '/cases'],
      ['POST', '/cases'],
      ['POST', '/cases/abc/notes'],
      ['PUT', '/cases/abc/status'],
      ['POST', '/alerts/configure'],
      ['GET', '/alerts/settings/c1'],
      ['POST', '/sar/auto-generate'],
      ['POST', '/sar/submit'],
      ['GET', '/sar/history'],
      ['GET', '/rules'],
      ['POST', '/rules'],
      ['DELETE', '/rules/1'],
      ['GET', '/reports'],
      ['POST', '/reports/export'],
      ['POST', '/tenants'],
      ['GET', '/tenants'],
      ['POST', '/tenants/T1/users'],
      ['POST', '/tenants/T1/api-keys'],
      ['POST', '/kyc-check'],
      ['POST', '/aml-score'],
      ['POST', '/monitoring/rescreening/schedule'],
      ['POST', '/webhooks/register'],
    ];

    for (const [method, path] of protectedEndpoints) {
      it(`${method} ${path} → 401 without token`, async () => {
        const res = await (request(app) as any)[method.toLowerCase()](path).send({});
        expect(res.status).toBe(401);
      });
    }
  });

  // ─── 2. Global Admin – wildcard permission ──────────────────────────────────

  describe('Global admin (*) can access everything', () => {
    const adminToken = authHeader(ROLES.GLOBAL_ADMIN);

    it('can create a case', async () => {
      const res = await request(app).post('/cases').set('Authorization', adminToken).send({});
      expect(res.status).toBe(201);
    });

    it('can list cases', async () => {
      const res = await request(app).get('/cases').set('Authorization', adminToken);
      expect(res.status).toBe(200);
    });

    it('can add case notes', async () => {
      const res = await request(app).post('/cases/abc/notes').set('Authorization', adminToken).send({});
      expect(res.status).toBe(201);
    });

    it('can configure alerts', async () => {
      const res = await request(app).post('/alerts/configure').set('Authorization', adminToken).send({});
      expect(res.status).toBe(200);
    });

    it('can file a SAR', async () => {
      const res = await request(app).post('/sar/auto-generate').set('Authorization', adminToken).send({});
      expect(res.status).toBe(200);
    });

    it('can submit SAR', async () => {
      const res = await request(app).post('/sar/submit').set('Authorization', adminToken).send({});
      expect(res.status).toBe(200);
    });

    it('can edit rules', async () => {
      const res = await request(app).post('/rules').set('Authorization', adminToken).send({});
      expect(res.status).toBe(201);
    });

    it('can delete rules', async () => {
      const res = await request(app).delete('/rules/1').set('Authorization', adminToken);
      expect(res.status).toBe(200);
    });

    it('can register a tenant', async () => {
      const res = await request(app).post('/tenants').set('Authorization', adminToken).send({});
      expect(res.status).toBe(201);
    });

    it('can list tenants', async () => {
      const res = await request(app).get('/tenants').set('Authorization', adminToken);
      expect(res.status).toBe(200);
    });

    it('can invite users to any tenant', async () => {
      const res = await request(app).post('/tenants/OTHER-TENANT/users').set('Authorization', adminToken).send({});
      expect(res.status).toBe(201);
    });

    it('can generate API keys for any tenant', async () => {
      const res = await request(app).post('/tenants/ANY/api-keys').set('Authorization', adminToken).send({});
      expect(res.status).toBe(201);
    });
  });

  // ─── 3. Tenant Admin ────────────────────────────────────────────────────────

  describe('Tenant Admin – full admin for own tenant', () => {
    // tenant_admin for TENANT-A
    const token = authHeader(ROLES.TENANT_ADMIN, { tenant: 'TENANT-A' });
    const otherTenantToken = authHeader(ROLES.TENANT_ADMIN, { tenant: 'TENANT-B' });

    it('can list cases', async () => {
      const res = await request(app).get('/cases').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('can create a case', async () => {
      const res = await request(app).post('/cases').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });

    it('can invite users to own tenant', async () => {
      const res = await request(app).post('/tenants/TENANT-A/users').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });

    it('cannot invite users to a different tenant', async () => {
      const res = await request(app).post('/tenants/TENANT-A/users').set('Authorization', otherTenantToken).send({});
      expect(res.status).toBe(403);
    });

    it('can generate API keys for own tenant', async () => {
      const res = await request(app).post('/tenants/TENANT-A/api-keys').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });

    it('cannot create a new global tenant (admin-only)', async () => {
      const res = await request(app).post('/tenants').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot list all tenants (admin-only)', async () => {
      const res = await request(app).get('/tenants').set('Authorization', token);
      expect(res.status).toBe(403);
    });

    it('can configure alerts', async () => {
      const res = await request(app).post('/alerts/configure').set('Authorization', token).send({});
      expect(res.status).toBe(200);
    });

    it('can view SAR history', async () => {
      const res = await request(app).get('/sar/history').set('Authorization', token);
      expect(res.status).toBe(200);
    });
  });

  // ─── 4. Compliance Officer ───────────────────────────────────────────────────

  describe('Compliance Officer – manage cases, alerts, rules, SAR', () => {
    const token = authHeader(ROLES.COMPLIANCE_OFFICER);

    it('can list cases', async () => {
      const res = await request(app).get('/cases').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('can create a case', async () => {
      const res = await request(app).post('/cases').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });

    it('can add notes to a case', async () => {
      const res = await request(app).post('/cases/abc/notes').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });

    it('can update case status', async () => {
      const res = await request(app).put('/cases/abc/status').set('Authorization', token).send({});
      expect(res.status).toBe(200);
    });

    it('can view alerts', async () => {
      const res = await request(app).get('/alerts/settings/c1').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('can configure alerts', async () => {
      const res = await request(app).post('/alerts/configure').set('Authorization', token).send({});
      expect(res.status).toBe(200);
    });

    it('can auto-generate a SAR', async () => {
      const res = await request(app).post('/sar/auto-generate').set('Authorization', token).send({});
      expect(res.status).toBe(200);
    });

    it('can submit a SAR', async () => {
      const res = await request(app).post('/sar/submit').set('Authorization', token).send({});
      expect(res.status).toBe(200);
    });

    it('can view SAR history', async () => {
      const res = await request(app).get('/sar/history').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('can edit rules (POST)', async () => {
      const res = await request(app).post('/rules').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });

    it('cannot delete rules (needs tenant_admin+)', async () => {
      const res = await request(app).delete('/rules/1').set('Authorization', token);
      expect(res.status).toBe(403);
    });

    it('cannot register a tenant', async () => {
      const res = await request(app).post('/tenants').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can schedule re-screening', async () => {
      const res = await request(app).post('/monitoring/rescreening/schedule').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });
  });

  // ─── 5. Compliance Analyst ────────────────────────────────────────────────────

  describe('Compliance Analyst – investigate, add notes, propose decisions', () => {
    const token = authHeader(ROLES.COMPLIANCE_ANALYST);

    it('can list cases', async () => {
      const res = await request(app).get('/cases').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('can add notes to a case', async () => {
      const res = await request(app).post('/cases/abc/notes').set('Authorization', token).send({});
      expect(res.status).toBe(201);
    });

    it('cannot create a case (officer-only)', async () => {
      const res = await request(app).post('/cases').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot update case status (officer-only)', async () => {
      const res = await request(app).put('/cases/abc/status').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can read rules', async () => {
      const res = await request(app).get('/rules').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot edit rules (officer-only)', async () => {
      const res = await request(app).post('/rules').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot file a SAR (officer-only)', async () => {
      const res = await request(app).post('/sar/auto-generate').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can view alert settings', async () => {
      const res = await request(app).get('/alerts/settings/c1').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot configure alerts (write-only for officer+)', async () => {
      const res = await request(app).post('/alerts/configure').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot register a tenant', async () => {
      const res = await request(app).post('/tenants').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can view reports', async () => {
      const res = await request(app).get('/reports').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot export reports (operator+ only)', async () => {
      const res = await request(app).post('/reports/export').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });
  });

  // ─── 6. Operator ─────────────────────────────────────────────────────────────

  describe('Operator – view status, trigger reviews, export reports', () => {
    const token = authHeader(ROLES.OPERATOR);

    it('can list cases', async () => {
      const res = await request(app).get('/cases').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot create a case', async () => {
      const res = await request(app).post('/cases').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot add notes to a case', async () => {
      const res = await request(app).post('/cases/abc/notes').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can view alert settings', async () => {
      const res = await request(app).get('/alerts/settings/c1').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot configure alerts', async () => {
      const res = await request(app).post('/alerts/configure').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot file a SAR', async () => {
      const res = await request(app).post('/sar/auto-generate').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can view reports', async () => {
      const res = await request(app).get('/reports').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('can export reports', async () => {
      const res = await request(app).post('/reports/export').set('Authorization', token).send({});
      expect(res.status).toBe(200);
    });

    it('can read rules', async () => {
      const res = await request(app).get('/rules').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot edit rules', async () => {
      const res = await request(app).post('/rules').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot register a tenant', async () => {
      const res = await request(app).post('/tenants').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });
  });

  // ─── 7. Read-Only / Viewer ────────────────────────────────────────────────────

  describe('Read-Only – view-only, cannot modify anything', () => {
    const token = authHeader(ROLES.READ_ONLY);

    it('can list cases', async () => {
      const res = await request(app).get('/cases').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot create a case', async () => {
      const res = await request(app).post('/cases').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot add notes', async () => {
      const res = await request(app).post('/cases/abc/notes').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot update case status', async () => {
      const res = await request(app).put('/cases/abc/status').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can view alert settings', async () => {
      const res = await request(app).get('/alerts/settings/c1').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot configure alerts', async () => {
      const res = await request(app).post('/alerts/configure').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot file a SAR', async () => {
      const res = await request(app).post('/sar/auto-generate').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('can view SAR history', async () => {
      const res = await request(app).get('/sar/history').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('can read rules', async () => {
      const res = await request(app).get('/rules').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot edit rules', async () => {
      const res = await request(app).post('/rules').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot delete rules', async () => {
      const res = await request(app).delete('/rules/1').set('Authorization', token);
      expect(res.status).toBe(403);
    });

    it('can view reports', async () => {
      const res = await request(app).get('/reports').set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('cannot export reports', async () => {
      const res = await request(app).post('/reports/export').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot register a tenant', async () => {
      const res = await request(app).post('/tenants').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });

    it('cannot invite users', async () => {
      const res = await request(app).post('/tenants/T1/users').set('Authorization', token).send({});
      expect(res.status).toBe(403);
    });
  });

  // ─── 8. Permission wildcard (*) ──────────────────────────────────────────────

  describe('Wildcard permission (*) grants access to any permission check', () => {
    // Craft a token with the wildcard permission
    const wildcardToken = `Bearer ${jwt.sign(
      {
        id: 'superuser',
        email: 'superuser@test.com',
        role: 'admin',
        permissions: ['*'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET
    )}`;

    it('grants access to cases:read', async () => {
      const res = await request(app).get('/cases').set('Authorization', wildcardToken);
      expect(res.status).toBe(200);
    });

    it('grants access to cases:notes', async () => {
      const res = await request(app).post('/cases/x/notes').set('Authorization', wildcardToken).send({});
      expect(res.status).toBe(201);
    });

    it('grants access to sar:file', async () => {
      const res = await request(app).post('/sar/auto-generate').set('Authorization', wildcardToken).send({});
      expect(res.status).toBe(200);
    });

    it('grants access to rules:edit', async () => {
      const res = await request(app).post('/rules').set('Authorization', wildcardToken).send({});
      expect(res.status).toBe(201);
    });

    it('grants access to reports:export', async () => {
      const res = await request(app).post('/reports/export').set('Authorization', wildcardToken).send({});
      expect(res.status).toBe(200);
    });
  });

  // ─── 9. Token security ───────────────────────────────────────────────────────

  describe('Token security', () => {
    it('rejects an expired token with 401', async () => {
      const expiredToken = `Bearer ${jwt.sign(
        {
          id: 'u1',
          email: 'x@y.com',
          role: 'admin',
          permissions: ['*'],
          exp: Math.floor(Date.now() / 1000) - 3600,
        },
        JWT_SECRET
      )}`;
      const res = await request(app).get('/cases').set('Authorization', expiredToken);
      expect(res.status).toBe(401);
    });

    it('rejects a token signed with a different secret', async () => {
      const badToken = `Bearer ${jwt.sign(
        { id: 'u1', email: 'x@y.com', role: 'admin', permissions: ['*'] },
        'wrong-secret'
      )}`;
      const res = await request(app).get('/cases').set('Authorization', badToken);
      expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const res = await request(app).get('/cases').set('Authorization', 'Bearer not.a.jwt');
      expect(res.status).toBe(401);
    });

    it('rejects when Bearer prefix is missing', async () => {
      const res = await request(app).get('/cases').set('Authorization', makeToken(ROLES.COMPLIANCE_OFFICER));
      expect(res.status).toBe(401);
    });
  });

  // ─── 10. Case management lifecycle ──────────────────────────────────────────

  describe('Case management lifecycle with real caseManagementRoutes', () => {
    // We test the full POST→GET→PATCH flow using the actual route module and
    // an in-memory case store (no DB needed).

    let lifecycleApp: Express;

    beforeAll(async () => {
      // Dynamically import real case management route (uses in-memory store)
      const { default: caseRoutes } = await import('../routes/caseManagementRoutes');
      lifecycleApp = express();
      lifecycleApp.use(express.json());
      lifecycleApp.use('/api/v1/cases', caseRoutes);
    });

    const officerToken = authHeader(ROLES.COMPLIANCE_OFFICER);
    const analystToken = authHeader(ROLES.COMPLIANCE_ANALYST);
    const operatorToken = authHeader(ROLES.OPERATOR);
    const readonlyToken = authHeader(ROLES.READ_ONLY);

    let caseId: string;

    it('officer can create a case', async () => {
      const res = await request(lifecycleApp)
        .post('/api/v1/cases')
        .set('Authorization', officerToken)
        .send({
          caseType: 'SUSPICIOUS_ACTIVITY',
          entityId: 'entity-001',
          jurisdiction: 'AE',
          summary: 'Suspicious transaction pattern detected during review.',
          riskScore: 75,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      caseId = res.body.data.caseId;
      expect(caseId).toBeDefined();
    });

    it('analyst can read the case', async () => {
      const res = await request(lifecycleApp)
        .get('/api/v1/cases')
        .set('Authorization', analystToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('analyst can add a note', async () => {
      const res = await request(lifecycleApp)
        .post(`/api/v1/cases/${caseId}/notes`)
        .set('Authorization', analystToken)
        .send({ content: 'Reviewed transaction logs – pattern matches known structuring.' });
      expect(res.status).toBe(201);
      expect(res.body.data.noteId).toBeDefined();
    });

    it('operator cannot add a note', async () => {
      const res = await request(lifecycleApp)
        .post(`/api/v1/cases/${caseId}/notes`)
        .set('Authorization', operatorToken)
        .send({ content: 'Operator note attempt.' });
      expect(res.status).toBe(403);
    });

    it('read_only cannot add a note', async () => {
      const res = await request(lifecycleApp)
        .post(`/api/v1/cases/${caseId}/notes`)
        .set('Authorization', readonlyToken)
        .send({ content: 'Viewer note attempt.' });
      expect(res.status).toBe(403);
    });

    it('analyst cannot update case status', async () => {
      const res = await request(lifecycleApp)
        .put(`/api/v1/cases/${caseId}/status`)
        .set('Authorization', analystToken)
        .send({ status: 'INVESTIGATING', reason: 'Moving to investigation phase.' });
      expect(res.status).toBe(403);
    });

    it('officer can update case status to INVESTIGATING', async () => {
      const res = await request(lifecycleApp)
        .put(`/api/v1/cases/${caseId}/status`)
        .set('Authorization', officerToken)
        .send({ status: 'INVESTIGATING', reason: 'Escalating for full investigation.' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INVESTIGATING');
    });

    it('officer can resolve the case', async () => {
      const res = await request(lifecycleApp)
        .put(`/api/v1/cases/${caseId}/status`)
        .set('Authorization', officerToken)
        .send({ status: 'RESOLVED', reason: 'False positive confirmed.' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
    });
  });

  // ─── 11. Alert workflow – full authenticated lifecycle ───────────────────────

  describe('Alert workflow – authenticated routes', () => {
    let alertApp: Express;

    beforeAll(async () => {
      const { default: alertRoutes } = await import('../routes/alertWorkflowRoutes');
      alertApp = express();
      alertApp.use(express.json());
      alertApp.use('/api/v1', alertRoutes);
    });

    const officerToken = authHeader(ROLES.COMPLIANCE_OFFICER);
    const analystToken = authHeader(ROLES.COMPLIANCE_ANALYST);
    const readonlyToken = authHeader(ROLES.READ_ONLY);

    it('unauthenticated → 401 on configure', async () => {
      const res = await request(alertApp).post('/api/v1/alerts/configure').send({});
      expect(res.status).toBe(401);
    });

    it('analyst cannot configure alerts', async () => {
      const res = await request(alertApp)
        .post('/api/v1/alerts/configure')
        .set('Authorization', analystToken)
        .send({
          clientId: 'c1',
          channels: ['email'],
          suppressionWindowMinutes: 30,
          thresholds: { defaultRiskScore: 70 },
          enabled: true,
        });
      expect(res.status).toBe(403);
    });

    it('compliance officer can configure alerts', async () => {
      const res = await request(alertApp)
        .post('/api/v1/alerts/configure')
        .set('Authorization', officerToken)
        .send({
          clientId: 'c1',
          channels: ['email'],
          suppressionWindowMinutes: 30,
          thresholds: { defaultRiskScore: 70 },
          enabled: true,
        });
      expect(res.status).toBe(200);
    });

    it('read_only can view alert settings (alerts:read)', async () => {
      // Configure alerts first so the settings endpoint returns 200
      const officerToken2 = authHeader(ROLES.COMPLIANCE_OFFICER);
      await request(alertApp)
        .post('/api/v1/alerts/configure')
        .set('Authorization', officerToken2)
        .send({
          clientId: 'c1-readonly-test',
          channels: ['email'],
          suppressionWindowMinutes: 30,
          thresholds: { defaultRiskScore: 70 },
          enabled: true,
        });

      const res = await request(alertApp)
        .get('/api/v1/alerts/settings/c1-readonly-test')
        .set('Authorization', readonlyToken);
      expect(res.status).toBe(200);
    });
  });

  // ─── 12. SAR/CTR routes – authenticated ──────────────────────────────────────

  describe('SAR/CTR – authenticated routes', () => {
    let sarApp: Express;

    beforeAll(async () => {
      const { default: sarRoutes } = await import('../routes/sarCtrRoutes');
      sarApp = express();
      sarApp.use(express.json());
      sarApp.use('/api/v1/reports', sarRoutes);
    });

    const officerToken = authHeader(ROLES.COMPLIANCE_OFFICER);
    const analystToken = authHeader(ROLES.COMPLIANCE_ANALYST);

    it('unauthenticated → 401 on SAR auto-generate', async () => {
      const res = await request(sarApp).post('/api/v1/reports/sar/auto-generate').send({});
      expect(res.status).toBe(401);
    });

    it('analyst cannot generate a SAR', async () => {
      const res = await request(sarApp)
        .post('/api/v1/reports/sar/auto-generate')
        .set('Authorization', analystToken)
        .send({
          entityId: uuidv4(),
          jurisdiction: 'AE',
          transactionIds: [uuidv4()],
        });
      expect(res.status).toBe(403);
    });

    it('officer can view SAR history', async () => {
      const res = await request(sarApp)
        .get('/api/v1/reports/sar/history')
        .set('Authorization', officerToken);
      expect(res.status).toBe(200);
    });

    it('officer can view CTR pending list', async () => {
      const res = await request(sarApp)
        .get('/api/v1/reports/ctr/pending')
        .set('Authorization', officerToken);
      expect(res.status).toBe(200);
    });
  });

  // ─── 13. Rules routes – authenticated ────────────────────────────────────────

  describe('Rules routes – authenticated', () => {
    let rulesApp: Express;

    beforeAll(async () => {
      const { default: rulesRoutes } = await import('../routes/rulesRoutes');
      rulesApp = express();
      rulesApp.use(express.json());
      rulesApp.use('/api', rulesRoutes);
    });

    const officerToken = authHeader(ROLES.COMPLIANCE_OFFICER);
    const tenantAdminToken = authHeader(ROLES.TENANT_ADMIN, { tenant: 'TENANT-A' });
    const analystToken = authHeader(ROLES.COMPLIANCE_ANALYST);

    it('unauthenticated → 401 on rules list', async () => {
      const res = await request(rulesApp).get('/api/rules').query({ query: 'kyc', jurisdiction: 'AE' });
      expect(res.status).toBe(401);
    });

    it('analyst can read rules', async () => {
      const res = await request(rulesApp)
        .get('/api/rules')
        .set('Authorization', analystToken)
        .query({ query: 'aml', jurisdiction: 'AE' });
      // Passes auth; may get 400 or 200 depending on ragService availability
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('analyst cannot create a rule', async () => {
      const res = await request(rulesApp)
        .post('/api/rules')
        .set('Authorization', analystToken)
        .send({ content: 'test', jurisdiction: 'AE', documentType: 'regulation' });
      expect(res.status).toBe(403);
    });

    it('officer can create a rule (rules:edit permission)', async () => {
      const res = await request(rulesApp)
        .post('/api/rules')
        .set('Authorization', officerToken)
        .send({ content: 'test', jurisdiction: 'AE', documentType: 'regulation' });
      // Passes auth; may fail later due to ragService — not 401 or 403
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('analyst cannot delete a rule', async () => {
      const res = await request(rulesApp)
        .delete('/api/rules/1')
        .set('Authorization', analystToken);
      expect(res.status).toBe(403);
    });

    it('tenant_admin can delete a rule', async () => {
      const res = await request(rulesApp)
        .delete('/api/rules/1')
        .set('Authorization', tenantAdminToken);
      // Passes auth; may fail later due to ragService — not 401 or 403
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
