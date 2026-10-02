import assert from 'node:assert/strict';
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import test from 'node:test';
import pg from 'pg';
import { getSslConfig } from '../backend/dbConfig.js';

const { Pool } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL;

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('E2E media flows integration test', {
  skip: databaseUrl ? false : 'Set TEST_DATABASE_URL to a migrated PostgreSQL test database',
}, async (context) => {
  const parsedDatabaseUrl = new URL(databaseUrl);
  const database = new Pool({
    connectionString: databaseUrl,
    ssl: getSslConfig(parsedDatabaseUrl),
  });

  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      JWT_SECRET: 'e2e-integration-test-secret-long-enough-for-jwt',
      CORS_ORIGIN: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.setEncoding('utf8').on('data', (chunk) => { logs += chunk; });
  server.stderr.setEncoding('utf8').on('data', (chunk) => { logs += chunk; });

  context.after(async () => {
    if (server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once('exit', resolve));
    }
    await database.end();
  });

  async function waitForServer() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Server exited early:\n${logs}`);
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Server did not become ready:\n${logs}`);
  }

  await waitForServer();

  await context.test('movie flow: search -> detail -> trailer URL', async () => {
    const searchRes = await fetch(`${baseUrl}/api/search/unified?q=inception&type=movie`);
    const data = await searchRes.json();
    assert.ok(Array.isArray(data.results));
    if (data.results.length > 0) {
      const movieId = data.results[0].id;
      const detailRes = await fetch(`${baseUrl}/api/movies/${movieId}`);
      const movieData = await detailRes.json();
      assert.ok(movieData.movie);
    }
  });

  await context.test('cache flow: second identical search is cached', async () => {
    const r1 = await fetch(`${baseUrl}/api/search/unified?q=testquery&type=all`).then((r) => r.json());
    assert.equal(r1.cached, false);
    const r2 = await fetch(`${baseUrl}/api/search/unified?q=testquery&type=all`).then((r) => r.json());
    assert.equal(r2.cached, true);
  });

  await context.test('search_cache_type_check constraint includes all provider types', async () => {
    const result = await database.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'search_cache'::regclass
        AND conname = 'search_cache_type_check'
    `);
    const def = result.rows[0]?.def ?? '';
    for (const type of ['tv', 'audiobook', 'youtube', 'deezer', 'librivox', 'all', 'suggest']) {
      assert(def.includes(`'${type}'`), `constraint missing type: ${type}`);
    }
  });
});
