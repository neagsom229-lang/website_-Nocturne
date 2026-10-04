import { useLocation } from 'react-router-dom';

export type Crumb = {
  label: string;
  to?: string;
};

export function useBreadcrumbs(customTitle?: string): Crumb[] {
  const location = useLocation();
  const path = location.pathname;

  if (path === '/' || path === '/tapes' || path === '/home') {
    return [{ label: 'Home', to: '/tapes' }];
  }
  if (path === '/movies') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Discover', to: '/tapes' }, { label: 'Movies' }];
  }
  if (path.startsWith('/movies/')) {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Discover', to: '/tapes' }, { label: 'Movies', to: '/movies' }, { label: customTitle || 'Details' }];
  }
  if (path === '/library') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'My Media', to: '/library' }, { label: 'Library' }];
  }
  if (path === '/playlists') {
    const tab = new URLSearchParams(location.search).get('tab');
    return [{ label: 'Home', to: '/tapes' }, { label: 'My Media', to: '/library' }, { label: tab === 'discover' ? 'Discover Playlists' : 'Playlists' }];
  }
  if (path.startsWith('/playlists/')) {
    return [{ label: 'Home', to: '/tapes' }, { label: 'My Media', to: '/playlists' }, { label: 'Playlists', to: '/playlists' }, { label: customTitle || 'Details' }];
  }
  if (path.startsWith('/u/')) {
    return [{ label: 'Home', to: '/tapes' }, { label: 'People', to: '/community' }, { label: customTitle || 'Profile' }];
  }
  if (path === '/settings') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Settings' }];
  }
  if (path === '/settings/security') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Settings', to: '/settings' }, { label: 'Security' }];
  }
  if (path === '/settings/appearance') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Settings', to: '/settings' }, { label: 'Appearance' }];
  }
  if (path === '/trending') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Discover', to: '/tapes' }, { label: 'Trending' }];
  }
  if (path === '/search') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Discover', to: '/tapes' }, { label: 'Search Hub' }];
  }
  if (path === '/chat') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Social', to: '/community' }, { label: 'Chat' }];
  }
  if (path === '/community') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Social', to: '/community' }, { label: 'Community Feed' }];
  }
  if (path === '/diary') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Personal', to: '/diary' }, { label: 'Song Diary' }];
  }
  if (path === '/mood') {
    return [{ label: 'Home', to: '/tapes' }, { label: 'Personal', to: '/diary' }, { label: 'Mood Check-in' }];
  }

  const segments = path.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Home', to: '/tapes' }];
  let accumulated = '';
  segments.forEach((seg, i) => {
    accumulated += `/${seg}`;
    const label = customTitle && i === segments.length - 1 ? customTitle : seg.replace(/-/g, ' ');
    crumbs.push({ label, to: i < segments.length - 1 ? accumulated : undefined });
  });
  return crumbs;
}
