import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type DrawerProps = {
  open: boolean
  onClose: () => void
  /** Which edge the drawer slides in from. Sidebar uses 'left'. */
  side?: 'left' | 'right'
  title?: string
  children: ReactNode
}

/**
 * Generic overlay drawer primitive — not Studio- or Sidebar-specific.
 * Backdrop + slide-in panel + Escape-to-close + focus returns to nothing
 * special (native `<button>` autofocus on the close button covers the
 * common case). Any feature needing an off-canvas panel on narrow
 * viewports can reuse this without knowing about navigation at all.
 */
export function Drawer({ open, onClose, side = 'left', title, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          'absolute top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          side === 'left' ? 'left-0' : 'right-0',
        ].join(' ')}
      >
        {title && (
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4">
            <span className="text-base font-semibold text-gray-900">{title}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
