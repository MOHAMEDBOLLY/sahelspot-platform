import { describe, expect, it } from 'vitest'
import {
  computeActionQueue,
  computeCompletionDistribution,
  computeCompletionSummary,
  computeDestinationProgress,
  computeMissingDataCounts,
  computeOverallCompletion,
  computeStatusBreakdown,
  evaluateVenueQualities,
} from './dashboardAggregates'
import type { Venue } from '../types/venue'
import type { Destination } from '../types/destination'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: overrides.id ?? 'v1',
    name: 'Test Venue',
    slug: 'test-venue',
    destination: overrides.destination ?? { id: 'd1', name: 'Test Destination' },
    district: null,
    category: 'Restaurant',
    status: 'draft',
    version: 1,
    translations: null,
    is_featured: false,
    is_verified: false,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    website: null,
    maps_url: null,
    instagram_handle: null,
    facebook_handle: null,
    tiktok_handle: null,
    short_description: null,
    cover_image_url: null,
    gallery_image_urls: null,
    opening_hours: null,
    beach_details: null,
    internal_notes: null,
    source: null,
    brand: null,
    last_published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'd1',
    name: 'Test Destination',
    region: 'Test Region',
    status: 'approved',
    aliases: null,
    boundary: null,
    notes: null,
    cover_image_url: null,
    version: 1,
    translations: null,
    last_published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const COMPLETE_FIELDS = {
  cover_image_url: 'https://example.com/cover.jpg',
  gallery_image_urls: ['https://example.com/1.jpg'],
  instagram_handle: 'handle',
  website: 'https://example.com',
  phone: '+201234567890',
  maps_url: 'https://maps.google.com/?q=1,1',
}

describe('computeStatusBreakdown', () => {
  it('returns zero counts for an empty dataset', () => {
    const result = computeStatusBreakdown([])
    expect(result.total).toBe(0)
    expect(result.counts).toEqual({ draft: 0, review: 0, approved: 0, archived: 0 })
  })

  it('tallies venues per status, summing to total', () => {
    const venues = [
      makeVenue({ id: 'v1', status: 'draft' }),
      makeVenue({ id: 'v2', status: 'draft' }),
      makeVenue({ id: 'v3', status: 'review' }),
      makeVenue({ id: 'v4', status: 'approved' }),
    ]

    const result = computeStatusBreakdown(venues)

    expect(result.total).toBe(4)
    expect(result.counts).toEqual({ draft: 2, review: 1, approved: 1, archived: 0 })
    expect(Object.values(result.counts).reduce((a, b) => a + b, 0)).toBe(result.total)
  })
})

describe('evaluateVenueQualities', () => {
  it('returns one entry per venue, keyed by id', () => {
    const venues = [makeVenue({ id: 'v1', ...COMPLETE_FIELDS }), makeVenue({ id: 'v2' })]

    const result = evaluateVenueQualities(venues)

    expect(result.size).toBe(2)
    expect(result.get('v1')?.completionPercent).toBe(100)
    expect(result.get('v2')?.completionPercent).toBe(0)
  })
})

describe('computeMissingDataCounts', () => {
  it('returns zero for every field on an empty dataset', () => {
    const result = computeMissingDataCounts(evaluateVenueQualities([]))
    expect(result).toEqual({ cover: 0, gallery: 0, instagram: 0, website: 0, phone: 0, maps: 0 })
  })

  it('matches evaluateVenueQuality output on a mixed fixture set', () => {
    const venues = [
      makeVenue({ id: 'v1', ...COMPLETE_FIELDS }),
      makeVenue({ id: 'v2' }),
      makeVenue({ id: 'v3', cover_image_url: COMPLETE_FIELDS.cover_image_url }),
    ]

    const result = computeMissingDataCounts(evaluateVenueQualities(venues))

    expect(result.cover).toBe(1)
    expect(result.gallery).toBe(2)
    expect(result.instagram).toBe(2)
    expect(result.website).toBe(2)
    expect(result.phone).toBe(2)
    expect(result.maps).toBe(2)
  })
})

describe('computeDestinationProgress', () => {
  it('returns zero-venue rows for destinations with no venues', () => {
    const destinations = [makeDestination({ id: 'd1', name: 'Empty Dest' })]

    const result = computeDestinationProgress([], destinations, evaluateVenueQualities([]))

    expect(result).toEqual([
      { destinationId: 'd1', destinationName: 'Empty Dest', venueCount: 0, readyCount: 0, averageCompletionPercent: 0 },
    ])
  })

  it('groups venues by destination and computes per-destination averages', () => {
    const destinations = [
      makeDestination({ id: 'd1', name: 'Dest A' }),
      makeDestination({ id: 'd2', name: 'Dest B' }),
    ]
    const venues = [
      makeVenue({ id: 'v1', destination: { id: 'd1', name: 'Dest A' }, ...COMPLETE_FIELDS }),
      makeVenue({ id: 'v2', destination: { id: 'd1', name: 'Dest A' } }),
      makeVenue({ id: 'v3', destination: { id: 'd2', name: 'Dest B' }, ...COMPLETE_FIELDS }),
    ]

    const result = computeDestinationProgress(venues, destinations, evaluateVenueQualities(venues))

    expect(result[0]).toEqual({
      destinationId: 'd1',
      destinationName: 'Dest A',
      venueCount: 2,
      readyCount: 1,
      averageCompletionPercent: 50,
    })
    expect(result[1]).toEqual({
      destinationId: 'd2',
      destinationName: 'Dest B',
      venueCount: 1,
      readyCount: 1,
      averageCompletionPercent: 100,
    })
  })

  it('preserves destination input ordering', () => {
    const destinations = [
      makeDestination({ id: 'd2', name: 'Second' }),
      makeDestination({ id: 'd1', name: 'First' }),
    ]

    const result = computeDestinationProgress([], destinations, evaluateVenueQualities([]))

    expect(result.map((r) => r.destinationId)).toEqual(['d2', 'd1'])
  })
})

describe('computeOverallCompletion', () => {
  it('returns 0 for an empty dataset (never NaN)', () => {
    expect(computeOverallCompletion(evaluateVenueQualities([]))).toBe(0)
  })

  it('averages completion across all venues', () => {
    const venues = [
      makeVenue({ id: 'v1', ...COMPLETE_FIELDS }), // 100%
      makeVenue({ id: 'v2' }), // 0%
    ]

    expect(computeOverallCompletion(evaluateVenueQualities(venues))).toBe(50)
  })
})

describe('computeCompletionSummary', () => {
  it('returns zero/zero for an empty dataset', () => {
    expect(computeCompletionSummary(evaluateVenueQualities([]))).toEqual({ complete: 0, needsAttention: 0 })
  })

  it('splits complete (100%) from everything else', () => {
    const venues = [
      makeVenue({ id: 'v1', ...COMPLETE_FIELDS }), // 100%
      makeVenue({ id: 'v2', cover_image_url: COMPLETE_FIELDS.cover_image_url }), // 17%
      makeVenue({ id: 'v3' }), // 0%
    ]

    expect(computeCompletionSummary(evaluateVenueQualities(venues))).toEqual({ complete: 1, needsAttention: 2 })
  })
})

describe('computeCompletionDistribution', () => {
  it('returns 7 zero-count buckets (0..6) for an empty dataset', () => {
    const result = computeCompletionDistribution(evaluateVenueQualities([]))

    expect(result).toHaveLength(7)
    expect(result.every((bucket) => bucket.count === 0 && bucket.percentageOfDataset === 0)).toBe(true)
    expect(result.map((b) => b.score)).toEqual([6, 5, 4, 3, 2, 1, 0])
    expect(result.map((b) => b.percent)).toEqual([100, 83, 67, 50, 33, 17, 0])
  })

  it('buckets venues by exact score and computes percentage of dataset', () => {
    const venues = [
      makeVenue({ id: 'v1', ...COMPLETE_FIELDS }), // score 6 (100%)
      makeVenue({ id: 'v2', ...COMPLETE_FIELDS }), // score 6 (100%)
      makeVenue({ id: 'v3' }), // score 0 (0%)
    ]

    const result = computeCompletionDistribution(evaluateVenueQualities(venues))
    const hundredBucket = result.find((b) => b.score === 6)!
    const zeroBucket = result.find((b) => b.score === 0)!

    expect(hundredBucket.count).toBe(2)
    expect(hundredBucket.percentageOfDataset).toBe(67)
    expect(zeroBucket.count).toBe(1)
    expect(zeroBucket.percentageOfDataset).toBe(33)
  })
})

describe('computeActionQueue', () => {
  it('returns four zero-count groups for an empty dataset', () => {
    const result = computeActionQueue(evaluateVenueQualities([]))
    expect(result).toHaveLength(4)
    expect(result.every((group) => group.count === 0)).toBe(true)
  })

  it('groups a venue missing cover+gallery into missing_visuals', () => {
    const venues = [
      makeVenue({
        id: 'v1',
        instagram_handle: 'h',
        website: 'https://example.com',
        phone: '+1',
        maps_url: 'https://maps.google.com/?q=1,1',
      }),
    ]
    const result = computeActionQueue(evaluateVenueQualities(venues))
    const group = result.find((g) => g.key === 'missing_visuals')!
    expect(group.venueIds).toEqual(['v1'])
  })

  it('groups a venue missing instagram+website+phone into no_digital_presence', () => {
    const venues = [
      makeVenue({
        id: 'v1',
        cover_image_url: 'https://example.com/c.jpg',
        gallery_image_urls: ['https://example.com/1.jpg'],
        maps_url: 'https://maps.google.com/?q=1,1',
      }),
    ]
    const result = computeActionQueue(evaluateVenueQualities(venues))
    const group = result.find((g) => g.key === 'no_digital_presence')!
    expect(group.venueIds).toEqual(['v1'])
  })

  it('groups a venue missing exactly one field into nearly_complete', () => {
    const venues = [
      makeVenue({
        id: 'v1',
        cover_image_url: 'https://example.com/c.jpg',
        gallery_image_urls: ['https://example.com/1.jpg'],
        instagram_handle: 'h',
        website: 'https://example.com',
        phone: '+1',
        // maps_url missing — the one gap
      }),
    ]
    const result = computeActionQueue(evaluateVenueQualities(venues))
    const group = result.find((g) => g.key === 'nearly_complete')!
    expect(group.venueIds).toEqual(['v1'])
  })

  it('groups a fully empty venue into low_completion', () => {
    const venues = [makeVenue({ id: 'v1' })]
    const result = computeActionQueue(evaluateVenueQualities(venues))
    const group = result.find((g) => g.key === 'low_completion')!
    expect(group.venueIds).toEqual(['v1'])
  })

  it('a venue can appear in multiple groups when it matches multiple criteria', () => {
    // Fully empty: 0% (low_completion) AND missing cover+gallery (missing_visuals)
    // AND missing instagram+website+phone (no_digital_presence).
    const venues = [makeVenue({ id: 'v1' })]
    const result = computeActionQueue(evaluateVenueQualities(venues))

    expect(result.find((g) => g.key === 'low_completion')!.venueIds).toContain('v1')
    expect(result.find((g) => g.key === 'missing_visuals')!.venueIds).toContain('v1')
    expect(result.find((g) => g.key === 'no_digital_presence')!.venueIds).toContain('v1')
  })
})
