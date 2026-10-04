import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  emailChangePending?: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  isPublic?: boolean;
};

type AuthContextValue = {
  user: AuthUser | undefined | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthUser>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<{ user: null; email: string; message: string }>;
  signUp: (displayName: string, email: string, password: string) => Promise<{ user: null; email: string; message: string }>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function authRequest<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    payload = { error: `Authentication request failed (${response.status})` };
  }

  if (!response.ok) {
    const message = payload.message || payload.error || `Authentication request failed (${response.status})`;
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).code = payload.error || (response.status === 401 ? 'invalid_credentials' : response.status === 429 ? 'rate_limited' : response.status === 403 ? 'email_not_verified' : 'unknown');
    throw error;
  }
  return payload as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | undefined | null>(undefined);
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let active = true;
    async function checkAuth(retries = 2, delayMs = 500) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (!active) return;
        try {
          const { user: currentUser } = await authRequest<{ user: AuthUser }>('/api/auth/me');
          if (active) {
            setUser(currentUser);
            setLoading(false);
          }
          return;
        } catch (error: any) {
          const status = error?.status;
          if (status === 401 || status === 403) {
            if (active) {
              setUser(null);
              setLoading(false);
            }
            return;
          }
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            if (status >= 500 && active) {
              console.error('[auth] check failed:', error);
            }
            if (active) {
              setUser(null);
              setLoading(false);
            }
          }
        }
      }
    }
    void checkAuth();
    return () => { active = false; };
  }, []);

  async function signInWithEmail(email: string, password: string) {
    const result = await authRequest<{ user: AuthUser }>('/api/auth/signin', { email, password });
    setUser(result.user);
    return result.user;
  }

  async function signUpWithEmail(email: string, password: string, displayName = email.split('@')[0]) {
    const result = await authRequest<{ user: null; email: string; message: string }>('/api/auth/signup', { displayName, email, password });
    return result;
  }

  async function signUp(displayName: string, email: string, password: string) {
    return signUpWithEmail(email, password, displayName);
  }

  const ALLOWED_OAUTH_PREFIXES = [
    'https://shgaguqairkhtdhazdnp.supabase.co',
    'https://accounts.google.com',
    'https://www.facebook.com',
  ];

  async function signInWithGoogle() {
    const { url } = await authRequest<{ url: string }>('/api/auth/signin/google');
    console.info('[oauth] received url:', url, 'type:', typeof url);
    if (!url) {
      throw new Error('OAuth URL is empty — check SUPABASE_URL and SUPABASE_ANON_KEY on the local backend');
    }
    if (!ALLOWED_OAUTH_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      throw new Error(`OAuth URL not in allowlist: ${url}`);
    }
    window.location.href = url;
  }

  async function signInWithFacebook() {
    const { url } = await authRequest<{ url: string }>('/api/auth/signin/facebook');
    console.info('[oauth] received url:', url, 'type:', typeof url);
    if (!url) {
      throw new Error('OAuth URL is empty — check SUPABASE_URL and SUPABASE_ANON_KEY on the local backend');
    }
    if (!ALLOWED_OAUTH_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      throw new Error(`OAuth URL not in allowlist: ${url}`);
    }
    window.location.href = url;
  }

  async function signOut() {
    await authRequest<void>('/api/auth/signout', {});
    setUser(null);
  }

  async function resendVerificationEmail(email: string) {
    await authRequest('/api/auth/verify-email/resend', { email });
  }

  async function resetPassword(email: string) {
    await authRequest('/api/auth/reset-password', { email });
  }

  const value = useMemo(() => ({
    user,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signUp,
    signInWithGoogle,
    signInWithFacebook,
    signOut,
    resendVerificationEmail,
    resetPassword,
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
