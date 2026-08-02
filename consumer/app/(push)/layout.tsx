/** Shell for pushed detail screens: Venue Details and Search.
 *
 * Deliberately has no BottomNav — approved decision 6. This is why the two
 * shells are separate route groups rather than one layout with a flag: a push
 * screen has no way to render the nav, so it cannot regress into showing one.
 *
 * Back navigation is the screen's own control (a hero IconButton on Venue
 * Details, a header one on Search), matching the export. */
export default function PushLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">{children}</div>
  );
}
