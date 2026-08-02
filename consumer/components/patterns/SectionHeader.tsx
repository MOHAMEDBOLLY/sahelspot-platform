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
 * as an inert label. Stitch itself never shows a disabled action. */
export function SectionHeader({
  title,
  size = "md",
  actionLabel,
  actionHref,
  onActionClick,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2
        className={`font-bold text-primary ${size === "lg" ? "text-xl" : "text-lg"}`}
      >
        {title}
      </h2>
      {actionLabel ? (
        actionHref ? (
          <Link
            className="text-sm font-semibold text-secondary hover:underline"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            className="text-sm font-semibold text-secondary hover:underline"
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
