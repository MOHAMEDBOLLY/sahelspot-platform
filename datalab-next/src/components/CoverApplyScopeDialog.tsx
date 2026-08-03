import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type CoverApplyScopeDialogProps = {
  /** Total venues sharing the brand, including this one — the task's own
   * "Apply to all <N> venues in this brand" wording. Only ever rendered
   * by `ImagesSection` when this is > 1; the caller (not this component)
   * is what hides the prompt entirely for a brand-less or lone-venue
   * cover upload. */
  venueCount: number
  onCancel: () => void
  onConfirm: (applyToBrand: boolean) => void
}

/** Brand Asset Propagation — "Apply cover to: This venue only / All
 * venues in the same brand". Unlike `RejectDialog`/`DeleteConfirmDialog`,
 * this dialog opens itself (a cover file was already picked, see
 * `ImagesSection.handleCoverFileSelected`) rather than via its own
 * trigger button — same native `<dialog>` shape either way.
 */
export function CoverApplyScopeDialog({ venueCount, onCancel, onConfirm }: CoverApplyScopeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [scope, setScope] = useState<'this-venue' | 'brand'>('this-venue')

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleClose() {
    dialogRef.current?.close()
    onCancel()
  }

  function handleConfirm() {
    dialogRef.current?.close()
    onConfirm(scope === 'brand')
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Apply cover to</h2>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-900">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2 text-sm text-gray-900">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="cover-apply-scope"
              checked={scope === 'this-venue'}
              onChange={() => setScope('this-venue')}
            />
            This venue only
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="cover-apply-scope"
              checked={scope === 'brand'}
              onChange={() => setScope('brand')}
            />
            Apply to all {venueCount} venues in this brand
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 lg:min-h-0"
          >
            Upload
          </button>
        </div>
      </div>
    </dialog>
  )
}
