import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError('Password must be between 8 and 128 characters');
      return;
    }
    if (!/[0-9]/.test(newPassword) && !/[^a-zA-Z0-9]/.test(newPassword)) {
      setError('Password must contain at least 1 number or symbol');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Password reset failed');
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError((err as Error).message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  }

  if (!tokenHash) {
    return (
      <main className="auth-page">
        <div className="tp-fx auth-page__fx" aria-hidden="true" />
        <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
        <section className="auth-card">
          <h1 className="t-h1">Invalid reset link</h1>
          <p className="t-small t-mute">This password reset link is missing its verification token.</p>
          <Link to="/auth/forgot-password" className="btn btn--primary auth-form__submit" style={{ textDecoration: 'none', marginTop: '16px' }}>
            Request new reset link
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="tp-fx auth-page__fx" aria-hidden="true" />
      <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
      <section className="auth-card" aria-labelledby="reset-title">
        <span className="auth-card__lamp" aria-hidden="true">✳</span>
        <h1 id="reset-title" className="t-h1">Set new password</h1>
        {success ? (
          <div>
            <p className="t-small t-mute" style={{ marginBottom: '16px', color: '#639f75' }}>Your password has been successfully updated.</p>
            <Link to="/auth/login" className="btn btn--primary auth-form__submit" style={{ textDecoration: 'none' }}>
              Sign in with new password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <p className="auth-form__error" role="alert">{error}</p>}
            <div className="auth-field">
              <label className="auth-label" htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                required
                className="input auth-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 chars (1 number or symbol)"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                className="input auth-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
              />
            </div>
            <button type="submit" className="btn btn--primary auth-form__submit" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
              <Icon name="arrow-right" size={16} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
