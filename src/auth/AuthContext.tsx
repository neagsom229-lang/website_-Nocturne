import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react';

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  isPublic?: boolean;
  emailVerified?: boolean;
  emailChangePending?: boolean;
  deletedAt?: string | null;
};

type AuthContextValue = {
  user: AuthUser | undefined | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

class AuthError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

async function authRequest<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return undefined as T;

  let payload: Record<string, unknown> & { message?: string; error?: string };
  try {
    payload = await response.json();
  } catch {
    payload = { error: `Authentication request failed (${response.status})` };
  }

  if (!response.ok) {
    const message = payload.message || payload.error || `Authentication request failed (${response.status})`;
    const code = payload.error || (response.status === 401 ? 'invalid_credentials' : response.status === 429 ? 'rate_limited' : response.status === 403 ? 'email_not_verified' : 'unknown');
    throw new AuthError(message, response.status, typeof code === 'string' ? code : 'unknown');
  }
  return payload as T;
}

const ALLOWED_OAUTH_PREFIXES = ['https://', 'http://localhost'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | undefined | null>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const safetyTimeout = setTimeout(() => {
      if (active) {
        controller.abort();
        setUser(null);
        setLoading(false);
      }
    }, 8000);

    async function checkAuth(retries = 2, delayMs = 500) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (!active) return;
        try {
          const response = await fetch('/api/auth/me', {
            signal: controller.signal,
            credentials: 'same-origin',
          });
          if (response.status === 204 || response.status === 401 || response.status === 403) {
            if (active) {
              setUser(null);
              setLoading(false);
            }
            return;
          }
          let payload: { user?: AuthUser } = {};
          try {
            payload = await response.json();
          } catch {
            // ignore JSON parse error on non-ok responses
          }
          if (response.ok && payload.user) {
            if (active) {
              setUser(payload.user);
              setLoading(false);
            }
            return;
          } else {
            if (active && attempt === retries) {
              setUser(null);
              setLoading(false);
            }
          }
        } catch (error: unknown) {
          if (!active || (error instanceof Error && error.name === 'AbortError')) {
            return;
          }
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else if (active) {
            setUser(null);
            setLoading(false);
          }
        }
      }
      if (active) {
        setUser(null);
        setLoading(false);
      }
    }
    void checkAuth();
    return () => {
      active = false;
      clearTimeout(safetyTimeout);
      controller.abort();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser } = await authRequest<{ user: AuthUser }>('/api/auth/signin', { email, password });
    setUser(loggedInUser);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, displayName?: string) => {
    const { user: registeredUser } = await authRequest<{ user: AuthUser }>('/api/auth/signup', { email, password, displayName });
    setUser(registeredUser);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    await signUpWithEmail(email, password, displayName);
  }, [signUpWithEmail]);

  const signInWithGoogle = useCallback(async () => {
    const { url } = await authRequest<{ url: string }>('/api/auth/signin/google');
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid OAuth redirect URL received from server.');
    }
    if (!ALLOWED_OAUTH_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      throw new Error(`OAuth URL not in allowlist: ${url}`);
    }
    window.location.href = url;
  }, []);

  const signInWithFacebook = useCallback(async () => {
    const { url } = await authRequest<{ url: string }>('/api/auth/signin/facebook');
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid OAuth redirect URL received from server.');
    }
    if (!ALLOWED_OAUTH_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      throw new Error(`OAuth URL not in allowlist: ${url}`);
    }
    window.location.href = url;
  }, []);

  const signOut = useCallback(async () => {
    await authRequest<void>('/api/auth/signout', {});
    setUser(null);
  }, []);

  const resendVerificationEmail = useCallback(async (email: string) => {
    await authRequest('/api/auth/verify-email/resend', { email });
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await authRequest('/api/auth/reset-password', { email });
  }, []);

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
  }), [user, loading, signInWithEmail, signUpWithEmail, signUp, signInWithGoogle, signInWithFacebook, signOut, resendVerificationEmail, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
