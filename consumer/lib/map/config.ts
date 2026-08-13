export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/** Fallback camera position when no venue has real coordinates yet (an empty
 * publish snapshot, or every venue missing lat/lng) — the North Coast region
 * itself, matching Home's "North Coast" hero. A map default, not fabricated
 * content: it positions the camera, it doesn't claim a venue exists there. */
export const DEFAULT_CENTER: [number, number] = [28.7, 31.05];
export const DEFAULT_ZOOM = 10;

/** Angled Map View prototype — a subtle, premium tilt applied to every
 * camera position the map ever moves to, not just initialization. Kept
 * here as the single source of truth so `MapView`'s camera calls
 * (`easeTo`/`flyTo`) all read the same two values instead of each
 * hardcoding its own. `bearing: 0` keeps North-up orientation unchanged —
 * only `pitch` introduces the angle. */
export const MAP_PITCH = 42;
export const MAP_BEARING = 0;

/** North Coast Bounds — restricts free panning to SahelSpot's actual
 * product coverage, so the map can't be dragged into Cairo, deep desert,
 * or open Mediterranean far past the last destination.
 *
 * Derived from real data, not invented: the envelope of every current
 * destination's `boundary` polygon (`/public/destinations`) plus every
 * published venue's coordinates (`/public/venues`), read live —
 * min/max lng [28.599, 29.066], min/max lat [30.813, 31.019] — then
 * padded with a ~0.15° lng (~14km) / ~0.09° lat (~9km) buffer so the
 * boundary reads as "a bit more North Coast around the destinations,"
 * not a wall built flush against the outermost venue. The buffer is
 * intentionally asymmetric-feeling in practice (more room north, over
 * the Mediterranean, than the tight destination cluster needs) because
 * `MAP_PITCH = 42`'s forward tilt reveals more of what's "ahead" — north,
 * with `MAP_BEARING = 0` — than a flat top-down camera would at the same
 * position, so the same absolute buffer reads as smaller there. */
export const NORTH_COAST_BOUNDS: [[number, number], [number, number]] = [
  [28.449, 30.723],
  [29.216, 31.109],
];

/** Screen-space chrome reserved over the map: the top search+filter overlay
 * and the right-edge FAB column (locate/layers, 48px each + `right-4` =
 * ~72px), plus a small margin on the other two edges so markers/clusters
 * never render flush against the viewport. Set once as the map's native
 * `padding` — every camera method (`flyTo`, `easeTo`, `jumpTo`) falls back
 * to this automatically when it doesn't specify its own, so cluster-
 * expansion and "locate me" both frame their target inside the safe area
 * without each call needing to know about it. Also used to inset the
 * viewport box `MapView` queries for visible markers, so a pin is never
 * *built* already clipped by an edge or the filter overlay.
 *
 * `top` (~360px) is sized for the overlay's *tallest* combination —
 * SearchField + Destination + Category + Tags + Access Type + Reservation
 * Policy (Category/Tags/Access Type/Badges/Collections architecture,
 * Phase 3) — not just whichever rows happen to be visible for the current
 * filter selection. Reserving for the max means markers are never hidden
 * under the overlay when a row appears, at the cost of some unused margin
 * when fewer rows are showing — the safer direction for a value that
 * can't react to the overlay's actual measured height. */
export const MAP_SAFE_PADDING = { top: 360, right: 72, bottom: 24, left: 24 };

/** The filter row now lives in the canonical taxonomy — see
 * `@/lib/domain/categories`. Re-exported here so existing Map/Search
 * imports don't need to change paths. */
export { CATEGORY_FILTERS } from "@/lib/domain/categories";
