import { logger } from './logger.js';

const circuitBreakers = new Map(); // provider -> { failures: number, resetAt: number }
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;

export async function fetchWithResilience(url, options = {}, providerName = 'default', fetchImpl = fetch) {
  const breaker = circuitBreakers.get(providerName) ?? { failures: 0, resetAt: 0 };
  const now = Date.now();

  if (breaker.failures >= CIRCUIT_THRESHOLD) {
    if (now < breaker.resetAt) {
      logger.debug(`[circuit-breaker] Circuit open for ${providerName}, skipping live call`, { providerName });
      throw new Error(`Circuit open for ${providerName}`);
    } else {
      breaker.failures = 0;
      circuitBreakers.set(providerName, breaker);
    }
  }

  const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS) || 10_000;
  const maxRetries = 2;

  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      if (response.status >= 500) {
        throw new Error(`Server error status ${response.status}`);
      }

      if (breaker.failures > 0) {
        breaker.failures = 0;
        circuitBreakers.set(providerName, breaker);
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('aborted due to timeout');
      const is5xx = err.message?.includes('Server error');
      const isNetwork = !err.status || isTimeout || is5xx;

      if (attempt <= maxRetries && isNetwork) {
        const backoff = Math.pow(2, attempt) * 100 + Math.random() * 50;
        logger.debug(`[http] Retry attempt ${attempt} for ${providerName} after error: ${err.message}`, { providerName, attempt });
        await new Promise((r) => {
          setTimeout(r, backoff);
        });
        continue;
      }
      break;
    }
  }

  breaker.failures += 1;
  if (breaker.failures >= CIRCUIT_THRESHOLD) {
    breaker.resetAt = Date.now() + CIRCUIT_COOLDOWN_MS;
    logger.warn(`[circuit-breaker] Circuit tripped for ${providerName} after ${breaker.failures} failures`, { providerName });
  }
  circuitBreakers.set(providerName, breaker);

  throw lastError;
}
