import { useEffect } from 'react';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useAutoRefresh(fn, intervalMs = FIVE_MINUTES) {
  useEffect(() => {
    const id = setInterval(fn, intervalMs);
    return () => clearInterval(id);
  }, [fn, intervalMs]);
}
