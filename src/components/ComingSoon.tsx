import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import '../styles/page-state.css';

export function ComingSoon({
  title,
  body,
  icon = 'sparkle',
  relatedLabel = 'Search Hub',
  relatedHref = '/search',
}: {
  title: string;
  body: string;
  icon?: IconName;
  relatedLabel?: string;
  relatedHref?: string;
}) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      const waitlist = JSON.parse(localStorage.getItem('nocturne_waitlist') || '[]');
      localStorage.setItem('nocturne_waitlist', JSON.stringify([...waitlist, { email, feature: title, date: new Date().toISOString() }]));
      setSubmitted(true);
    } catch {}
  }

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-mockup" aria-hidden="true" />
      <span className="page-state__icon"><Icon name={icon} size={32} /></span>
      <h1 className="t-h1" style={{ fontSize: '28px', marginBottom: '6px' }}>{title}</h1>
      <p className="t-body" style={{ color: 'var(--tp-mute)', marginBottom: '8px' }}>Coming in v0.4</p>
      <div className="coming-soon-progress">
        <div className="coming-soon-progress__bar" />
      </div>
      <p style={{ color: 'var(--tp-mute)', fontSize: '14px', margin: '16px 0' }}>{body}</p>
      {submitted ? (
        <p style={{ color: 'var(--tp-acc)', margin: '16px 0' }}>You&apos;re on the waitlist!</p>
      ) : (
        <form onSubmit={handleSubmit} className="coming-soon-waitlist">
          <input
            type="email"
            placeholder="Enter your email for early access…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn btn--primary" style={{ padding: '10px 16px', borderRadius: '10px' }}>Join waitlist</button>
        </form>
      )}
      <div style={{ marginTop: '24px' }}>
        <Link to={relatedHref} className="btn btn--ghost" style={{ color: 'var(--tp-acc)', textDecoration: 'none', fontSize: '13px' }}>
          Explore {relatedLabel} instead <Icon name="arrow-right" size={14} />
        </Link>
      </div>
    </div>
  );
}
