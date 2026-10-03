import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../auth/AuthContext';

export function SignUp() {
  const { signUpWithEmail, signInWithGoogle, signInWithFacebook } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');

  function getPasswordStrength(pwd: string) {
    if (!pwd) return { label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { label: 'Weak', color: '#e78377', width: '33%' };
    if (score <= 3) return { label: 'Medium', color: '#d9ab55', width: '66%' };
    return { label: 'Strong', color: '#639f75', width: '100%' };
  }

  const strength = getPasswordStrength(password);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setError('Please agree to the terms to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await signUpWithEmail(email, password, displayName);
      setSuccessEmail(res.email || email);
    } catch (err: any) {
      setError(err?.message || 'That didn’t work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (successEmail) {
    return (
      <main className="auth-page">
        <div className="tp-fx auth-page__fx" aria-hidden="true" />
        <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
        <section className="auth-card" aria-labelledby="inbox-title">
          <span className="auth-card__lamp" aria-hidden="true">✳</span>
          <p className="t-eyebrow">MAKE A LITTLE ROOM FOR YOURSELF</p>
          <h1 id="inbox-title" className="t-h1">Check your inbox.</h1>
          <p className="t-small t-mute">
            We sent a verification link to <strong>{successEmail}</strong>. Please click the link to activate your account.
          </p>
          <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
            <Link to="/auth/login" className="btn btn--primary auth-form__submit" style={{ textDecoration: 'none' }}>
              Sign in after verifying
              <Icon name="arrow-right" size={16} />
            </Link>
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
        <p className="t-eyebrow">MAKE A LITTLE ROOM FOR YOURSELF</p>
        <h1 id="auth-title" className="t-h1">Stay a little.</h1>
        <p className="t-small t-mute">A quiet place for the songs and stories you keep.</p>

        <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
          <label className="diary-field">
            <span>What should we call you?</span>
            <input autoComplete="name" required maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </label>
          <label className="diary-field">
            <span>Email</span>
            <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@somewhere.com" />
          </label>
          <label className="diary-field">
            <span>Password (min 8 chars)</span>
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            {password ? (
              <div style={{ marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--tp-mute)', marginBottom: '2px' }}>
                  <span>Strength</span>
                  <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                </div>
                <div style={{ height: '3px', background: 'var(--tp-line)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: strength.width, height: '100%', background: strength.color, transition: 'width 0.2s ease' }} />
                </div>
              </div>
            ) : null}
          </label>
          <label className="diary-field">
            <span>Confirm password</span>
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--tp-mute)', cursor: 'pointer' }}>
            <input type="checkbox" required checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
            <span>I agree to the terms and quiet neighborhood guidelines</span>
          </label>

          {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn--primary auth-form__submit" disabled={submitting}>
            {submitting ? 'One second…' : 'Create account'}
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
          <p className="auth-form__privacy">Your password is stored as a one-way hash. We never put it in the light.</p>
        </form>

        <p className="auth-card__switch">
          Already have a room?{' '}
          <Link to="/auth/login">Come back in</Link>
        </p>
        <Link to="/landing" className="auth-card__public">Or just look around <Icon name="arrow-right" size={14} /></Link>
      </section>
      <p className="auth-page__note t-small t-mute">No rush. The night is long.</p>
    </main>
  );
}
