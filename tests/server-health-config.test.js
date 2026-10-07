import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { validateAndLoadConfig } from '../backend/config.js';

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

test('validateAndLoadConfig throws error on missing required env vars', () => {
  const oldEnv = { ...process.env };
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
  try {
    assert.throws(() => validateAndLoadConfig(), /Missing required environment variables/);
  } finally {
    process.env = oldEnv;
  }
});

test('validateAndLoadConfig throws error on short JWT_SECRET', () => {
  const oldEnv = { ...process.env };
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
  process.env.JWT_SECRET = 'too-short';
  try {
    assert.throws(() => validateAndLoadConfig(), /JWT_SECRET must be at least 32 characters long/);
  } finally {
    process.env = oldEnv;
  }
});

test('/api/health endpoint returns 200 OK', async (context) => {
  const port = await availablePort();
  const dbUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable';
  const server = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: dbUrl,
      JWT_SECRET: 'test-secret-long-enough-for-jwt-validation-32-chars',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  context.after(async () => {
    if (server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once('exit', resolve));
    }
  });

  const startTime = Date.now();
  let started = false;
  let lastStatus = null;
  while (Date.now() - startTime < 30000) {
    if (server.exitCode !== null) break;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      lastStatus = res.status;
      if (res.status === 200) {
        const json = await res.json();
        assert.equal(json.status, 'ok');
        started = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  assert.equal(started, true, `Server failed to start or respond to /api/health (last status: ${lastStatus})`);
});

test('server startup handles unreachable database gracefully with connection error', async (_context) => {
  const port = await availablePort();
  const server = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/postgres?sslmode=disable',
      JWT_SECRET: 'test-secret-long-enough-for-jwt-validation-32-chars',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  server.stdout.setEncoding('utf8').on('data', (d) => { output += d; });
  server.stderr.setEncoding('utf8').on('data', (d) => { output += d; });

  await new Promise((resolve) => server.once('exit', resolve));
  assert.match(output, /Database connection failed|FATAL|ECONNREFUSED/);
});
