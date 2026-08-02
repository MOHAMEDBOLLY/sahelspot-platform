import { MapPin, Globe, AtSign, MessageCircle, Phone } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Venue } from '../types/venue'

export type VenueLink = {
  key: 'maps' | 'website' | 'instagram' | 'whatsapp' | 'phone'
  label: string
  href: string
  icon: ComponentType<{ size?: number; className?: string }>
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function buildMapsHref(mapsUrl: string | null | undefined): string | null {
  if (!mapsUrl?.trim()) return null
  return withScheme(mapsUrl.trim())
}

export function buildWebsiteHref(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  return withScheme(website.trim())
}

export function buildInstagramHref(handle: string | null | undefined): string | null {
  if (!handle?.trim()) return null
  const clean = handle.trim().replace(/^@/, '')
  if (/^https?:\/\//i.test(clean)) return clean
  return `https://instagram.com/${clean}`
}

/** Egypt-only platform — editors overwhelmingly enter local mobile numbers
 * (`01XXXXXXXXX`, 11 digits, no country code), but `wa.me` requires the
 * country code with the leading `0` dropped. Passed through unchanged, a
 * stored local number produces a link WhatsApp reports as invalid rather
 * than opening a chat (confirmed against real published venue data — see
 * the identical fix in `consumer/lib/domain/validators.ts`'s
 * `toValidWhatsapp`, which this mirrors since the two frontends don't
 * share code). Only the one unambiguous case — 11 digits with a single
 * leading `0` — is converted to `20` + the remaining 10 digits; anything
 * else passes through as before. */
export function buildWhatsappHref(whatsapp: string | null | undefined): string | null {
  if (!whatsapp?.trim()) return null
  const digits = whatsapp.replace(/[^\d]/g, '')
  if (!digits) return null
  const normalized = digits.length === 11 && digits.startsWith('0') ? `20${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

export function buildPhoneHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null
  const digits = phone.replace(/[^\d+]/g, '')
  if (!digits) return null
  return `tel:${digits}`
}

/** Single source of truth for "which open-link actions does this venue
 * support" — used identically by the venue list row and the editor
 * sections, so link construction and ordering never drift between them. */
export function getVenueLinks(venue: Venue): VenueLink[] {
  const candidates: Array<[VenueLink['key'], string, VenueLink['icon'], string | null]> = [
    ['maps', 'Open in Google Maps', MapPin, buildMapsHref(venue.maps_url)],
    ['website', 'Open website', Globe, buildWebsiteHref(venue.website)],
    ['instagram', 'Open Instagram', AtSign, buildInstagramHref(venue.instagram_handle)],
    ['whatsapp', 'Open WhatsApp', MessageCircle, buildWhatsappHref(venue.whatsapp)],
    ['phone', 'Call phone', Phone, buildPhoneHref(venue.phone)],
  ]

  return candidates
    .filter((entry): entry is [VenueLink['key'], string, VenueLink['icon'], string] => entry[3] !== null)
    .map(([key, label, icon, href]) => ({ key, label, href, icon }))
}
