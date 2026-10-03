import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send reset link');
      }
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send reset link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="tp-fx auth-page__fx" aria-hidden="true" />
      <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
      <section className="auth-card" aria-labelledby="forgot-title">
        <span className="auth-card__lamp" aria-hidden="true">✳</span>
        <h1 id="forgot-title" className="t-h1">Reset password</h1>
        {sent ? (
          <div>
            <p className="t-small t-mute" style={{ marginBottom: '16px' }}>If an account exists for {email}, we’ve sent a password reset link to your inbox.</p>
            <Link to="/auth/login" className="btn btn--primary auth-form__submit" style={{ textDecoration: 'none' }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <p className="t-small t-mute">Enter your email address and we’ll send you a link to reset your password.</p>
            {error && <p className="auth-form__error" role="alert">{error}</p>}
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
            <button type="submit" className="btn btn--primary auth-form__submit" disabled={loading}>
              {loading ? 'Sending link…' : 'Send reset link'}
              <Icon name="arrow-right" size={16} />
            </button>
            <div className="auth-footer" style={{ marginTop: '16px', textAlign: 'center' }}>
              <Link to="/auth/login" className="t-small" style={{ color: 'var(--tp-acc)', textDecoration: 'none' }}>Remember your password? Sign in</Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
