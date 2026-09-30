import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from './AuthContext';

export function ProtectedRoutes() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (loading) {
    return <main className="auth-loading" role="status">Turning the little key…</main>;
  }
  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  async function onSignOut() {
    setError('');
    try {
      await signOut();
      navigate('/auth/login', { replace: true });
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not sign out.');
    }
  }

  return (
    <>
      <div className="auth-session-bar">
        <span><Icon name="user" size={14} /> {user.displayName}</span>
        <button type="button" onClick={() => void onSignOut()}>Sign out</button>
      </div>
      {error ? <div className="auth-session-error" role="alert">{error}</div> : null}
      <Outlet />
    </>
  );
}

function AuthCard({ children, mode }: { children: ReactNode; mode: 'login' | 'register' }) {
  return (
    <main className="auth-page">
      <div className="tp-fx auth-page__fx" aria-hidden="true" />
      <Link to="/" className="nav__logo auth-brand"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="auth-card__lamp" aria-hidden="true">✳</span>
        <p className="t-eyebrow">{mode === 'login' ? 'THE LIGHT WAS LEFT ON' : 'MAKE A LITTLE ROOM FOR YOURSELF'}</p>
        <h1 id="auth-title" className="t-h1">{mode === 'login' ? 'Come on in.' : 'Stay a little.'}</h1>
        <p className="t-small t-mute">
          {mode === 'login' ? 'Your listening room is right where you left it.' : 'A quiet place for the songs and stories you keep.'}
        </p>
        {children}
        <p className="auth-card__switch">
          {mode === 'login' ? 'New around here?' : 'Already have a room?'}{' '}
          <Link to={mode === 'login' ? '/auth/register' : '/auth/login'}>
            {mode === 'login' ? 'Make an account' : 'Come back in'}
          </Link>
        </p>
        <Link to="/landing" className="auth-card__public">Or just look around <Icon name="arrow-right" size={14} /></Link>
      </section>
      <p className="auth-page__note t-small t-mute">No rush. The night is long.</p>
    </main>
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading, signIn, signUp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/tapes';

  if (loading) return <main className="auth-loading" role="status">Turning the little key…</main>;
  if (user) return <Navigate to={destination} replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'register') await signUp(displayName, email, password);
      else await signIn(email, password);
      navigate(destination, { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'That didn’t work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard mode={mode}>
      <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
        {mode === 'register' ? (
          <label className="diary-field">
            <span>What should we call you?</span>
            <input autoComplete="name" required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
          </label>
        ) : null}
        <label className="diary-field">
          <span>Email</span>
          <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@somewhere.com" />
        </label>
        <label className="diary-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 8 : undefined}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
          />
        </label>
        {error ? <p className="auth-form__error" role="alert">{error}</p> : null}
        <button type="submit" className="btn btn--primary auth-form__submit" disabled={submitting}>
          {submitting ? 'One second…' : mode === 'login' ? 'Come back in' : 'Make my account'}
          <Icon name="arrow-right" size={16} />
        </button>
        <p className="auth-form__privacy">Your password is stored as a one-way hash. We never put it in the light.</p>
      </form>
    </AuthCard>
  );
}

