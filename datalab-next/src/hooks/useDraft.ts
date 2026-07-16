import { useEffect, useMemo, useState } from 'react'

export type DraftMode = 'view' | 'edit'

/**
 * Generic view/edit-draft state for a single entity workspace (e.g. the Venue
 * Workspace, and later a Destination Workspace). Holds a mode plus a local
 * draft copy of `original`, computes whether the draft differs from the
 * original ("dirty"), and warns before an accidental browser refresh/close
 * while dirty.
 *
 * Nothing here calls an API or persists anything — the draft only ever lives
 * in React state, for exactly as long as this hook is mounted with
 * mode 'edit'. This is deliberately the shared foundation Save, Publish, and
 * autosave will build on later, not a one-off piece of VenueWorkspace state.
 */
export function useDraft<T>(original: T | undefined, resetKey: unknown) {
  const [mode, setMode] = useState<DraftMode>('view')
  const [draft, setDraft] = useState<T | null>(null)

  // A different entity was selected (e.g. a different venue) — any
  // in-progress draft belongs to the old one, so drop it.
  useEffect(() => {
    setMode('view')
    setDraft(null)
  }, [resetKey])

  const isDirty = useMemo(() => {
    if (mode !== 'edit' || draft === null || original === undefined) return false
    return JSON.stringify(draft) !== JSON.stringify(original)
  }, [mode, draft, original])

  // Standard beforeunload pattern: browsers show their own generic prompt
  // (the custom message text is ignored everywhere modern), but calling
  // preventDefault and setting returnValue is what triggers it.
  useEffect(() => {
    if (!isDirty) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  function startEditing() {
    if (original === undefined) return
    setDraft(original)
    setMode('edit')
  }

  function cancelEditing() {
    setDraft(null)
    setMode('view')
  }

  function updateField<K extends keyof T>(field: K, value: T[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  // View mode always shows the real `original`; edit mode shows the
  // in-progress draft, which starts as a copy of it.
  const value = mode === 'edit' && draft !== null ? draft : (original ?? null)

  return { mode, value, isDirty, startEditing, cancelEditing, updateField }
}
