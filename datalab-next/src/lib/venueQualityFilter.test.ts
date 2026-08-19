import { describe, expect, it } from 'vitest'
import {
  hasAnyDigitalPresence,
  hasNoDigitalPresence,
  hasQualityFilter,
  matchesQualityFilter,
  parseQualityFilterParams,
  qualityFilterUrlKeys,
  serializeQualityFilterParams,
  type QualityFilterParams,
} from './venueQualityFilter'
import { evaluateVenueQuality } from './venueQuality'
import type { Venue } from '../types/venue'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'v1',
    name: 'Test Venue',
    slug: 'test-venue',
    destination: { id: 'd1', name: 'Test Destination' },
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
    reserve_your_spot_beach_url: null,
    reserve_your_table_url: null,
    reserve_your_spot_nightlife_url: null,
    short_description: null,
    cover_image_url: null,
    gallery_image_urls: null,
    opening_hours: null,
    beach_details: null,
    access_type: null,
    reservation_policy: null,
    is_no_qr: false,
    no_qr_type: null,
    parent_venue_id: null,
    tags: [],
    collections: [],
    internal_notes: null,
    source: null,
    brand: null,
    last_published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('hasQualityFilter', () => {
  it('is false when nothing is set', () => {
    expect(hasQualityFilter({})).toBe(false)
  })

  it('is false for empty arrays', () => {
    expect(hasQualityFilter({ has: [], missing: [] })).toBe(false)
  })

  it('is true when missing is set', () => {
    expect(hasQualityFilter({ missing: ['cover'] })).toBe(true)
  })

  it('is true when has is set', () => {
    expect(hasQualityFilter({ has: ['cover'] })).toBe(true)
  })

  it('is true when maxCompletion is set, even to 0', () => {
    expect(hasQualityFilter({ maxCompletion: 0 })).toBe(true)
  })

  it('is true when minCompletion, missingCount, or digitalPresence is set', () => {
    expect(hasQualityFilter({ minCompletion: 0 })).toBe(true)
    expect(hasQualityFilter({ missingCount: 0 })).toBe(true)
    expect(hasQualityFilter({ digitalPresence: 'any' })).toBe(true)
  })
})

describe('matchesQualityFilter', () => {
  it('matches everything when no params are set', () => {
    const quality = evaluateVenueQuality(makeVenue())
    expect(matchesQualityFilter(quality, {})).toBe(true)
  })

  it('missing: matches only venues missing every listed field (AND)', () => {
    const withCover = evaluateVenueQuality(makeVenue({ cover_image_url: 'https://example.com/c.jpg' }))
    const withoutCover = evaluateVenueQuality(makeVenue())
    const missingCoverOnly = evaluateVenueQuality(
      makeVenue({ gallery_image_urls: ['https://example.com/1.jpg'] }),
    )

    expect(matchesQualityFilter(withCover, { missing: ['cover'] })).toBe(false)
    expect(matchesQualityFilter(withoutCover, { missing: ['cover'] })).toBe(true)
    // missing both cover AND gallery — withoutCover is missing gallery too
    expect(matchesQualityFilter(withoutCover, { missing: ['cover', 'gallery'] })).toBe(true)
    // missingCoverOnly has gallery, so it doesn't match "missing cover AND gallery"
    expect(matchesQualityFilter(missingCoverOnly, { missing: ['cover', 'gallery'] })).toBe(false)
  })

  it('has: matches only venues that have every listed field (AND)', () => {
    const withBoth = evaluateVenueQuality(
      makeVenue({
        cover_image_url: 'https://example.com/c.jpg',
        gallery_image_urls: ['https://example.com/1.jpg'],
      }),
    )
    const coverOnly = evaluateVenueQuality(makeVenue({ cover_image_url: 'https://example.com/c.jpg' }))

    expect(matchesQualityFilter(withBoth, { has: ['cover', 'gallery'] })).toBe(true)
    expect(matchesQualityFilter(coverOnly, { has: ['cover', 'gallery'] })).toBe(false)
    expect(matchesQualityFilter(coverOnly, { has: ['cover'] })).toBe(true)
  })

  it('single-value backward compatibility: a one-element array behaves like the old single-field filter', () => {
    const withoutCover = evaluateVenueQuality(makeVenue())
    expect(matchesQualityFilter(withoutCover, { missing: ['cover'] })).toBe(true)
  })

  it('maxCompletion: only matches venues strictly below the threshold', () => {
    const fiftyPercent = evaluateVenueQuality(
      makeVenue({
        cover_image_url: 'https://example.com/c.jpg',
        gallery_image_urls: ['https://example.com/1.jpg'],
        instagram_handle: 'h',
      }),
    )
    expect(fiftyPercent.completionPercent).toBe(50)

    expect(matchesQualityFilter(fiftyPercent, { maxCompletion: 50 })).toBe(false)
    expect(matchesQualityFilter(fiftyPercent, { maxCompletion: 51 })).toBe(true)
    expect(matchesQualityFilter(fiftyPercent, { maxCompletion: 17 })).toBe(false)
  })

  it('minCompletion: only matches venues at or above the threshold', () => {
    const fiftyPercent = evaluateVenueQuality(
      makeVenue({
        cover_image_url: 'https://example.com/c.jpg',
        gallery_image_urls: ['https://example.com/1.jpg'],
        instagram_handle: 'h',
      }),
    )
    expect(matchesQualityFilter(fiftyPercent, { minCompletion: 50 })).toBe(true)
    expect(matchesQualityFilter(fiftyPercent, { minCompletion: 51 })).toBe(false)
  })

  it('missingCount: matches only venues missing exactly that many fields', () => {
    const missingOne = evaluateVenueQuality(
      makeVenue({
        cover_image_url: 'https://example.com/c.jpg',
        gallery_image_urls: ['https://example.com/1.jpg'],
        instagram_handle: 'h',
        website: 'https://example.com',
        phone: '+1',
        // maps missing — exactly one gap
      }),
    )
    expect(matchesQualityFilter(missingOne, { missingCount: 1 })).toBe(true)
    expect(matchesQualityFilter(missingOne, { missingCount: 2 })).toBe(false)
  })

  it('digitalPresence "any": matches venues with at least one of instagram/website/phone', () => {
    const withInstagram = evaluateVenueQuality(makeVenue({ instagram_handle: 'h' }))
    const withNone = evaluateVenueQuality(makeVenue())

    expect(matchesQualityFilter(withInstagram, { digitalPresence: 'any' })).toBe(true)
    expect(matchesQualityFilter(withNone, { digitalPresence: 'any' })).toBe(false)
  })

  it('digitalPresence "none": matches venues missing all of instagram/website/phone', () => {
    const withInstagram = evaluateVenueQuality(makeVenue({ instagram_handle: 'h' }))
    const withNone = evaluateVenueQuality(makeVenue())

    expect(matchesQualityFilter(withInstagram, { digitalPresence: 'none' })).toBe(false)
    expect(matchesQualityFilter(withNone, { digitalPresence: 'none' })).toBe(true)
  })

  it('combines multiple params with AND semantics', () => {
    const quality = evaluateVenueQuality(makeVenue()) // 0%, missing everything
    expect(matchesQualityFilter(quality, { missing: ['maps'], maxCompletion: 50 })).toBe(true)
    expect(matchesQualityFilter(quality, { missing: ['maps'], maxCompletion: 0 })).toBe(false)
  })
})

describe('hasAnyDigitalPresence / hasNoDigitalPresence', () => {
  it('agree exactly (never both true, never both false)', () => {
    const withPhone = evaluateVenueQuality(makeVenue({ phone: '+1' }))
    const withNone = evaluateVenueQuality(makeVenue())

    expect(hasAnyDigitalPresence(withPhone)).toBe(true)
    expect(hasNoDigitalPresence(withPhone)).toBe(false)
    expect(hasAnyDigitalPresence(withNone)).toBe(false)
    expect(hasNoDigitalPresence(withNone)).toBe(true)
  })
})

describe('serializeQualityFilterParams', () => {
  it('produces no keys for an empty params object', () => {
    expect(serializeQualityFilterParams({})).toEqual({})
  })

  it('joins field arrays with commas', () => {
    expect(serializeQualityFilterParams({ has: ['cover', 'gallery'] })).toEqual({ has: 'cover,gallery' })
  })

  it('omits empty arrays entirely rather than serializing an empty string', () => {
    expect(serializeQualityFilterParams({ has: [] })).toEqual({})
  })

  it('stringifies numeric and enum fields', () => {
    expect(
      serializeQualityFilterParams({ minCompletion: 80, maxCompletion: 100, missingCount: 1, digitalPresence: 'none' }),
    ).toEqual({ minCompletion: '80', maxCompletion: '100', missingCount: '1', digitalPresence: 'none' })
  })

  it('serializes maxCompletion: 0 (falsy but meaningful)', () => {
    expect(serializeQualityFilterParams({ maxCompletion: 0 })).toEqual({ maxCompletion: '0' })
  })
})

describe('parseQualityFilterParams', () => {
  it('returns an empty object when no relevant params are present', () => {
    expect(parseQualityFilterParams(new URLSearchParams('q=beach'))).toEqual({})
  })

  it('parses a single-value missing param (Sprint 1 backward compatibility)', () => {
    expect(parseQualityFilterParams(new URLSearchParams('missing=cover'))).toEqual({ missing: ['cover'] })
  })

  it('parses a comma-separated multi-value param', () => {
    expect(parseQualityFilterParams(new URLSearchParams('missing=cover,gallery'))).toEqual({
      missing: ['cover', 'gallery'],
    })
  })

  it('drops unrecognized field names rather than throwing', () => {
    expect(parseQualityFilterParams(new URLSearchParams('missing=cover,not-a-real-field'))).toEqual({
      missing: ['cover'],
    })
  })

  it('drops a missing param whose every value is unrecognized', () => {
    expect(parseQualityFilterParams(new URLSearchParams('missing=not-a-real-field'))).toEqual({})
  })

  it('parses numeric params, ignoring non-numeric values', () => {
    expect(parseQualityFilterParams(new URLSearchParams('minCompletion=80&maxCompletion=abc'))).toEqual({
      minCompletion: 80,
    })
  })

  it('parses maxCompletion=0 (falsy but meaningful)', () => {
    expect(parseQualityFilterParams(new URLSearchParams('maxCompletion=0'))).toEqual({ maxCompletion: 0 })
  })

  it('only accepts "any"/"none" for digitalPresence', () => {
    expect(parseQualityFilterParams(new URLSearchParams('digitalPresence=any'))).toEqual({ digitalPresence: 'any' })
    expect(parseQualityFilterParams(new URLSearchParams('digitalPresence=bogus'))).toEqual({})
  })

  it('parses every dimension combined', () => {
    const params = new URLSearchParams(
      'has=maps&missing=cover,gallery&minCompletion=10&maxCompletion=90&missingCount=2&digitalPresence=none',
    )
    expect(parseQualityFilterParams(params)).toEqual({
      has: ['maps'],
      missing: ['cover', 'gallery'],
      minCompletion: 10,
      maxCompletion: 90,
      missingCount: 2,
      digitalPresence: 'none',
    })
  })
})

describe('URL round-trip', () => {
  const cases: QualityFilterParams[] = [
    {},
    { missing: ['cover'] },
    { has: ['instagram', 'website'], missing: ['cover', 'gallery'] },
    { minCompletion: 10, maxCompletion: 90 },
    { missingCount: 1 },
    { digitalPresence: 'any' },
    { has: ['maps'], missing: ['cover'], minCompletion: 0, maxCompletion: 100, missingCount: 3, digitalPresence: 'none' },
  ]

  it.each(cases)('serialize -> URLSearchParams -> parse reproduces the original params for %j', (original) => {
    const serialized = serializeQualityFilterParams(original)
    const url = new URLSearchParams(serialized)
    const parsed = parseQualityFilterParams(url)
    expect(parsed).toEqual(original)
  })

  it('a full page reload (URLSearchParams -> parse -> serialize -> URLSearchParams) preserves the query string', () => {
    const original = new URLSearchParams('has=cover&missing=instagram,website&maxCompletion=50')
    const roundTripped = new URLSearchParams(serializeQualityFilterParams(parseQualityFilterParams(original)))
    expect(roundTripped.toString()).toBe(original.toString())
  })
})

describe('qualityFilterUrlKeys', () => {
  it('covers every key serializeQualityFilterParams can produce', () => {
    const fullParams: QualityFilterParams = {
      has: ['cover'],
      missing: ['gallery'],
      minCompletion: 1,
      maxCompletion: 2,
      missingCount: 3,
      digitalPresence: 'any',
    }
    const serializedKeys = Object.keys(serializeQualityFilterParams(fullParams))
    expect(serializedKeys.every((key) => qualityFilterUrlKeys().includes(key))).toBe(true)
  })
})
