import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import { SmartImage } from '../SmartImage';
import type { ExternalMedia } from '../../lib/workspaceHooks';
import { useFocusTrap } from '../../lib/useFocusTrap';

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
  useFocusTrap(panelRef, isOpen);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="queue-overlay" onClick={onClose}>
      <div
        className="queue-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Playback Queue"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="queue-panel__header">
          <h3>Playback Queue</h3>
          <div className="queue-panel__actions">
            {queue.length > 0 ? (
              <button type="button" className="queue-panel__clear" onClick={onClear}>
                Clear queue
              </button>
            ) : null}
            <button type="button" className="queue-panel__close" aria-label="Close queue" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
        </header>

        <div className="queue-panel__content">
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
                        <SmartImage src={item.thumbnailUrl} alt="" loading="lazy" />
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
