"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { VenueCategory } from "@/lib/domain/categories";
import type { Venue } from "@/lib/domain/venue";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_BEARING,
  MAP_PITCH,
  MAP_SAFE_PADDING,
  MAPBOX_TOKEN,
  NORTH_COAST_BOUNDS,
} from "@/lib/map/config";
import { placeDestinationLabels } from "@/lib/map/placeDestinationLabels";
import { applySahelSpotBasemap } from "@/lib/map/sahelspotBasemap";
import { spreadOverlappingVenues } from "@/lib/map/spreadMarkers";
import {
  createDestinationLabelElement,
  measureDestinationLabelWidth,
} from "./createDestinationLabelElement";
import { createMarkerElement, createUserLocationElement } from "./createMarkerElement";
import { createPreviewChipElement } from "./createPreviewChipElement";

export type MapViewHandle = {
  flyToUser: () => void;
  toggleStyle: () => void;
  /** Used by the Destination filter — centers the camera on a computed
   * destination centroid at a close-enough zoom to see its venues spread
   * out, without needing its own dedicated method per caller. */
  flyTo: (center: [number, number], zoom: number) => void;
};

/** Tagged venues first, then featured, then everything else — z-index
 * only, never a filter: nothing is hidden, a more relevant venue simply
 * doesn't end up visually buried under a plain one when markers sit close
 * together (see `spreadOverlappingVenues` for the separate, position-level
 * fix for the same "markers on top of each other" problem). */
function markerPriority(venue: Venue): number {
  if (venue.tags.length > 0) return 3;
  if (venue.isFeatured) return 2;
  return 1;
}

/** A destination's real display coordinate — the centroid of its own
 * mappable venues, computed by `MapClient` (the same technique its own
 * `changeDestination` already uses to fly the camera to a destination).
 * Not a new geometry source: no destination-level coordinate exists in
 * the API today, so this is derived from real venue coordinates rather
 * than inventing one. */
export type DestinationMarker = { id: string; name: string; lat: number; lng: number };

type MapViewProps = {
  venues: Venue[];
  /** Only used to re-trigger a marker render pass (see the `activeVenueId`/
   * `activeCategory` effect below) — markers are always Brand Navy per the
   * frozen Mobile 2027 Design System's data-marker rule, never colored by
   * category. */
  activeCategory: VenueCategory | "all";
  /** Opens Venue Details for this venue directly — the map's marker/pin
   * flow always resolves to a venue, never a destination. */
  onSelectVenue: (venueId: string) => void;
  /** Low-Angle Oblique North Coast View — real destinations, shown as
   * text-only labels with a leader arrow only while the map is pressed
   * and held (see the long-press handling below). Never rendered as a
   * permanent pin. */
  destinations: DestinationMarker[];
};

const STYLES = ["mapbox://styles/mapbox/streets-v12", "mapbox://styles/mapbox/satellite-streets-v12"];

/** Mapbox Label Language & Hierarchy — both Streets v12 and Satellite
 * Streets v12 already give every label layer's `text-field` as
 * `["coalesce", ["get", "name_en"], ["get", "name"]]` (confirmed by
 * fetching the real styles from the Mapbox Styles API, not assumed) —
 * Mapbox's own English-preferring pattern. The bilingual appearance this
 * task is fixing isn't two lines from one layer; it's this `coalesce`
 * falling back to the local `name` property (Arabic, for this region's
 * OSM data) whenever a feature has no `name_en`.
 *
 * `stripLocalNameFallback` walks that expression tree and drops the
 * `["get", "name"]` fallback, leaving `["get", "name_en"]` alone — when
 * `name_en` is absent Mapbox then renders empty text (nothing), which is
 * exactly "hide rather than fall back to Arabic," never a translation
 * this app invents. Generic over the expression shape, not a hardcoded
 * per-layer or per-place list — the same function handles `road-label`,
 * `poi-label`, `settlement-major-label`, and every other layer sharing
 * this pattern, including ones nested inside a `step`/`match` (e.g.
 * `transit-label`, `airport-label`). */
function stripLocalNameFallback(expression: unknown): unknown {
  if (Array.isArray(expression)) {
    if (
      expression.length === 3 &&
      expression[0] === "coalesce" &&
      Array.isArray(expression[1]) &&
      expression[1][0] === "get" &&
      expression[1][1] === "name_en" &&
      Array.isArray(expression[2]) &&
      expression[2][0] === "get" &&
      expression[2][1] === "name"
    ) {
      return expression[1];
    }
    return expression.map(stripLocalNameFallback);
  }
  return expression;
}

/** Scales every numeric *output* in a `text-size` expression by `factor`,
 * preserving the expression's own structure exactly — required because
 * Mapbox GL rejects a zoom-dependent expression (`["interpolate", ...,
 * ["zoom"], ...]`) nested inside another expression like `["*", ...]`:
 * confirmed live (`layers.settlement-major-label.layout.text-size:
 * "zoom" expression may only be used as the root...`), not assumed.
 * `interpolate`/`step`/`match` are the three expression types Mapbox's
 * own style spec allows to carry a zoom or data-driven stop list; this
 * recurses through exactly those three, multiplying only their *value*
 * slots (never a stop position, zoom level, or symbolrank threshold —
 * scaling one of those would change *which* stop applies, not how big
 * the text is). Anything else (`["get", "symbolrank"]`, `["zoom"]`,
 * `["cubic-bezier", ...]`, or a plain number) is a leaf: numbers scale,
 * everything else is returned untouched rather than guessed at. */
function scaleTextSize(expression: unknown, factor: number): unknown {
  if (typeof expression === "number") return expression * factor;
  if (!Array.isArray(expression)) return expression;

  const [operator] = expression;
  if (operator === "interpolate") {
    const [, interpolation, input, ...pairs] = expression;
    const scaled: unknown[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      scaled.push(pairs[i], scaleTextSize(pairs[i + 1], factor));
    }
    return ["interpolate", interpolation, input, ...scaled];
  }
  if (operator === "step") {
    const [, input, defaultOutput, ...pairs] = expression;
    const scaled: unknown[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      scaled.push(pairs[i], scaleTextSize(pairs[i + 1], factor));
    }
    return ["step", input, scaleTextSize(defaultOutput, factor), ...scaled];
  }
  if (operator === "match") {
    const [, input, ...rest] = expression;
    const fallback = rest[rest.length - 1];
    const casesAndOutputs = rest.slice(0, -1);
    const scaled: unknown[] = [];
    for (let i = 0; i < casesAndOutputs.length; i += 2) {
      scaled.push(casesAndOutputs[i], scaleTextSize(casesAndOutputs[i + 1], factor));
    }
    return ["match", input, ...scaled, scaleTextSize(fallback, factor)];
  }
  return expression;
}

/** Applied on every `style.load` (initial load *and* every `setStyle`
 * call — `toggleStyle` below — so both Streets and Satellite Streets get
 * the same treatment without duplicated logic).
 *
 * Only `settlement-major-label` gets the size bump — Mapbox's own "major
 * settlement" tier, the real North Coast localities (Sidi Abdel Rahman,
 * El Alamein, Marina, ...) this task calls "major area/destination"
 * labels. `settlement-minor-label` (smaller towns) and
 * `settlement-subdivision-label` (neighborhoods) are deliberately left
 * alone per the task's own "do not enlarge minor locality labels."
 * `scaleTextSize` (above) rewrites the layer's *existing* `text-size`
 * expression in place, multiplying every stop's output by 1.18 while
 * keeping Mapbox's whole zoom/symbolrank interpolation curve exactly as
 * shipped — no hand-reconstruction of the curve itself, so it can't
 * drift from whatever Mapbox ships next. Font, color, halo, weight:
 * untouched. */
function applyLabelPreferences(map: mapboxgl.Map) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    const textField = map.getLayoutProperty(layer.id, "text-field");
    if (textField === undefined) continue;
    const next = stripLocalNameFallback(textField);
    if (JSON.stringify(next) !== JSON.stringify(textField)) {
      // The expression tree is walked generically (see
      // `stripLocalNameFallback`'s own docstring) — its shape isn't
      // known statically, so `setLayoutProperty`'s overloaded, per-
      // property-name expression type can't be narrowed here any more
      // precisely than `mapbox-gl` itself narrows it from a runtime
      // `getLayoutProperty` read.
      map.setLayoutProperty(layer.id, "text-field", next as never);
    }
  }

  if (map.getLayer("settlement-major-label")) {
    const currentSize = map.getLayoutProperty("settlement-major-label", "text-size");
    if (currentSize !== undefined) {
      map.setLayoutProperty(
        "settlement-major-label",
        "text-size",
        scaleTextSize(currentSize, 1.18) as never,
      );
    }
  }
}

/** Far-Field Atmospheric Fade — real Mapbox fog (`map.setFog`), not a CSS
 * overlay, gradient, or mask. Applied on every `style.load` alongside
 * `applyLabelPreferences` so it survives the Layers FAB's `setStyle` call,
 * which discards fog exactly like it discards custom sources/layers.
 *
 * Purpose is territorial, not decorative: at `MAP_PITCH = 68` the horizon
 * inherently renders geography far beyond SahelSpot's corridor — Marsa
 * Matruh, and past it Sidi Barrani and the Libyan coast — none of which
 * the product covers. Fog is the Mapbox-native way to say "our map ends
 * around Ras El Hekma" using real distance from the camera, rather than
 * suppressing specific place labels by name (which would be a hardcoded
 * lie about the basemap, and would silently rot as Mapbox's own data
 * changes).
 *
 * `range` is in units of distance from the camera, where the second value
 * is where fog reaches full opacity. `[2.4, 7]` was tuned against the real
 * render at the approved camera, not taken from Mapbox's defaults: it
 * keeps the entire corridor — Marina at ~80% of the viewport height up
 * through Dabaa and Ras El Hekma near the top — completely clear, and only
 * starts biting well past the corridor's northwestern end. `color` is
 * sampled to sit between the basemap's sand and the sea/sky blues so the
 * fade reads as atmospheric haze rather than a white wash, and
 * `horizon-blend` is kept low so the sky itself isn't flooded. */
function applyFarFieldFog(map: mapboxgl.Map) {
  map.setFog({
    range: [2.4, 7],
    color: "#cfdcea",
    "horizon-blend": 0.06,
    "high-color": "#b9d2ea",
    "space-color": "#cfe0f0",
    "star-intensity": 0,
  });
}

/** Label layers constrained to SahelSpot's territory below — the tiers
 * that name a *place*, which is what read as "this map extends past where
 * the product goes". `airport-label` is in the list because Marsa Matruh's
 * airport ("MUH") survived the settlement filter on its own layer.
 *
 * Deliberately minimal: road shields, POIs, transit, and water/landform
 * labels are left alone. Those genuinely aid orientation, the road shields
 * along the Coastal Road are part of the approved composition, and none of
 * them were the problem. */
const TERRITORY_CONSTRAINED_LABEL_LAYERS = [
  "settlement-major-label",
  "settlement-minor-label",
  "settlement-subdivision-label",
  "airport-label",
];

/** Territory polygon for the `within` filter below — the same
 * `NORTH_COAST_BOUNDS` box the camera is already clamped to, expressed as
 * GeoJSON. Deriving it from that one constant (rather than a second
 * hand-written box) is what keeps "where the camera may go" and "which
 * place names belong to us" from drifting apart. */
const TERRITORY_POLYGON: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [NORTH_COAST_BOUNDS[0][0], NORTH_COAST_BOUNDS[0][1]],
        [NORTH_COAST_BOUNDS[1][0], NORTH_COAST_BOUNDS[0][1]],
        [NORTH_COAST_BOUNDS[1][0], NORTH_COAST_BOUNDS[1][1]],
        [NORTH_COAST_BOUNDS[0][0], NORTH_COAST_BOUNDS[1][1]],
        [NORTH_COAST_BOUNDS[0][0], NORTH_COAST_BOUNDS[0][1]],
      ],
    ],
  },
};

/** Far-Field Atmospheric Fade, part two — the fog above fades the *ground*
 * beyond the corridor, but Mapbox renders symbol labels in screen space
 * and does not apply fog to them, so "Marsa Matruh" stayed fully crisp
 * inside an otherwise hazed horizon (confirmed by rendering it, not
 * assumed). This constrains the settlement-label tiers to SahelSpot's own
 * territory so place names stop where the product does.
 *
 * Geographic, never name-based: the filter is Mapbox's own `within`
 * expression evaluated against `TERRITORY_POLYGON`, so it suppresses
 * *whatever* happens to lie outside the corridor. Hardcoding
 * `!= "Marsa Matruh"` would have been shorter and wrong — it would leave
 * Sidi Barrani, Tobruk and every future far-field label to be discovered
 * one at a time.
 *
 * Runtime-only, on this map instance: `setFilter` mutates the loaded style
 * in memory and never touches the Mapbox-hosted style, so nothing here is
 * visible to any other map or product surface. Existing layer filters are
 * preserved by `all`-combining rather than replaced. */
function constrainLabelsToTerritory(map: mapboxgl.Map) {
  for (const layerId of TERRITORY_CONSTRAINED_LABEL_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    const existing = map.getFilter(layerId);
    const territoryFilter = ["within", TERRITORY_POLYGON];
    map.setFilter(
      layerId,
      (existing ? ["all", existing, territoryFilter] : territoryFilter) as never,
    );
  }
}

const SOURCE_ID = "venues";
// Invisible GL layer purely so `queryRenderedFeatures` has something to
// query — every visible pixel is still a DOM marker, never this layer's
// own render output. Predates cluster removal (Individual Map Markers
// task) but the name no longer implies clustering, since the source
// below isn't clustered anymore.
const VENUE_QUERY_LAYER = "venues-query-layer";
/** Screen-space footprint of the preview marker, in pixels — a fixed
 * estimate is enough to keep it fully inside the safe area without
 * measuring the real DOM element. It's anchored by its bottom edge (see the
 * marker creation below), so it extends almost entirely *above* the
 * coordinate, not symmetrically around it — `PIN_HEIGHT_ABOVE` and
 * `PIN_HEIGHT_BELOW` reflect that; only the width (`PIN_WIDTH_HALF`) is
 * still symmetric left/right. Matches `createPreviewChipElement`'s own
 * `PIN_WIDTH`/`PIN_HEIGHT` (130 × 168). */
const PIN_WIDTH_HALF = 69;
const PIN_HEIGHT_ABOVE = 174;
const PIN_HEIGHT_BELOW = 4;
const CHIP_NUDGE_DURATION_MS = 200;
/** Correction passes `ensureActiveVenueVisible` may take before giving up.
 * Three is empirically more than enough — the residual error falls off
 * sharply per pass at `MAP_PITCH = 68` — and the hard cap is what
 * guarantees the loop terminates regardless of camera state. */
const MAX_CHIP_NUDGE_PASSES = 3;

/** Low-Angle Oblique North Coast View — long-press threshold for revealing
 * destination labels, matching the approved concept's "approximately
 * 300ms" spec exactly. `LONG_PRESS_MOVE_CANCEL_PX` is the drag-vs-hold
 * disambiguation: a normal pan starts with real pointer movement almost
 * immediately, so any movement past this many CSS pixels before the timer
 * fires cancels the long-press rather than fighting the user's drag. */
const LONG_PRESS_MS = 300;
const LONG_PRESS_MOVE_CANCEL_PX = 8;

type VenueFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }>;

/** Feeds the query-only GeoJSON source the *spread* positions
 * (`spreadOverlappingVenues`), not raw `venue.coordinates` — so two venues
 * geocoded a few meters apart render as visually distinguishable markers
 * instead of stacking exactly on top of one another. `venuesByIdRef` (real
 * domain objects, real coordinates) is what every other consumer of a
 * venue's location reads; this collection only ever drives what's drawn. */
function toFeatureCollection(venues: Venue[]): VenueFeatureCollection {
  return {
    type: "FeatureCollection",
    features: spreadOverlappingVenues(venues).map(({ venue, lng, lat }) => ({
      type: "Feature",
      properties: { id: venue.id },
      geometry: { type: "Point", coordinates: [lng, lat] },
    })),
  };
}

/** Style Toggle Custom Layer Regression fix — `map.setStyle()` (the
 * Layers FAB's `toggleStyle`) discards every custom source/layer along
 * with the old style; Mapbox does not recreate them. This is the one
 * place that (re)installs `SOURCE_ID`/`VENUE_QUERY_LAYER`, called both
 * on the map's initial `"load"` and on every subsequent `"style.load"`
 * (which also fires after `setStyle`) — see the two call sites below.
 *
 * Idempotent by construction (`getSource`/`getLayer` existence checks),
 * so calling it twice back-to-back (initial `"style.load"` then `"load"`
 * firing moments later, both on first mount) never double-adds anything
 * — the second call is a no-op, not a duplicate. Unclustered on purpose
 * (Individual Map Markers task) — every visible venue gets its own DOM
 * marker now; `spreadOverlappingVenues` (in `toFeatureCollection`) is
 * what keeps near-identical coordinates visually distinguishable instead
 * of grouping them into a cluster bubble. */
function installCustomMapLayers(map: mapboxgl.Map, venues: Venue[]) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: toFeatureCollection(venues) satisfies VenueFeatureCollection,
    });
  }
  // Invisible on purpose — see the component docstring. This is the only
  // GL layer venue rendering needs; every visible marker is DOM.
  if (!map.getLayer(VENUE_QUERY_LAYER)) {
    map.addLayer({
      id: VENUE_QUERY_LAYER,
      type: "circle",
      source: SOURCE_ID,
      paint: { "circle-radius": 1, "circle-opacity": 0 },
    });
  }
}

/** The only place `mapbox-gl` is imported in the app — isolated per
 * docs/consumer/ARCHITECTURE.md §5, loaded via `next/dynamic` with
 * `ssr: false` at the call site so the GL bundle never enters any other
 * route's payload.
 *
 * Individual Map Markers task — clustering was removed: the Map is now
 * intent-driven (no venues visible without a Destination/Category/filter
 * selection), so the dense "many venues at once" case clustering existed
 * for no longer applies. The GeoJSON source is unclustered; its only GL
 * layer is a single invisible circle layer (`circle-opacity: 0`) that
 * exists purely so Mapbox tiles/renders the source and
 * `queryRenderedFeatures` has something to query. Every pixel the user
 * sees — pins, the preview chip — is a plain DOM element, the same
 * approach `createMarkerElement` has always used. */
export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { venues, activeCategory, onSelectVenue, destinations },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const styleIndexRef = useRef(0);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const venuesByIdRef = useRef<Map<string, Venue>>(new Map());
  const [activeVenueId, setActiveVenueId] = useState<string | null>(null);
  const activeVenueIdRef = useRef<string | null>(null);
  const destinationsRef = useRef<DestinationMarker[]>(destinations);
  const destinationLabelMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    flyToUser() {
      if (!mapRef.current || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        if (!userMarkerRef.current) {
          userMarkerRef.current = new mapboxgl.Marker({ element: createUserLocationElement() })
            .setLngLat([longitude, latitude])
            .addTo(mapRef.current as mapboxgl.Map);
        } else {
          userMarkerRef.current.setLngLat([longitude, latitude]);
        }
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 14, pitch: MAP_PITCH, bearing: MAP_BEARING });
      });
    },
    toggleStyle() {
      if (!mapRef.current) return;
      styleIndexRef.current = (styleIndexRef.current + 1) % STYLES.length;
      mapRef.current.setStyle(STYLES[styleIndexRef.current]);
    },
    // Single centralized entry point for every external `flyTo` caller
    // (currently only `MapClient.changeDestination`) — callers pass just
    // `center`/`zoom`, same as before; `pitch`/`bearing` are injected here
    // once so the Angled Map View prototype's tilt is preserved on every
    // camera move without each call site needing to know about it.
    flyTo(center, zoom) {
      mapRef.current?.flyTo({ center, zoom, pitch: MAP_PITCH, bearing: MAP_BEARING });
    },
  }));

  useEffect(() => {
    activeVenueIdRef.current = activeVenueId;
  }, [activeVenueId]);

  useEffect(() => {
    venuesByIdRef.current = new Map(venues.map((venue) => [venue.id, venue]));
  }, [venues]);

  const venuesRef = useRef<Venue[]>(venues);
  useEffect(() => {
    venuesRef.current = venues;
  }, [venues]);

  useEffect(() => {
    destinationsRef.current = destinations;
  }, [destinations]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES[0],
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: MAP_PITCH,
      bearing: MAP_BEARING,
      // North Coast Bounds — native Mapbox camera constraint, not custom
      // drag-blocking: Mapbox itself resists/stops the camera at this
      // box for every interaction (drag, scroll-zoom, `flyTo`, `easeTo`)
      // without this app touching any pointer/touch event. See
      // `NORTH_COAST_BOUNDS`'s own doc comment for how it was derived.
      maxBounds: NORTH_COAST_BOUNDS,
      attributionControl: false,
    });
    mapRef.current = map;
    // Reserves the top search/filter overlay and the right FAB column —
    // every camera method (`flyTo`/`easeTo`/`jumpTo`) falls back to this
    // padding when a call doesn't specify its own, so "locate me" and
    // every other camera move frame their target inside the safe area
    // without those call sites needing to know about it.
    map.setPadding(MAP_SAFE_PADDING);

    // Mapbox Label Language & Hierarchy — fires on the initial style load
    // *and* every subsequent `setStyle` (see `toggleStyle` below), so
    // both Streets and Satellite Streets get the English-only labels and
    // major-label size bump without this effect needing to know which
    // style is active.
    map.on("style.load", () => {
      applyLabelPreferences(map);
      applyFarFieldFog(map);
      constrainLabelsToTerritory(map);
      // SahelSpot Vector Basemap — recolors Mapbox's own Streets layers
      // (see `lib/map/sahelspotBasemap.ts`). Applied here, inside
      // `style.load`, for the same reason everything else in this handler
      // is: `setStyle` discards runtime style mutations, so the Layers FAB
      // would otherwise drop the treatment the first time it round-trips
      // through Satellite and back.
      //
      // Streets only. Satellite Streets is raster imagery — repainting
      // land/water fills there would either no-op or fight the photograph,
      // so it is deliberately left exactly as it renders today.
      // `styleIndexRef` is already updated by `toggleStyle` before its
      // `setStyle` call, so it reliably describes the style being loaded.
      if (styleIndexRef.current === 0) applySahelSpotBasemap(map);
    });

    // The preview chip is much wider (~220px) than an ordinary pin (32px),
    // so a venue whose anchor comfortably clears the plain-marker safe
    // margin above can still produce a chip that overflows an edge or the
    // FAB column. Rather than widening the general inset (which would also
    // start hiding ordinary, compact markers unnecessarily), the camera is
    // nudged by the minimal amount needed — only when a venue actually
    // becomes the active chip — so the chip lands fully inside the safe
    // area without moving anything for the common case.
    function ensureActiveVenueVisible(lngLat: [number, number]) {
      const { width, height } = map.getContainer().getBoundingClientRect();
      const minX = MAP_SAFE_PADDING.left + PIN_WIDTH_HALF;
      const maxX = width - MAP_SAFE_PADDING.right - PIN_WIDTH_HALF;
      const minY = MAP_SAFE_PADDING.top + PIN_HEIGHT_ABOVE;
      const maxY = height - MAP_SAFE_PADDING.bottom - PIN_HEIGHT_BELOW;

      /** How far, in screen pixels, the chip's anchor currently sits
       * outside the safe box. Zero on both axes means fully inside. */
      function overflowAt(point: mapboxgl.Point) {
        let dx = 0;
        let dy = 0;
        if (point.x < minX) dx = point.x - minX;
        else if (point.x > maxX) dx = point.x - maxX;
        if (point.y < minY) dy = point.y - minY;
        else if (point.y > maxY) dy = point.y - maxY;
        return { dx, dy };
      }

      const startCenter = map.getCenter();
      let moved = false;

      // One shift-the-center-by-a-screen-delta step is only exact on a
      // near-flat camera. At `MAP_PITCH = 68` screen displacement is
      // strongly non-uniform across ground points, so a single pass
      // over/undershoots — measured before this fix: a venue whose pin sat
      // at x=91 produced a chip at x=299..429 in a 390px viewport.
      //
      // So each pass now measures the *actual* projection after the
      // previous one instead of trusting the first estimate, and the
      // remaining error shrinks each time. `jumpTo` is used inside the
      // loop specifically because it applies synchronously, which is what
      // makes the next `map.project` read a real post-move value rather
      // than a prediction. Bounded by `MAX_CHIP_NUDGE_PASSES`, so this can
      // never spin: it either converges or gives up with the best camera
      // it found.
      for (let pass = 0; pass < MAX_CHIP_NUDGE_PASSES; pass += 1) {
        const { dx, dy } = overflowAt(map.project(lngLat));
        if (dx === 0 && dy === 0) break;
        const centerPoint = map.project(map.getCenter());
        map.jumpTo({ center: map.unproject([centerPoint.x + dx, centerPoint.y + dy]) });
        moved = true;
      }

      if (!moved) return;

      // Nothing has painted yet — Mapbox draws on rAF and the whole loop
      // above runs inside a single task — so snapping back and easing to
      // the solved center reads as one smooth nudge, exactly the motion
      // the previous single-pass version produced.
      const solvedCenter = map.getCenter();
      map.jumpTo({ center: startCenter });
      map.easeTo({
        center: solvedCenter,
        duration: CHIP_NUDGE_DURATION_MS,
        pitch: MAP_PITCH,
        bearing: MAP_BEARING,
      });
    }

    // Low-Angle Oblique North Coast View — destination labels are built
    // fresh on every press (not toggled via CSS) and fully removed on
    // release, per the approved concept: no permanent destination pins,
    // labels visible only for the duration of the hold. Only destinations
    // whose real (venue-centroid) coordinate currently falls inside the
    // viewport are labeled — "currently relevant," not a fixed list.
    function showDestinationLabels() {
      if (destinationLabelMarkersRef.current.length > 0) return;
      const bounds = map.getBounds();
      if (!bounds) return;

      // Project each on-screen destination's *real* coordinate once, and
      // let `placeDestinationLabels` resolve text collisions purely in
      // screen space. Nothing geographic is adjusted here — every marker
      // below is still attached at `[destination.lng, destination.lat]`;
      // only the label's offset within its own (anchor-centered) element
      // varies, so the arrowhead stays on the true location.
      const anchors = destinationsRef.current
        .filter((destination) => bounds.contains([destination.lng, destination.lat]))
        .map((destination) => {
          const point = map.project([destination.lng, destination.lat]);
          return { id: destination.id, name: destination.name, x: point.x, y: point.y };
        });

      // Reuse the same safe area every camera call already respects, so a
      // label can't be pushed under the toolbar or the FAB column.
      const { width, height } = map.getContainer().getBoundingClientRect();
      const placements = placeDestinationLabels(anchors, measureDestinationLabelWidth, {
        left: MAP_SAFE_PADDING.left,
        top: MAP_SAFE_PADDING.top,
        right: width - MAP_SAFE_PADDING.right,
        bottom: height - MAP_SAFE_PADDING.bottom,
      });
      const destinationsById = new Map(destinationsRef.current.map((d) => [d.id, d]));

      for (const placement of placements) {
        const destination = destinationsById.get(placement.id);
        if (!destination) continue;
        const el = createDestinationLabelElement(placement.name, {
          dx: placement.dx,
          dy: placement.dy,
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map);
        destinationLabelMarkersRef.current.push(marker);
      }
    }

    function hideDestinationLabels() {
      for (const marker of destinationLabelMarkersRef.current) marker.remove();
      destinationLabelMarkersRef.current = [];
    }

    function clearLongPressTimer() {
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    function handlePointerDown(event: PointerEvent) {
      pressStartRef.current = { x: event.clientX, y: event.clientY };
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        showDestinationLabels();
      }, LONG_PRESS_MS);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!pressStartRef.current) return;
      const dx = event.clientX - pressStartRef.current.x;
      const dy = event.clientY - pressStartRef.current.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_CANCEL_PX) {
        // Real drag, not a hold — let Mapbox's own pan take over
        // uninterrupted and don't reveal labels for this gesture.
        clearLongPressTimer();
        pressStartRef.current = null;
      }
    }

    function handlePointerEnd() {
      pressStartRef.current = null;
      clearLongPressTimer();
      hideDestinationLabels();
    }

    const mapContainer = map.getContainer();
    // Passive, non-preventing listeners — this only ever *adds* an overlay
    // after the hold threshold; it never calls `preventDefault`/
    // `stopPropagation`, so Mapbox's native drag-pan and pinch-zoom keep
    // working exactly as before, including for a gesture that started as
    // what looked like a hold and turned into a drag.
    mapContainer.addEventListener("pointerdown", handlePointerDown, { passive: true });
    mapContainer.addEventListener("pointermove", handlePointerMove, { passive: true });
    mapContainer.addEventListener("pointerup", handlePointerEnd, { passive: true });
    mapContainer.addEventListener("pointercancel", handlePointerEnd, { passive: true });
    mapContainer.addEventListener("pointerleave", handlePointerEnd, { passive: true });

    function renderVisibleFeatures() {
      // Style Toggle Custom Layer Regression fix — between `setStyle()`
      // discarding the old style and `installCustomMapLayers` reinstalling
      // on the following `"style.load"`, a `moveend`/`zoomend` could in
      // principle fire (e.g. mid-drag when the style swap happens) and
      // reach here before the layer exists again. Mapbox itself is what
      // throws ("does not exist in the map's style") if this isn't
      // guarded — a plain no-op here is correct: the reinstall's own
      // explicit `scheduleRender()` call (below) re-runs this the moment
      // the layer is back.
      if (!map.getLayer(VENUE_QUERY_LAYER)) return;

      // CSS-pixel container size, inset by the same safe-area padding —
      // features projecting into that reserved margin simply don't get a
      // marker built this pass, rather than being built already clipped by
      // an edge or hidden behind a FAB. `canvas.width`/`height` are device
      // pixels (dpr-scaled), not CSS pixels, so the container's own rect is
      // used instead of the canvas for this.
      const { width, height } = map.getContainer().getBoundingClientRect();
      const viewport: [mapboxgl.PointLike, mapboxgl.PointLike] = [
        [MAP_SAFE_PADDING.left, MAP_SAFE_PADDING.top],
        [width - MAP_SAFE_PADDING.right, height - MAP_SAFE_PADDING.bottom],
      ];
      const rendered = map.queryRenderedFeatures(viewport, { layers: [VENUE_QUERY_LAYER] }) as
        | Array<mapboxgl.MapboxGeoJSONFeature & { properties: Record<string, unknown> }>
        | undefined;
      if (!rendered) return;

      const nextKeys = new Set<string>();

      function renderKeyFor(venueId: string) {
        return `${venueId}:${venueId === activeVenueIdRef.current ? "chip" : "pin"}`;
      }

      for (const feature of rendered) {
        const geometry = feature.geometry as GeoJSON.Point;
        const [lng, lat] = geometry.coordinates;

        const venueId = feature.properties?.id as string;
        const venue = venuesByIdRef.current.get(venueId);
        if (!venue) continue;

        // High-pitch viewport membership. `queryRenderedFeatures` is given
        // a screen-space box, but at `MAP_PITCH = 68` the frustum slice
        // that box implies covers an enormous stretch of ground, and it
        // returns far more than actually falls inside it — measured before
        // this check: 46 of 86 markers were instantiated off-screen, with
        // projected x reaching ~657 in a 390px viewport.
        //
        // Re-testing each feature against the *same* box using Mapbox's
        // own projection is what makes membership true at any pitch. This
        // only corrects which features are off-screen; the venue set,
        // filters, and data flow are untouched, and nothing that was
        // genuinely visible stops rendering.
        //
        // The active venue is exempt: it may legitimately sit just outside
        // the box at the moment it is selected, and
        // `ensureActiveVenueVisible` below is what pulls it back in.
        const isActive = venue.id === activeVenueIdRef.current;
        if (!isActive) {
          const point = map.project([lng, lat]);
          if (
            point.x < MAP_SAFE_PADDING.left ||
            point.x > width - MAP_SAFE_PADDING.right ||
            point.y < MAP_SAFE_PADDING.top ||
            point.y > height - MAP_SAFE_PADDING.bottom
          ) {
            continue;
          }
        }

        const key = `venue:${venueId}`;
        nextKeys.add(key);

        // Rebuilt (not reused) whenever this venue's active state changes —
        // the marker <-> pin morph needs a fresh element, not a mutation of
        // the old one.
        const existing = markersRef.current.get(key);
        if (existing && existing.getElement().dataset.renderKey === renderKeyFor(venue.id)) continue;
        existing?.remove();

        if (isActive) ensureActiveVenueVisible([lng, lat]);
        const el = isActive
          ? createPreviewChipElement(venue, { onOpen: () => onSelectVenue(venue.id) })
          : createMarkerElement(venue.category, { label: venue.name, zIndex: markerPriority(venue) });
        el.dataset.renderKey = renderKeyFor(venue.id);
        // Marker elements sit inside the map's own container, so a click
        // here also bubbles up to `map.on("click", ...)` below — without
        // stopping it, the background-click deselect handler fires right
        // after and undoes whatever this listener just did.
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!isActive) setActiveVenueId(venue.id);
        });
        // Both states now anchor their own bottom edge to the coordinate:
        // the active chip so it can grow upward in place (see
        // `createPreviewChipElement`), the ordinary marker because it's a
        // teardrop pin now (see `createMarkerElement`) whose coordinate is
        // its point, not its visual center — `center` (Mapbox's default)
        // was only correct for the symmetric circle this replaced.
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      }

      for (const [key, marker] of markersRef.current) {
        if (!nextKeys.has(key)) {
          marker.remove();
          markersRef.current.delete(key);
        }
      }
    }

    let renderScheduled = false;
    function scheduleRender() {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        renderVisibleFeatures();
      });
    }

    // Style Toggle Custom Layer Regression fix — `"style.load"` fires on
    // the initial style load *and* every subsequent `setStyle()`
    // (`toggleStyle`, the Layers FAB), unlike `"load"` (fires once,
    // ever). Reinstalling here — via the same idempotent
    // `installCustomMapLayers` the initial `"load"` handler below also
    // calls — is what survives a style change; `setStyle` silently drops
    // every custom source/layer and Mapbox never recreates them itself.
    // The explicit `scheduleRender()` after reinstalling is what actually
    // restores visible markers post-switch, rather than waiting
    // for an incidental `moveend`/`zoomend` that may never come if the
    // user isn't still interacting with the map. `venuesRef.current` (not
    // the `venues` prop) so a style change never regresses to stale data
    // — same reasoning `"load"`'s own seed comment already gives.
    map.on("style.load", () => {
      installCustomMapLayers(map, venuesRef.current);
      scheduleRender();
    });

    map.on("load", () => {
      // Belt-and-suspenders with the `"style.load"` handler above: on the
      // very first load both fire (order isn't guaranteed to be
      // `"style.load"` before `"load"` across all Mapbox GL versions),
      // and `installCustomMapLayers`'s own existence checks make calling
      // it twice here a no-op, not a duplicate add.
      installCustomMapLayers(map, venuesRef.current);

      // One-time registration — `"load"` only ever fires once per map
      // instance, so these listeners are never re-registered on a style
      // change (that would be the actual duplicate-handler bug this task
      // warns against). They don't need the source/layer to exist at
      // registration time, only when they eventually run, and
      // `renderVisibleFeatures`/the click handler below both guard for
      // that themselves.
      map.on("moveend", scheduleRender);
      map.on("zoomend", scheduleRender);
      map.on("sourcedata", (event) => {
        if (event.sourceId === SOURCE_ID && map.isSourceLoaded(SOURCE_ID)) scheduleRender();
      });

      map.on("click", (event) => {
        if (!map.getLayer(VENUE_QUERY_LAYER)) return;
        const hits = map.queryRenderedFeatures(event.point, { layers: [VENUE_QUERY_LAYER] });
        if (hits.length === 0) setActiveVenueId(null);
      });
    });

    const markers = markersRef.current;
    return () => {
      mapContainer.removeEventListener("pointerdown", handlePointerDown);
      mapContainer.removeEventListener("pointermove", handlePointerMove);
      mapContainer.removeEventListener("pointerup", handlePointerEnd);
      mapContainer.removeEventListener("pointercancel", handlePointerEnd);
      mapContainer.removeEventListener("pointerleave", handlePointerEnd);
      clearLongPressTimer();
      map.remove();
      mapRef.current = null;
      markers.clear();
      destinationLabelMarkersRef.current = [];
    };
    // Mounted once — venue/category/active-chip updates flow through the
    // GeoJSON source and the render pass above, not through remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource(SOURCE_ID)) return;
    (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(toFeatureCollection(venues));
  }, [venues]);

  // Re-render the current viewport's markers whenever the active chip or
  // filter color changes, without waiting for a map move.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.fire("moveend");
  }, [activeVenueId, activeCategory]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-container-low px-4 text-center">
        <p className="text-sm text-on-surface-variant">
          Map unavailable — <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> isn&apos;t configured.
        </p>
      </div>
    );
  }

  return <div className="h-full w-full" ref={containerRef} />;
});
