import { useState, useCallback } from 'react';
import type { ExternalMedia } from './workspaceHooks';

export function useQueue(initialQueue: ExternalMedia[] = []) {
  const [queue, setQueue] = useState<ExternalMedia[]>(initialQueue);

  const addToQueue = useCallback((item: ExternalMedia) => {
    setQueue((prev) => [...prev, item]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      if (moved) copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  return { queue, setQueue, addToQueue, removeFromQueue, clearQueue, reorderQueue };
}
