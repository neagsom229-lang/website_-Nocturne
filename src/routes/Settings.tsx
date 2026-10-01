import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { FollowButton } from '../components/FollowButton';
import { WorkspaceShell } from '../components/WorkspaceShell';
import { deleteMyAccount, getMyProfile, getUserConnections, updateMyProfile, type SocialUser } from '../lib/socialApi';

export function Settings() {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [people, setPeople] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const activeTab = params.get('tab') === 'following' ? 'following' : 'profile';

  useEffect(() => {
    let active = true;
    void Promise.all([getMyProfile(), getUserConnections(user?.id ?? '', 'following')])
      .then(([profile, following]) => {
        if (!active) return;
        setDisplayName(profile.displayName);
        setBio(profile.bio ?? '');
        setAvatarUrl(profile.avatarUrl ?? '');
        setIsPublic(profile.isPublic);
        setPeople(following);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your settings.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await updateMyProfile({ displayName: displayName.trim(), bio, avatarUrl: avatarUrl.trim() || null, isPublic });
      setMessage('Your profile is up to date.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount() {
    setError('');
    try {
      await deleteMyAccount();
      await signOut();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete your account.');
      setConfirmDelete(false);
    }
  }

  function selectTab(next: 'profile' | 'following') {
    const nextParams = new URLSearchParams(params);
    if (next === 'profile') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  return (
    <WorkspaceShell>
      <main className="social-page settings-page">
        <header className="social-page__heading">
          <p className="social-eyebrow">YOUR CORNER</p>
          <h1>Settings</h1>
        </header>
        <div className="profile-tabs settings-tabs" role="tablist" aria-label="Settings sections">
          <button type="button" role="tab" aria-selected={activeTab === 'profile'} onClick={() => selectTab('profile')}>Profile & account</button>
          <button type="button" role="tab" aria-selected={activeTab === 'following'} onClick={() => selectTab('following')}>Following</button>
        </div>
        {loading ? <p role="status">Loading your settings…</p> : null}
        {error ? <p className="social-inline-error" role="alert">{error}</p> : null}
        {!loading && activeTab === 'profile' ? (
          <div className="settings-columns">
            <form className="settings-panel" onSubmit={(event) => void saveProfile(event)}>
              <h2>Profile</h2>
              <div className="settings-avatar-preview">
                <Avatar name={displayName || 'Listener'} src={avatarUrl} size="large" />
                <span>Live preview</span>
              </div>
              <label>Display name
                <input maxLength={60} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              </label>
              <label>Bio
                <textarea maxLength={280} rows={4} value={bio} onChange={(event) => setBio(event.target.value)} />
                <small>{bio.length}/280</small>
              </label>
              <label>Avatar URL
                <input type="url" placeholder="https://…" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
              </label>
              <label className="settings-toggle">
                <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
                <span>Public profile</span>
              </label>
              <p className="settings-profile-privacy">
                Your profile is private by default. Turn this on to let others see your playlists and activity.
              </p>
              {message ? <p role="status">{message}</p> : null}
              <button className="social-button social-button--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </form>
            <section className="settings-panel settings-account">
              <h2>Account</h2>
              <label>Email
                <input value={user?.email ?? ''} readOnly />
              </label>
              <p>Password changes will be available in a future update.</p>
              <hr />
              <div className="settings-danger">
                <h3>Danger zone</h3>
                <p>Soft-delete your account. Your profile will no longer be visible.</p>
                <button className="social-button social-button--danger" onClick={() => setConfirmDelete(true)}>Delete account</button>
              </div>
            </section>
          </div>
        ) : null}
        {!loading && activeTab === 'following' ? (
          <section className="profile-people-grid">
            {people.map((person) => (
              <article className="profile-person" key={person.id}>
                <Link className="profile-person__identity" to={`/u/${encodeURIComponent(person.id)}`}>
                  <Avatar name={person.displayName} src={person.avatarUrl} size="medium" />
                  <strong>{person.displayName}</strong>
                </Link>
                <FollowButton userId={person.id} initialFollowing={person.isFollowing} />
              </article>
            ))}
            {!people.length ? <p className="social-empty">You’re not following anyone yet.</p> : null}
          </section>
        ) : null}
        {confirmDelete ? (
          <div className="social-modal-backdrop" role="presentation">
            <section className="social-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
              <h2 id="delete-account-title">Delete your account?</h2>
              <p>Your profile will be hidden and your session will end. This cannot be undone here.</p>
              <div className="social-modal__actions">
                <button className="social-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="social-button social-button--danger" onClick={() => void removeAccount()}>Delete account</button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </WorkspaceShell>
  );
}
