import { useSyncExternalStore } from 'react'

/** Generic viewport check — matches the `lg:` breakpoint (1024px) every
 * other feature already switches Drawer/BottomSheet at (see
 * `Venues.tsx`'s filter panel). Backed by `matchMedia`, not a resize
 * listener, so it only notifies on an actual breakpoint crossing. */
const QUERY = '(min-width: 1024px)'

function subscribe(onStoreChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(QUERY)
  mediaQueryList.addEventListener('change', onStoreChange)
  return () => mediaQueryList.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  return !window.matchMedia(QUERY).matches
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
