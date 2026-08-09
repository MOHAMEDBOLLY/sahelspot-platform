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
};

export const HOME_ACTIVITIES: readonly HomeActivity[] = [
  { id: "beaches", icon: "beach_access", label: "Beaches", categories: ["beach"] },
  { id: "coffee", icon: "coffee", label: "Coffee", categories: ["coffee"] },
  // No Bakery/Dessert/Ice Cream/Fast Food category exists in Studio; in this
  // dataset those venues are filed under Cafe, which maps to "coffee".
  { id: "quick-bites", icon: "fastfood", label: "Quick Bites", categories: ["coffee", "food"] },
  { id: "restaurants", icon: "restaurant", label: "Restaurants", categories: ["food"] },
  { id: "events", icon: "confirmation_number", label: "Events", categories: [], href: "/events" },
  { id: "nightlife", icon: "nightlife", label: "Nightlife", categories: ["nightlife", "beach"] },
  // `Activity` is the family bucket in practice — aqua parks, kids' clubs,
  // football fields, public parks. Resolves to the domain's "entertainment"
  // bucket via `toVenueCategory`.
  { id: "family", icon: "group", label: "Family", categories: ["entertainment"] },
  { id: "date", icon: "favorite", label: "Date", categories: ["beach", "nightlife", "coffee"] },
  { id: "shopping", icon: "shopping_bag", label: "Shopping", categories: ["shopping"] },
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
 * component builds a search query string by hand. */
export function activityHref(item: { categories: readonly VenueCategory[]; href?: string }): string {
  if (item.href) return item.href;
  const [primary] = item.categories;
  return primary ? `/search?category=${encodeURIComponent(primary)}` : "/search";
}
