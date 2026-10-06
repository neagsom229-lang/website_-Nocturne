import { useState, useEffect, useCallback, useRef } from 'react';

export type FetchState<T> = {
  data: T;
  loading: boolean;
  degraded: boolean;
  error: string | null;
  retry: () => void;
};

export function useFetchWithRetry<T>(
  fetchFn: () => Promise<unknown>,
  initialData: T
): FetchState<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDegraded(false);
    setError(null);

    const execute = async (isRetry = false) => {
      try {
        const response = await fetchFn();
        if (!active) return;

        let payload: unknown = response;
        let isDegraded = false;

        if (response && typeof response === 'object') {
          const resObj = response as Record<string, unknown>;
          if ('results' in resObj) payload = resObj.results;
          else if ('movie' in resObj) payload = resObj.movie;
          else if ('show' in resObj) payload = resObj.show;
          if ('degraded' in resObj) isDegraded = Boolean(resObj.degraded);
        }

        setData((payload as T) ?? initialDataRef.current);
        setDegraded(isDegraded);
      } catch (err: unknown) {
        if (!active) return;
        const errObj = err as { status?: number; message?: string };
        if (errObj?.status === 401 || errObj?.message?.includes('401') || errObj?.message?.includes('Please log in')) {
          setData(initialDataRef.current);
          setDegraded(false);
          setError(null);
          return;
        }
        if (!isRetry) {
          setTimeout(() => {
            if (active) void execute(true);
          }, 2000);
          return;
        }
        setError(errObj?.message || 'Could not load data.');
        setDegraded(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void execute(false);

    return () => {
      active = false;
    };
  }, [fetchFn, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { data, loading, degraded, error, retry };
}
