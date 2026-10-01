import assert from 'node:assert/strict';
import test from 'node:test';
import { getSslConfig } from '../backend/dbConfig.js';

test('Supabase pooler URLs disable certificate verification', () => {
  assert.deepEqual(
    getSslConfig(new URL('postgresql://postgres.project@aws-0-region.pooler.supabase.com:6543/postgres')),
    { rejectUnauthorized: false },
  );
});

test('non-pooler URLs use default SSL behavior', () => {
  for (const hostname of ['localhost', 'db.project.supabase.co', 'db.example.com']) {
    const databaseUrl = new URL(`postgresql://user:password@${hostname}:5432/database`);
    assert.equal(getSslConfig(databaseUrl), undefined, `${hostname} should use default SSL behavior`);
  }
});
