export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/** Fallback camera position when no venue has real coordinates yet (an empty
 * publish snapshot, or every venue missing lat/lng) — the North Coast region
 * itself, matching Home's "North Coast" hero. A map default, not fabricated
 * content: it positions the camera, it doesn't claim a venue exists there. */
export const DEFAULT_CENTER: [number, number] = [28.7, 31.05];
export const DEFAULT_ZOOM = 10;

/** Screen-space chrome reserved over the map: the top search+filter overlay
 * (measured ~140px) and the right-edge FAB column (locate/layers, 48px each
 * + `right-4` = ~72px), plus a small margin on the other two edges so
 * markers/clusters never render flush against the viewport. Set once as the
 * map's native `padding` — every camera method (`flyTo`, `easeTo`,
 * `jumpTo`) falls back to this automatically when it doesn't specify its
 * own, so cluster-expansion and "locate me" both frame their target inside
 * the safe area without each call needing to know about it. Also used to
 * inset the viewport box `MapView` queries for visible markers, so a pin
 * is never *built* already clipped by an edge or the FAB column. */
export const MAP_SAFE_PADDING = { top: 140, right: 72, bottom: 24, left: 24 };

/** The filter row now lives in the canonical taxonomy — see
 * `@/lib/domain/categories`. Re-exported here so existing Map/Search
 * imports don't need to change paths. */
export { CATEGORY_FILTERS } from "@/lib/domain/categories";
