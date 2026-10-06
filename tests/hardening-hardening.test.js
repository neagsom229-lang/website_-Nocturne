import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWithResilience } from '../backend/lib/http.js';
import { validateAndLoadConfig } from '../backend/config.js';

test('fetchWithResilience throws timeout or handles network resilience', async () => {
  // Test with invalid URL or aborted signal
  const oldEnv = process.env.HTTP_TIMEOUT_MS;
  process.env.HTTP_TIMEOUT_MS = '50';
  try {
    await assert.rejects(
      async () => fetchWithResilience('https://httpbin.org/delay/5', {}, 'test-provider'),
      /aborted|fetch failed|Failed to fetch/
    );
  } finally {
    if (oldEnv === undefined) delete process.env.HTTP_TIMEOUT_MS;
    else process.env.HTTP_TIMEOUT_MS = oldEnv;
  }
});

test('validateAndLoadConfig validates missing DATABASE_URL and JWT_SECRET', () => {
  const oldEnv = { ...process.env };
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
  try {
    assert.throws(() => validateAndLoadConfig(), /Missing required environment variables/);
  } finally {
    process.env = oldEnv;
  }
});
