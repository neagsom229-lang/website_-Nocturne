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
      const isMac = /Mac|iPhone|iPad/.test(
        (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || ''
      );
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      const target = document.activeElement as HTMLElement;
      const isEditing = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target?.isContentEditable;

      if ((cmdKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !isEditing)) {
        e.preventDefault();
        if (isOpen) close();
        else open();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close]);

  return { isOpen, open, close };
}
