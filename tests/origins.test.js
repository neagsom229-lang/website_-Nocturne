import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { isOriginAllowed, normalizeOrigin, csrfProtection } from '../backend/lib/origins.js';

test('normalizeOrigin parses valid URLs and trims strings', () => {
  assert.equal(normalizeOrigin('http://localhost:5173/path'), 'http://localhost:5173');
  assert.equal(normalizeOrigin('  HTTPS://Example.com:8443/  '), 'https://example.com:8443');
});

test('isOriginAllowed allows requests with missing origin and referer', () => {
  const result = isOriginAllowed(undefined, undefined);
  assert.equal(result.allowed, true);
});

test('isOriginAllowed allows localhost:5173 in development', () => {
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const result = isOriginAllowed('http://localhost:5173', undefined);
    assert.equal(result.allowed, true);
  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test('isOriginAllowed rejects localhost:5173 in production when not in CORS_ORIGIN', () => {
  const oldEnv = process.env.NODE_ENV;
  const oldCors = process.env.CORS_ORIGIN;
  process.env.NODE_ENV = 'production';
  delete process.env.CORS_ORIGIN;
  try {
    const result = isOriginAllowed('http://localhost:5173', undefined);
    assert.equal(result.allowed, false);
  } finally {
    process.env.NODE_ENV = oldEnv;
    if (oldCors !== undefined) process.env.CORS_ORIGIN = oldCors;
    else delete process.env.CORS_ORIGIN;
  }
});

test('isOriginAllowed falls back to referer if origin is missing', () => {
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const result = isOriginAllowed(undefined, 'http://localhost:5173/settings');
    assert.equal(result.allowed, true);
  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

test('isOriginAllowed rejects mismatched origins', () => {
  const result = isOriginAllowed('http://malicious-site.com', undefined);
  assert.equal(result.allowed, false);
});

async function startCsrfTestApp() {
  const app = express();
  app.use(express.json());
  app.use(csrfProtection);
  app.post('/api/test', (_req, res) => res.status(200).json({ ok: true }));

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  return {
    fetch: (path, options) => fetch(`http://127.0.0.1:${address.port}${path}`, options),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('csrfProtection middleware end-to-end scenarios (no DATABASE_URL needed)', async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldCors = process.env.CORS_ORIGIN;
  process.env.NODE_ENV = 'development';
  const app = await startCsrfTestApp();

  try {
    // 1. Allowed origin passes
    const resAllowed = await app.fetch('/api/test', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resAllowed.status, 200);

    // 2. Mismatched origin returns 403
    const resMismatched = await app.fetch('/api/test', {
      method: 'POST',
      headers: { Origin: 'http://malicious.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resMismatched.status, 403);

    // 3. Missing Origin passes
    const resMissing = await app.fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resMissing.status, 200);

    // 4. Referer fallback works
    const resReferer = await app.fetch('/api/test', {
      method: 'POST',
      headers: { Referer: 'http://localhost:5173/callback', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resReferer.status, 200);

    // 5. localhost:5173 fails in production when not in CORS_ORIGIN
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGIN;
    const resProdFail = await app.fetch('/api/test', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resProdFail.status, 403);

  } finally {
    process.env.NODE_ENV = oldEnv;
    if (oldCors !== undefined) process.env.CORS_ORIGIN = oldCors;
    else delete process.env.CORS_ORIGIN;
    await app.close();
  }
});
