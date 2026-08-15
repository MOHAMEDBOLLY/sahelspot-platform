export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/** Low-Angle Oblique North Coast View — camera position tuned, by actually
 * rendering it and looking, so the real Sidi Abdel Rahman/Hacienda Bay
 * stretch (the densest real part of the Marina -> Telal destination
 * cluster) fills the frame as a readable coastal journey rather than being
 * lost in either open sea or a wall of desert. Biased slightly onto the
 * land side of the real coastline on purpose — centering exactly on the
 * coastline itself, at this pitch/bearing, put more than half the frame
 * over open Mediterranean. */
export const DEFAULT_CENTER: [number, number] = [28.84, 30.884];
export const DEFAULT_ZOOM = 10.75;

/** Low-Angle Oblique North Coast View — replaces the earlier "Angled Map
 * View" prototype's flatter tilt with a real low-angle aerial perspective,
 * applied to every camera position the map ever moves to (not just
 * initialization) via this single source of truth, so every `easeTo`/
 * `flyTo` call reads the same two values instead of each hardcoding its
 * own.
 *
 * `MAP_BEARING` is derived from real geography, not chosen for looks: it's
 * the initial great-circle bearing along the corridor the map exists to
 * show, Marina (`lat 30.8133, lng 29.0570`) -> Ras El Hekma (`lat 31.2078,
 * lng 27.8498`) — 291.2°, rounded to 291. Setting the map's `bearing` to a
 * compass direction rotates the camera so that direction points to the top
 * of the screen, so at 291° the real Marina -> El Alamein -> Sidi Abdel
 * Rahman -> Dabaa -> Ras El Hekma corridor reads bottom-to-top, with the
 * Mediterranean on the right and the desert/coastal-road side on the left.
 *
 * This replaces an earlier 300°, which was the bearing to Telal — correct
 * while Telal was the corridor's endpoint, but 8.8° off once the endpoint
 * became Ras El Hekma. Over a 123km corridor that error compounds to ~19km
 * of lateral drift, and it showed: the coastline visibly exited the left
 * edge of the frame instead of running vertically through it. The value is
 * recomputed from the endpoints, never hand-tuned to taste — change the
 * corridor's endpoints and this must be recomputed with it.
 *
 * `MAP_PITCH` is Mapbox's own camera pitch — 68°, tuned down from an
 * initial 78° after actually rendering both: at 78° the sky/haze
 * consumed roughly half the frame, well past "the actual North Coast
 * geography must remain the dominant visual." Pitch is the one camera
 * value that directly controls how much of the frame the horizon eats —
 * neither `zoom` nor `MAP_SAFE_PADDING` moves the horizon itself, only
 * which ground content surrounds it — so 68° is the real, visually-
 * verified low-angle-oblique value, not the untested 75–82° starting
 * range. */
export const MAP_PITCH = 68;
export const MAP_BEARING = 291;

/** Real coordinate of Ras El Hekma, the northwestern end of SahelSpot's
 * operating corridor. Resolved from Mapbox's own geocoder (the Arabic
 * name, "رأس الحكمة" — the Latin spellings return nothing), not estimated.
 *
 * Camera framing reference ONLY. Ras El Hekma has no destination in the
 * live dataset today (`/public/destinations` ends at Telal, lng 28.606),
 * so it deliberately gets no marker, no label, and no entry anywhere in
 * the destination list — the map merely extends far enough to show the
 * real geography it sits in. `lib/reference/northCoastReference.ts`
 * already documents ~19 real Ras El Hekma villages awaiting live data;
 * when those land they'll surface through the normal destination flow,
 * with no change needed here. */
export const RAS_EL_HEKMA: [number, number] = [27.8498, 31.2078];

/** North Coast Bounds — restricts free panning to SahelSpot's actual
 * product coverage, so the map can't be dragged into Cairo, deep desert,
 * or open Mediterranean far past the corridor.
 *
 * Derived from real data, not invented. The southeast corner still comes
 * from the live dataset's own envelope (every destination `boundary`
 * polygon plus every published venue coordinate — max lng 29.066, min lat
 * 30.813). The northwest corner is now `RAS_EL_HEKMA` above rather than
 * the westernmost live venue, because the approved corridor deliberately
 * runs past where SahelSpot currently has venues: Mapbox enforces
 * `maxBounds` as a hard camera clamp, so leaving the old envelope in
 * place would make the Ras El Hekma end of the corridor literally
 * unreachable by any camera position. Both corners keep the same ~0.15°
 * lng (~14km) / ~0.09° lat (~9km) buffer the original bounds used, so the
 * edge still reads as "a bit more North Coast," not a wall flush against
 * the outermost point. */
export const NORTH_COAST_BOUNDS: [[number, number], [number, number]] = [
  [RAS_EL_HEKMA[0] - 0.15, 30.723],
  [29.216, RAS_EL_HEKMA[1] + 0.09],
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
 * `top` (~110px) matches the Unified Search & Filter Toolbar's real
 * measured height (Search + chip row, ~72px, plus the container's own
 * `p-4` inset) — the popovers it opens (Destination/Category/Filter) are
 * floating `ToolbarPopover` panels layered over the map, not stacked
 * overlay rows that push this padding taller, so reserving for a tall
 * multi-row stack here was stale and (at the high pitch/zoom the
 * Low-Angle Oblique North Coast View camera now uses) was forcing the
 * camera's effective center far down-screen, leaving the map mostly sky.
 * Still generous enough that a marker/label never renders flush under the
 * toolbar. */
export const MAP_SAFE_PADDING = { top: 110, right: 72, bottom: 24, left: 24 };

/** The filter row now lives in the canonical taxonomy — see
 * `@/lib/domain/categories`. Re-exported here so existing Map/Search
 * imports don't need to change paths. */
export { CATEGORY_FILTERS } from "@/lib/domain/categories";
