import { getVenueLinks } from '../lib/externalLinks'
import { ExternalLinkButton } from './ExternalLinkButton'
import type { Venue } from '../types/venue'

type ExternalLinkGroupProps = {
  venue: Venue
  className?: string
}

/** Renders only the open-link actions a venue actually has data for —
 * no disabled/placeholder icons for missing links. Empty when the venue
 * has none, so callers can render it unconditionally. */
export function ExternalLinkGroup({ venue, className = '' }: ExternalLinkGroupProps) {
  const links = getVenueLinks(venue)
  if (links.length === 0) return null

  return (
    <div className={['flex items-center gap-0.5', className].join(' ')}>
      {links.map((link) => (
        <ExternalLinkButton key={link.key} link={link} />
      ))}
    </div>
  )
}
