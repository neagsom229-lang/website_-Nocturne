import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isProd = process.env.NODE_ENV === 'production';
const missing = [
  !supabaseUrl && 'SUPABASE_URL',
  !supabaseAnonKey && 'SUPABASE_ANON_KEY',
  !supabaseServiceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
].filter(Boolean);

if (isProd && missing.length) {
  throw new Error(`[supabase] Missing required env vars in production: ${missing.join(', ')}`);
}

if (missing.length) {
  console.warn(`[supabase] Missing env vars: ${missing.join(', ')}. Auth will not work until they are set.`);
}
if (supabaseUrl) {
  console.info(`[supabase] configured for ${supabaseUrl}`);
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder-service-key',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const supabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { auth: { persistSession: false, autoRefreshToken: false } }
);