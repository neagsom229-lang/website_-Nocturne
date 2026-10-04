import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { getStoredNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from '../lib/notifications';
import { useFocusTrap } from '../lib/useFocusTrap';

export function NotificationPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      setNotifications(getStoredNotifications());
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayItems = notifications.slice(0, 10);

  function handleMarkAll() {
    const updated = markAllNotificationsRead();
    setNotifications(updated);
  }

  function handleItemClick(id: string) {
    const updated = markNotificationRead(id);
    setNotifications(updated);
  }

  return (
    <div className="notification-panel-backdrop" role="presentation">
      <div className="notification-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Notifications">
        <div className="notification-panel__header">
          <strong>Notifications</strong>
          {unreadCount > 0 && (
            <button type="button" className="notification-panel__mark-read" onClick={handleMarkAll}>
              Mark all read
            </button>
          )}
          <button type="button" className="notification-panel__close" onClick={onClose} aria-label="Close notifications">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="notification-panel__body">
          {displayItems.length === 0 ? (
            <div className="notification-panel__empty">
              <p>You&apos;re all caught up.</p>
            </div>
          ) : (
            <div className="notification-panel__list">
              {displayItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notification-item ${item.read ? '' : 'is-unread'}`}
                  onClick={() => handleItemClick(item.id)}
                >
                  <span className="notification-item__icon">
                    <Icon name={(item.icon as any) || 'bell'} size={15} />
                  </span>
                  <div className="notification-item__content">
                    <div className="notification-item__title-row">
                      <strong>{item.title}</strong>
                      <span className="notification-item__time">{item.timestamp}</span>
                    </div>
                    <p className="notification-item__body">{item.body}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="notification-panel__footer">
          <Link to="/notifications" onClick={onClose}>View all</Link>
        </div>
      </div>
    </div>
  );
}
