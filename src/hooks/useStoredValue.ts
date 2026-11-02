import { useCallback, useSyncExternalStore } from 'react';

/**
 * A value remembered in this browser (localStorage), read the way React recommends for
 * outside stores instead of copying it into state in a useEffect. The server render and
 * the first client render use `fallback`, so the page hydrates without a mismatch; the
 * remembered value follows straight after. Saving '' forgets the value.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange); // another tab changed it
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredValue(key: string, fallback: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key) ?? fallback, () => fallback);
  const save = useCallback((next: string) => {
    try {
      if (next) window.localStorage.setItem(key, next);
      else window.localStorage.removeItem(key);
    } catch {
      /* storage blocked by the browser: the value cannot be remembered */
    }
    listeners.forEach(notify => notify());
  }, [key]);
  return [value, save];
}
