import { BottomNav } from "@/components/nav/BottomNav";

/** Shell for the five root-tab screens: Home, Explore, Map, Saved, More.
 *
 * The `pb-24` matches the Stitch export and reserves space for the fixed nav;
 * BottomNav itself adds `env(safe-area-inset-bottom)` on top of that. */
export default function RootTabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="min-h-dvh pb-24">{children}</div>
      <BottomNav />
    </>
  );
}
