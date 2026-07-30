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

export function buildWhatsappHref(whatsapp: string | null | undefined): string | null {
  if (!whatsapp?.trim()) return null
  const digits = whatsapp.replace(/[^\d]/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}`
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
