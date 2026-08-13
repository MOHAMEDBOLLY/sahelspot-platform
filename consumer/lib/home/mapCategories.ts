import { CATEGORY_BY_VALUE, type VenueCategory } from "@/lib/domain/categories";
import { ESSENTIALS_GROUPS, HOME_ACTIVITIES } from "@/lib/home/activities";

/** Map's category filter — the exact same category definitions Home's
 * "What do you want to do?" rail already uses (id, label, icon, order,
 * allowed-tag contextual filters), not a second taxonomy. Single source
 * of truth stays `HOME_ACTIVITIES`/`ESSENTIALS_GROUPS`
 * (`lib/home/activities.ts`) — this file only *derives* a Map-appropriate
 * view over them, it never redefines a category's id/label/icon/tags.
 *
 * Two of Home's nine activities are excluded here: Events and No QR are
 * independent discovery entities with their own routes, not a
 * `VenueCategory` — they have no venue markers to ever put on the map
 * (`categories: []` on both in `HOME_ACTIVITIES`). Map only ever renders
 * `Venue` markers (`MapView`'s `venues` prop), so a category with nothing
 * to filter has no place in this list. This is a deliberate scope
 * decision for this task, not an oversight — flagged in the
 * implementation report rather than silently applied. */
export type MapCategory = {
  id: string;
  label: string;
  icon: string;
  /** Domain `VenueCategory` values this filter matches — a venue belongs
   * to this Map category if its own `.category` is one of these. */
  categories: readonly VenueCategory[];
  /** Same `allowedTags` Search already reads via `findAllowedTags` — the
   * contextual filter options Map shows once this category is selected.
   * Omitted (Beaches) means this category has no tag-based contextual
   * filter; Beaches' contextual filter is Access Type instead, handled
   * separately (see `MapClient`'s `hasAccessTypeFilter`). */
  allowedTags?: readonly string[];
};

export const MAP_CATEGORIES: readonly MapCategory[] = [
  ...HOME_ACTIVITIES.filter((activity) => activity.categories.length > 0).map(
    (activity): MapCategory => ({
      id: activity.id,
      label: activity.label,
      icon: activity.icon,
      categories: activity.categories,
      allowedTags: activity.allowedTags,
    }),
  ),
  ...ESSENTIALS_GROUPS.map(
    (group): MapCategory => ({
      id: group.id,
      label: CATEGORY_BY_VALUE[group.category].label,
      icon: CATEGORY_BY_VALUE[group.category].icon,
      categories: [group.category],
      allowedTags: group.allowedTags,
    }),
  ),
];

/** Beaches is the one Map category whose contextual filter is Access
 * Type, not tags — matching the exact Access Type vocabulary/behavior
 * Search/the previous Map implementation already used
 * (`lib/domain/accessType.ts`), never a new one. */
export const ACCESS_TYPE_CATEGORY_ID = "beaches";
