import { db } from '../db.js';
import { recordCacheWriteFailure } from '../services/cacheMetrics.js';

const CACHE_TTL_LONG = "INTERVAL '7 days'";

export async function providerFetch({
  url,
  options = {},
  cacheKey,
  cacheType = 'general',
  apiKeyToRedact,
  transform = (data) => data,
}) {
  let response;
  let errorBody = '';
  const sanitizedUrl = apiKeyToRedact ? url.replace(apiKeyToRedact, 'REDACTED') : url;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const json = await response.json();
        const results = transform(json);

        if (cacheKey) {
          try {
            await db.prepare(`
              INSERT INTO search_cache (query, type, sort, response_json, expires_at)
              VALUES ($1, $2, 'relevance', $3, NOW() + ${CACHE_TTL_LONG})
              ON CONFLICT (query, type, sort) DO UPDATE SET
                response_json = excluded.response_json,
                expires_at = excluded.expires_at
            `).run(cacheKey, cacheType, JSON.stringify(results));
          } catch (cacheErr) {
            recordCacheWriteFailure(cacheErr);
          }
        }

        return { results, degraded: false, reason: null };
      }

      errorBody = await response.text().catch(() => '');
      if (response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (err) {
      errorBody = err.message || String(err);
      if (attempt === 2) {
        console.error('[provider] request failed', {
          url: sanitizedUrl,
          status: response?.status,
          body: errorBody?.slice(0, 300),
        });
      }
    }
  }

  if (cacheKey) {
    try {
      const cached = await db.prepare(`
        SELECT response_json AS "responseJson" FROM search_cache
        WHERE query = $1 AND type = $2
      `).get(cacheKey, cacheType);
      if (cached?.responseJson) {
        const cachedResults = JSON.parse(cached.responseJson);
        console.warn(`[provider] fallback to cache for ${cacheKey}`);
        return { results: cachedResults, degraded: true, reason: 'provider_unavailable_cached' };
      }
    } catch (cacheFetchErr) {
      console.error('[provider] cache fallback failed:', cacheFetchErr);
    }
  }

  return { results: [], degraded: true, reason: 'provider_unavailable' };
}
