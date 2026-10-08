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

function createMockClient() {
  const registeredEmails = new Set();
  return {
    auth: {
      async signInWithPassword({ email }) {
        return {
          data: {
            user: { id: 'mock-user-id-' + email, email, email_confirmed_at: new Date() },
            session: { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' }
          },
          error: null
        };
      },
      async signInWithOAuth({ provider, options }) {
        const appUrl = options?.redirectTo?.split('/auth/callback')[0] || 'http://localhost:5173';
        return {
          data: { url: `https://example.com/oauth/${provider}?redirect_uri=${encodeURIComponent(appUrl)}` },
          error: null
        };
      },
      async getUser() {
        return { data: { user: { id: 'mock-user-id', email: 'test@example.com' } }, error: null };
      },
      async setSession() {
        return { data: { session: { access_token: 'mock-access-token' } }, error: null };
      },
      async verifyOtp({ token_hash }) {
        return { data: { user: { id: 'mock-user-id-' + token_hash, email: 'otp@example.com', email_confirmed_at: new Date() } }, error: null };
      },
      async resend() {
        return { data: {}, error: null };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null };
      },
      async refreshSession() {
        return { data: { session: { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' } }, error: null };
      },
      async signInWithOtp() {
        return { data: {}, error: null };
      },
      admin: {
        async createUser({ email, user_metadata }) {
          const normalized = typeof email === 'string' ? email.toLowerCase() : '';
          if (normalized && registeredEmails.has(normalized)) {
            return {
              data: { user: null },
              error: { message: 'User already registered', status: 422 }
            };
          }
          if (normalized) {
            registeredEmails.add(normalized);
          }
          return {
            data: { user: { id: 'mock-admin-user-id-' + email, email, user_metadata, email_confirmed_at: new Date() } },
            error: null
          };
        },
        async getUserById(id) {
          return { data: { user: { id, email: 'user@example.com', email_confirmed_at: new Date() } }, error: null };
        },
        async updateUserById(id, attrs) {
          return { data: { user: { id, ...attrs } }, error: null };
        },
        async signOut() {
          return { error: null };
        }
      }
    }
  };
}

const isPlaceholder = supabaseUrl?.includes('placeholder.supabase.co');

export const supabaseAdmin = isPlaceholder
  ? createMockClient()
  : (isConfigured
    ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : createUnconfiguredClient('supabaseAdmin'));

export const supabaseClient = isPlaceholder
  ? createMockClient()
  : (isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : createUnconfiguredClient('supabaseClient'));
