import { CalendarCheck } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextField } from '../../../../components/workspace/fields/TextField'
import type { WorkspaceMode } from '../../../../components/workspace/types'

type BookingSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Venue>(field: K, value: Venue[K]) => void
}

type BookingField = {
  field: 'reserve_your_spot_beach_url' | 'reserve_your_table_url' | 'reserve_your_spot_nightlife_url'
  label: string
}

/** Booking CTA Fields (Phase 1) — SahelSpot is not the booking engine;
 * this is only an external URL, same as Website in `ContactSection`.
 * Consumer will eventually just open it, no internal reservation flow,
 * no state, no auth requirement (explicitly out of scope for this
 * phase).
 *
 * Exactly one of the three CTA/category pairings ever applies to a given
 * venue, so this renders at most one field, never three — unlike
 * `BeachDetailsSection` (gated by the parent `VenueWorkspace` via a
 * plain `category === 'Beach Club'` conditional), the gating here is
 * self-contained: Beach/Nightlife are plain category checks, but Fine
 * Dining is a Restaurant-scoped *Tag*, not a category (confirmed against
 * `api/alembic/versions/0020_final_taxonomy_tags.py`), so the "which
 * field, if any" decision needs both `venue.category` and `venue.tags`
 * together — simpler to compute once here than to duplicate a
 * tag-aware conditional in `VenueWorkspace.tsx` alongside its existing
 * category-only one. Returns `null` (renders nothing) for every venue
 * that matches none of the three. */
function resolveBookingField(venue: Venue): BookingField | null {
  if (venue.category === 'Beach Club') {
    return { field: 'reserve_your_spot_beach_url', label: 'Reserve Your Spot' }
  }
  if (venue.category === 'Nightlife') {
    return { field: 'reserve_your_spot_nightlife_url', label: 'Reserve Your Spot' }
  }
  if (venue.category === 'Restaurant' && venue.tags.includes('fine-dining')) {
    return { field: 'reserve_your_table_url', label: 'Reserve Your Table' }
  }
  return null
}

export function BookingSection({ venue, mode, onFieldChange }: BookingSectionProps) {
  const booking = resolveBookingField(venue)
  if (!booking) return null

  const value = venue[booking.field]

  return (
    <WorkspaceSection id="venue-section-booking" title="Booking" icon={CalendarCheck}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'view' ? (
          <WorkspaceField
            label={booking.label}
            value={
              value ? (
                <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  {value}
                </a>
              ) : null
            }
          />
        ) : (
          <TextField
            label={booking.label}
            type="url"
            value={value ?? ''}
            onChange={(v) => onFieldChange(booking.field, v)}
          />
        )}
      </dl>
    </WorkspaceSection>
  )
}
