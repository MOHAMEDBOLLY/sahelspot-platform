/** External Data Enrichment Workflow (Phase 1). A staging/review row for
 * one external research record — never a Venue, until an operator
 * explicitly applies fields or creates one (see `features/externalData/
 * api.ts`). Source-agnostic: nothing here is iSahel-specific. */
export type MatchStatus = 'MATCH_CONFIRMED' | 'MATCH_PROBABLE' | 'REVIEW_REQUIRED' | 'NO_MATCH'
export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type ExternalReviewStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'PARTIALLY_APPLIED'
  | 'REJECTED'
  | 'NEEDS_RESEARCH'

export type ExternalRecordVenueRef = {
  id: string
  name: string
}

export type ExternalRecord = {
  id: number
  source: string
  source_url: string | null
  external_name: string
  external_category: string | null
  external_destination: string | null
  external_description: string | null
  external_amenities: string[]
  external_maps_url: string | null
  external_booking_type: string | null
  external_booking_url: string | null
  external_image_urls: string[]
  source_review_status: string | null
  raw_row: Record<string, unknown> | null
  matched_venue_id: string | null
  matched_venue: ExternalRecordVenueRef | null
  match_status: MatchStatus
  match_confidence: MatchConfidence | null
  review_status: ExternalReviewStatus
  /** Populated only when an explicit, operator-approved
   * `ExternalDestinationMapping` exists for this record's (source,
   * external_destination) — never a fuzzy guess. Shown before Apply is
   * ever attempted, so an operator can see a destination is about to be
   * normalized through an approved mapping. */
  destination_mapping: { id: string; name: string } | null
  created_at: string
  updated_at: string
}

export type ExternalRecordSummary = {
  total: number
  by_match_status: Record<string, number>
  by_review_status: Record<string, number>
}

export type ExternalRecordListResponse = {
  items: ExternalRecord[]
  total: number
  summary: ExternalRecordSummary
}
