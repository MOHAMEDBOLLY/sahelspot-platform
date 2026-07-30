/**
 * Every source id and GL layer id used anywhere in the Maps feature.
 * Nothing outside this file may write a literal layer/source id string —
 * every layer class, the Layer Manager, the Selection Manager, and any
 * future interaction code import from here instead of comparing against
 * `"venues"`/`"clusters"`/etc. directly.
 */
export const LayerId = {
  /** The venues GeoJSON source — clustered. Both the Cluster Layer and
   * the unclustered-point rendering read from this one source. */
  VENUES_SOURCE: 'venues',
  VENUES_UNCLUSTERED: 'venues-unclustered',
  CLUSTERS: 'clusters',
  CLUSTER_COUNT: 'cluster-count',

  /** The destination-boundary GeoJSON source, and its two read-only
   * rendering layers (fill + outline). */
  DESTINATIONS_SOURCE: 'destinations',
  BOUNDARIES_FILL: 'boundaries-fill',
  BOUNDARIES_LINE: 'boundaries-line',
} as const

export type LayerId = (typeof LayerId)[keyof typeof LayerId]
