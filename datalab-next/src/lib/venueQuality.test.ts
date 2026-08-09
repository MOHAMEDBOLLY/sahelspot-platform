import { describe, expect, it } from 'vitest'
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
    short_description: null,
    cover_image_url: null,
    gallery_image_urls: null,
    opening_hours: null,
    beach_details: null,
    access_type: null,
    reservation_policy: null,
    is_no_qr: false,
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

describe('evaluateVenueQuality', () => {
  it('scores a fully complete venue as 100%', () => {
    const venue = makeVenue({
      cover_image_url: 'https://example.com/cover.jpg',
      gallery_image_urls: ['https://example.com/1.jpg'],
      instagram_handle: 'testvenue',
      website: 'https://example.com',
      phone: '+201234567890',
      maps_url: 'https://maps.google.com/?q=1,1',
    })

    const result = evaluateVenueQuality(venue)

    expect(result.completionPercent).toBe(100)
    expect(result.score).toBe(6)
    expect(result.missingFields).toEqual([])
    expect(result.completedFields).toEqual(['cover', 'gallery', 'instagram', 'website', 'phone', 'maps'])
    expect(result.hasCover).toBe(true)
    expect(result.hasGallery).toBe(true)
    expect(result.hasInstagram).toBe(true)
    expect(result.hasWebsite).toBe(true)
    expect(result.hasPhone).toBe(true)
    expect(result.hasMaps).toBe(true)
  })

  it('scores a completely empty venue as 0%', () => {
    const result = evaluateVenueQuality(makeVenue())

    expect(result.completionPercent).toBe(0)
    expect(result.score).toBe(0)
    expect(result.completedFields).toEqual([])
    expect(result.missingFields).toEqual(['cover', 'gallery', 'instagram', 'website', 'phone', 'maps'])
    expect(result.hasCover).toBe(false)
    expect(result.hasGallery).toBe(false)
    expect(result.hasInstagram).toBe(false)
    expect(result.hasWebsite).toBe(false)
    expect(result.hasPhone).toBe(false)
    expect(result.hasMaps).toBe(false)
  })

  it('scores a partial venue proportionally (3/6 = 50%)', () => {
    const venue = makeVenue({
      cover_image_url: 'https://example.com/cover.jpg',
      website: 'https://example.com',
      maps_url: 'https://maps.google.com/?q=1,1',
    })

    const result = evaluateVenueQuality(venue)

    expect(result.score).toBe(3)
    expect(result.completionPercent).toBe(50)
    expect(result.completedFields).toEqual(['cover', 'website', 'maps'])
    expect(result.missingFields).toEqual(['gallery', 'instagram', 'phone'])
  })

  it('treats missing social links (instagram/website/phone) as absent independently', () => {
    const venue = makeVenue({
      cover_image_url: 'https://example.com/cover.jpg',
      gallery_image_urls: ['https://example.com/1.jpg'],
      maps_url: 'https://maps.google.com/?q=1,1',
    })

    const result = evaluateVenueQuality(venue)

    expect(result.hasInstagram).toBe(false)
    expect(result.hasWebsite).toBe(false)
    expect(result.hasPhone).toBe(false)
    expect(result.missingFields).toEqual(['instagram', 'website', 'phone'])
  })

  it('treats a missing cover as absent even when everything else is present', () => {
    const venue = makeVenue({
      gallery_image_urls: ['https://example.com/1.jpg'],
      instagram_handle: 'testvenue',
      website: 'https://example.com',
      phone: '+201234567890',
      maps_url: 'https://maps.google.com/?q=1,1',
    })

    const result = evaluateVenueQuality(venue)

    expect(result.hasCover).toBe(false)
    expect(result.score).toBe(5)
    expect(result.missingFields).toEqual(['cover'])
  })

  it('treats a missing maps_url as absent even when everything else is present', () => {
    const venue = makeVenue({
      cover_image_url: 'https://example.com/cover.jpg',
      gallery_image_urls: ['https://example.com/1.jpg'],
      instagram_handle: 'testvenue',
      website: 'https://example.com',
      phone: '+201234567890',
    })

    const result = evaluateVenueQuality(venue)

    expect(result.hasMaps).toBe(false)
    expect(result.score).toBe(5)
    expect(result.missingFields).toEqual(['maps'])
  })

  it('treats an empty gallery array the same as a missing gallery', () => {
    const result = evaluateVenueQuality(makeVenue({ gallery_image_urls: [] }))

    expect(result.hasGallery).toBe(false)
  })

  it('treats a null gallery the same as a missing gallery', () => {
    const result = evaluateVenueQuality(makeVenue({ gallery_image_urls: null }))

    expect(result.hasGallery).toBe(false)
  })

  it('treats a whitespace-only string field as missing', () => {
    const venue = makeVenue({
      cover_image_url: '   ',
      website: '\t\n',
    })

    const result = evaluateVenueQuality(venue)

    expect(result.hasCover).toBe(false)
    expect(result.hasWebsite).toBe(false)
  })

  it('rounds non-exact fractions using standard rounding (1/6 -> 17%, 5/6 -> 83%)', () => {
    const oneOfSix = evaluateVenueQuality(makeVenue({ cover_image_url: 'https://example.com/cover.jpg' }))
    expect(oneOfSix.completionPercent).toBe(17)

    const fiveOfSix = evaluateVenueQuality(
      makeVenue({
        cover_image_url: 'https://example.com/cover.jpg',
        gallery_image_urls: ['https://example.com/1.jpg'],
        instagram_handle: 'testvenue',
        website: 'https://example.com',
        phone: '+201234567890',
      }),
    )
    expect(fiveOfSix.completionPercent).toBe(83)
  })
})
