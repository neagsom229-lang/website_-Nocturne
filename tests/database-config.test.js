import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const databaseModule = pathToFileURL(join(process.cwd(), 'backend', 'db.js')).href;

function runDatabaseImport(databaseUrl) {
  const directory = mkdtempSync(join(tmpdir(), 'nocturne-db-config-'));
  const { DATABASE_URL: _databaseUrl, TEST_DATABASE_URL: _testDatabaseUrl, ...environment } = process.env;
  try {
    return spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(databaseModule)})`],
      {
        cwd: directory,
        encoding: 'utf8',
        env: { ...environment, ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) },
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('missing DATABASE_URL gives actionable Render setup instructions', () => {
  const result = runDatabaseImport();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DATABASE_URL is not set/);
  assert.match(result.stderr, /Environment → Add Environment Variable/);
  assert.match(result.stderr, /host \*\.pooler\.supabase\.com, port 6543/);
  assert.match(result.stderr, /pgbouncer=true/);
});

test('database startup logs only the configured hostname', () => {
  const result = runDatabaseImport(
    'postgresql://test-user:test-password@aws-0-test.pooler.supabase.com:6543/postgres?pgbouncer=true',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[database\] PostgreSQL host: aws-0-test\.pooler\.supabase\.com/);
  assert.doesNotMatch(result.stdout, /test-user|test-password/);
});
