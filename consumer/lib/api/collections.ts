import { apiGetList, apiGetOrNull } from "./client";
import type { PublishedCollectionDTO, PublishedHomeCollectionDTO } from "./dto";

/** `GET /public/collections/{slug}` — the single-collection public read
 * path (Category/Tags/Access Type/Badges/Collections architecture, Phase
 * 1). Kept for any caller that needs one specific collection by slug;
 * Home itself now uses `fetchHomeCollections` below instead, since this
 * endpoint never exposed `Collection.sort_order` and so can't answer
 * "what order do the curated Home sections go in." A 404 means "no
 * active/published collection at this slug" — an inactive collection is
 * dropped from the publish snapshot entirely (see `_serialize_collections`,
 * api/app/publishing/engine.py), so `is_active` never needs checking
 * client-side: absence from this endpoint *is* the inactive signal.
 * `venues` in the response already carries the collection's curated
 * `sort_order` — never re-sorted here or by any caller. */
export function fetchCollection(slug: string): Promise<PublishedCollectionDTO | null> {
  return apiGetOrNull<PublishedCollectionDTO>(`/public/collections/${encodeURIComponent(slug)}`);
}

/** `GET /public/collections` — Consumer Home Curation Integration V2. The
 * one request Home's curated sections (`best-beaches`/`food-picks`/
 * `nightlife`) now share, replacing three independent per-slug requests.
 * Returns only the Home-Curation-allowlisted collections (server-side —
 * see `HOME_CURATION_SLUGS`, api/app/api/routes/public.py), already in
 * `Collection.sort_order` order with each `sort_order` field holding this
 * collection's position among the Home Curation set specifically — the
 * signal `fetchCollection` above never had. An inactive collection is
 * absent from the array entirely, same "absence is the signal" contract
 * as the single-slug endpoint. Empty array (not an error) when no
 * revision exists yet or none of the three are currently published. */
export function fetchHomeCollections(): Promise<PublishedHomeCollectionDTO[]> {
  return apiGetList<PublishedHomeCollectionDTO>("/public/collections");
}
