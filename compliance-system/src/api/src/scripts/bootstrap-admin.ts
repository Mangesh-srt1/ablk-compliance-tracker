#!/usr/bin/env ts-node
/**
 * Bootstrap Script: Create Platform Admin User
 *
 * Creates the platform-level admin account (admin@platform.com) if it does
 * not already exist.  This mirrors the approach used in the pe-toknsn-pi-hub
 * reference repo where admin@platform.com is seeded during first-run setup.
 *
 * Usage:
 *   npx ts-node src/api/src/scripts/bootstrap-admin.ts
 *
 * Environment variables required (or defaults apply):
 *   ADMIN_EMAIL    – defaults to admin@platform.com
 *   ADMIN_PASSWORD – defaults to Admin@Platform1  (CHANGE IN PRODUCTION)
 *   DATABASE_URL   – PostgreSQL connection string
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { ROLE_DEFAULT_PERMISSIONS, ROLES } from '../middleware/authMiddleware';

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@platform.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@Platform1';
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'Platform Administrator';

async function bootstrapAdmin(): Promise<void> {
  console.log('Connecting to database...');
  await db.connect();

  // Check whether admin already exists
  const existing = await db.query('SELECT id, email FROM users WHERE email = $1', [ADMIN_EMAIL]);
  if (existing.rows.length > 0) {
    console.log(`✅  Platform admin already exists: ${ADMIN_EMAIL} (id: ${existing.rows[0].id})`);
    return;
  }

  const passwordHash   = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const permissions    = ROLE_DEFAULT_PERMISSIONS[ROLES.GLOBAL_ADMIN] ?? ['*'];
  const id             = uuidv4();

  await db.query(
    `INSERT INTO users
       (id, email, full_name, role, password_hash, active)
     VALUES ($1, $2, $3, 'admin', $4, true)`,
    [id, ADMIN_EMAIL, ADMIN_NAME, passwordHash]
  );

  console.log(`✅  Platform admin created successfully.`);
  console.log(`    Email   : ${ADMIN_EMAIL}`);
  console.log(`    Password: ${ADMIN_PASSWORD}`);
  console.log(`    ID      : ${id}`);
  console.log('');
  console.log('⚠️   IMPORTANT: Change the default password before deploying to production!');
}

bootstrapAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  });
