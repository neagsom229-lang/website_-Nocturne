import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { NotificationPanel } from './NotificationPanel';
import { getStoredNotifications } from '../lib/notifications';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const checkUnread = () => {
      const items = getStoredNotifications();
      setUnreadCount(items.filter((n) => !n.read).length);
    };
    checkUnread();
    const interval = setInterval(checkUnread, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div className="notification-bell-wrapper">
      <button
        type="button"
        className={`workspace-topbar__notifications ${unreadCount > 0 ? 'has-unread' : ''}`}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Icon name="bell" size={19} />
        {unreadCount > 0 && <span className="notification-badge">{badgeText}</span>}
      </button>
      <NotificationPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
