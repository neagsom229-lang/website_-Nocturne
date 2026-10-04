import { useState, useEffect, useCallback, useRef } from 'react';

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((trigger?: HTMLElement | null) => {
    if (trigger) triggerRef.current = trigger;
    else if (document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if ((cmdKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        if (isOpen) close();
        else open();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close]);

  return { isOpen, open, close };
}
