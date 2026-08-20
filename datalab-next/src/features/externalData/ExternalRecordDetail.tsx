import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import {
  applyFields,
  createDestinationMapping,
  createVenueFromRecord,
  fetchExternalRecord,
  overrideMatch,
  updateReviewStatus,
} from './api'
import { useVenue } from '../venues/useVenue'
import { useDestinations } from '../destinations/useDestinations'
import { VENUE_CATEGORIES } from '../venues/venueCategories'
import { LoadingState } from '../../components/LoadingState'
import { ErrorState } from '../../components/ErrorState'
import { ApiError } from '../../lib/apiClient'
import type { MatchStatus, ExternalReviewStatus } from '../../types/externalRecord'

const MATCH_STATUSES: MatchStatus[] = ['MATCH_CONFIRMED', 'MATCH_PROBABLE', 'REVIEW_REQUIRED', 'NO_MATCH']
const REVIEW_STATUSES: ExternalReviewStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'PARTIALLY_APPLIED',
  'REJECTED',
  'NEEDS_RESEARCH',
]

type ExternalRecordDetailProps = {
  recordId: number
  onBack: () => void
}

/** External Data Enrichment Workflow (Phase 1). External Research ->
 * Match -> Human Review -> Field-level Approval -> Apply. Studio's
 * existing value is always shown as the current/authoritative value;
 * the external value is only ever a suggestion, never applied without
 * an explicit per-field checkbox + Apply click. Category/destination
 * are conflict-gated server-side (`override_conflict`) — this UI only
 * ever sends that flag after the operator has already seen the 409 and
 * chosen to proceed, never silently. */
export function ExternalRecordDetail({ recordId, onBack }: ExternalRecordDetailProps) {
  const queryClient = useQueryClient()
  const { data: record, isPending, isError, error, refetch } = useQuery({
    queryKey: ['external-records', recordId],
    queryFn: () => fetchExternalRecord(recordId),
  })
  const { data: venue } = useVenue(record?.matched_venue_id ?? null)
  const { data: destinationsData } = useDestinations()
  const destinations = destinationsData?.items

  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [unresolvedDestinationError, setUnresolvedDestinationError] = useState<string | null>(null)
  const [mappingDestinationId, setMappingDestinationId] = useState('')
  const [showCreateVenue, setShowCreateVenue] = useState(false)
  const [newVenue, setNewVenue] = useState({
    id: '',
    name: '',
    slug: '',
    category: VENUE_CATEGORIES[0] as string,
    destination_id: '',
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['external-records', recordId] })
    queryClient.invalidateQueries({ queryKey: ['external-records'] })
    if (record?.matched_venue_id) queryClient.invalidateQueries({ queryKey: ['venue', record.matched_venue_id] })
  }

  const { mutate: apply, isPending: isApplying } = useMutation({
    mutationFn: (overrideConflict: boolean) => applyFields(recordId, Array.from(selectedFields), overrideConflict),
    onSuccess: () => {
      setSelectedFields(new Set())
      setConflictError(null)
      setUnresolvedDestinationError(null)
      invalidate()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictError(err.message)
      } else if (err instanceof ApiError && err.status === 422 && selectedFields.has('destination')) {
        setUnresolvedDestinationError(err.message)
      }
    },
  })

  const { mutate: setMatch } = useMutation({
    mutationFn: (status: MatchStatus) => overrideMatch(recordId, { match_status: status }),
    onSuccess: invalidate,
  })

  const { mutate: createMapping, isPending: isCreatingMapping } = useMutation({
    mutationFn: () => createDestinationMapping(record!.source, record!.external_destination as string, mappingDestinationId),
    onSuccess: () => {
      setUnresolvedDestinationError(null)
      setMappingDestinationId('')
      invalidate()
    },
  })

  const { mutate: setReviewStatus } = useMutation({
    mutationFn: (status: ExternalReviewStatus) => updateReviewStatus(recordId, status),
    onSuccess: invalidate,
  })

  const { mutate: createVenue, isPending: isCreatingVenue, error: createError } = useMutation({
    mutationFn: () => createVenueFromRecord(recordId, newVenue),
    onSuccess: () => {
      setShowCreateVenue(false)
      invalidate()
    },
  })

  if (isPending) return <LoadingState label="Loading external record…" />
  if (isError) {
    return (
      <ErrorState message={error instanceof Error ? error.message : 'Failed to load record.'} onRetry={refetch} />
    )
  }

  function toggleField(field: string) {
    setConflictError(null)
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  const categoryConflict = Boolean(
    venue && record.external_category && venue.category !== record.external_category,
  )
  const destinationConflict = Boolean(
    venue && record.external_destination && venue.destination.name !== record.external_destination,
  )

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Back to External Data Review
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">External Venue</h2>
        <p className="mt-1 text-lg font-semibold text-gray-900">
          {record.source}: {record.external_name}
        </p>
        <p className="text-sm text-gray-500">
          Destination: {record.external_destination || '—'} · Category: {record.external_category || '—'}
        </p>

        <div className="mt-4 border-t border-gray-100 pt-4">
          {venue ? (
            <>
              <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Matched Studio Venue</h3>
              <Link to={`/venues?q=${encodeURIComponent(venue.name)}`} className="text-blue-600 hover:underline">
                {venue.name}
              </Link>
              <p className="text-xs text-gray-400">Studio ID: {venue.id}</p>
            </>
          ) : (
            <h3 className="text-sm font-medium text-gray-500">No Studio venue matched.</h3>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={record.match_status}
              onChange={(event) => setMatch(event.target.value as MatchStatus)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
            >
              {MATCH_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {record.match_confidence && (
              <span className="text-xs font-medium text-gray-500">Confidence: {record.match_confidence}</span>
            )}
            <select
              value={record.review_status}
              onChange={(event) => setReviewStatus(event.target.value as ExternalReviewStatus)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
            >
              {REVIEW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!venue && (
        <div className="rounded-xl border border-dashed border-gray-300 p-4">
          <p className="text-sm font-semibold text-gray-700">NO MATCH FOUND</p>
          {!showCreateVenue ? (
            <button
              type="button"
              onClick={() => {
                setNewVenue({
                  id: '',
                  name: record.external_name,
                  slug: '',
                  category: VENUE_CATEGORIES[0],
                  destination_id: '',
                })
                setShowCreateVenue(true)
              }}
              className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Review New Venue
            </button>
          ) : (
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <p className="text-xs text-gray-500">
                Confirm every field before creating a real Studio venue — nothing here is inferred automatically.
              </p>
              <input
                placeholder="Venue id (e.g. v00500)"
                value={newVenue.id}
                onChange={(e) => setNewVenue((v) => ({ ...v, id: e.target.value }))}
                className="rounded-lg border border-gray-300 px-2 py-1.5"
              />
              <input
                placeholder="Slug"
                value={newVenue.slug}
                onChange={(e) => setNewVenue((v) => ({ ...v, slug: e.target.value }))}
                className="rounded-lg border border-gray-300 px-2 py-1.5"
              />
              <input
                placeholder="Name"
                value={newVenue.name}
                onChange={(e) => setNewVenue((v) => ({ ...v, name: e.target.value }))}
                className="rounded-lg border border-gray-300 px-2 py-1.5"
              />
              <select
                value={newVenue.category}
                onChange={(e) => setNewVenue((v) => ({ ...v, category: e.target.value }))}
                className="rounded-lg border border-gray-300 px-2 py-1.5"
              >
                {VENUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={newVenue.destination_id}
                onChange={(e) => setNewVenue((v) => ({ ...v, destination_id: e.target.value }))}
                className="rounded-lg border border-gray-300 px-2 py-1.5"
              >
                <option value="">Select destination…</option>
                {destinations?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">Description: {record.external_description || '—'}</p>
              <p className="text-xs text-gray-400">
                Amenities: {record.external_amenities.join(', ') || '—'}
              </p>
              <p className="text-xs text-gray-400">Source: {record.source_url || '—'}</p>
              {createError && (
                <p className="text-sm text-red-600">
                  {createError instanceof ApiError ? createError.message : 'Failed to create venue.'}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateVenue(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreatingVenue || !newVenue.id || !newVenue.slug || !newVenue.destination_id}
                  onClick={() => createVenue()}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {isCreatingVenue ? 'Creating…' : 'Create Venue'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {venue && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <FieldRow
            label="Description"
            studioValue={venue.short_description}
            externalValue={record.external_description}
            selected={selectedFields.has('description')}
            onToggle={() => toggleField('description')}
          />
          <FieldRow
            label="Amenities (review only — no Studio field to apply to yet)"
            studioValue={null}
            externalValue={record.external_amenities.join(', ') || null}
            selected={false}
            onToggle={undefined}
          />
          <FieldRow
            label="Google Maps"
            studioValue={venue.maps_url}
            externalValue={record.external_maps_url}
            selected={selectedFields.has('maps_url')}
            onToggle={() => toggleField('maps_url')}
          />
          <FieldRow
            label="Booking (review only — never auto-applied to a booking URL)"
            studioValue={null}
            externalValue={
              record.external_booking_type
                ? `${record.external_booking_type}${record.external_booking_url ? ` — ${record.external_booking_url}` : ''}`
                : null
            }
            selected={false}
            onToggle={undefined}
          />
          <FieldRow
            label="Category"
            studioValue={venue.category}
            externalValue={record.external_category}
            selected={selectedFields.has('category')}
            onToggle={() => toggleField('category')}
            conflict={categoryConflict}
          />
          <FieldRow
            label="Destination"
            studioValue={venue.destination.name}
            externalValue={record.external_destination}
            selected={selectedFields.has('destination')}
            onToggle={() => toggleField('destination')}
            conflict={destinationConflict}
          />
          {record.destination_mapping && (
            <div className="border-t border-gray-100 bg-blue-50 px-4 py-2">
              <p className="text-xs text-blue-700">
                Normalized via approved mapping: "{record.external_destination}" → "
                {record.destination_mapping.name}"
              </p>
            </div>
          )}

          {unresolvedDestinationError && (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-sm text-red-600">{unresolvedDestinationError}</p>
              <p className="mt-1 text-xs text-gray-500">
                No mapping exists for "{record.external_destination}" from {record.source}. Create one to allow
                this destination to resolve deterministically.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={mappingDestinationId}
                  onChange={(e) => setMappingDestinationId(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">Select Studio destination…</option>
                  {destinations?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!mappingDestinationId || isCreatingMapping}
                  onClick={() => createMapping()}
                  className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  Create Mapping
                </button>
              </div>
            </div>
          )}

          {record.external_image_urls.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-sm font-medium text-gray-700">External Images (reference only)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {record.external_image_urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-blue-600 hover:underline"
                  >
                    Open Source <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {conflictError && (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-sm text-red-600">{conflictError}</p>
              <button
                type="button"
                onClick={() => apply(true)}
                className="mt-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Apply anyway (override conflict)
              </button>
            </div>
          )}

          <div className="flex justify-end border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              disabled={isApplying || selectedFields.size === 0}
              onClick={() => apply(false)}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplying ? 'Applying…' : `Apply ${selectedFields.size || ''} Selected Field${selectedFields.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldRow({
  label,
  studioValue,
  externalValue,
  selected,
  onToggle,
  conflict = false,
}: {
  label: string
  studioValue: string | null
  externalValue: string | null
  selected: boolean
  onToggle: (() => void) | undefined
  conflict?: boolean
}) {
  const isSuggestedOnEmpty = !studioValue && !!externalValue

  return (
    <div className="border-t border-gray-100 px-4 py-3 first:border-t-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {conflict && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            CONFLICT
          </span>
        )}
      </div>
      <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-gray-400">
            {studioValue ? 'Current' : 'Current: EMPTY'}
          </p>
          <p className="text-sm text-gray-900">{studioValue || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">{isSuggestedOnEmpty ? 'Suggested' : 'External'}</p>
          <p className="text-sm text-gray-900">{externalValue || '—'}</p>
        </div>
      </div>
      {onToggle && externalValue && (
        <label className="mt-2 flex items-center gap-2 text-xs font-medium text-gray-600">
          <input type="checkbox" checked={selected} onChange={onToggle} className="accent-gray-900" />
          Apply external value
        </label>
      )}
    </div>
  )
}
