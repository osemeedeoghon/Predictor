import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/**
 * Runs `load` whenever it changes (memoize it with useCallback) and exposes
 * loading/error/ready states plus a retry. Pass null to stay idle.
 */
export function useAsync<T>(load: (() => Promise<T>) | null) {
  const [state, setState] = useState<AsyncState<T>>(load ? { status: 'loading' } : { status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!load) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    load()
      .then((data) => !cancelled && setState({ status: 'ready', data }))
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
