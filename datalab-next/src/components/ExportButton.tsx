import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { ApiError } from '../lib/apiClient'

type ExportButtonProps = {
  label: string
  onExport: (format: 'csv' | 'json') => Promise<void>
}

/** EP20-T01 — shared by venues and destinations, both of which have an
 * identical `GET .../export?format=csv|json`. A plain button pair rather
 * than a format-picker dialog: this is a download trigger, not a form. */
export function ExportButton({ label, onExport }: ExportButtonProps) {
  const [pendingFormat, setPendingFormat] = useState<'csv' | 'json' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExport(format: 'csv' | 'json') {
    setPendingFormat(format)
    setError(null)
    try {
      await onExport(format)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Export failed.')
    } finally {
      setPendingFormat(null)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => handleExport('csv')}
          disabled={pendingFormat !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingFormat === 'csv' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {label} (CSV)
        </button>
        <button
          type="button"
          onClick={() => handleExport('json')}
          disabled={pendingFormat !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingFormat === 'json' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {label} (JSON)
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
