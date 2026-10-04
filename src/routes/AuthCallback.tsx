import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { supabase } from '../lib/supabaseClient';

async function waitForSession(timeoutMs = 10000) {
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < timeoutMs) {
    attempts++;
    const { data: { session } } = await supabase.auth.getSession();
    console.info(`[callback] poll #${attempts}: session=${session ? 'yes' : 'no'}`);
    if (session) return session;
    await new Promise(r => setTimeout(r, 200));
  }
  console.error('[callback] timed out waiting for session after', timeoutMs, 'ms');
  return null;
}

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
      console.info('[callback] hash:', window.location.hash.slice(0, 50));
      console.info('[callback] search:', window.location.search);
      
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace('#', ''));
        const supabaseError = params.get('error') || hash.get('error');
        const supabaseErrorDesc = params.get('error_description') || hash.get('error_description');
        if (supabaseError) {
          throw new Error(`Supabase OAuth error: ${supabaseError} — ${supabaseErrorDesc}`);
        }

        const session = await waitForSession(10000);
        if (!session) throw new Error('Supabase session not found after 10s');
        
        console.info('[callback] got session, user:', session.user?.email);
        
        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
          credentials: 'same-origin',
        });
        
        const body = await res.json().catch(() => ({}));
        console.info('[callback] POST /api/auth/callback status:', res.status);
        console.info('[callback] response body:', body);
        
        if (!res.ok) throw new Error(body.error || `Callback failed: ${res.status}`);
        
        await supabase.auth.signOut();
        
        // Verify cookie is set before redirecting
        const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
        console.info('[callback] /api/auth/me after callback:', meRes.status);
        if (!meRes.ok) throw new Error('Cookie was not set — session invalid');
        
        const redirectTo = searchParams.get('redirect') || searchParams.get('from') || '/';
        console.info('[callback] success, redirecting to', redirectTo);
        navigate(redirectTo, { replace: true });
      } catch (err: any) {
        console.error('[callback] FAILED:', err);
        setError(err.message || 'Could not complete sign in.');
      } finally {
        setLoading(false);
      }
    }
    handleCallback();
  }, [searchParams, navigate]);

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
