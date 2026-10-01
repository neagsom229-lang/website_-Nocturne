import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { followUser, unfollowUser } from '../lib/socialApi';

export function FollowButton({
  userId,
  initialFollowing,
  onChange,
}: {
  userId: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
}) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (!user) return;
    const previous = following;
    const next = !previous;
    setFollowing(next);
    onChange?.(next);
    setBusy(true);
    setError('');
    try {
      if (next) await followUser(userId);
      else await unfollowUser(userId);
    } catch (toggleError) {
      setFollowing(previous);
      onChange?.(previous);
      setError(toggleError instanceof Error ? toggleError.message : 'Could not update follow status.');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <Link className="social-button" to="/auth/login">Sign in to follow</Link>;
  return (
    <span className="social-action">
      <button
        type="button"
        className={`social-button${following ? ' is-active' : ''}`}
        aria-pressed={following}
        disabled={busy || user.id === userId}
        onClick={() => void toggle()}
      >{following ? 'Following' : 'Follow'}</button>
      {error ? <span className="social-inline-error" role="alert">{error}</span> : null}
    </span>
  );
}
