import { VENUE_CATEGORIES } from '../../venues/venueCategories'

/**
 * One color per venue category — reuses the existing, single-source-of-
 * truth category list (`venueCategories.ts`) rather than duplicating it.
 * Icons may share artwork for now (per the architecture decision), but
 * every category already gets its own value here, so marker appearance
 * is genuinely data-driven from day one, not a placeholder to revisit
 * later. Adding a 14th category to `VENUE_CATEGORIES` without adding a
 * color here falls back to `DEFAULT_VENUE_COLOR`, never a crash.
 */
export const VENUE_CATEGORY_COLORS: Record<(typeof VENUE_CATEGORIES)[number], string> = {
  Restaurant: '#F97316',
  Cafe: '#B45309',
  Hotel: '#6366F1',
  Beach: '#06B6D4',
  Nightlife: '#A855F7',
  Shopping: '#EC4899',
  Services: '#64748B',
  Entertainment: '#F59E0B',
  Other: '#9CA3AF',
  Resort: '#0EA5E9',
  Spa: '#14B8A6',
  'Beach Club': '#22D3EE',
  Activity: '#84CC16',
}

const DEFAULT_VENUE_COLOR = '#6B7280'

/**
 * A Mapbox GL style `match` expression keyed on the `category` feature
 * property — passed straight into a layer's `paint`, evaluated per-
 * feature by the GPU, not computed per-marker in React. The single place
 * this expression is built, so the Venue Layer (and any future layer
 * needing the same per-category color) never re-derives it.
 */
export function buildVenueCategoryColorExpression(): unknown[] {
  const cases: unknown[] = ['match', ['get', 'category']]
  for (const [category, color] of Object.entries(VENUE_CATEGORY_COLORS)) {
    cases.push(category, color)
  }
  cases.push(DEFAULT_VENUE_COLOR)
  return cases
}
