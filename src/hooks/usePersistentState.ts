import { useEffect, useState } from 'react';

/**
 * `useState` backed by localStorage. Only used for UI preferences (never for SQL input), and the
 * data stays on the user's device.
 */
export function usePersistentState<T extends object>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { ...initial, ...(parsed as Partial<T>) };
    } catch {
      // Storage unavailable (private mode, disabled cookies) or corrupt value.
    }
    return initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore quota / availability errors.
    }
  }, [key, state]);

  return [state, setState];
}
