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

  // The value editing started from, frozen at the moment Edit was clicked.
  // Dirty-checking compares against this, not the live `original` — if the
  // underlying query refetches while someone is mid-edit (e.g. on window
  // refocus), that must not silently change what "dirty" means partway
  // through an edit session. This is also the natural baseline a future
  // conflict check ("did someone else change this while I was editing?")
  // would compare against the latest `original` — a different comparison
  // than dirty-checking, and one this snapshot already sets up for.
  const [baseline, setBaseline] = useState<T | null>(null)

  // A different entity was selected (e.g. a different venue) — any
  // in-progress draft belongs to the old one, so drop it.
  useEffect(() => {
    setMode('view')
    setDraft(null)
    setBaseline(null)
  }, [resetKey])

  const isDirty = useMemo(() => {
    if (mode !== 'edit' || draft === null || baseline === null) return false
    return JSON.stringify(draft) !== JSON.stringify(baseline)
  }, [mode, draft, baseline])

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
    setBaseline(original)
    setMode('edit')
  }

  function cancelEditing() {
    setDraft(null)
    setBaseline(null)
    setMode('view')
  }

  // Save Draft: the server's response becomes the new baseline, so isDirty
  // goes back to false — but mode stays 'edit', per the product's "remain in
  // Edit Mode after Save Draft" requirement (this is not Cancel or Publish).
  function commitSave(saved: T) {
    setDraft(saved)
    setBaseline(saved)
  }

  function updateField<K extends keyof T>(field: K, value: T[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  // View mode always shows the real `original`; edit mode shows the
  // in-progress draft, which starts as a copy of it.
  const value = mode === 'edit' && draft !== null ? draft : (original ?? null)

  return { mode, value, isDirty, startEditing, cancelEditing, commitSave, updateField }
}
