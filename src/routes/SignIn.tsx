import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';

export function SignIn() {
  const { signInWithEmail, signInWithGoogle, signInWithFacebook, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const destination = searchParams.get('redirect') || searchParams.get('from') || '/tapes';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      const errorObj = err as Error & { code?: string; message?: string };
      const code = errorObj?.code || (errorObj?.message?.includes('verify') ? 'email_not_verified' : 'invalid_credentials');
      const message = errorObj?.message || 'That didn’t work. Please check your email and password.';
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
    } catch (err: unknown) {
      setError({ message: (err as Error)?.message || 'Could not send magic link' });
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
    } catch (err: unknown) {
      setError({ message: (err as Error)?.message || 'Could not resend verification email.' });
    } finally {
      setResending(false);
    }
  }

  if (error?.code === 'email_not_verified') {
    return (
      <main className="auth-page">
        <div className="tp-fx auth-page__fx" aria-hidden="true" />
        <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
        <section className="auth-card" aria-labelledby="verify-prompt-title">
          <span className="auth-card__lamp" aria-hidden="true">✳</span>
          <h1 id="verify-prompt-title" className="t-h1">Verify your email</h1>
          <p className="t-small t-mute" style={{ marginBottom: '16px' }}>
            Your account exists, but your email hasn't been verified yet. Check your inbox or resend the verification link.
          </p>
          {resendSuccess ? (
            <p className="t-small" style={{ color: '#639f75', marginBottom: '16px' }}>Verification email resent successfully!</p>
          ) : null}
          <div style={{ display: 'grid', gap: '10px' }}>
            <button
              type="button"
              className="btn btn--primary auth-form__submit"
              onClick={() => void handleResendVerification()}
              disabled={resending}
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: 'none', border: 'none', color: 'var(--tp-acc)', cursor: 'pointer' }}
              onClick={() => setError(null)}
            >
              ← Back to sign in
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
      <section className="auth-card" aria-labelledby="signin-title">
        <span className="auth-card__lamp" aria-hidden="true">✳</span>
        <h1 id="signin-title" className="t-h1">Welcome back</h1>
        <p className="t-small t-mute">Step into your room. The night is long.</p>

        {error && <p className="auth-form__error" role="alert">{error.message}</p>}
        {magicSent && <p className="t-small" role="status" style={{ color: '#639f75', margin: '8px 0' }}>Magic link sent! Check your email.</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-label" htmlFor="password">Password</label>
              <Link to="/auth/forgot-password" className="t-small" style={{ color: 'var(--tp-acc)', textDecoration: 'none' }}>Forgot?</Link>
            </div>
            <input
              id="password"
              type="password"
              required
              className="input auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>
          <button type="submit" className="btn btn--primary auth-form__submit" disabled={submitting}>
            {submitting ? 'Stepping inside…' : 'Sign in'}
            <Icon name="arrow-right" size={16} />
          </button>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ flex: 1, fontSize: '13px' }}
              onClick={() => void handleMagicLink()}
              disabled={submitting}
            >
              Send Magic Link
            </button>
          </div>
        </form>

        <div className="auth-divider"><span>or continue with</span></div>

        <div className="auth-providers">
          <button type="button" className="btn btn--provider" onClick={() => void signInWithGoogle()}>
            <Icon name="star" size={16} /> Google
          </button>
          <button type="button" className="btn btn--provider" onClick={() => void signInWithFacebook()}>
            <Icon name="heart" size={16} /> Facebook
          </button>
        </div>

        <div className="auth-footer" style={{ marginTop: '20px', textAlign: 'center' }}>
          <p className="t-small t-mute">
            Don't have a room yet? <Link to="/auth/signup" style={{ color: 'var(--tp-acc)', textDecoration: 'none' }}>Create one</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
