import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { VenueCard } from './VenueCard'
import type { PopupController } from '../popup/PopupController'
import type { Venue } from '../../../types/venue'

type MapPopupProps = {
  popup: PopupController
  /** Looked up by the page from the same `Venue[]` already fetched for
   * the layer data — the popup never fetches anything itself. */
  venues: Venue[]
  onClose: () => void
}

/**
 * React owns this component; `PopupController` owns only the state
 * (`show`/`update`/`hide`, subscribed to below). The Provider Interface's
 * `getNativeInstance()` is explicitly documented as an adapter-only
 * escape hatch ("callers that need it must be inside `providers/`, never
 * in the Layer Manager or UI") — so this popup does not pixel-project
 * onto the venue's exact marker position (that would need a new Provider
 * capability, out of scope for a frozen architecture). It renders as a
 * fixed-position overlay instead; see the Phase 4 report's known
 * limitations.
 */
export function MapPopup({ popup, venues, onClose }: MapPopupProps) {
  const subscribe = useCallback((onStoreChange: () => void) => popup.subscribe(() => onStoreChange()), [popup])
  const state = useSyncExternalStore(subscribe, () => popup.getState())

  // Two-phase mount so the entrance is a CSS transition (fade + slight
  // rise) rather than an instant pop — no animation library, just the
  // existing `transition-*` utilities already used across the app.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!state) {
      setVisible(false)
      return
    }
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [state])

  if (!state) return null

  const venue = venues.find((candidate) => candidate.id === state.feature.properties.id)
  if (!venue) return null

  return (
    <div
      role="region"
      aria-label="Venue preview"
      className={[
        'absolute inset-x-4 top-4 z-10 w-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg',
        'transition-all duration-150 ease-out lg:inset-x-auto lg:left-4 lg:w-72',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
      >
        <X size={16} />
      </button>
      <div className="pr-8">
        <VenueCard venue={venue} variant="compact" />
      </div>
    </div>
  )
}
