export function getSslConfig(databaseUrl) {
  const isProduction = process.env.NODE_ENV === 'production';
  const ca = process.env.DATABASE_SSL_CA;

  if (isProduction) {
    return {
      rejectUnauthorized: true,
      ...(ca && { ca }),
    };
  }

  // Development
  if (databaseUrl.hostname.endsWith('.pooler.supabase.com') || databaseUrl.hostname !== 'localhost' && databaseUrl.hostname !== '127.0.0.1') {
    console.warn('[db] WARNING: SSL rejectUnauthorized is false in development/remote connection.');
  }
  return {
    rejectUnauthorized: false,
  };
}
