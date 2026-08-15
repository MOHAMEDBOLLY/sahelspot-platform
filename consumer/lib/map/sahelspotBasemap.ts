/** SahelSpot Vector Basemap — EXPERIMENT, not yet wired into production.
 *
 * A runtime restyle of Mapbox's own Streets v12 vector layers: every
 * geographic feature (coastline, roads, water, landuse) is still Mapbox's
 * real vector data, only recolored. Nothing here draws geometry, replaces
 * a source, or invents a coastline — it is exclusively `setPaintProperty`
 * over layers that already exist, which is also why it composes with the
 * label/fog treatments rather than fighting them.
 *
 * Implemented as a runtime override rather than a Mapbox-hosted Studio
 * style on purpose: it can be reviewed, diffed, and reverted in the repo,
 * and it cannot alter what any other product surface renders.
 *
 * Deliberately structural typing instead of `import mapboxgl` — the app
 * keeps a single Mapbox entry point (`components/map/MapView.tsx`, see
 * docs/consumer/ARCHITECTURE.md §5), and this module has no reason to pull
 * the GL bundle into anything that imports it.
 */

export type StyleableMap = {
  getLayer(id: string): unknown;
  setPaintProperty(layerId: string, name: string, value: unknown): void;
};

/** Warm limestone / Mediterranean palette.
 *
 * The North Coast's own materials are the reference: bleached limestone
 * and sand inland, a Mediterranean that reads green-blue in the shallows
 * and deepens offshore. Every value is desaturated well below Mapbox's
 * defaults so the basemap stays a quiet ground for the section-colored
 * markers sitting on top of it — the brand colors (#C8633B / #5B2A83 /
 * #0D3B66) deliberately appear nowhere in this table. */
export const SAHELSPOT_BASEMAP_PALETTE = {
  /** Warm off-white limestone — the map's ground tone. */
  land: "#F4EFE4",
  /** Slightly deeper sand for built-up/landuse areas, so towns read as
   * texture rather than as colored blocks. */
  landuse: "#EDE5D6",
  /** Muted, dusty green — North Coast vegetation is sparse and pale, not
   * the saturated park-green Mapbox ships. */
  vegetation: "#DCE0CC",
  vegetationStrong: "#D2D9C0",
  /** Mediterranean turquoise. Two earlier passes were too timid — a
   * blue-grey (#89B0C2) read dusty/northern next to the satellite
   * reference, and a green-leaning blue-grey (#7FA9B8) still read as
   * "sea in general" rather than as this sea. This is blue-green with
   * real presence while staying short of cyan: saturation is held well
   * below a tropical/Caribbean water, so it reads as Mediterranean rather
   * than as a resort brochure. */
  water: "#4FA6B5",
  /** Offshore/deep water, painted by Mapbox's own depth layer — this is
   * what produces the natural "richer blue away from the coast" gradient
   * without any hand-drawn shading. Kept clearly darker and bluer than
   * `water` so the offshore falloff still reads at this camera's shallow
   * viewing angle, and so the turquoise stays a coastal quality rather
   * than flooding the whole right half of the frame. */
  waterDeep: "#2F8195",
  /** Sits under the water fill and reads as the shallow coastal shelf —
   * the lightest, most turquoise step, which is what puts the brightest
   * water immediately against the beaches. */
  waterShadow: "#8CC9CE",
  /** Very subtle warm-gray massing. Buildings should register as texture
   * along the coast, never as objects competing with markers. */
  building: "#E5DDCC",
  /** The International Coastal Road — the composition's spine, so it is
   * the one basemap element allowed real presence. Warm ochre/bronze:
   * clearly traceable against sand, still restrained. */
  coastalRoad: "#C9A263",
  coastalRoadCase: "#AD8547",
  /** Primary roads: present, a step quieter than the coastal road. */
  primaryRoad: "#DFCFAE",
  primaryRoadCase: "#CBB68F",
  /** Everything below primary recedes into the land tone. */
  minorRoad: "#EAE1D0",
  minorRoadCase: "#DFD4BF",
  /** Warm dark brown-gray + warm halo, instead of Mapbox's neutral
   * black-on-white — a large part of what stops the map reading as a
   * generic navigation app. */
  label: "#5A5245",
  labelHalo: "#F8F4EB",
  /** Barely-there administrative lines. */
  admin: "#D8CDB8",
} as const;

type PaintRule = { layers: readonly string[]; property: string; value: unknown };

/** Layer ids are taken from the real Streets v12 style (fetched from the
 * Mapbox Styles API, not guessed). Every application is guarded by a
 * `getLayer` existence check, so a layer Mapbox renames or drops in a
 * future style version degrades to "left at its default" rather than
 * throwing. */
const PAINT_RULES: readonly PaintRule[] = [
  { layers: ["land"], property: "background-color", value: SAHELSPOT_BASEMAP_PALETTE.land },
  {
    layers: ["landuse", "land-structure-polygon", "aeroway-polygon"],
    property: "fill-color",
    value: SAHELSPOT_BASEMAP_PALETTE.landuse,
  },
  { layers: ["landcover"], property: "fill-color", value: SAHELSPOT_BASEMAP_PALETTE.vegetation },
  {
    layers: ["national-park"],
    property: "fill-color",
    value: SAHELSPOT_BASEMAP_PALETTE.vegetationStrong,
  },

  { layers: ["water"], property: "fill-color", value: SAHELSPOT_BASEMAP_PALETTE.water },
  { layers: ["water-depth"], property: "fill-color", value: SAHELSPOT_BASEMAP_PALETTE.waterDeep },
  {
    layers: ["water-shadow"],
    property: "fill-color",
    value: SAHELSPOT_BASEMAP_PALETTE.waterShadow,
  },
  {
    layers: ["waterway", "waterway-shadow"],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.water,
  },

  { layers: ["building"], property: "fill-color", value: SAHELSPOT_BASEMAP_PALETTE.building },
  {
    layers: ["building"],
    property: "fill-outline-color",
    value: SAHELSPOT_BASEMAP_PALETTE.minorRoadCase,
  },

  // The Coastal Road runs as trunk/motorway through this corridor, in the
  // ordinary, bridge, and tunnel variants Mapbox splits it across.
  {
    layers: [
      "road-motorway-trunk",
      "bridge-motorway-trunk",
      "bridge-motorway-trunk-2",
      "tunnel-motorway-trunk",
      "road-major-link",
      "bridge-major-link",
    ],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.coastalRoad,
  },
  {
    layers: [
      "road-motorway-trunk-case",
      "bridge-motorway-trunk-case",
      "bridge-motorway-trunk-2-case",
      "tunnel-motorway-trunk-case",
      "road-major-link-case",
      "bridge-major-link-case",
    ],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.coastalRoadCase,
  },

  {
    layers: ["road-primary", "bridge-primary", "tunnel-primary"],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.primaryRoad,
  },
  {
    layers: ["road-primary-case", "bridge-primary-case", "tunnel-primary-case"],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.primaryRoadCase,
  },

  {
    layers: [
      "road-secondary-tertiary",
      "bridge-secondary-tertiary",
      "tunnel-secondary-tertiary",
      "road-street",
      "road-street-low",
      "bridge-street",
      "tunnel-street",
      "road-minor",
      "road-minor-link",
      "bridge-minor",
      "tunnel-minor",
      "road-pedestrian",
      "road-path",
    ],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.minorRoad,
  },
  {
    layers: [
      "road-secondary-tertiary-case",
      "bridge-secondary-tertiary-case",
      "tunnel-secondary-tertiary-case",
      "road-street-case",
      "bridge-street-case",
      "tunnel-street-case",
      "road-minor-case",
      "road-minor-link-case",
      "bridge-minor-case",
      "tunnel-minor-case",
      "road-pedestrian-case",
    ],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.minorRoadCase,
  },

  {
    layers: ["admin-0-boundary", "admin-1-boundary", "admin-0-boundary-disputed"],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.admin,
  },
  {
    layers: ["admin-0-boundary-bg", "admin-1-boundary-bg"],
    property: "line-color",
    value: SAHELSPOT_BASEMAP_PALETTE.land,
  },
];

/** Symbol layers whose text is recolored to the warm editorial pair.
 * Typography itself — face, size, weight, placement — is left entirely to
 * Mapbox (and, in production, to `applyLabelPreferences`); only color and
 * halo change here. */
const LABEL_LAYERS = [
  "country-label",
  "state-label",
  "settlement-major-label",
  "settlement-minor-label",
  "settlement-subdivision-label",
  "poi-label",
  "airport-label",
  "transit-label",
  "water-point-label",
  "water-line-label",
  "natural-point-label",
  "natural-line-label",
  "road-label",
];

export function applySahelSpotBasemap(map: StyleableMap): void {
  for (const rule of PAINT_RULES) {
    for (const layerId of rule.layers) {
      if (!map.getLayer(layerId)) continue;
      map.setPaintProperty(layerId, rule.property, rule.value);
    }
  }

  for (const layerId of LABEL_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    map.setPaintProperty(layerId, "text-color", SAHELSPOT_BASEMAP_PALETTE.label);
    map.setPaintProperty(layerId, "text-halo-color", SAHELSPOT_BASEMAP_PALETTE.labelHalo);
    map.setPaintProperty(layerId, "text-halo-width", 1.4);
  }
}
