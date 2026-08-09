import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, ChevronRight } from 'lucide-react'
import { useAllVenues } from '../features/stats/useAllVenues'
import { computeNoQrGroups } from '../features/noQr/computeNoQrGroups'
import { updateVenueParent } from '../features/venues/api'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import type { Venue } from '../types/venue'

/** Studio Content Organization — "No QR" discovery content.
 *
 * "No QR" is `Venue.is_no_qr` — an explicit editor designation (Walk,
 * Mall, standalone roadside spot), set from the Basic Information
 * checkbox in the existing Venues workspace. It is deliberately NOT the
 * same thing as `access_type != 'QR Required'` (that's the *access
 * method* concept, still correctly served as-is by
 * `GET /public/discover/no-qr`) — see `features/noQr/computeNoQrGroups.ts`
 * and `Venue.is_no_qr`'s own docstring (api/app/db/models.py) for the
 * full reasoning. A normal Restaurant/Coffee/Hotel venue never appears
 * here just because it doesn't require a QR code.
 *
 * `Venue.parent_venue_id` (optional self-reference) groups this same
 * `is_no_qr` set into "Parent Area" (e.g. Zahra Walk, with its ordinary
 * child venues listed beneath it) vs "Standalone" — only a venue with
 * `is_no_qr = true` may be a parent (enforced by the backend).
 *
 * Editing itself (name, category, access type, ...) still happens in the
 * existing Venues workspace — this page's rows link there rather than
 * duplicating that editor. The one action unique to this page is
 * assigning/clearing a venue's parent. */
export function NoQr() {
  const { data: venues, isPending, isError, error, refetch } = useAllVenues()
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const groups = useMemo(() => (venues ? computeNoQrGroups(venues) : null), [venues])

  const { mutate: setParent } = useMutation({
    mutationFn: ({ venue, parentVenueId }: { venue: Venue; parentVenueId: string | null }) =>
      updateVenueParent(venue.id, venue.version, parentVenueId),
    onMutate: ({ venue }) => setPendingId(venue.id),
    onSettled: () => setPendingId(null),
    onSuccess: (updated) => {
      queryClient.setQueryData(['venue', updated.id], updated)
      queryClient.invalidateQueries({ queryKey: ['venues'] })
    },
  })

  if (isPending) return <LoadingState label="Loading No QR content…" />
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load venues.'}
        onRetry={refetch}
      />
    )
  }
  if (!groups) return null

  // Per product decision, only a venue with `is_no_qr = true` may be used
  // as a parent — the backend enforces this too (`validate_parent_venue_id`),
  // this is just keeping the picker from ever offering an invalid choice.
  // Any `is_no_qr` venue not currently a parent is still a valid pick:
  // choosing one is exactly how a new Parent Area (e.g. Zahra Walk) starts
  // existing as one, with no separate "create area" action needed.
  const parentOptions = venues
    .filter((v) => v.is_no_qr)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <QrCode size={22} className="text-gray-500" />
          No QR
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Explicitly designated discovery places — Walks, malls, and standalone spots.
          Set "Is No QR Place" on a venue's Basic Information to add it here.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Parent Areas ({groups.parents.length})
        </h2>
        {groups.parents.length === 0 ? (
          <p className="text-sm text-gray-400">
            No Parent Areas yet — assign a venue as another venue's parent below to create one.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.parents.map((parent) => (
              <div key={parent.id} className="rounded-xl border border-gray-200 bg-white">
                <VenueRow venue={parent} />
                <ul className="divide-y divide-gray-100 border-t border-gray-100 pl-6">
                  {(groups.childrenByParentId.get(parent.id) ?? []).map((child) => (
                    <li key={child.id}>
                      <VenueRow venue={child} onClearParent={() => setParent({ venue: child, parentVenueId: null })} pending={pendingId === child.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Standalone ({groups.standalone.length})
        </h2>
        {groups.standalone.length === 0 ? (
          <p className="text-sm text-gray-400">No standalone No QR venues.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {groups.standalone.map((venue) => (
                <li key={venue.id}>
                  <VenueRow
                    venue={venue}
                    parentOptions={parentOptions.filter((option) => option.id !== venue.id)}
                    onAssignParent={(parentVenueId) => setParent({ venue, parentVenueId })}
                    pending={pendingId === venue.id}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

function VenueRow({
  venue,
  parentOptions,
  onAssignParent,
  onClearParent,
  pending = false,
}: {
  venue: Venue
  parentOptions?: Venue[]
  onAssignParent?: (parentVenueId: string) => void
  onClearParent?: () => void
  pending?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link
        to={`/venues?q=${encodeURIComponent(venue.name)}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-gray-900 hover:text-blue-600"
      >
        <span className="truncate">{venue.name}</span>
        <span className="shrink-0 text-xs font-normal text-gray-400">
          {venue.category} · {venue.destination.name}
        </span>
        <ChevronRight size={14} className="shrink-0 text-gray-300" />
      </Link>

      {onClearParent && (
        <button
          type="button"
          disabled={pending}
          onClick={onClearParent}
          className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Remove from parent
        </button>
      )}

      {parentOptions && onAssignParent && (
        <select
          disabled={pending}
          value=""
          onChange={(event) => {
            if (event.target.value) onAssignParent(event.target.value)
          }}
          className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
        >
          <option value="">Assign parent…</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
