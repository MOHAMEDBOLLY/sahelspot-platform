/** Home's editorial navigation — "What do you want to do today?".
 *
 * Activities are *not* categories. They are the things someone actually
 * wants to do during a day on the North Coast, and each one resolves to one
 * or more Consumer domain categories. The mapping lives here and nowhere
 * else: no table, no migration, no Studio concept. Adding or re-pointing an
 * activity is a one-line edit to this file.
 *
 * `categories` holds **domain `VenueCategory` values** (`"beach"`,
 * `"coffee"`, …) — the same vocabulary Search (`SearchClient.tsx`) reads
 * straight off `?category=` and Explore's "Browse by Category" already
 * links with. Raw Studio strings never appear here; `toVenueCategory` in
 * `lib/domain/categories.ts` is what turns Studio's taxonomy into these
 * values on the way in, and this file must speak the same output vocabulary
 * so navigation actually lands on a match.
 *
 * Coverage note, measured against publish revision with 400 venues — the
 * real Studio taxonomy is 11 values (`Restaurant` 156, `Cafe` 50, `Activity`
 * 38, `Shopping` 33, `Spa` 28, `Hotel` 26, `Services` 20, `Resort` 20,
 * `Beach Club` 19, `Nightlife` 8, `Other` 2), which `toVenueCategory` folds
 * into the domain values below. Several finer-grained categories a richer
 * editorial mapping would want (`Bakery`, `Fine Dining`, `Lounge`,
 * `Rooftop`, `Kids`, …) do not exist in Studio today, so the activities
 * below map to the closest domain bucket that actually carries venues.
 */

import type { VenueCategory } from "@/lib/domain/categories";

export type HomeActivity = {
  id: string;
  /** Material Symbols Outlined glyph name (see `components/ui/Icon.tsx`) —
   * the one icon system already used everywhere in this app (venue
   * favorites, ticket CTAs, nav). Not emoji, and not a second icon library:
   * mixing Lucide in here would be the actual visual-language break. */
  icon: string;
  label: string;
  /** Domain `VenueCategory` values this activity covers, most representative
   * first. The first entry is what navigation filters by — Search takes a
   * single `?category=` value, so a multi-category activity lands on its
   * primary one rather than inventing a new API contract. */
  categories: readonly VenueCategory[];
  /** Set when the activity isn't a venue-category search at all. Events are
   * their own published entity with their own route, not a venue category. */
  href?: string;
  /** V1 Home taxonomy (approved product decision) — the tag *slugs* Search
   * is allowed to surface for this activity, out of everything
   * `topTags()` finds in the activity's backend category. This is what
   * lets Quick Bites and Restaurants both resolve to the same `food`
   * category yet show disjoint tag rows: Quick Bites allow-lists
   * fast/casual slugs, Restaurants allow-lists sit-down slugs, and a slug
   * outside both lists (`sushi`, `italian`) simply never surfaces under
   * either. Consumer-side only — no Studio/backend concept, doesn't
   * rename or reassign any tag. Omit for activities with no V1 allow-list
   * (Search then falls back to showing every tag `topTags()` finds for
   * the category, unrestricted). A slug with zero current venues still
   * won't render — the allow-list narrows what's *eligible*, it doesn't
   * force anything to appear (`SearchClient`'s existing zero-count
   * behavior is unchanged). */
  allowedTags?: readonly string[];
};

export const HOME_ACTIVITIES: readonly HomeActivity[] = [
  { id: "beaches", icon: "beach_access", label: "Beaches", categories: ["beach"] },
  {
    id: "coffee",
    icon: "coffee",
    label: "Coffee",
    categories: ["coffee"],
    allowedTags: ["specialty-coffee", "cafe-shop", "shisha", "bakery", "desserts"],
  },
  // "Quick Bites" means fast/casual eating — Fast Food, Burgers, Pizza,
  // Sandwiches — which are Restaurant-category tags (see api/alembic
  // 0014_tags.py's Quick Bites tag set), not Cafe. Primary must be "food"
  // so `activityHref` lands on Search's food taxonomy, not coffee's.
  // `allowedTags` is what actually keeps Quick Bites and Restaurants
  // disjoint despite sharing the same `food` category — see
  // `allowedTags`'s own doc comment above.
  {
    id: "quick-bites",
    icon: "fastfood",
    label: "Quick Bites",
    categories: ["food", "coffee"],
    allowedTags: ["fast-food", "pizza", "burgers", "sandwiches", "feteer"],
  },
  {
    id: "restaurants",
    icon: "restaurant",
    label: "Restaurants",
    categories: ["food"],
    allowedTags: ["fine-dining", "grill", "seafood", "mandi-kabsa"],
  },
  { id: "events", icon: "confirmation_number", label: "Events", categories: [], href: "/events" },
  // No QR Independent Entity (`no_qr_areas`/`no_qr_places`,
  // api/app/db/models.py) — its own discovery entity, not a Venue
  // category and not a tag, same architectural shape as Events. Reads
  // `GET /public/discover/no-qr-areas` (`lib/api/noQr.ts`), never the
  // legacy `is_no_qr`/`parent_venue_id`/`no_qr_type` Venue fields, which
  // this model supersedes and which the public API still doesn't (and
  // shouldn't) expose.
  { id: "no-qr", icon: "directions_walk", label: "No QR", categories: [], href: "/no-qr" },
  // `Activity` is the family bucket in practice — aqua parks, kids' clubs,
  // football fields, public parks. Resolves to the domain's "entertainment"
  // bucket via `toVenueCategory`.
  {
    id: "family",
    icon: "group",
    label: "Family",
    categories: ["entertainment"],
    allowedTags: ["kids-area", "kids-activities", "pool", "aqua-park", "play-area"],
  },
  {
    id: "nightlife",
    icon: "nightlife",
    label: "Nightlife",
    categories: ["nightlife", "beach"],
    allowedTags: ["dj", "lounge", "night-club", "beach-party"],
  },
  // Essentials is a Consumer-only umbrella over two backend categories
  // (`shopping`, `services`) — no single `?category=` value covers both,
  // and a `HomeActivity` navigates to one category via `activityHref`.
  // Rather than inventing a new merged view (a Home/Search redesign this
  // task explicitly rules out), this points at `/explore`'s existing
  // "Browse by Category" grid, which already lists Shopping and Services
  // as separate chips into their own `/search?category=` taxonomy — the
  // smallest clean reuse of an existing screen, zero new code.
  { id: "essentials", icon: "storefront", label: "Essentials", categories: [], href: "/explore" },
];

/** Essential Services — the practical, non-leisure half of a trip.
 *
 * Studio has a single `Services` category (20 venues) covering all six of
 * these at once: supermarkets (7MART, Sokkar Market), pharmacies (El Ezaby),
 * clinics (Espitalia), plus a mall, a cinema and a mosque. There is no
 * `Pharmacy`/`ATM`/`Gas Station`/`Hospital` category to point at, so every
 * tile below currently resolves to that one bucket. They are listed
 * separately because the moment those categories exist in Studio this file
 * is the only thing that has to change. */
export type EssentialService = {
  id: string;
  /** Material Symbols Outlined glyph name — same single icon language as
   * `HomeActivity.icon` above; this app has zero emoji in production UI. */
  icon: string;
  label: string;
  categories: readonly VenueCategory[];
};

export const ESSENTIAL_SERVICES: readonly EssentialService[] = [
  { id: "supermarkets", icon: "local_grocery_store", label: "Supermarkets", categories: ["services"] },
  { id: "pharmacies", icon: "local_pharmacy", label: "Pharmacies", categories: ["services"] },
  { id: "atms", icon: "local_atm", label: "ATMs", categories: ["services"] },
  { id: "gas-stations", icon: "local_gas_station", label: "Gas Stations", categories: ["services"] },
  { id: "hospitals", icon: "local_hospital", label: "Hospitals", categories: ["services"] },
  { id: "car-services", icon: "car_repair", label: "Car Services", categories: ["services"] },
];

/** The one place an activity/service turns into a destination URL, so no
 * component builds a search query string by hand.
 *
 * Appends `&activity=<id>` whenever the item carries an `id` and resolves
 * to a category (not `href`-based, like Events) — that's how Search knows
 * which `allowedTags` list to apply for a V1 tag row (see `HomeActivity`'s
 * doc comment). Items without an `id` (none today) or without an
 * `allowedTags` entry still work exactly as before: Search simply finds no
 * matching allow-list and shows every tag `topTags()` returns. */
export function activityHref(item: {
  id?: string;
  categories: readonly VenueCategory[];
  href?: string;
}): string {
  if (item.href) return item.href;
  const [primary] = item.categories;
  if (!primary) return "/search";
  const params = new URLSearchParams({ category: primary });
  if (item.id) params.set("activity", item.id);
  return `/search?${params.toString()}`;
}

/** Essentials' two V1 sub-groups (Shopping / Services) — not Home rail
 * tiles themselves (Essentials is the one tile, at `/explore`), but each
 * needs its own `allowedTags` the same way a `HomeActivity` does, since
 * `shopping` and `services` are each a single backend category with their
 * own approved V1 tag list. Kept here, not duplicated into
 * `ExploreClient.tsx`, so this file stays the one place Home/Essentials
 * taxonomy is defined — `ExploreClient` only reads `category`/`id` off
 * this array to build its existing "Browse by Category" hrefs, it doesn't
 * redefine the mapping. `findAllowedTags` below is what `SearchClient`
 * actually queries — it checks `HOME_ACTIVITIES` first, then this list,
 * so both activity kinds resolve through one function. */
export const ESSENTIALS_GROUPS: readonly {
  id: string;
  category: VenueCategory;
  allowedTags: readonly string[];
}[] = [
  {
    id: "essentials-shopping",
    category: "shopping",
    allowedTags: ["fashion", "beauty", "beach-essentials", "home-decor"],
  },
  {
    id: "essentials-services",
    category: "services",
    allowedTags: ["supermarket", "pharmacy", "clinics", "veterinary", "car-services"],
  },
];

/** Resolves an `?activity=` id (from `activityHref`, or an
 * `ESSENTIALS_GROUPS` link built by `ExploreClient`) to its V1 allow-list,
 * across both sources — the single lookup `SearchClient` calls instead of
 * reading `HOME_ACTIVITIES`/`ESSENTIALS_GROUPS` directly. */
export function findAllowedTags(activityId: string | null): readonly string[] | undefined {
  if (!activityId) return undefined;
  const activity = HOME_ACTIVITIES.find((item) => item.id === activityId);
  if (activity) return activity.allowedTags;
  return ESSENTIALS_GROUPS.find((group) => group.id === activityId)?.allowedTags;
}
