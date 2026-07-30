import type { VenueLink } from '../lib/externalLinks'

type ExternalLinkButtonProps = {
  link: VenueLink
}

/** Compact icon-only external-link action. Shared by the venue list and
 * the editor sections so link styling/behavior never diverges. Stops
 * propagation so it can sit inside a clickable list row without also
 * triggering the row's own onClick (venue selection). */
export function ExternalLinkButton({ link }: ExternalLinkButtonProps) {
  const Icon = link.icon
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer noopener"
      title={link.label}
      aria-label={link.label}
      onClick={(event) => event.stopPropagation()}
      className="relative flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gray-900 max-lg:after:absolute max-lg:after:inset-[-10px] max-lg:after:content-['']"
    >
      <Icon size={14} />
    </a>
  )
}
