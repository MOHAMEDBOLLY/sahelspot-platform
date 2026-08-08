import type { Venue } from "@/lib/domain/venue";

/** Tags are raw Studio slugs (e.g. `"specialty-coffee"`) — there is no
 * public label catalog to translate them through (`GET /editor/tags` is
 * auth-gated, Phase 1 architecture). This is the one humanization rule the
 * whole app shares for them: hyphens to spaces, then Title Case. Not a
 * lookup table — unlike `category`'s closed, curated vocabulary
 * (`lib/domain/categories.ts`), a tag slug is already close enough to its
 * display form that a table would just duplicate the string, and there's
 * no fixed list to build one from anyway. */
export function humanizeTag(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export type TagFrequency = {
  slug: string;
  label: string;
  count: number;
};

/** Aggregates `tags` across every venue passed in, most common first. Pure
 * client-side derivation over already-fetched `/public/venues` data —
 * there is no public tags catalog endpoint to source this from instead.
 * Unlike Access Type/Category, which are closed vocabularies that could in
 * principle be hardcoded, "what tags exist and which are popular" is
 * genuinely open-ended editorial content only observable from real
 * published venues, so it is never hardcoded here. */
export function topTags(venues: readonly Venue[], limit: number): TagFrequency[] {
  const counts = new Map<string, number>();
  for (const venue of venues) {
    for (const tag of venue.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, label: humanizeTag(slug), count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
    .slice(0, limit);
}

/** Every venue carrying a given tag slug — the data source for a tag-driven
 * rail (e.g. "Sushi Spots") the same way `category === "beach"` already is
 * for "Best Beaches" in `HomeClient`. */
export function venuesWithTag(venues: readonly Venue[], slug: string): Venue[] {
  return venues.filter((venue) => venue.tags.includes(slug));
}
