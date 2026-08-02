type LogoLockupProps = {
  size?: "md" | "lg";
  showTagline?: boolean;
};

/** Brand-defining lockup — Splash's only content, and its only use. Mark +
 * wordmark + English tagline + Arabic tagline (`dir="rtl"`, IBM Plex Sans
 * Arabic).
 *
 * The circular compass/leaf mark itself is not in the Stitch export (no
 * Splash screen was exported) — it is built from the brand palette
 * (`DESIGN.md`: teal + gold accents) rather than invented as an illustration,
 * pending the real asset. */
export function LogoLockup({ size = "lg", showTagline = true }: LogoLockupProps) {
  const markSize = size === "lg" ? "h-20 w-20" : "h-16 w-16";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        className={`${markSize} rounded-full bg-gradient-to-br from-secondary to-tertiary shadow-md`}
      />
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-primary">SahelSpot</h1>
        {showTagline ? (
          <>
            <p className="text-sm text-on-surface-variant">Discover the North Coast</p>
            <p className="font-arabic text-sm text-on-surface-variant" dir="rtl">
              اكتشف الساحل الشمالي
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
