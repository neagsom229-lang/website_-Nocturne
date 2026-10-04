import { useState, useEffect, useCallback } from 'react';

export type RepeatMode = 'off' | 'all' | 'one';

export function usePlaybackModes() {
  const [shuffle, setShuffle] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nocturne.player.shuffle') === 'true';
    } catch {
      return false;
    }
  });

  const [repeat, setRepeat] = useState<RepeatMode>(() => {
    try {
      return (localStorage.getItem('nocturne.player.repeat') as RepeatMode) || 'off';
    } catch {
      return 'off';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('nocturne.player.shuffle', String(shuffle));
    } catch {}
  }, [shuffle]);

  useEffect(() => {
    try {
      localStorage.setItem('nocturne.player.repeat', repeat);
    } catch {}
  }, [repeat]);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      if (r === 'off') return 'all';
      if (r === 'all') return 'one';
      return 'off';
    });
  }, []);

  return { shuffle, repeat, toggleShuffle, cycleRepeat };
}
