let cacheWriteFailures = 0;
let lastLoggedTime = 0;
const ONE_HOUR = 60 * 60 * 1000;

export function recordCacheWriteFailure(error) {
  cacheWriteFailures += 1;
  const now = Date.now();
  if (now - lastLoggedTime >= ONE_HOUR) {
    lastLoggedTime = now;
    console.error('Search cache write error:', error);
  } else {
    console.debug('Search cache write error (throttled):', error?.message);
  }
}

export function getCacheStats() {
  return {
    cacheWriteFailures,
  };
}
