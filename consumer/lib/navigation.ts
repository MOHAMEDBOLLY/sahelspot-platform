/** The root tabs, in Stitch's order.
 *
 * The last is "More" with a `menu` glyph — not "Profile", which is what the
 * remaining-screens spec calls it. The exported bottom nav is byte-identical
 * across Home, Map, Saved, More, and Venue Details, so this list is the most
 * reliable single fact in the whole design.
 *
 * UI Polish Batch, item 6 — Explore is deferred to the next release: its
 * entry is removed from this array so `BottomNav` no longer surfaces it, but
 * nothing about the feature itself changed. `app/(root)/explore/` (route,
 * page, `ExploreClient.tsx`) is untouched and still resolves normally for
 * anyone who reaches `/explore` directly (a bookmark, a shared link, or the
 * existing `CTAButton`s in `SavedClient.tsx`'s empty states, deliberately
 * left alone as out of scope for this batch). Restoring the tab for the next
 * release is a one-line revert: add `{ href: "/explore", label: "Explore",
 * icon: "explore" }` back at its previous position (after Home). */
export type RootTab = {
  href: string;
  label: string;
  icon: string;
};

export const ROOT_TABS: readonly RootTab[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/saved", label: "Saved", icon: "favorite" },
  { href: "/more", label: "More", icon: "menu" },
] as const;

/** `/` would otherwise prefix-match every route. */
export function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/") return pathname === "/";
  return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
}
