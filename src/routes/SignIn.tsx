import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';

export function SignIn() {
  const { signInWithEmail, signInWithGoogle, signInWithFacebook, resendVerificationEmail } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
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

  async function handleMagicLink() {
    if (!email) {
      setError({ message: 'Please enter your email address first for a magic link.' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send magic link');
      }
      setMagicSent(true);
    } catch (err: any) {
      setError({ message: err?.message || 'Could not send magic link' });
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

        {magicSent ? (
          <div className="auth-form">
            <p className="t-small" style={{ color: '#639f75' }}>Magic link sent to {email}. Check your inbox to sign in instantly.</p>
            <button type="button" className="btn btn--primary auth-form__submit" onClick={() => setMagicSent(false)}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
            <label className="diary-field">
              <span>Email</span>
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@somewhere.com" />
            </label>
            <label className="diary-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Password</span>
                <Link to="/auth/forgot-password" style={{ color: 'var(--tp-acc)', fontSize: '11px', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            </label>
            {error ? <p className="auth-form__error" role="alert">{error.message}</p> : null}
            <button type="submit" className="btn btn--primary auth-form__submit" disabled={submitting}>
              {submitting ? 'One second…' : 'Sign in'}
              <Icon name="arrow-right" size={16} />
            </button>

            <button
              type="button"
              className="btn"
              style={{ background: 'transparent', border: '1px dashed var(--tp-acc)', color: 'var(--tp-acc)', minHeight: '38px', fontSize: '12px' }}
              onClick={() => void handleMagicLink()}
              disabled={submitting}
            >
              Email me a magic link
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0', color: 'var(--tp-mute)', fontSize: '11px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--tp-line)' }} />
              <span>or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--tp-line)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="btn"
                style={{ background: '#ffffff', color: '#1f1f1f', border: '1px solid var(--tp-line)', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 500 }}
                onClick={() => void signInWithGoogle()}
              >
                Google
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#1877F2', color: '#ffffff', border: 'none', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 500 }}
                onClick={() => void signInWithFacebook()}
              >
                Facebook
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#000000', color: '#ffffff', border: 'none', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 500 }}
                onClick={() => alert('Apple sign-in requires Apple Developer configuration')}
              >
                Apple
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
