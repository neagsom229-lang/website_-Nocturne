export function getSslConfig(databaseUrl) {
  const host = databaseUrl.hostname.toLowerCase();
  const sslMode = databaseUrl.searchParams.get('sslmode');

  if (sslMode === 'disable' || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')) {
    return false;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const ca = process.env.DATABASE_SSL_CA;

  if (isProduction) {
    return {
      rejectUnauthorized: true,
      ...(ca && { ca }),
    };
  }

  // Development / non-production
  if (databaseUrl.hostname.endsWith('.pooler.supabase.com')) {
    return { rejectUnauthorized: false };
  }

  // Localhost / default non-pooler URLs use default SSL behavior (undefined)
  return undefined;
}
