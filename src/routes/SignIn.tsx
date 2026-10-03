import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';

export function SignIn() {
  const { signInWithEmail, signInWithGoogle, signInWithFacebook, resendVerificationEmail, resetPassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      navigate(destination, { replace: true });
    } catch (err: any) {
      const code = err?.code || (err?.message?.includes('verify') ? 'email_not_verified' : 'invalid_credentials');
      const message = err?.message || 'That didn’t work. Please check your email and password.';
      setError({ message, code });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      setError({ message: 'Please enter your email address first.' });
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err: any) {
      setError({ message: err?.message || 'Could not send password reset email.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email) return;
    setResending(true);
    try {
      await resendVerificationEmail(email);
      setResendSuccess(true);
    } catch (err: any) {
      setError({ message: err?.message || 'Could not resend verification email.' });
    } finally {
      setResending(false);
    }
  }

  if (error?.code === 'email_not_verified') {
    return (
      <main className="auth-page">
        <div className="tp-fx auth-page__fx" aria-hidden="true" />
        <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
        <section className="auth-card" aria-labelledby="verify-title">
          <span className="auth-card__lamp" aria-hidden="true">✳</span>
          <p className="t-eyebrow">ONE MORE STEP IN THE DARK</p>
          <h1 id="verify-title" className="t-h1">Verify your email.</h1>
          <p className="t-small t-mute">
            Please check your inbox ({email}) to verify your email address before stepping into your room.
          </p>
          {resendSuccess ? (
            <p className="auth-form__error" style={{ background: 'color-mix(in srgb, #639f75 12%, var(--tp-surf))', borderColor: 'color-mix(in srgb, #639f75 45%, var(--tp-line))' }}>
              Verification email resent! Check your inbox.
            </p>
          ) : null}
          <div className="auth-form" style={{ gap: '10px' }}>
            <button
              type="button"
              className="btn btn--primary auth-form__submit"
              onClick={() => void handleResendVerification()}
              disabled={resending}
            >
              {resending ? 'Sending verification link…' : 'Resend verification email'}
              <Icon name="arrow-right" size={16} />
            </button>
            <button
              type="button"
              className="btn"
              style={{ minHeight: '40px', background: 'transparent', border: '1px solid var(--tp-line)', color: 'var(--tp-ink)' }}
              onClick={() => setError(null)}
            >
              Try another account
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="tp-fx auth-page__fx" aria-hidden="true" />
      <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="auth-card__lamp" aria-hidden="true">✳</span>
        <p className="t-eyebrow">THE LIGHT WAS LEFT ON</p>
        <h1 id="auth-title" className="t-h1">Come on in.</h1>
        <p className="t-small t-mute">Your listening room is right where you left it.</p>

        {forgotMode ? (
          <form className="auth-form" onSubmit={(e) => void handleResetPassword(e)}>
            <p className="t-small">Enter your email and we’ll send a link to reset your password.</p>
            {resetSent ? (
              <p className="auth-form__error" style={{ background: 'color-mix(in srgb, #639f75 12%, var(--tp-surf))' }}>
                Reset link sent to {email}. Check your inbox.
              </p>
            ) : (
              <>
                <label className="diary-field">
                  <span>Email</span>
                  <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@somewhere.com" />
                </label>
                {error ? <p className="auth-form__error" role="alert">{error.message}</p> : null}
                <button type="submit" className="btn btn--primary auth-form__submit" disabled={submitting}>
                  {submitting ? 'Sending reset link…' : 'Send password reset link'}
                  <Icon name="arrow-right" size={16} />
                </button>
              </>
            )}
            <button type="button" className="btn" style={{ background: 'transparent', border: 'none', color: 'var(--tp-acc)', cursor: 'pointer', textAlign: 'center' }} onClick={() => { setForgotMode(false); setResetSent(false); setError(null); }}>
              Back to sign in
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
            <label className="diary-field">
              <span>Email</span>
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@somewhere.com" />
            </label>
            <label className="diary-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Password</span>
                <button type="button" style={{ background: 'none', border: 'none', color: 'var(--tp-acc)', fontSize: '11px', cursor: 'pointer', padding: 0 }} onClick={() => setForgotMode(true)}>
                  Forgot password?
                </button>
              </div>
              <input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            </label>
            {error ? <p className="auth-form__error" role="alert">{error.message}</p> : null}
            <button type="submit" className="btn btn--primary auth-form__submit" disabled={submitting}>
              {submitting ? 'One second…' : 'Sign in'}
              <Icon name="arrow-right" size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0', color: 'var(--tp-mute)', fontSize: '11px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--tp-line)' }} />
              <span>or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--tp-line)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                style={{ background: '#ffffff', color: '#1f1f1f', border: '1px solid var(--tp-line)', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 500 }}
                onClick={() => void signInWithGoogle()}
              >
                <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.32 7.23 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.1 0 9.8 0 12s.43 3.9 1.19 5.42l4.09-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>
                Google
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#1877F2', color: '#ffffff', border: 'none', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontWeight: 500 }}
                onClick={() => void signInWithFacebook()}
              >
                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </button>
            </div>
            <p className="auth-form__privacy">Your password is stored securely. We never put it in the light.</p>
          </form>
        )}

        <p className="auth-card__switch">
          Don’t have an account?{' '}
          <Link to="/auth/register">Sign up</Link>
        </p>
        <Link to="/landing" className="auth-card__public">Or just look around <Icon name="arrow-right" size={14} /></Link>
      </section>
      <p className="auth-page__note t-small t-mute">No rush. The night is long.</p>
    </main>
  );
}
