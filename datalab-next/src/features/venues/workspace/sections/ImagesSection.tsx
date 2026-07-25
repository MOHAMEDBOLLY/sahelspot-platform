import { useRef, useState, type ChangeEvent } from 'react'
import { ImageOff, Images, Loader2, Upload, X } from 'lucide-react'
import type { Venue } from '../../../../types/venue'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import type { WorkspaceMode } from '../../../../components/workspace/types'

type ImagesSectionProps = {
  venue: Venue
  mode: WorkspaceMode
  onUploadCover: (file: File) => void
  onUploadGalleryImage: (file: File) => void
  onRemoveCover: () => void
  onRemoveGalleryImage: (url: string) => void
  isUploading: boolean
  uploadError: string | null
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400">
      <ImageOff size={20} />
      <span className="text-xs">{label}</span>
    </div>
  )
}

/** Sprint 25 — Media Library Foundation. Uploading and removing an image
 * act immediately (like Approve/Submit for Review), not through Save
 * Draft's dirty-tracking — an uploaded image is already a committed fact
 * on the server the moment it succeeds, not something to stage and save
 * later. Client-side type/size checks here are UX only, mirroring the
 * same rule the rest of this codebase already follows for validation
 * (`lib/validation.ts`): the backend (`app/media/service.py`) enforces
 * the real limit and is never bypassed by trusting this check. */
export function ImagesSection({
  venue,
  mode,
  onUploadCover,
  onUploadGalleryImage,
  onRemoveCover,
  onRemoveGalleryImage,
  isUploading,
  uploadError,
}: ImagesSectionProps) {
  const gallery = venue.gallery_image_urls ?? []
  const coverInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  function validateFile(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      setLocalError('Only image files are supported.')
      return false
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError('Image exceeds the 5 MB upload limit.')
      return false
    }
    setLocalError(null)
    return true
  }

  function handleCoverFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file && validateFile(file)) {
      onUploadCover(file)
    }
  }

  function handleGalleryFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file && validateFile(file)) {
      onUploadGalleryImage(file)
    }
  }

  const displayedError = localError ?? uploadError

  return (
    <WorkspaceSection title="Images" icon={Images}>
      {displayedError && <p className="mb-3 text-xs font-medium text-red-600">{displayedError}</p>}

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cover Image</p>
          {mode === 'edit' && (
            <div className="flex items-center gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileSelected}
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {venue.cover_image_url ? 'Replace' : 'Upload'}
              </button>
              {venue.cover_image_url && (
                <button
                  type="button"
                  onClick={onRemoveCover}
                  disabled={isUploading}
                  className="rounded-lg border border-gray-300 p-1 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Remove cover image"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>
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
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Gallery</p>
          {mode === 'edit' && (
            <>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGalleryFileSelected}
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Add Image
              </button>
            </>
          )}
        </div>
        {gallery.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((url) => (
              <div key={url} className="group relative">
                <img
                  src={url}
                  alt={`${venue.name} gallery`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
                {mode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => onRemoveGalleryImage(url)}
                    disabled={isUploading}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
                    title="Remove image"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <ImagePlaceholder label="No gallery images" />
        )}
      </div>
    </WorkspaceSection>
  )
}
