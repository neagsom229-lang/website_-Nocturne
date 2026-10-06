export function getSslConfig(databaseUrl) {
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
