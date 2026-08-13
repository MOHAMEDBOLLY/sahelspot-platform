"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CATEGORY_BY_VALUE, type VenueCategory } from "@/lib/domain/categories";
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
import { spreadOverlappingVenues } from "@/lib/map/spreadMarkers";
import { createClusterElement } from "./createClusterElement";
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

type MapViewProps = {
  venues: Venue[];
  /** Drives which venues are visible/clustered — no longer drives cluster
   * color, which is always Brand Navy per the frozen Mobile 2027 Design
   * System's data-marker rule. */
  activeCategory: VenueCategory | "all";
  /** Opens Venue Details for this venue directly — the map's marker/pin
   * flow always resolves to a venue, never a destination. */
  onSelectVenue: (venueId: string) => void;
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

const SOURCE_ID = "venues-cluster";
const CLUSTER_QUERY_LAYER = "venues-cluster-query-layer";
// Reduced from the original 50/14: clustering was persisting well past the
// zoom level anyone actually browses at, so nearby venues almost always
// rendered as one crowded bubble instead of individually tappable pins.
// Clusters should read as "zoomed far out, region view" only — a smaller
// radius means less eager grouping at any given zoom, and a lower max zoom
// means clusters dissolve into real markers as soon as the user zooms in
// past the initial region-level view, not deep into street level.
const CLUSTER_RADIUS = 30;
const CLUSTER_MAX_ZOOM = 11;
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

type VenueFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }>;

/** Feeds Mapbox's clustering engine the *spread* positions
 * (`spreadOverlappingVenues`), not raw `venue.coordinates` — clustering and
 * marker placement both need to agree on where a venue visually sits, or
 * a venue could cluster with neighbors its own marker doesn't appear next
 * to. `venuesByIdRef` (real domain objects, real coordinates) is what
 * every other consumer of a venue's location reads; this collection only
 * ever drives what's drawn. */
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
 * place that (re)installs `SOURCE_ID`/`CLUSTER_QUERY_LAYER`, called both
 * on the map's initial `"load"` and on every subsequent `"style.load"`
 * (which also fires after `setStyle`) — see the two call sites below.
 *
 * Idempotent by construction (`getSource`/`getLayer` existence checks),
 * so calling it twice back-to-back (initial `"style.load"` then `"load"`
 * firing moments later, both on first mount) never double-adds anything
 * — the second call is a no-op, not a duplicate. Configuration
 * (`cluster`/`clusterRadius`/`clusterMaxZoom`, the invisible query
 * layer's paint) is copied verbatim from the original one-time setup;
 * nothing about the clustering behavior itself changed. */
function installCustomMapLayers(map: mapboxgl.Map, venues: Venue[]) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: toFeatureCollection(venues) satisfies VenueFeatureCollection,
      cluster: true,
      clusterRadius: CLUSTER_RADIUS,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
    });
  }
  // Invisible on purpose — see the component docstring. This is the only
  // GL layer clustering needs; every visible marker/cluster is DOM.
  if (!map.getLayer(CLUSTER_QUERY_LAYER)) {
    map.addLayer({
      id: CLUSTER_QUERY_LAYER,
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
 * Clustering reuses Mapbox GL's native clustering engine (a clustered
 * GeoJSON source + `getClusterExpansionZoom`) — the same primitive
 * `datalab-next`'s Studio map is built on — but never its GL circle-layer
 * *rendering*. The source's only GL layer here is a single invisible circle
 * layer (`circle-opacity: 0`) that exists purely so Mapbox tiles/renders the
 * source and `queryRenderedFeatures` has something to query; every pixel the
 * user sees — pins, clusters, the preview chip — is a plain DOM element, the
 * same approach `createMarkerElement` already used before clustering existed. */
export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { venues, activeCategory, onSelectVenue },
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
    // padding when a call doesn't specify its own, so cluster expansion
    // and "locate me" both frame their target inside the safe area
    // without those call sites needing to know about it.
    map.setPadding(MAP_SAFE_PADDING);

    // Mapbox Label Language & Hierarchy — fires on the initial style load
    // *and* every subsequent `setStyle` (see `toggleStyle` below), so
    // both Streets and Satellite Streets get the English-only labels and
    // major-label size bump without this effect needing to know which
    // style is active.
    map.on("style.load", () => applyLabelPreferences(map));

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
      const point = map.project(lngLat);
      const minX = MAP_SAFE_PADDING.left + PIN_WIDTH_HALF;
      const maxX = width - MAP_SAFE_PADDING.right - PIN_WIDTH_HALF;
      const minY = MAP_SAFE_PADDING.top + PIN_HEIGHT_ABOVE;
      const maxY = height - MAP_SAFE_PADDING.bottom - PIN_HEIGHT_BELOW;
      let dx = 0;
      let dy = 0;
      if (point.x < minX) dx = point.x - minX;
      else if (point.x > maxX) dx = point.x - maxX;
      if (point.y < minY) dy = point.y - minY;
      else if (point.y > maxY) dy = point.y - maxY;
      if (dx === 0 && dy === 0) return;
      const centerPoint = map.project(map.getCenter());
      const newCenter = map.unproject([centerPoint.x + dx, centerPoint.y + dy]);
      map.easeTo({ center: newCenter, duration: CHIP_NUDGE_DURATION_MS, pitch: MAP_PITCH, bearing: MAP_BEARING });
    }

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
      if (!map.getLayer(CLUSTER_QUERY_LAYER)) return;

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
      const rendered = map.queryRenderedFeatures(viewport, { layers: [CLUSTER_QUERY_LAYER] }) as
        | Array<mapboxgl.MapboxGeoJSONFeature & { properties: Record<string, unknown> }>
        | undefined;
      if (!rendered) return;

      const nextKeys = new Set<string>();

      // Dedupe: `queryRenderedFeatures` can return the same feature more
      // than once across tile boundaries.
      const seenClusters = new Set<number>();

      function renderKeyFor(venueId: string) {
        return `${venueId}:${venueId === activeVenueIdRef.current ? "chip" : "pin"}`;
      }

      for (const feature of rendered) {
        const geometry = feature.geometry as GeoJSON.Point;
        const [lng, lat] = geometry.coordinates;
        const isCluster = Boolean(feature.properties?.cluster);

        if (isCluster) {
          const clusterId = feature.properties?.cluster_id as number;
          if (seenClusters.has(clusterId)) continue;
          seenClusters.add(clusterId);

          const key = `cluster:${clusterId}`;
          nextKeys.add(key);
          if (!markersRef.current.has(key)) {
            const count = feature.properties?.point_count as number;
            const el = createClusterElement(count, CATEGORY_BY_VALUE.general.color);
            el.addEventListener("click", (event) => {
              // Marker elements sit inside the map's own container, so a
              // click here also bubbles up to `map.on("click", ...)` below
              // — without stopping it, the background-click deselect
              // handler fires right after and undoes whatever this
              // listener just did.
              event.stopPropagation();
              const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
              source.getClusterExpansionZoom(clusterId, (error, zoom) => {
                if (error || zoom == null) return;
                map.easeTo({ center: [lng, lat], zoom, pitch: MAP_PITCH, bearing: MAP_BEARING });
              });
            });
            const marker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
            markersRef.current.set(key, marker);
          }
          continue;
        }

        const venueId = feature.properties?.id as string;
        const venue = venuesByIdRef.current.get(venueId);
        if (!venue) continue;

        const key = `venue:${venueId}`;
        nextKeys.add(key);

        // Rebuilt (not reused) whenever this venue's active state changes —
        // the marker <-> pin morph needs a fresh element, not a mutation of
        // the old one.
        const existing = markersRef.current.get(key);
        if (existing && existing.getElement().dataset.renderKey === renderKeyFor(venue.id)) continue;
        existing?.remove();

        const isActive = venue.id === activeVenueIdRef.current;
        if (isActive) ensureActiveVenueVisible([lng, lat]);
        const el = isActive
          ? createPreviewChipElement(venue, { onOpen: () => onSelectVenue(venue.id) })
          : createMarkerElement(venue.category, { label: venue.name, zIndex: markerPriority(venue) });
        el.dataset.renderKey = renderKeyFor(venue.id);
        // See the cluster click handler's comment — same reason this stops
        // propagation instead of letting it reach `map.on("click", ...)`.
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!isActive) setActiveVenueId(venue.id);
        });
        // The active marker's own bottom edge — not its center — is what
        // stays on the coordinate, so it can grow upward in place (see
        // `createPreviewChipElement`); the ordinary marker is a symmetric
        // circle, so `center` (Mapbox's default) is correct for it
        // unchanged.
        const marker = new mapboxgl.Marker({ element: el, anchor: isActive ? "bottom" : "center" })
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
    // restores visible markers/clusters post-switch, rather than waiting
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
        if (!map.getLayer(CLUSTER_QUERY_LAYER)) return;
        const hits = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_QUERY_LAYER] });
        if (hits.length === 0) setActiveVenueId(null);
      });
    });

    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
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
