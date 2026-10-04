import { useState } from 'react';
import { Icon } from '../Icon';
import { QueuePanel } from './QueuePanel';
import type { ExternalMedia } from '../../lib/workspaceHooks';

export function QueueButton({
  queue,
  currentIndex,
  onClear,
  onRemove,
  onSelectIndex,
}: {
  queue: ExternalMedia[];
  currentIndex: number;
  onClear: () => void;
  onRemove: (index: number) => void;
  onSelectIndex: (index: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const count = queue.length;
  const badgeText = count > 9 ? '9+' : String(count);

  return (
    <div className="queue-button-wrapper">
      <button
        type="button"
        className="workspace-player__iconbtn queue-btn"
        aria-label="Queue"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Icon name="library" size={18} />
        {count > 0 && <span className="queue-badge">{badgeText}</span>}
      </button>
      <QueuePanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        queue={queue}
        currentIndex={currentIndex}
        onClear={onClear}
        onRemove={onRemove}
        onSelectIndex={onSelectIndex}
      />
    </div>
  );
}
