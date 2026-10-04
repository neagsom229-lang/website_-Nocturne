import { useState, useEffect, useCallback, useRef } from 'react';

export type SleepTimerOption = '15' | '30' | '60' | 'track' | 'off';

export function useSleepTimer(onComplete: () => void) {
  const [timerMode, setTimerMode] = useState<SleepTimerOption>('off');
  const [timeLeftMinutes, setTimeLeftMinutes] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    setTimerMode('off');
    setTimeLeftMinutes(null);
  }, []);

  const setTimer = useCallback((mode: SleepTimerOption) => {
    if (mode === 'off') {
      clearTimer();
      return;
    }
    setTimerMode(mode);
    if (mode === 'track') {
      setTimeLeftMinutes(null);
      return;
    }
    const mins = parseInt(mode, 10);
    setTimeLeftMinutes(mins);

    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setTimeLeftMinutes((prev) => {
        if (prev === null || prev <= 1) {
          clearTimer();
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 60000);
  }, [clearTimer, onComplete]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  return { timerMode, timeLeftMinutes, setTimer, clearTimer };
}
