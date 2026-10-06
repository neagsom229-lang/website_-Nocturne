import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const guard = useRef(false);

  useEffect(() => {
    if (guard.current) return;
    guard.current = true;

    async function handleCallback() {
      console.info('[callback] URL:', window.location.href);
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');

        if (!accessToken || !refreshToken) {
          throw new Error('No session in URL — the link may have expired.');
        }

        console.info('[callback] got tokens, posting to backend');

        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
          credentials: 'same-origin',
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Callback failed: ${res.status}`);

        // Verify cookie is set
        const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!meRes.ok) throw new Error('Session not established');

        // Clean the fragment out of the URL bar
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        const redirectTo = searchParams.get('redirect') || searchParams.get('from') || '/';
        console.info('[callback] success, redirecting to', redirectTo);
        navigate(redirectTo, { replace: true });
      } catch (err: unknown) {
        console.error('[callback] FAILED:', err);
        setError((err as Error).message || 'Could not complete sign in.');
      } finally {
        setLoading(false);
      }
    }

    handleCallback();
  }, [navigate, searchParams]);

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
