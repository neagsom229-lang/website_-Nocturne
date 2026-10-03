import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { resendVerificationEmail } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [emailForResend, setEmailForResend] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    async function verify() {
      try {
        const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
        const type = searchParams.get('type') || 'signup';
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = searchParams.get('access_token') || hashParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token');

        if (accessToken) {
          // Fallback case: Supabase default template redirect with access_token in hash
          const res = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
            credentials: 'same-origin',
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Email verification failed.');
          }
          setStatus('success');
          return;
        }

        if (!tokenHash) {
          setStatus('error');
          setErrorMessage('Verification token is missing from the link. Please note this flow requires our custom Supabase email template configuration (see DEPLOYMENT.md).');
          return;
        }

        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash, type }),
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Email verification failed.');
        }
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'This link is invalid or expired.');
      }
    }
    void verify();
  }, [searchParams]);

  async function handleResend() {
    if (!emailForResend) return;
    setResending(true);
    try {
      await resendVerificationEmail(emailForResend);
      setResendSent(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not resend verification email.');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="tp-fx auth-page__fx" aria-hidden="true" />
      <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
      <section className="auth-card" aria-labelledby="verify-title">
        <span className="auth-card__lamp" aria-hidden="true">✳</span>
        <h1 id="verify-title" className="t-h1">
          {status === 'verifying' && 'Verifying email…'}
          {status === 'success' && 'Email verified!'}
          {status === 'error' && 'Verification failed'}
        </h1>
        {status === 'verifying' && <p className="t-small t-mute">Please wait while we confirm your email address.</p>}
        {status === 'success' && (
          <>
            <p className="t-small t-mute">Your email has been successfully verified. You can now step into your room.</p>
            <Link to="/" className="btn btn--primary auth-form__submit" style={{ textDecoration: 'none', marginTop: '14px' }}>
              Open Nocturne
              <Icon name="arrow-right" size={16} />
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="auth-form__error" role="alert">{errorMessage}</p>
            <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
              {resendSent ? (
                <p className="t-small" style={{ color: '#639f75' }}>New verification email sent!</p>
              ) : (
                <>
                  <input
                    type="email"
                    placeholder="Enter your email to resend"
                    className="diary-field input"
                    style={{ minHeight: '40px', padding: '8px 12px', border: '1px solid var(--tp-line)', borderRadius: 'var(--tp-r-sm)', background: 'var(--tp-surf)', color: 'var(--tp-ink)' }}
                    value={emailForResend}
                    onChange={(e) => setEmailForResend(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void handleResend()}
                    disabled={resending || !emailForResend}
                  >
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </button>
                </>
              )}
              <Link to="/auth/login" className="btn" style={{ textDecoration: 'none', textAlign: 'center', color: 'var(--tp-acc)' }}>
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
