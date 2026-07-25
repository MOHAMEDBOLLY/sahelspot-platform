import { useEffect, useState } from 'react'

/** Generic — Sprint 27's first user is the venues search box, but nothing
 * here is search-specific. Returns `value` unchanged until `delayMs` has
 * passed without `value` changing again, so a query driven by the
 * debounced result doesn't refire on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}
