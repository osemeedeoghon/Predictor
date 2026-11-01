import { useEffect, useState } from 'react';

/** Current time, refreshed periodically so matches lock while the page is open. */
export function useNow(getNow: () => Date, intervalMs = 30_000): Date {
  const [now, setNow] = useState(getNow);
  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), intervalMs);
    return () => clearInterval(id);
  }, [getNow, intervalMs]);
  return now;
}
