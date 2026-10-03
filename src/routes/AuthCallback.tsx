import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { supabase } from '../lib/supabaseClient';

async function waitForSession(timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function handleCallback() {
      try {
        const session = await waitForSession(3000);
        if (!session) {
          throw new Error('Sign-in link may have expired — try again');
        }

        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
          credentials: 'same-origin',
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Session exchange failed');
        }

        await supabase.auth.signOut();

        const redirectTo = searchParams.get('redirect') || searchParams.get('from') || '/';
        navigate(redirectTo, { replace: true });
      } catch (err: any) {
        setError(err?.message || 'Could not complete sign in.');
      } finally {
        setLoading(false);
      }
    }
    void handleCallback();
  }, [searchParams.toString(), navigate]);

  return (
    <main className="auth-page">
      <div className="tp-fx auth-page__fx" aria-hidden="true" />
      <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
      <section className="auth-card" aria-labelledby="callback-title">
        <span className="auth-card__lamp" aria-hidden="true">✳</span>
        <h1 id="callback-title" className="t-h1">{loading ? 'Stepping inside…' : 'Sign in failed'}</h1>
        {loading ? (
          <p className="t-small t-mute">We’re opening the door for you.</p>
        ) : (
          <>
            <p className="auth-form__error" role="alert">{error}</p>
            <Link to="/auth/login" className="btn btn--primary auth-form__submit" style={{ textDecoration: 'none', marginTop: '14px' }}>
              Back to sign in
              <Icon name="arrow-right" size={16} />
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
