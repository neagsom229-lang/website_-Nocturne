export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  icon?: string;
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'New mix added to Discovery',
    body: 'Late night ambient tapes have been updated for your timezone.',
    timestamp: '10m ago',
    read: false,
    icon: 'sparkle',
  },
  {
    id: 'notif-2',
    title: 'Profile milestone',
    body: '5 friends started following your midnight listening room.',
    timestamp: '1h ago',
    read: false,
    icon: 'users',
  },
  {
    id: 'notif-3',
    title: 'Security alert',
    body: 'New sign-in detected from Windows device in your region.',
    timestamp: 'Yesterday',
    read: true,
    icon: 'settings',
  },
];

const STORAGE_KEY = 'nocturne_notifications_v1';

export function getStoredNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveStoredNotifications(items: NotificationItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('notifications:changed'));
  } catch {}
}

export function markNotificationRead(id: string): NotificationItem[] {
  const items = getStoredNotifications().map((item) => (item.id === id ? { ...item, read: true } : item));
  saveStoredNotifications(items);
  return items;
}

export function markAllNotificationsRead(): NotificationItem[] {
  const items = getStoredNotifications().map((item) => ({ ...item, read: true }));
  saveStoredNotifications(items);
  return items;
}
