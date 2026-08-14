import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  /** `md` (18/700) is the root-screen size — Home, Explore, Map sheet.
   * `lg` (20/700) is the detail-screen size, confirmed only on Venue Details.
   * Stitch genuinely uses two sizes here; this isn't a normalization. */
  size?: "md" | "lg";
  actionLabel?: string;
  actionHref?: string;
  onActionClick?: () => void;
};

/** Title + optional "See All" action. Omitting the action renders the title
 * alone, as Explore's Quick Browse section does.
 *
 * No disabled variant: a "See All" with nowhere to go still routes somewhere
 * real — either an existing screen or `/coming-soon` — rather than shipping
 * as an inert label. Stitch itself never shows a disabled action.
 *
 * Visual Richness / Art Direction Pass — pure typographic refinement, no new
 * information: `size="lg"` steps up further (was 20px, now 24px/tight
 * tracking) so it can genuinely read as a "showcase" moment for the one or
 * two sections that call it (previously the md/lg gap was too small to
 * register as a real hierarchy step); the underline mark is a touch longer
 * and sits with more air beneath the title instead of crowding it; "See
 * All" moves to a small tracked-caps label (`text-xs uppercase
 * tracking-wide`) rather than plain sentence-case text, reading as a quiet
 * secondary action instead of competing with the title for weight — the
 * "Primary → Secondary → Tertiary" hierarchy the brief asks for, expressed
 * through scale/weight/tracking rather than new markup. Still the one
 * actionable point this component owns, still navy (see the color-fix
 * comment history below), just styled to sit clearly behind the title now. */
export function SectionHeader({
  title,
  size = "md",
  actionLabel,
  actionHref,
  onActionClick,
}: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between ${size === "lg" ? "mb-5" : "mb-4"}`}>
      <div>
        <h2
          className={`font-headline font-bold tracking-tight text-primary ${
            size === "lg" ? "text-xl leading-[1.1]" : "text-base leading-tight"
          }`}
        >
          {title}
        </h2>
        <div
          aria-hidden="true"
          className={`rounded-full bg-accent ${size === "lg" ? "mt-2 h-0.5 w-9" : "mt-1.5 h-0.5 w-6"}`}
        />
      </div>
      {actionLabel ? (
        actionHref ? (
          <Link
            // Navy, not lime — lime (`--color-accent`) has ~1.2:1 contrast
            // against this light page background, effectively invisible as
            // text; the brief's own color hierarchy calls navy the
            // "primary brand/action" color and reserves lime for fills/
            // highlights (L-Bracket, active toggles), so "See All" belongs
            // here, not on the accent token.
            className="pb-0.5 text-xs font-semibold tracking-wide text-primary uppercase hover:underline"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            // Navy, not lime — see comment above.
            className="pb-0.5 text-xs font-semibold tracking-wide text-primary uppercase hover:underline"
            onClick={onActionClick}
            type="button"
          >
            {actionLabel}
          </button>
        )
      ) : null}
    </div>
  );
}
