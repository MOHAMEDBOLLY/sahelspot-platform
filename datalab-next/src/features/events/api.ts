import { apiDelete, apiDeleteJson, apiGet, apiPatch, apiPost, apiPostJson, apiUpload } from '../../lib/apiClient'
import type {
  Event,
  EventBulkOperationResponse,
  EventListResponse,
  EventSearchParams,
} from '../../types/event'

export function fetchEvents(params: EventSearchParams = {}): Promise<EventListResponse> {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set('q', params.q)
  if (params.status) searchParams.set('status', params.status)
  if (params.venueId) searchParams.set('venue_id', params.venueId)
  if (params.destinationId) searchParams.set('destination_id', params.destinationId)
  if (params.featured !== undefined) searchParams.set('featured', String(params.featured))
  searchParams.set('page', String(params.page ?? 1))
  searchParams.set('page_size', String(params.pageSize ?? 50))

  return apiGet<EventListResponse>(`/editor/events?${searchParams.toString()}`)
}

export function fetchEvent(id: string): Promise<Event> {
  return apiGet<Event>(`/editor/events/${encodeURIComponent(id)}`)
}

/** Exactly the fields Edit Mode exposes as editable — same reasoning as
 * `features/venues/api.ts`'s `VenuePatch`. `id`, `slug`, `status`
 * (workflow-controlled), and timestamps aren't part of this write path. */
export type EventPatch = Pick<
  Event,
  | 'title'
  | 'start_date'
  | 'end_date'
  | 'start_time'
  | 'end_time'
  | 'short_description'
  | 'cover_image_url'
  | 'featured'
  | 'ticket_provider'
  | 'ticket_url'
  | 'external_event_id'
> & {
  venue_id: string | null
  destination_id: string | null
}

function emptyToNull(value: string | null): string | null {
  return value === '' ? null : value
}

export function toEventPatch(event: Event): EventPatch {
  return {
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    start_time: event.start_time,
    end_time: event.end_time,
    short_description: emptyToNull(event.short_description),
    cover_image_url: event.cover_image_url,
    featured: event.featured,
    venue_id: event.venue?.id ?? null,
    destination_id: event.destination?.id ?? null,
    ticket_provider: emptyToNull(event.ticket_provider),
    ticket_url: emptyToNull(event.ticket_url),
    external_event_id: emptyToNull(event.external_event_id),
  }
}

export function updateEvent(id: string, version: number, patch: Partial<EventPatch>): Promise<Event> {
  return apiPatch<Event>(`/editor/events/${encodeURIComponent(id)}`, patch, { 'If-Match': String(version) })
}

/** `id`/`slug` caller-supplied, same reasoning as `DestinationCreateInput`. */
export interface EventCreateInput {
  id: string
  title: string
  slug: string
  start_date: string
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  venue_id?: string | null
  destination_id?: string | null
  short_description?: string | null
  ticket_provider?: string | null
  ticket_url?: string | null
  external_event_id?: string | null
}

export function createEvent(input: EventCreateInput): Promise<Event> {
  return apiPostJson<Event>('/editor/events', input)
}

export function deleteEvent(id: string): Promise<void> {
  return apiDelete(`/editor/events/${encodeURIComponent(id)}`)
}

/** Cover only — events have no gallery in v1, same reasoning as
 * destinations' single-slot upload. */
export function uploadEventCover(
  id: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Event> {
  const formData = new FormData()
  formData.append('file', file)
  return apiUpload<Event>(`/editor/events/${encodeURIComponent(id)}/media`, formData, onProgress)
}

export function deleteEventCover(id: string): Promise<Event> {
  return apiDeleteJson<Event>(`/editor/events/${encodeURIComponent(id)}/media`)
}

export function submitEventForReview(id: string): Promise<Event> {
  return apiPost<Event>(`/editor/events/${encodeURIComponent(id)}/submit-for-review`)
}

export function approveEvent(id: string): Promise<Event> {
  return apiPost<Event>(`/editor/events/${encodeURIComponent(id)}/approve`)
}

export function rejectEvent(id: string, reason: string): Promise<Event> {
  return apiPostJson<Event>(`/editor/events/${encodeURIComponent(id)}/reject`, { reason })
}

export function moveEventToDraft(id: string): Promise<Event> {
  return apiPost<Event>(`/editor/events/${encodeURIComponent(id)}/move-to-draft`)
}

export function archiveEvent(id: string): Promise<Event> {
  return apiPost<Event>(`/editor/events/${encodeURIComponent(id)}/archive`)
}

export function restoreEvent(id: string): Promise<Event> {
  return apiPost<Event>(`/editor/events/${encodeURIComponent(id)}/restore`)
}

export function bulkSubmitEventsForReview(eventIds: string[]): Promise<EventBulkOperationResponse> {
  return apiPostJson<EventBulkOperationResponse>('/editor/events/bulk/submit-for-review', {
    event_ids: eventIds,
  })
}

export function bulkApproveEvents(eventIds: string[]): Promise<EventBulkOperationResponse> {
  return apiPostJson<EventBulkOperationResponse>('/editor/events/bulk/approve', { event_ids: eventIds })
}

export function bulkMoveEventsToDraft(eventIds: string[]): Promise<EventBulkOperationResponse> {
  return apiPostJson<EventBulkOperationResponse>('/editor/events/bulk/move-to-draft', {
    event_ids: eventIds,
  })
}

export function bulkArchiveEvents(eventIds: string[]): Promise<EventBulkOperationResponse> {
  return apiPostJson<EventBulkOperationResponse>('/editor/events/bulk/archive', { event_ids: eventIds })
}

export function bulkRestoreEvents(eventIds: string[]): Promise<EventBulkOperationResponse> {
  return apiPostJson<EventBulkOperationResponse>('/editor/events/bulk/restore', { event_ids: eventIds })
}

export function bulkDeleteEvents(eventIds: string[]): Promise<EventBulkOperationResponse> {
  return apiPostJson<EventBulkOperationResponse>('/editor/events/bulk/delete', { event_ids: eventIds })
}
