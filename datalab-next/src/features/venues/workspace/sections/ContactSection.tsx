import { Phone } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import { WorkspaceField } from '../../../../components/workspace/WorkspaceField'
import { TextField } from '../../../../components/workspace/fields/TextField'
import { ExternalLinkButton } from '../../../../components/ExternalLinkButton'
import type { WorkspaceMode } from '../../../../components/workspace/types'
import type { FieldErrors } from '../../../../lib/validation'
import {
  buildInstagramHref,
  buildPhoneHref,
  buildWebsiteHref,
  buildWhatsappHref,
  type VenueLink,
} from '../../../../lib/externalLinks'
import { AtSign, Globe, MessageCircle } from 'lucide-react'

type ContactSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onFieldChange: <K extends keyof Venue>(field: K, value: Venue[K]) => void
  errors?: FieldErrors
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
      {href}
    </a>
  )
}

/** Pairs a WorkspaceField's value with its one-click open action, when
 * the field resolves to a usable link. Keeps link-building centralized in
 * lib/externalLinks.ts rather than re-deriving hrefs per field here. */
function FieldValueWithLink({ value, href, icon, label, linkKey }: {
  value: ReactNode
  href: string | null
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  linkKey: VenueLink['key']
}) {
  if (!href) return <>{value}</>
  return (
    <span className="flex items-center gap-1.5">
      {value}
      <ExternalLinkButton link={{ key: linkKey, label, href, icon }} />
    </span>
  )
}

export function ContactSection({ venue, mode, onFieldChange, errors = {} }: ContactSectionProps) {
  return (
    <WorkspaceSection id="venue-section-contact" title="Contact" icon={Phone}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mode === 'view' ? (
          <>
            <WorkspaceField
              label="Phone"
              value={
                <FieldValueWithLink
                  value={venue.phone}
                  href={buildPhoneHref(venue.phone)}
                  icon={Phone}
                  label="Call phone"
                  linkKey="phone"
                />
              }
            />
            <WorkspaceField
              label="WhatsApp"
              value={
                <FieldValueWithLink
                  value={venue.whatsapp}
                  href={buildWhatsappHref(venue.whatsapp)}
                  icon={MessageCircle}
                  label="Open WhatsApp"
                  linkKey="whatsapp"
                />
              }
            />
            <WorkspaceField
              label="Website"
              value={
                venue.website ? (
                  <FieldValueWithLink
                    value={<ExternalLink href={venue.website} />}
                    href={buildWebsiteHref(venue.website)}
                    icon={Globe}
                    label="Open website"
                    linkKey="website"
                  />
                ) : null
              }
            />
            <WorkspaceField
              label="Instagram"
              value={
                <FieldValueWithLink
                  value={venue.instagram_handle}
                  href={buildInstagramHref(venue.instagram_handle)}
                  icon={AtSign}
                  label="Open Instagram"
                  linkKey="instagram"
                />
              }
            />
            <WorkspaceField label="Facebook" value={venue.facebook_handle} />
            <WorkspaceField label="TikTok" value={venue.tiktok_handle} />
          </>
        ) : (
          <>
            <TextField label="Phone" value={venue.phone ?? ''} onChange={(v) => onFieldChange('phone', v)} />
            <TextField
              label="WhatsApp"
              value={venue.whatsapp ?? ''}
              onChange={(v) => onFieldChange('whatsapp', v)}
            />
            <TextField
              label="Website"
              type="url"
              value={venue.website ?? ''}
              onChange={(v) => onFieldChange('website', v)}
              error={errors.website}
            />
            <TextField
              label="Instagram"
              value={venue.instagram_handle ?? ''}
              onChange={(v) => onFieldChange('instagram_handle', v)}
            />
            <TextField
              label="Facebook"
              value={venue.facebook_handle ?? ''}
              onChange={(v) => onFieldChange('facebook_handle', v)}
            />
            <TextField
              label="TikTok"
              value={venue.tiktok_handle ?? ''}
              onChange={(v) => onFieldChange('tiktok_handle', v)}
            />
          </>
        )}
      </dl>
    </WorkspaceSection>
  )
}
