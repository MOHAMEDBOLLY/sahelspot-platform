/** HOME CURATION — SCOPE CORRECTION. `Collection` is a general-purpose
 * model with 7 pre-existing, unrelated production rows (`editors-choice`,
 * `trending`, ...) seeded by migration 0015, long before Home Curation
 * existed. This explicit allowlist is the single place that says which
 * collections are Home Curation's concern — every screen in this feature
 * filters/guards against it, rather than scattering the same three
 * string literals across components. Sourced from migration 0023's own
 * seed list; if a future migration adds a fourth Home section, this is
 * the one place to update. */
export const HOME_CURATION_SLUGS = ['best-beaches', 'food-picks', 'nightlife'] as const

export type HomeCurationSlug = (typeof HOME_CURATION_SLUGS)[number]

export function isHomeCurationSlug(id: string): id is HomeCurationSlug {
  return (HOME_CURATION_SLUGS as readonly string[]).includes(id)
}
