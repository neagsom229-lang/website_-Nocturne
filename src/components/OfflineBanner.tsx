import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import '../styles/page-state.css';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <Icon name="refresh" size={16} />
      <span>You&apos;re offline. Some things may not load.</span>
    </div>
  );
}
