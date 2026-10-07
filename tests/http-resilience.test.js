import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWithResilience } from '../backend/lib/http.js';
import { validateAndLoadConfig } from '../backend/config.js';

test('fetchWithResilience throws timeout error when fetchImpl aborts', async () => {
  const mockFetch = async (_url, options) => {
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      }, 30);
      if (typeof timer.unref === 'function') timer.unref();

      options.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  };

  const oldEnv = process.env.HTTP_TIMEOUT_MS;
  process.env.HTTP_TIMEOUT_MS = '10';
  try {
    await assert.rejects(
      async () => fetchWithResilience('http://localhost/test', {}, 'test-provider', mockFetch),
      /aborted/
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
