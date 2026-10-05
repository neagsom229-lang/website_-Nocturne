import 'dotenv/config';

export function validateAndLoadConfig() {
  const env = process.env;

  const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missingRequired = requiredVars.filter((v) => !env[v]);

  if (missingRequired.length > 0) {
    throw new Error(`[config] FATAL: Missing required environment variables: ${missingRequired.join(', ')}`);
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    throw new Error('[config] FATAL: JWT_SECRET must be at least 32 characters long.');
  }

  // Check Supabase anon keys consistency
  const supabaseAnon = env.SUPABASE_ANON_KEY;
  const viteSupabaseAnon = env.VITE_SUPABASE_ANON_KEY;
  if (supabaseAnon && viteSupabaseAnon && supabaseAnon !== viteSupabaseAnon) {
    console.warn('[config] WARNING: SUPABASE_ANON_KEY and VITE_SUPABASE_ANON_KEY differ. Frontend and backend may authenticate against different Supabase instances.');
  }

  const optionalVars = [
    'PORT', 'API_PORT', 'APP_URL', 'CORS_ORIGIN', 'TRUST_PROXY',
    'ADMIN_TOKEN', 'TMDB_API_KEY', 'YOUTUBE_API_KEY',
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
    'RESEND_API_KEY', 'EMAIL_FROM', 'NODE_ENV'
  ];

  console.info('[config] Environment Startup Summary:');
  for (const v of requiredVars) {
    console.info(`  [required] ${v}: configured`);
  }
  for (const v of optionalVars) {
    const status = env[v] ? 'configured' : 'MISSING';
    console.info(`  [optional] ${v}: ${status}`);
  }

  return {
    port: Number(env.PORT ?? env.API_PORT ?? 3000),
    nodeEnv: env.NODE_ENV || 'development',
    jwtSecret: env.JWT_SECRET,
    databaseUrl: env.DATABASE_URL,
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:4173',
    trustProxy: env.TRUST_PROXY === '1',
    adminToken: env.ADMIN_TOKEN,
  };
}
