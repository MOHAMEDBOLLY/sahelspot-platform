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
 * Per the frozen SahelSpot Mobile 2027 Design System
 * (docs/consumer/MOBILE_2027_DESIGN_FREEZE.md §3.3), every section header
 * carries a small fixed yellow underline mark beneath the title, and the
 * "See All" action is rendered in the accent color — it is the one
 * actionable point this component owns, so it is the one place yellow
 * belongs here. */
export function SectionHeader({
  title,
  size = "md",
  actionLabel,
  actionHref,
  onActionClick,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2
          className={`font-headline font-bold text-primary ${size === "lg" ? "text-xl" : "text-lg"}`}
        >
          {title}
        </h2>
        <div aria-hidden="true" className="mt-1 h-0.5 w-6 rounded-full bg-accent" />
      </div>
      {actionLabel ? (
        actionHref ? (
          <Link
            className="text-sm font-semibold text-accent hover:underline"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            className="text-sm font-semibold text-accent hover:underline"
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
