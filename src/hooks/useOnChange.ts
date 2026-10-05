import { useState } from 'react';

/**
 * Runs `onChange` once, during render, whenever `key` changes (not on mount).
 * This is React's recommended way to reset state (e.g. a page number) when
 * inputs change, instead of a useEffect that sets state after the render.
 * `key` should be a primitive or a JSON string of the values to watch.
 */
export function useOnChange(key: string, onChange: () => void): void {
  const [previous, setPrevious] = useState(key);
  if (previous !== key) {
    setPrevious(key);
    onChange();
  }
}
