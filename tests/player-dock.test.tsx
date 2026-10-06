import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { useQueue } from '../src/lib/useQueue';
import { useSleepTimer } from '../src/lib/useSleepTimer';
import { usePlaybackModes } from '../src/lib/usePlaybackModes';
import { QueueButton } from '../src/components/player/QueueButton';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Player Dock enhancements', () => {
  it('useQueue manages queue items, adding, removing, and clearing', () => {
    function DummyQueueTest() {
      const { queue, addToQueue, removeFromQueue, clearQueue } = useQueue();
      return (
        <div>
          <span data-testid="count">{queue.length}</span>
          <button type="button" onClick={() => addToQueue({ type: 'audio', provider: 'audius', externalId: '1', title: 'Song 1', artist: 'Artist', thumbnailUrl: null, streamUrl: 'url', externalUrl: null })}>Add</button>
          <button type="button" onClick={() => removeFromQueue(0)}>Remove</button>
          <button type="button" onClick={clearQueue}>Clear</button>
        </div>
      );
    }

    const { getByTestId, getByRole } = render(<DummyQueueTest />);
    expect(getByTestId('count').textContent).toBe('0');
    fireEvent.click(getByRole('button', { name: 'Add' }));
    expect(getByTestId('count').textContent).toBe('1');
    fireEvent.click(getByRole('button', { name: 'Clear' }));
    expect(getByTestId('count').textContent).toBe('0');
  });

  it('usePlaybackModes persists shuffle to localStorage and cycles repeat', () => {
    function DummyModesTest() {
      const { shuffle, repeat, toggleShuffle, cycleRepeat } = usePlaybackModes();
      return (
        <div>
          <span data-testid="shuffle">{String(shuffle)}</span>
          <span data-testid="repeat">{repeat}</span>
          <button type="button" onClick={toggleShuffle}>ToggleShuffle</button>
          <button type="button" onClick={cycleRepeat}>CycleRepeat</button>
        </div>
      );
    }

    const { getByTestId, getByRole } = render(<DummyModesTest />);
    expect(getByTestId('repeat').textContent).toBe('off');
    fireEvent.click(getByRole('button', { name: 'CycleRepeat' }));
    expect(getByTestId('repeat').textContent).toBe('all');
    fireEvent.click(getByRole('button', { name: 'CycleRepeat' }));
    expect(getByTestId('repeat').textContent).toBe('one');
    fireEvent.click(getByRole('button', { name: 'CycleRepeat' }));
    expect(getByTestId('repeat').textContent).toBe('off');

    fireEvent.click(getByRole('button', { name: 'ToggleShuffle' }));
    expect(localStorage.getItem('nocturne.player.shuffle')).toBe('true');
  });

  it('Sleep timer sets a timeout and triggers onComplete', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    function DummySleepTest() {
      const { timerMode, timeLeftMinutes, setTimer } = useSleepTimer(onComplete);
      return (
        <div>
          <span data-testid="mode">{timerMode}</span>
          <span data-testid="time">{timeLeftMinutes}</span>
          <button type="button" onClick={() => setTimer('15')}>Set15</button>
        </div>
      );
    }

    const { getByTestId, getByRole } = render(<DummySleepTest />);
    fireEvent.click(getByRole('button', { name: 'Set15' }));
    expect(getByTestId('mode').textContent).toBe('15');
    expect(getByTestId('time').textContent).toBe('15');

    await act(async () => { vi.advanceTimersByTime(15 * 60 * 1000); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('Queue button shows correct badge count and opens panel', async () => {
    const queue = [
      { type: 'audio' as const, provider: 'audius' as const, externalId: '1', title: 'Song 1', artist: 'Artist', thumbnailUrl: null, streamUrl: 'url', externalUrl: null },
    ];
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QueueButton
          queue={queue}
          currentIndex={0}
          onClear={vi.fn()}
          onRemove={vi.fn()}
          onSelectIndex={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('1')).toBeTruthy();
    const btn = screen.getByRole('button', { name: /^queue$/i });
    await user.click(btn);
    expect(screen.getByRole('dialog', { name: /^queue$/i })).toBeTruthy();
    expect(screen.getByText('Song 1')).toBeTruthy();
  });
});
