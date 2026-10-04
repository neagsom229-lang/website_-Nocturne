import { useState, useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import type { SleepTimerOption } from '../../lib/useSleepTimer';

export function SleepTimer({
  timerMode,
  timeLeftMinutes,
  setTimer,
}: {
  timerMode: SleepTimerOption;
  timeLeftMinutes: number | null;
  setTimer: (mode: SleepTimerOption) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isActive = timerMode !== 'off';

  const options: { label: string; value: SleepTimerOption }[] = [
    { label: '15 min', value: '15' },
    { label: '30 min', value: '30' },
    { label: '60 min', value: '60' },
    { label: 'End of track', value: 'track' },
    { label: 'Off', value: 'off' },
  ];

  return (
    <div className="sleep-timer-wrapper" ref={menuRef}>
      <button
        type="button"
        className={`workspace-player__iconbtn sleep-timer-btn ${isActive ? 'is-active' : ''}`}
        aria-label="Sleep timer"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Icon name="moon" size={18} />
        {isActive && timeLeftMinutes !== null && (
          <span className="sleep-timer-countdown">{timeLeftMinutes}m</span>
        )}
      </button>

      {isOpen && (
        <div className="sleep-timer-dropdown" role="menu" aria-label="Sleep timer options">
          <div className="sleep-timer-header">Sleep Timer</div>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              className={`sleep-timer-option ${timerMode === opt.value ? 'is-selected' : ''}`}
              onClick={() => {
                setTimer(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
