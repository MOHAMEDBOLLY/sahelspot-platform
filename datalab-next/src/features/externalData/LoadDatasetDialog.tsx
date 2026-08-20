import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loadDetailFile, loadMatchOverlay } from './api'
import { ApiError } from '../../lib/apiClient'

type Mode = 'choose' | 'detail' | 'matches'

/** External Data Enrichment Workflow (Phase 1). Same native `<dialog>`
 * pattern every other Studio create/upload dialog uses. Deliberately
 * two explicit load actions, not one generic "import" button — loading
 * detail records and loading a match overlay are different operations
 * on different file shapes (see `api/app/domain/external_ingest.py`),
 * and neither one ever writes to `venues` — only to the review staging
 * table. */
export function LoadDatasetDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<Mode>('choose')
  const [source, setSource] = useState('')
  const [sheetName, setSheetName] = useState('All Review')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { mutate: runDetailLoad, isPending: isLoadingDetail } = useMutation({
    mutationFn: () => loadDetailFile(source.trim(), file as File, setProgress),
    onSuccess: (res) => {
      setResult(`Loaded: ${res.created} created, ${res.updated} updated (source: ${res.source}).`)
      queryClient.invalidateQueries({ queryKey: ['external-records'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to load file.'),
  })

  const { mutate: runMatchLoad, isPending: isLoadingMatches } = useMutation({
    mutationFn: () => loadMatchOverlay(file as File, sheetName.trim() || 'All Review', setProgress),
    onSuccess: (res) => {
      setResult(`Matched: ${res.matched}, unmatched: ${res.unmatched}.`)
      queryClient.invalidateQueries({ queryKey: ['external-records'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to load match file.'),
  })

  function openDialog() {
    setMode('choose')
    setSource('')
    setSheetName('All Review')
    setFile(null)
    setProgress(null)
    setResult(null)
    setError(null)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
  }

  const isPending = isLoadingDetail || isLoadingMatches

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 lg:min-h-0"
      >
        + Load Dataset
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Load External Dataset</h2>
            <button type="button" onClick={closeDialog} className="text-gray-400 hover:text-gray-900">
              <X size={16} />
            </button>
          </div>

          {mode === 'choose' && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setMode('detail')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Load Detail Records
                <span className="block text-xs font-normal text-gray-400">
                  Full external records (name, description, amenities, images, booking info) into review staging.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode('matches')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Load Match Overlay
                <span className="block text-xs font-normal text-gray-400">
                  A pre-built candidate-match file (.csv or .xlsx) for already-loaded records.
                </span>
              </button>
            </div>
          )}

          {mode === 'detail' && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Source
                <input
                  type="text"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="e.g. beaches, restaurants, nightlife"
                  className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                File (.json or .csv)
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </label>
            </>
          )}

          {mode === 'matches' && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Sheet name (for .xlsx)
                <input
                  type="text"
                  value={sheetName}
                  onChange={(event) => setSheetName(event.target.value)}
                  className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none lg:min-h-0"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                File (.xlsx or .csv)
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </label>
            </>
          )}

          {progress !== null && <p className="text-xs text-gray-500">Uploading… {progress}%</p>}
          {result && <p className="text-sm text-green-700">{result}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={mode === 'choose' ? closeDialog : () => setMode('choose')}
              className="min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:min-h-0"
            >
              {mode === 'choose' ? 'Close' : 'Back'}
            </button>
            {mode === 'detail' && (
              <button
                type="button"
                disabled={isPending || !file || !source.trim()}
                onClick={() => runDetailLoad()}
                className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
              >
                {isLoadingDetail ? 'Loading…' : 'Load'}
              </button>
            )}
            {mode === 'matches' && (
              <button
                type="button"
                disabled={isPending || !file}
                onClick={() => runMatchLoad()}
                className="min-h-11 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
              >
                {isLoadingMatches ? 'Loading…' : 'Load'}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
