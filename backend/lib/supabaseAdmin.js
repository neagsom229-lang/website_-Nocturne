import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.NODE_ENV === 'production' && (!supabaseUrl || !supabaseServiceRoleKey)) {
  throw new Error('[supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production');
}

if (supabaseUrl) {
  console.info(`[supabase] configured for ${supabaseUrl}`);
} else {
  console.warn('[supabase] SUPABASE_URL is not configured. Running in development/fallback mode.');
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
