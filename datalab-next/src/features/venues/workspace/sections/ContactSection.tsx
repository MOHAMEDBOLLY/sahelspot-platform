import { Phone } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'
import { WorkspaceField } from '../WorkspaceField'
import { TextField } from '../fields/TextField'
import type { WorkspaceMode } from '../types'
import type { FieldErrors } from '../../../../lib/validation'

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

export function ContactSection({ venue, mode, onFieldChange, errors = {} }: ContactSectionProps) {
  return (
    <WorkspaceSection title="Contact" icon={Phone}>
      <dl className="grid grid-cols-2 gap-4">
        {mode === 'view' ? (
          <>
            <WorkspaceField label="Phone" value={venue.phone} />
            <WorkspaceField label="WhatsApp" value={venue.whatsapp} />
            <WorkspaceField
              label="Website"
              value={venue.website ? <ExternalLink href={venue.website} /> : null}
            />
            <WorkspaceField label="Instagram" value={venue.instagram_handle} />
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
