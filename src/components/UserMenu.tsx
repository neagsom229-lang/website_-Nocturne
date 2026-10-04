import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';
import { useFocusTrap } from '../lib/useFocusTrap';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(menuRef, isOpen);

  const items = [
    { label: 'View profile', to: user ? `/u/${encodeURIComponent(user.id)}` : '/auth/login', icon: 'user' as const },
    { label: 'Settings', to: '/settings', icon: 'settings' as const },
    { label: 'Security', to: '/settings/security', icon: 'shield' as const },
    { label: 'Sign out', action: 'signout', icon: 'close' as const, isDanger: true },
  ];

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[selectedIndex];
        if (item) {
          if (item.action === 'signout') {
            void signOut().then(() => {
              setIsOpen(false);
              navigate('/auth/login', { replace: true });
            });
          } else if (item.to) {
            navigate(item.to);
            setIsOpen(false);
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, items, navigate, signOut, closeMenu]);

  if (!user) return null;

  const initials = (user.displayName ?? 'N').slice(0, 1).toUpperCase();

  return (
    <div className="user-menu-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className="workspace-account__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User account menu"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSelectedIndex(0);
        }}
      >
        <div className="user-avatar-container">
          <div className="workspace-account__avatar">{initials}</div>
          <span className="online-indicator" title="Online" aria-label="Online" />
        </div>
        <span className="workspace-account__name">{user.displayName ?? 'Listener'}</span>
        <Icon name="chevron-down" size={15} />
      </button>

      {isOpen && (
        <div className="user-dropdown-menu" ref={menuRef} role="menu" aria-label="User menu">
          <div className="user-dropdown-header">
            <div className="user-avatar-container user-avatar-container--large">
              <div className="workspace-account__avatar workspace-account__avatar--large">{initials}</div>
              <span className="online-indicator" title="Online" aria-label="Online" />
            </div>
            <div className="user-dropdown-identity">
              <strong>{user.displayName ?? 'Listener'}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <div className="user-dropdown-divider" />
          <div className="user-dropdown-items">
            {items.map((item, index) => {
              const isSelected = selectedIndex === index;
              if (item.action === 'signout') {
                return (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className={`user-dropdown-item user-dropdown-item--danger ${isSelected ? 'is-selected' : ''}`}
                    onClick={async () => {
                      setIsOpen(false);
                      await signOut();
                      navigate('/auth/login', { replace: true });
                    }}
                  >
                    <Icon name={item.icon} size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              }
              return (
                <Link
                  key={item.label}
                  role="menuitem"
                  to={item.to!}
                  className={`user-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon name={item.icon} size={14} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
