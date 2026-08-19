import Image from "next/image";

type LogoLockupProps = {
  size?: "md" | "lg";
  showTagline?: boolean;
};

/** Display size for the full logo's native 1500×1499.999933 canvas — no
 * crop, no repositioning, the whole supplied SVG rendered as-is at a size
 * large enough for the wordmark to read clearly (Production Brand Assets
 * package: the canvas is transparent, but the glyphs occupy a modest,
 * off-center portion of it, so this component sizes the canvas up rather
 * than cropping into it — cropping is explicitly out of scope for this
 * pass). */
const SIZES: Record<"md" | "lg", number> = { lg: 300, md: 230 };

/** Brand-defining lockup — Splash's only content, and its only use. Full
 * SahelSpot logo + English tagline + Arabic tagline (`dir="rtl"`, IBM Plex
 * Sans Arabic).
 *
 * Renders the official supplied `sahelspot-full-logo.svg` verbatim (full/
 * expanded context per the brand handoff: Splash, Onboarding, and About are
 * presentational brand moments, not compact icon contexts) instead of the
 * retired standalone "S" mark + separate `<h1>SahelSpot</h1>` — the full
 * logo already draws the "SahelSpot" wordmark itself. */
export function LogoLockup({ size = "lg", showTagline = true }: LogoLockupProps) {
  const canvasSize = SIZES[size];

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Image alt="SahelSpot" height={canvasSize} src="/brand/sahelspot-full-logo.svg" width={canvasSize} />
      {showTagline ? (
        <div className="space-y-1">
          <p className="text-sm text-on-surface-variant">Discover the North Coast</p>
          <p className="font-arabic text-sm text-on-surface-variant" dir="rtl">
            اكتشف الساحل الشمالي
          </p>
        </div>
      ) : null}
    </div>
  );
}
