import { useState, useEffect, useCallback } from 'react';

export type FetchState<T> = {
  data: T;
  loading: boolean;
  degraded: boolean;
  error: string | null;
  retry: () => void;
};

export function useFetchWithRetry<T>(
  fetchFn: () => Promise<any>,
  initialData: T
): FetchState<T> {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDegraded(false);
    setError(null);

    const execute = async (isRetry = false) => {
      try {
        const response = await fetchFn();
        if (!active) return;

        let payload: any = response;
        let isDegraded = false;

        if (response && typeof response === 'object') {
          if ('results' in response) payload = response.results;
          else if ('movie' in response) payload = response.movie;
          else if ('show' in response) payload = response.show;
          if ('degraded' in response) isDegraded = Boolean(response.degraded);
        }

        setData(payload ?? initialData);
        setDegraded(isDegraded);
      } catch (err: any) {
        if (!active) return;
        if (!isRetry) {
          setTimeout(() => {
            if (active) execute(true);
          }, 2000);
          return;
        }
        setError(err?.message || 'Could not load data.');
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
