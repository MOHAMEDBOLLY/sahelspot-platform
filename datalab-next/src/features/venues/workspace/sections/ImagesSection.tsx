import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ImageOff, Images, ImageUp, Loader2, Upload, X } from 'lucide-react'
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
  onSetCover: (url: string) => void
  onReorderGallery: (newOrder: string[]) => void
  isUploading: boolean
  uploadProgress: number | null
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
 * the real limit and is never bypassed by trusting this check.
 *
 * Sprint 26 adds gallery reordering (native HTML5 drag-and-drop — no new
 * dependency), "Set Cover" per gallery image, and a basic upload progress
 * bar. Reordering and removal both go through `onReorderGallery`/
 * `onRemoveGalleryImage`, which the parent workspace saves via the
 * existing `PATCH` (no new backend endpoint for either — see
 * `routes/venues.py`'s `update_venue` docstring).
 */
export function ImagesSection({
  venue,
  mode,
  onUploadCover,
  onUploadGalleryImage,
  onRemoveCover,
  onRemoveGalleryImage,
  onSetCover,
  onReorderGallery,
  isUploading,
  uploadProgress,
  uploadError,
}: ImagesSectionProps) {
  const gallery = venue.gallery_image_urls ?? []
  const coverInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [draggedUrl, setDraggedUrl] = useState<string | null>(null)

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

  // Plain HTML5 drag-and-drop — no library. `draggedUrl` is the item
  // currently being dragged; dropping onto another thumbnail swaps it to
  // that position and saves the whole reordered array in one go.
  function handleDragStart(url: string) {
    setDraggedUrl(url)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
  }

  function handleDrop(targetUrl: string) {
    if (!draggedUrl || draggedUrl === targetUrl) {
      setDraggedUrl(null)
      return
    }
    const withoutDragged = gallery.filter((url) => url !== draggedUrl)
    const targetIndex = withoutDragged.indexOf(targetUrl)
    const reordered = [
      ...withoutDragged.slice(0, targetIndex),
      draggedUrl,
      ...withoutDragged.slice(targetIndex),
    ]
    setDraggedUrl(null)
    onReorderGallery(reordered)
  }

  const displayedError = localError ?? uploadError

  return (
    <WorkspaceSection title="Images" icon={Images}>
      {displayedError && <p className="mb-3 text-xs font-medium text-red-600">{displayedError}</p>}
      {isUploading && uploadProgress !== null && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gray-900 transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

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
              <div
                key={url}
                draggable={mode === 'edit'}
                onDragStart={() => handleDragStart(url)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(url)}
                className={`group relative ${mode === 'edit' ? 'cursor-move' : ''} ${
                  draggedUrl === url ? 'opacity-40' : ''
                }`}
              >
                <img
                  src={url}
                  alt={`${venue.name} gallery`}
                  className="aspect-square w-full rounded-lg object-cover"
                />
                {mode === 'edit' && (
                  <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {url !== venue.cover_image_url && (
                      <button
                        type="button"
                        onClick={() => onSetCover(url)}
                        disabled={isUploading}
                        className="rounded-full bg-black/60 p-1 text-white disabled:cursor-not-allowed"
                        title="Set as cover image"
                      >
                        <ImageUp size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveGalleryImage(url)}
                      disabled={isUploading}
                      className="rounded-full bg-black/60 p-1 text-white disabled:cursor-not-allowed"
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
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
