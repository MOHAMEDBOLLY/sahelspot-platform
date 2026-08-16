import { PageTransition } from "@/components/patterns/PageTransition";

/** Shell for pushed detail screens: Venue Details and Search.
 *
 * Deliberately has no BottomNav — approved decision 6. This is why the two
 * shells are separate route groups rather than one layout with a flag: a push
 * screen has no way to render the nav, so it cannot regress into showing one.
 *
 * Back navigation is the screen's own control (a hero IconButton on Venue
 * Details, a header one on Search), matching the export. `PageTransition`
 * gives the push itself a light enter animation (Motion & Micro-Interactions
 * Upgrade, item 9). `variant="push"` (P1.1, Design & Motion Audit) is this
 * layout's default already — passed explicitly so the two route groups'
 * classification is visible side by side, not implied by an omitted prop. */
export default function PushLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <PageTransition variant="push">{children}</PageTransition>
    </div>
  );
}
