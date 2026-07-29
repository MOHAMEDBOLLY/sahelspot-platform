import { ChevronLeft, ChevronRight } from 'lucide-react'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** Renders the existing backend pagination contract (`items`/`total`/
 * `page`/`page_size` — `VenueListOut` in api/app/api/schemas.py) — no new
 * API shape, just the UI that was missing for it. `totalPages` is at
 * least 1 even when `total` is 0, so "Page 1 of 1" is always a sane
 * thing to show rather than "Page 1 of 0". */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
      <p className="text-xs text-gray-500">
        Showing {start}–{end} of {total} venues
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={12} />
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
