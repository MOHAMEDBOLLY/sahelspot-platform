/**
 * A saved filter preset. Deliberately stores nothing beyond what's needed
 * to restore a URL: `params` is the exact set of query-string entries the
 * Venue List understood when the view was saved (whichever of `q`,
 * `destination`, `category`, `status`, `has`, `missing`, `minCompletion`,
 * `maxCompletion`, `missingCount`, `digitalPresence` were active) — no
 * parsed/structured filter object is kept separately, so there is nothing
 * here that could drift from what `pages/Venues.tsx`/`useVenueSearch`
 * actually understand. "Opening" a view is exactly `navigate({ search:
 * ... })` with these params, nothing more.
 *
 * No `sort` field: the Venue List has no sort control today (always
 * name-ascending), so there is nothing to persist yet — see the Phase 2
 * Sprint 2 architecture review. When sorting is introduced, add an
 * optional `sort?: string` here; every existing saved view (missing that
 * key) keeps meaning "whatever the default order is" with no migration
 * required, since restoring a view has always meant "apply these params,"
 * not "apply these params and this sort."
 */
export interface SavedView {
  id: string
  name: string
  /** Optional `lucide-react` icon name (e.g. `'Camera'`) — purely
   * decorative, chosen by the editor when saving. */
  icon?: string
  params: Record<string, string>
  createdAt: string
}

export type SavedViewInput = Pick<SavedView, 'name' | 'icon' | 'params'>

const STORAGE_KEY_PREFIX = 'sahelspot:savedViews:'

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Every function here takes a `Storage`-shaped adapter (defaults to
 * `window.localStorage`) so tests can pass an in-memory fake instead of
 * depending on a real browser API. Saved Views are namespaced per signed-
 * in user (`userId` from `useAuth()`'s `user.id`) so two editors sharing a
 * browser profile don't see each other's presets — no backend, no
 * cross-device sync, purely a local convenience. */
export function listSavedViews(userId: string, storage: Storage = window.localStorage): SavedView[] {
  const raw = storage.getItem(storageKey(userId))
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedView[]) : []
  } catch {
    return []
  }
}

export function saveSavedView(
  userId: string,
  input: SavedViewInput,
  storage: Storage = window.localStorage,
): SavedView {
  const view: SavedView = {
    id: generateId(),
    name: input.name,
    icon: input.icon,
    params: input.params,
    createdAt: new Date().toISOString(),
  }
  const views = listSavedViews(userId, storage)
  storage.setItem(storageKey(userId), JSON.stringify([...views, view]))
  return view
}

export function deleteSavedView(userId: string, viewId: string, storage: Storage = window.localStorage): void {
  const views = listSavedViews(userId, storage).filter((view) => view.id !== viewId)
  storage.setItem(storageKey(userId), JSON.stringify(views))
}
