import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function SettingsSecurity() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  // Change email state
  const [newEmail, setNewEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState({ type: '', text: '' });
  const [changingEmail, setChangingEmail] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSecurityData();
  }, []);

  async function loadSecurityData() {
    try {
      const [sessRes, actRes] = await Promise.all([
        fetch('/api/auth/sessions', { credentials: 'same-origin' }),
        fetch('/api/auth/activity', { credentials: 'same-origin' })
      ]);
      if (sessRes.ok) {
        const data = await sessRes.json();
        setSessions(data.sessions || []);
      }
      if (actRes.ok) {
        const data = await actRes.json();
        setActivity(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load security data:', err);
    } finally {
      setLoadingSessions(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setPasswordMessage({ type: 'success', text: 'Password changed successfully. All other sessions have been signed out.' });
      setCurrentPassword('');
      setNewPassword('');
      loadSecurityData();
    } catch (err: unknown) {
      setPasswordMessage({ type: 'error', text: (err as Error)?.message || 'Failed to change password' });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setChangingEmail(true);
    setEmailMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to request email change');
      setEmailMessage({ type: 'success', text: 'Check your new email inbox to confirm the change.' });
      setNewEmail('');
    } catch (err: unknown) {
      setEmailMessage({ type: 'error', text: (err as Error)?.message || 'Failed to request email change' });
    } finally {
      setChangingEmail(false);
    }
  }

  async function handleRevokeOthers() {
    try {
      const res = await fetch('/api/auth/sessions/revoke-others', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.ok) {
        loadSecurityData();
      }
    } catch (err) {
      console.error('Failed to revoke sessions:', err);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        await signOut();
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 className="t-h1" style={{ margin: 0 }}>Account Security</h1>
          <p className="t-small t-mute">Manage your password, email, active sessions, and security log.</p>
        </div>
        <Link to="/settings" className="btn" style={{ textDecoration: 'none' }}>
          Back to Settings
        </Link>
      </div>

      {/* Change Password */}
      <section className="auth-card" style={{ maxWidth: '100%', marginBottom: '24px', padding: '24px' }}>
        <h2 className="t-h2" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Change Password</h2>
        {passwordMessage.text && (
          <p className={passwordMessage.type === 'error' ? 'auth-form__error' : 't-small'} style={{ color: passwordMessage.type === 'success' ? '#639f75' : undefined, marginBottom: '12px' }}>
            {passwordMessage.text}
          </p>
        )}
        <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label className="auth-label" htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              required
              className="input auth-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="auth-label" htmlFor="newPasswordSec">New Password (8-128 chars, 1 number/symbol)</label>
            <input
              id="newPasswordSec"
              type="password"
              required
              className="input auth-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={changingPassword} style={{ width: 'fit-content' }}>
            {changingPassword ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* Change Email */}
      <section className="auth-card" style={{ maxWidth: '100%', marginBottom: '24px', padding: '24px' }}>
        <h2 className="t-h2" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Change Email</h2>
        <p className="t-small t-mute" style={{ marginBottom: '12px' }}>Current email: <strong>{user?.email}</strong> {user?.emailChangePending && <span style={{ color: '#d97706' }}>(Change pending confirmation)</span>}</p>
        {emailMessage.text && (
          <p className={emailMessage.type === 'error' ? 'auth-form__error' : 't-small'} style={{ color: emailMessage.type === 'success' ? '#639f75' : undefined, marginBottom: '12px' }}>
            {emailMessage.text}
          </p>
        )}
        <form onSubmit={handleEmailChange} style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label className="auth-label" htmlFor="newEmail">New Email Address</label>
            <input
              id="newEmail"
              type="email"
              required
              className="input auth-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={changingEmail} style={{ width: 'fit-content' }}>
            {changingEmail ? 'Sending confirmation…' : 'Change Email'}
          </button>
        </form>
      </section>

      {/* Active Sessions */}
      <section className="auth-card" style={{ maxWidth: '100%', marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="t-h2" style={{ fontSize: '1.2rem', margin: 0 }}>Active Sessions</h2>
          {sessions.length > 1 && (
            <button type="button" className="btn" onClick={() => void handleRevokeOthers()} style={{ fontSize: '0.85rem' }}>
              Sign out all other sessions
            </button>
          )}
        </div>
        {loadingSessions ? (
          <p className="t-small t-mute">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="t-small t-mute">No active sessions found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--tp-surf)', borderRadius: 'var(--tp-r-sm)', border: '1px solid var(--tp-line)' }}>
                <div>
                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {s.device}
                    {s.isCurrent && <span className="badge" style={{ background: 'var(--tp-acc)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>This device</span>}
                  </div>
                  <div className="t-small t-mute" style={{ marginTop: '4px' }}>IP: {s.ip} • Last active: {new Date(s.lastUsedAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity Log */}
      <section className="auth-card" style={{ maxWidth: '100%', marginBottom: '24px', padding: '24px' }}>
        <h2 className="t-h2" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Recent Security Activity</h2>
        {activity.length === 0 ? (
          <p className="t-small t-mute">No recent security events logged.</p>
        ) : (
          <div style={{ display: 'grid', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
            {activity.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--tp-surf)', borderRadius: 'var(--tp-r-sm)', fontSize: '0.9rem' }}>
                <div>
                  <strong style={{ textTransform: 'capitalize' }}>{ev.eventType.replaceAll('_', ' ')}</strong>
                  <div className="t-small t-mute">{ev.ip || 'Unknown IP'} • {ev.userAgent ? ev.userAgent.substring(0, 40) : 'Browser'}</div>
                </div>
                <div className="t-small t-mute">{new Date(ev.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete Account */}
      <section className="auth-card" style={{ maxWidth: '100%', padding: '24px', border: '1px solid #ef444433' }}>
        <h2 className="t-h2" style={{ fontSize: '1.2rem', color: '#ef4444', marginBottom: '8px' }}>Delete Account</h2>
        <p className="t-small t-mute" style={{ marginBottom: '16px' }}>Permanently deactivate your Nocturne account and remove your personal data.</p>
        <button type="button" className="btn" onClick={() => setShowDeleteModal(true)} style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444455' }}>
          Delete Account…
        </button>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#181b22', padding: '24px', borderRadius: '12px', maxWidth: '400px', width: '100%', border: '1px solid #2a2f3d' }}>
            <h3 className="t-h3" style={{ color: '#ef4444', marginBottom: '12px' }}>Are you absolutely sure?</h3>
            <p className="t-small t-mute" style={{ marginBottom: '16px' }}>This action cannot be undone. Type <strong>DELETE</strong> below to confirm.</p>
            <input
              type="text"
              className="input auth-input"
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              style={{ marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn"
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                onClick={() => void handleDeleteAccount()}
                style={{ background: '#ef4444', color: '#fff' }}
              >
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
