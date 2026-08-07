import { apiGet } from '../../lib/apiClient'
import type { Collection, Tag } from '../../types/taxonomy'

/** Category/Tags/Access Type/Badges/Collections architecture (Phase 1) —
 * both catalogs are read-only from Studio's side (no create/update/delete
 * endpoint exists yet; see `Tag`/`Collection`'s own docstrings,
 * api/app/db/models.py). `category` scopes the tag list to what's
 * assignable for a given venue — the same scoping the backend's own
 * `validate_tag_ids` enforces server-side, not just this picker's UI. */
export function fetchTags(category: string): Promise<Tag[]> {
  return apiGet<Tag[]>(`/editor/tags?category=${encodeURIComponent(category)}`)
}

export function fetchCollections(): Promise<Collection[]> {
  return apiGet<Collection[]>('/editor/collections')
}
