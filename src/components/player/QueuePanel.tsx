import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import type { ExternalMedia } from '../../lib/workspaceHooks';

export function QueuePanel({
  isOpen,
  onClose,
  queue,
  currentIndex,
  onClear,
  onRemove,
  onSelectIndex,
}: {
  isOpen: boolean;
  onClose: () => void;
  queue: ExternalMedia[];
  currentIndex: number;
  onClear: () => void;
  onRemove: (index: number) => void;
  onSelectIndex: (index: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="queue-panel-backdrop" role="presentation">
      <div className="queue-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Queue">
        <div className="queue-panel__header">
          <strong>Queue</strong>
          {queue.length > 0 && (
            <button type="button" className="queue-panel__clear" onClick={onClear}>
              Clear
            </button>
          )}
          <button type="button" className="queue-panel__close" onClick={onClose} aria-label="Close queue">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="queue-panel__body">
          {queue.length === 0 ? (
            <div className="queue-panel__empty">
              <p>Nothing queued. Play something to start building your queue.</p>
            </div>
          ) : (
            <div className="queue-panel__list">
              {queue.map((item, index) => {
                const isActive = index === currentIndex;
                return (
                  <div key={`${item.externalId}-${index}`} className={`queue-item ${isActive ? 'is-active' : ''}`}>
                    <span className="queue-item__handle" aria-hidden="true">⠿</span>
                    <button type="button" className="queue-item__main" onClick={() => onSelectIndex(index)}>
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="queue-item__fallback"><Icon name="headphones" size={13} /></span>
                      )}
                      <div className="queue-item__copy">
                        <strong>{item.title}</strong>
                        <span>{item.artist || item.provider}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="queue-item__remove"
                      onClick={() => onRemove(index)}
                      aria-label={`Remove ${item.title} from queue`}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
