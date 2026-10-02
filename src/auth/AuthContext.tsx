import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (displayName: string, email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
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
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Authentication request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkAuth(retries = 3, delayMs = 500) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        if (!active) return;
        try {
          const { user: currentUser } = await authRequest<{ user: AuthUser }>('/api/auth/me');
          if (active) {
            setUser(currentUser);
            setLoading(false);
          }
          return;
        } catch (error) {
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
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

  async function signIn(email: string, password: string) {
    const result = await authRequest<{ user: AuthUser }>('/api/auth/login', { email, password });
    setUser(result.user);
    return result.user;
  }

  async function signUp(displayName: string, email: string, password: string) {
    const result = await authRequest<{ user: AuthUser }>('/api/auth/register', { displayName, email, password });
    setUser(result.user);
    return result.user;
  }

  async function signOut() {
    await authRequest<void>('/api/auth/logout', {});
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, signIn, signUp, signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

