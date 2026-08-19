"use client";

import { useEffect, useState } from "react";

/** Generic trailing-edge debounce — the one implementation every debounced
 * input in this app should share, rather than each screen re-inventing its
 * own `setTimeout` dance. First consumer: `useSearchSuggestions`, gating live
 * autocomplete requests behind SEARCH_DEBOUNCE_MS
 * (see `lib/search/constants.ts`) so fast typing doesn't fire a network
 * request per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
