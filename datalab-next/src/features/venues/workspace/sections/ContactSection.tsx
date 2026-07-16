import { Phone } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'
import { WorkspaceField } from '../WorkspaceField'

type ContactSectionProps = {
  venue: Venue
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
      {href}
    </a>
  )
}

export function ContactSection({ venue }: ContactSectionProps) {
  return (
    <WorkspaceSection title="Contact" icon={Phone}>
      <dl className="grid grid-cols-2 gap-4">
        <WorkspaceField label="Phone" value={venue.phone} />
        <WorkspaceField label="WhatsApp" value={venue.whatsapp} />
        <WorkspaceField
          label="Website"
          value={venue.website ? <ExternalLink href={venue.website} /> : null}
        />
        <WorkspaceField label="Instagram" value={venue.instagram_handle} />
        <WorkspaceField label="Facebook" value={venue.facebook_handle} />
        <WorkspaceField label="TikTok" value={venue.tiktok_handle} />
      </dl>
    </WorkspaceSection>
  )
}
