/** The five root tabs, in Stitch's order.
 *
 * The fifth is "More" with a `menu` glyph — not "Profile", which is what the
 * remaining-screens spec calls it. The exported bottom nav is byte-identical
 * across Home, Explore, Map, and Venue Details, so this list is the most
 * reliable single fact in the whole design. */
export type RootTab = {
  href: string;
  label: string;
  icon: string;
};

export const ROOT_TABS: readonly RootTab[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/explore", label: "Explore", icon: "explore" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/saved", label: "Saved", icon: "favorite" },
  { href: "/more", label: "More", icon: "menu" },
] as const;

/** `/` would otherwise prefix-match every route. */
export function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === "/") return pathname === "/";
  return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
}
