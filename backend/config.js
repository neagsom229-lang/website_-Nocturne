import 'dotenv/config';

export function validateAndLoadConfig() {
  const env = process.env;
  const isProduction = env.NODE_ENV === 'production';

  const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
  if (isProduction && !env.APP_URL) {
    throw new Error('[config] FATAL: APP_URL is required in production for email verification and auth redirect links.');
  }

  const missingRequired = requiredVars.filter((v) => !env[v]);

  if (missingRequired.length > 0) {
    throw new Error(`[config] FATAL: Missing required environment variables: ${missingRequired.join(', ')}`);
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    throw new Error('[config] FATAL: JWT_SECRET must be at least 32 characters long.');
  }

  if (isProduction && env.TRUST_PROXY !== '1' && env.TRUST_PROXY !== 'true') {
    console.warn('[config] WARNING: TRUST_PROXY is not set to 1 while running in production. Secure cookies and rate-limiting IP detection may be affected behind reverse proxies (Render/Heroku).');
  }

  // Check Supabase anon keys consistency
  const supabaseAnon = env.SUPABASE_ANON_KEY;
  const viteSupabaseAnon = env.VITE_SUPABASE_ANON_KEY;
  if (supabaseAnon && viteSupabaseAnon && supabaseAnon !== viteSupabaseAnon) {
    console.warn('[config] WARNING: SUPABASE_ANON_KEY and VITE_SUPABASE_ANON_KEY differ. Frontend and backend may authenticate against different Supabase instances.');
  }

  const backendVars = [
    'PORT', 'API_PORT', 'APP_URL', 'CORS_ORIGIN', 'TRUST_PROXY',
    'ADMIN_TOKEN', 'TMDB_API_KEY', 'YOUTUBE_API_KEY',
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY', 'EMAIL_FROM', 'NODE_ENV', 'HTTP_TIMEOUT_MS', 'LOG_LEVEL'
  ];

  const frontendBuildVars = [
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'
  ];

  console.info('[config] Environment Startup Summary:');
  for (const v of requiredVars) {
    console.info(`  [required] ${v}: configured`);
  }
  for (const v of backendVars) {
    const status = env[v] ? 'configured' : 'MISSING';
    console.info(`  [optional-backend] ${v}: ${status}`);
  }
  for (const v of frontendBuildVars) {
    const status = env[v] ? 'configured' : 'MISSING (will fallback to build defaults)';
    console.info(`  [frontend-build-time] ${v}: ${status}`);
  }

  return {
    port: Number(env.PORT ?? env.API_PORT ?? 3000),
    nodeEnv: env.NODE_ENV || 'development',
    jwtSecret: env.JWT_SECRET,
    databaseUrl: env.DATABASE_URL,
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:4173',
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    adminToken: env.ADMIN_TOKEN,
  };
}
