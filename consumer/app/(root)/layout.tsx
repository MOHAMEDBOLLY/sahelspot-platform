import { BottomNav } from "@/components/nav/BottomNav";
import { PageTransition } from "@/components/patterns/PageTransition";

/** Shell for the five root-tab screens: Home, Explore, Map, Saved, More.
 *
 * The `pb-24` matches the Stitch export and reserves space for the fixed nav;
 * BottomNav itself adds `env(safe-area-inset-bottom)` on top of that.
 *
 * `PageTransition` wraps `children` only, not `BottomNav` — the nav is
 * static chrome that must not re-animate on every tab switch (Motion &
 * Micro-Interactions Upgrade, item 9). */
export default function RootTabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="min-h-dvh pb-24">
        <PageTransition>{children}</PageTransition>
      </div>
      <BottomNav />
    </>
  );
}
