import { BadgeCheck, ImageOff, MapPin } from 'lucide-react'
import { StatusBadge } from '../../../components/StatusBadge'
import { ExternalLinkGroup } from '../../../components/ExternalLinkGroup'
import { VENUE_CATEGORY_COLORS } from '../styling/venueMarkerStyle'
import type { Venue } from '../../../types/venue'

type VenueCardProps = {
  venue: Venue
  /** `compact` is the map-anchored popup's card (name + category only);
   * `full` is the Side Panel / Bottom Sheet's card (everything the app
   * already knows about the venue). Same component, same visual
   * language, so the popup and the panel never drift apart. */
  variant: 'compact' | 'full'
}

/** Pure display — reuses `StatusBadge`/`ExternalLinkGroup` (the same
 * Phase 1 "Open" buttons the Venues list already uses) rather than
 * inventing new venue chrome. Shows only fields that exist on `Venue`
 * today; there is no `rating`/`address` field anywhere in the app, so
 * neither is rendered — no placeholder, no "N/A". */
export function VenueCard({ venue, variant }: VenueCardProps) {
  const categoryColor = VENUE_CATEGORY_COLORS[venue.category as keyof typeof VENUE_CATEGORY_COLORS] ?? '#6B7280'

  return (
    <div className="flex flex-col gap-3">
      {variant === 'full' &&
        (venue.cover_image_url ? (
          <img
            src={venue.cover_image_url}
            alt=""
            className="h-36 w-full rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-300">
            <ImageOff size={20} />
          </div>
        ))}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor }}
              aria-hidden="true"
            />
            <h3 className="truncate text-sm font-semibold text-gray-900">{venue.name}</h3>
            {venue.is_verified && (
              <BadgeCheck size={14} className="shrink-0 text-emerald-500" aria-label="Verified" />
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">
              {venue.category}
              {venue.destination.name ? ` · ${venue.destination.name}` : ''}
            </span>
          </p>
        </div>
        {variant === 'full' && <StatusBadge status={venue.status} />}
      </div>

      {variant === 'full' && (
        <>
          {venue.short_description && <p className="text-sm text-gray-600">{venue.short_description}</p>}
          <ExternalLinkGroup venue={venue} />
        </>
      )}
    </div>
  )
}
