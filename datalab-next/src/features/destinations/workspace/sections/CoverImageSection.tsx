import { useRef, useState, type ChangeEvent } from 'react'
import { ImageOff, Images, Loader2, Upload, X } from 'lucide-react'
import type { Destination } from '../../../../types/destination'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import type { WorkspaceMode } from '../../../../components/workspace/types'

type CoverImageSectionProps = {
  destination: Destination
  mode: WorkspaceMode
  onUploadCover: (file: File) => void
  onRemoveCover: () => void
  isUploading: boolean
  uploadProgress: number | null
  uploadError: string | null
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Sprint 29 — adapted from venues' `ImagesSection` (Sprint 25/26), cover
 * only: destinations deliberately don't get a gallery, so there's no
 * "Set Cover"/reorder/multi-image UI to carry over, just the cover half of
 * that component. Upload/remove act immediately, same reasoning venues'
 * version already documents — an uploaded image is already a committed
 * fact on the server, not something to stage through Save Draft. */
export function CoverImageSection({
  destination,
  mode,
  onUploadCover,
  onRemoveCover,
  isUploading,
  uploadProgress,
  uploadError,
}: CoverImageSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLocalError('Only image files are supported.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError('Image exceeds the 5 MB upload limit.')
      return
    }
    setLocalError(null)
    onUploadCover(file)
  }

  const displayedError = localError ?? uploadError

  return (
    <WorkspaceSection title="Cover Image" icon={Images}>
      {displayedError && <p className="mb-3 text-xs font-medium text-red-600">{displayedError}</p>}
      {isUploading && uploadProgress !== null && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gray-900 transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {mode === 'edit' && (
        <div className="mb-2 flex items-center justify-end gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {destination.cover_image_url ? 'Replace' : 'Upload'}
          </button>
          {destination.cover_image_url && (
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

      {destination.cover_image_url ? (
        <img
          src={destination.cover_image_url}
          alt={`${destination.name} cover`}
          className="aspect-video w-full rounded-lg object-cover"
        />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400">
          <ImageOff size={20} />
          <span className="text-xs">No cover image</span>
        </div>
      )}
    </WorkspaceSection>
  )
}
