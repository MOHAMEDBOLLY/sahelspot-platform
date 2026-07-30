import { MapPin } from 'lucide-react'
import { BottomSheet } from '../../../components/BottomSheet'
import { PagePlaceholder } from '../../../components/PagePlaceholder'
import { VenueCard } from './VenueCard'
import { useIsMobile } from '../../../hooks/useIsMobile'
import type { Venue } from '../../../types/venue'

type VenueDetailPanelProps = {
  venue: Venue | null
  onClose: () => void
}

/**
 * Desktop: an always-present right-side panel (part of the page layout,
 * not a modal) showing an empty state until a venue is selected. Mobile:
 * the venue swaps into a `BottomSheet` (the same generic primitive the
 * Venues filters already use), opened/closed purely by whether a venue
 * is selected — no separate open/close state to keep in sync. `Drawer`
 * was considered for desktop too, but it's a modal overlay; the
 * architecture review called for a persistent side panel, so the panel
 * is inline layout instead (matches the "Right side information panel"
 * requirement exactly).
 */
export function VenueDetailPanel({ venue, onClose }: VenueDetailPanelProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <BottomSheet open={venue !== null} onClose={onClose} title={venue?.name ?? 'Venue'}>
        {venue && <VenueCard venue={venue} variant="full" />}
      </BottomSheet>
    )
  }

  return (
    <div
      role="complementary"
      aria-label="Venue details"
      className="hidden w-96 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white lg:flex"
    >
      {venue ? (
        <div className="flex flex-col gap-3 p-4 transition-opacity duration-150 ease-out">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Venue details</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900"
            >
              Close
            </button>
          </div>
          <VenueCard venue={venue} variant="full" />
        </div>
      ) : (
        <div className="p-4">
          <PagePlaceholder
            icon={MapPin}
            title="No venue selected"
            description="Click a marker on the map to see its details here."
          />
        </div>
      )}
    </div>
  )
}
