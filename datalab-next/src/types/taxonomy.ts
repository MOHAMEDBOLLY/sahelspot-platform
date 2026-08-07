/** Category/Tags/Access Type/Badges/Collections architecture (Phase 1).
 * Mirrors `TagOut`/`CollectionOut` (api/app/api/schemas.py). Both catalogs
 * are read-only from Studio's perspective in Phase 1 — no create/update/
 * delete endpoint exists yet (see features/taxonomy/api.ts). */

export interface Tag {
  id: number
  slug: string
  label: string
  category: string
  sort_order: number
}

export interface Collection {
  id: string
  slug: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}
