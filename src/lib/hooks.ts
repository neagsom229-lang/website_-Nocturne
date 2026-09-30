import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Persisted state for the demos, so taps survive a refresh. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initial : (JSON.parse(stored) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — the demo still works in memory */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * Every list in the pack has a skeleton state. This simulates the first fetch so the
 * skeletons are real, not decorative — and it never runs longer than one beat.
 */
export function useSimulatedLoad(delay = 700): boolean {
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    timer.current = window.setTimeout(() => setLoading(false), delay);
    return () => window.clearTimeout(timer.current);
  }, [delay]);

  return loading;
}

/** A tiny player clock for the audio demos — counts seconds while `playing`. */
export function usePlayClock(playing: boolean, duration: number, speed = 1, startAt = 0) {
  const [seconds, setSeconds] = useState(startAt);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setSeconds((current) => (current + 0.25 * speed >= duration ? 0 : current + 0.25 * speed));
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, duration, speed]);

  const seek = useCallback((next: number) => setSeconds(next), []);
  const progress = useMemo(() => (duration === 0 ? 0 : (seconds / duration) * 100), [seconds, duration]);

  return { seconds, progress, seek };
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
