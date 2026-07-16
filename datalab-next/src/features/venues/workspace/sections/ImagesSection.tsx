import { ImageOff, Images } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../WorkspaceSection'

type ImagesSectionProps = {
  venue: Venue
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400">
      <ImageOff size={20} />
      <span className="text-xs">{label}</span>
    </div>
  )
}

export function ImagesSection({ venue }: ImagesSectionProps) {
  const gallery = venue.gallery_image_urls ?? []

  return (
    <WorkspaceSection title="Images" icon={Images}>
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Cover Image
        </p>
        {venue.cover_image_url ? (
          <img
            src={venue.cover_image_url}
            alt={`${venue.name} cover`}
            className="aspect-video w-full rounded-lg object-cover"
          />
        ) : (
          <ImagePlaceholder label="No cover image" />
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Gallery</p>
        {gallery.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((url) => (
              <img
                key={url}
                src={url}
                alt={`${venue.name} gallery`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        ) : (
          <ImagePlaceholder label="No gallery images" />
        )}
      </div>
    </WorkspaceSection>
  )
}
