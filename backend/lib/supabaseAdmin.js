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

if (missing.length) {
  const msg = `[supabase] Missing required env vars: ${missing.join(', ')}`;
  if (isProd) {
    throw new Error(msg);
  } else {
    console.warn(`${msg}. Auth and Supabase features will return 503 "Supabase not configured" until they are set.`);
  }
} else if (supabaseUrl) {
  console.info(`[supabase] configured for ${supabaseUrl}`);
}

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey);

function createUnconfiguredClient(_name) {
  const throwErr = () => {
    const err = new Error('Supabase not configured');
    err.status = 503;
    throw err;
  };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'auth') {
        return new Proxy({}, {
          get(t, p) {
            if (p === 'admin') {
              return new Proxy({}, {
                get() { return throwErr; }
              });
            }
            return throwErr;
          }
        });
      }
      return throwErr;
    }
  });
}

export const supabaseAdmin = isConfigured
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : createUnconfiguredClient('supabaseAdmin');

export const supabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : createUnconfiguredClient('supabaseClient');
