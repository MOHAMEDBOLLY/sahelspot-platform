/** Home's editorial navigation — "What do you want to do today?".
 *
 * Activities are *not* categories. They are the things someone actually
 * wants to do during a day on the North Coast, and each one resolves to one
 * or more real Studio category values. The mapping lives here and nowhere
 * else: no table, no migration, no API parameter, no Studio concept. Adding
 * or re-pointing an activity is a one-line edit to this file.
 *
 * `categories` holds **raw Studio values** (`"Beach Club"`, `"Cafe"`), not
 * the five-value `VenueCategory` union `lib/domain/venue.ts` collapses them
 * into. That is deliberate: `/search?category=` is matched against the raw
 * published value, so this is the vocabulary navigation has to speak.
 *
 * Coverage note, measured against publish revision with 400 venues — the
 * real taxonomy is 11 values (`Restaurant` 156, `Cafe` 50, `Activity` 38,
 * `Shopping` 33, `Spa` 28, `Hotel` 26, `Services` 20, `Resort` 20,
 * `Beach Club` 19, `Nightlife` 8, `Other` 2). Several finer-grained
 * categories a richer editorial mapping would want (`Bakery`, `Fine Dining`,
 * `Lounge`, `Rooftop`, `Kids`, …) do not exist in Studio today, so the
 * activities below map to the closest values that actually carry venues
 * rather than to empty ones. `Beach` is a legal Studio value but has zero
 * published venues — `Beach Club` is where every beach venue actually sits.
 */

export type HomeActivity = {
  id: string;
  /** Material Symbols Outlined glyph name (see `components/ui/Icon.tsx`) —
   * the one icon system already used everywhere in this app (venue
   * favorites, ticket CTAs, nav). Not emoji, and not a second icon library:
   * mixing Lucide in here would be the actual visual-language break. */
  icon: string;
  label: string;
  /** Raw Studio category values this activity covers, most representative
   * first. The first entry is what navigation filters by — `/public/search/
   * venues` takes a single exact category, so a multi-category activity
   * lands on its primary one rather than inventing a new API contract. */
  categories: readonly string[];
  /** Set when the activity isn't a venue-category search at all. Events are
   * their own published entity with their own route, not a venue category. */
  href?: string;
};

export const HOME_ACTIVITIES: readonly HomeActivity[] = [
  { id: "beaches", icon: "beach_access", label: "Beaches", categories: ["Beach Club", "Beach"] },
  { id: "coffee", icon: "coffee", label: "Coffee", categories: ["Cafe"] },
  // No Bakery/Dessert/Ice Cream/Fast Food category exists in Studio; in this
  // dataset those venues are filed under Cafe.
  { id: "quick-bites", icon: "fastfood", label: "Quick Bites", categories: ["Cafe", "Restaurant"] },
  { id: "restaurants", icon: "restaurant", label: "Restaurants", categories: ["Restaurant"] },
  { id: "events", icon: "confirmation_number", label: "Events", categories: [], href: "/events" },
  { id: "nightlife", icon: "nightlife", label: "Nightlife", categories: ["Nightlife", "Beach Club"] },
  // `Activity` is the family bucket in practice — aqua parks, kids' clubs,
  // football fields, public parks.
  { id: "family", icon: "group", label: "Family", categories: ["Activity"] },
  { id: "date", icon: "favorite", label: "Date", categories: ["Beach Club", "Nightlife", "Cafe"] },
  { id: "shopping", icon: "shopping_bag", label: "Shopping", categories: ["Shopping"] },
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
  categories: readonly string[];
};

export const ESSENTIAL_SERVICES: readonly EssentialService[] = [
  { id: "supermarkets", icon: "local_grocery_store", label: "Supermarkets", categories: ["Services"] },
  { id: "pharmacies", icon: "local_pharmacy", label: "Pharmacies", categories: ["Services"] },
  { id: "atms", icon: "local_atm", label: "ATMs", categories: ["Services"] },
  { id: "gas-stations", icon: "local_gas_station", label: "Gas Stations", categories: ["Services"] },
  { id: "hospitals", icon: "local_hospital", label: "Hospitals", categories: ["Services"] },
  { id: "car-services", icon: "car_repair", label: "Car Services", categories: ["Services"] },
];

/** The one place an activity/service turns into a destination URL, so no
 * component builds a search query string by hand. */
export function activityHref(item: { categories: readonly string[]; href?: string }): string {
  if (item.href) return item.href;
  const [primary] = item.categories;
  return primary ? `/search?category=${encodeURIComponent(primary)}` : "/search";
}
