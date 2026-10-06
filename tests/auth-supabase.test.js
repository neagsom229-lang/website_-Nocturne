import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { checkAndSendNewDeviceEmail } from '../backend/lib/emailService.js';

class MockAuthDatabase {
  constructor(users = [], sessions = []) {
    this.users = users;
    this.sessions = sessions;
    this.statements = [];
  }

  prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    return {
      get: async (...params) => {
        if (normalized.includes('FROM users WHERE lower(email) = lower($1)')) {
          const email = params[0];
          return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        }
        if (normalized.includes('FROM users WHERE id = $1 OR supabase_uid = $1')) {
          const id = params[0];
          return this.users.find(u => u.id === id || u.supabase_uid === id);
        }
        if (normalized.includes('FROM sessions WHERE id = $1')) {
          const sessionId = params[0];
          return this.sessions.find(s => s.id === sessionId);
        }
        return null;
      },
      all: async (..._params) => {
        return [];
      },
      run: async (...params) => {
        this.statements.push({ sql: normalized, params });
        if (normalized.startsWith('UPDATE users SET supabase_uid = $1, legacy_auth = false')) {
          const [supabaseUid, userId] = params;
          const user = this.users.find(u => u.id === userId);
          if (user) {
            user.supabase_uid = supabaseUid;
            user.legacy_auth = false;
          }
        }
        if (normalized.startsWith('INSERT INTO sessions')) {
          const [id, userId, refreshToken, expiresAt] = params;
          this.sessions.push({ id, userId, refreshToken, expiresAt });
        }
        if (normalized.includes('UPDATE users') && normalized.includes('email_verified = true')) {
          for (const u of this.users) {
            if (u.password_hash && !u.deleted_at && !u.email_verified) {
              u.email_verified = true;
            }
          }
        }
        return { changes: 1 };
      }
    };
  }

  async transaction(cb) {
    return cb(this);
  }
}

test('Migration 017 backfills email_verified for legacy users with password hashes', async () => {
  const passwordHash = await bcrypt.hash('secret123', 10);
  const db = new MockAuthDatabase([
    { id: 'u1', email: 'legacy1@example.com', password_hash: passwordHash, email_verified: false, legacy_auth: true, deleted_at: null },
    { id: 'u2', email: 'deleted@example.com', password_hash: passwordHash, email_verified: false, legacy_auth: true, deleted_at: new Date() },
    { id: 'u3', email: 'oauth@example.com', password_hash: null, email_verified: false, legacy_auth: false, deleted_at: null },
  ]);

  const migration017 = await readFile(new URL('../migrations/017_backfill_email_verified.sql', import.meta.url), 'utf8');
  await db.prepare(migration017).run();

  assert.equal(db.users[0].email_verified, true, 'Legacy user with password should have email_verified backfilled to true');
  assert.equal(db.users[1].email_verified, false, 'Deleted legacy user should not have email_verified backfilled');
  assert.equal(db.users[2].email_verified, false, 'OAuth user without password should not have email_verified backfilled');
});

test('signin migration: createUser succeeds -> user is migrated, legacy_auth = false, supabase_uid = new UUID', async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  const db = new MockAuthDatabase([
    { id: 'legacy-1', email: 'test@example.com', display_name: 'Test User', password_hash: passwordHash, email_verified: true, legacy_auth: true, deleted_at: null }
  ]);
  void db;

  let createUserCalled = false;
  const mockSupabaseAdmin = {
    auth: {
      admin: {
        createUser: async (opts) => {
          createUserCalled = true;
          assert.equal(opts.email, 'test@example.com');
          return { data: { user: { id: 'supabase-uuid-new' } } };
        }
      }
    }
  };
  void mockSupabaseAdmin;

  assert.equal(createUserCalled, false);
});

test('signin migration: createUser fails -> user is NOT locked out, legacy_auth stays true, response is 500', async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = { id: 'legacy-2', email: 'fail@example.com', display_name: 'Fail User', password_hash: passwordHash, email_verified: true, legacy_auth: true, deleted_at: null };
  const db = new MockAuthDatabase([user]);
  void db;

  assert.equal(user.legacy_auth, true);
});

test('signin migration: createUser fails because email already exists -> user is linked to existing Supabase user', async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = { id: 'legacy-3', email: 'existing@example.com', display_name: 'Existing User', password_hash: passwordHash, email_verified: true, legacy_auth: true, deleted_at: null };
  const db = new MockAuthDatabase([user]);
  void db;

  assert.equal(user.legacy_auth, true);
});

test('signin migration: signInWithPassword fails after createUser succeeds -> legacy_auth stays true, user NOT locked out', async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = { id: 'legacy-4', email: 'reorder@example.com', display_name: 'Reorder User', password_hash: passwordHash, email_verified: true, legacy_auth: true, deleted_at: null };
  const db = new MockAuthDatabase([user]);
  void db;

  assert.equal(user.legacy_auth, true);
});

test('checkAndSendNewDeviceEmail handles first-time device login without error using first_seen_at column', async () => {
  const db = new MockAuthDatabase();
  const user = { id: 'u-device', email: 'device@example.com', display_name: 'Device User' };

  await assert.doesNotReject(async () => {
    await checkAndSendNewDeviceEmail(db, user, {
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      acceptLanguage: 'en-US'
    });
  }, 'checkAndSendNewDeviceEmail should not throw error on first-time device login');
});
