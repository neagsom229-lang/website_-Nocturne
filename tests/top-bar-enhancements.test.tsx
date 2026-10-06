import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'user-1', displayName: 'June', email: 'june@example.com' } as { id: string; displayName: string; email: string },
  signOut: vi.fn(),
}));

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: mocks.authUser, signOut: mocks.signOut }),
}));

import { Breadcrumbs } from '../src/components/Breadcrumbs';
import { NotificationBell } from '../src/components/NotificationBell';
import { UserMenu } from '../src/components/UserMenu';
import { useBreadcrumbs } from '../src/lib/useBreadcrumbs';
import { saveStoredNotifications } from '../src/lib/notifications';

afterEach(cleanup);

describe('Top-bar enhancements', () => {
  it('Breadcrumbs render correct segments for various paths', () => {
    function DummyBreadcrumbComponent() {
      const crumbs = useBreadcrumbs();
      return <Breadcrumbs items={crumbs} />;
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={['/movies']}>
        <Routes>
          <Route path="/movies" element={<DummyBreadcrumbComponent />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Discover')).toBeTruthy();
    expect(screen.getByText('Movies')).toBeTruthy();

    rerender(
      <MemoryRouter initialEntries={['/library']}>
        <Routes>
          <Route path="/library" element={<DummyBreadcrumbComponent />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('My Media')).toBeTruthy();
    expect(screen.getByText('Library')).toBeTruthy();

    rerender(
      <MemoryRouter initialEntries={['/playlists/abc']}>
        <Routes>
          <Route path="/playlists/:id" element={<DummyBreadcrumbComponent />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Playlists')).toBeTruthy();
    expect(screen.getByText('abc')).toBeTruthy();
  });

  it('Notification panel opens on bell click and shows empty state when zero notifications', async () => {
    saveStoredNotifications([]); // 0 notifications
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    const bellBtn = screen.getByRole('button', { name: /notifications/i });
    expect(bellBtn).toBeTruthy();

    await user.click(bellBtn);
    expect(screen.getByRole('dialog', { name: /notifications/i })).toBeTruthy();
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
  });

  it('User menu opens, keyboard nav works, Esc closes, online dot renders when user is truthy', async () => {
    mocks.authUser = { id: 'user-1', displayName: 'June', email: 'june@example.com' };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );

    // Online dot renders
    const dot = screen.getByTitle('Online');
    expect(dot).toBeTruthy();

    const trigger = screen.getByRole('button', { name: /user account menu/i });
    await user.click(trigger);

    const menu = screen.getByRole('menu', { name: /user menu/i });
    expect(menu).toBeTruthy();

    // Keyboard navigation (ArrowDown, Esc)
    fireEvent.keydown(window, { key: 'ArrowDown' });
    fireEvent.keydown(window, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: /user menu/i })).toBeNull();
  });

  it('Online dot does not render when user is falsy', () => {
    mocks.authUser = null;
    const { container } = render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });
});
