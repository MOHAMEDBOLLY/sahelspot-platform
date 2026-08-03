import { useRef, useState, type ChangeEvent } from 'react'
import { ImageOff, Images, Loader2, Upload, X } from 'lucide-react'
import type { Event } from '../../../../types/event'
import { WorkspaceSection } from '../../../../components/workspace/WorkspaceSection'
import type { WorkspaceMode } from '../../../../components/workspace/types'

type EventCoverSectionProps = {
  event: Event
  mode: WorkspaceMode
  onUploadCover: (file: File) => void
  onRemoveCover: () => void
  isUploading: boolean
  uploadProgress: number | null
  uploadError: string | null
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Events Module v1 — adapted directly from destinations'
 * `CoverImageSection`: cover only, no gallery (see `Event`'s backend
 * docstring for why). Upload/remove act immediately, same reasoning
 * every other cover section in Studio already documents. */
export function EventCoverSection({
  event,
  mode,
  onUploadCover,
  onRemoveCover,
  isUploading,
  uploadProgress,
  uploadError,
}: EventCoverSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  function handleFileSelected(fileEvent: ChangeEvent<HTMLInputElement>) {
    const file = fileEvent.target.files?.[0]
    fileEvent.target.value = ''
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
          <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {mode === 'edit' && (
        <div className="mb-2 flex items-center justify-end gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {event.cover_image_url ? 'Replace' : 'Upload'}
          </button>
          {event.cover_image_url && (
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

      {event.cover_image_url ? (
        <img
          src={event.cover_image_url}
          alt={`${event.title} cover`}
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
