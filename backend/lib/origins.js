export function getAllowedOrigins() {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultCors = isProd ? '' : 'http://localhost:5173,http://localhost:4173';
  const envOrigins = (process.env.CORS_ORIGIN ?? defaultCors)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const appUrl = process.env.APP_URL;

  const originsSet = new Set([...envOrigins]);
  if (appUrl) originsSet.add(appUrl);

  if (!isProd) {
    originsSet.add('http://localhost:5173');
    originsSet.add('http://127.0.0.1:5173');
    originsSet.add('http://localhost:5174');
    originsSet.add('http://127.0.0.1:5174');
    originsSet.add('http://localhost:4173');
    originsSet.add('http://127.0.0.1:4173');
  }

  return Array.from(originsSet);
}

export function normalizeOrigin(urlStr) {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return urlStr.toLowerCase().trim();
  }
}

export function isOriginAllowed(originHeader, refererHeader) {
  const allowed = getAllowedOrigins().map(normalizeOrigin);

  let target = '';
  if (originHeader) {
    target = normalizeOrigin(originHeader);
  } else if (refererHeader) {
    target = normalizeOrigin(refererHeader);
  }

  if (!target) {
    return { allowed: true, normalized: target, allowedList: allowed };
  }

  const isAllowed = allowed.includes(target);
  return { allowed: isAllowed, normalized: target, allowedList: allowed };
}

export function csrfProtection(request, response, next) {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.get('origin');
    const referer = request.get('referer');
    const check = isOriginAllowed(origin, referer);

    if (!check.allowed) {
      console.warn(`[csrf] CSRF validation failed: Origin mismatch. Rejected origin/referer: "${origin || referer}". Allowed origins: ${JSON.stringify(check.allowedList)}`);
      return response.status(403).json({
        error: 'CSRF validation failed: Origin mismatch',
        ...(process.env.NODE_ENV !== 'production' && {
          rejected: origin || referer,
          allowed: check.allowedList,
        }),
      });
    }
  }
  return next();
}
