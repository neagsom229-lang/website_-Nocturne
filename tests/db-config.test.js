import assert from 'node:assert/strict';
import test from 'node:test';
import { getSslConfig } from '../backend/dbConfig.js';

test('Supabase pooler URLs disable certificate verification', () => {
  assert.deepEqual(
    getSslConfig(new URL('postgresql://postgres.project@aws-0-region.pooler.supabase.com:6543/postgres')),
    { rejectUnauthorized: false },
  );
});

test('localhost and sslmode=disable return false SSL configuration', () => {
  for (const urlStr of [
    'postgresql://user:pass@localhost:5432/db',
    'postgresql://user:pass@127.0.0.1:5432/db',
    'postgresql://user:pass@remotehost:5432/db?sslmode=disable',
  ]) {
    assert.equal(getSslConfig(new URL(urlStr)), false, `${urlStr} should return false SSL config`);
  }
});

test('non-pooler remote URLs use default SSL behavior', () => {
  for (const hostname of ['db.project.supabase.co', 'db.example.com']) {
    const databaseUrl = new URL(`postgresql://user:password@${hostname}:5432/database`);
    assert.equal(getSslConfig(databaseUrl), undefined, `${hostname} should use default SSL behavior`);
  }
});
