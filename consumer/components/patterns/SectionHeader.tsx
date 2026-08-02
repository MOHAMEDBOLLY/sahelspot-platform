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
  /** Renders the "See All" text without a working link — for sections whose
   * Stitch export shows one but that have no listing screen in the 9-screen
   * inventory to send it to (Home's Trending Today, Explore Destinations,
   * mood grid). Per the standing rule (DESIGN_SYSTEM.md §11), an
   * unimplemented feature loses its interaction, not its visual presence —
   * so the label stays, it just isn't clickable. */
  disabled?: boolean;
};

/** Title + optional "See All" action. Omitting the action renders the title
 * alone, as Explore's Quick Browse section does. */
export function SectionHeader({
  title,
  size = "md",
  actionLabel,
  actionHref,
  onActionClick,
  disabled = false,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2
        className={`font-bold text-primary ${size === "lg" ? "text-xl" : "text-lg"}`}
      >
        {title}
      </h2>
      {actionLabel ? (
        disabled ? (
          <span aria-disabled="true" className="text-sm font-semibold text-secondary/50">
            {actionLabel}
          </span>
        ) : actionHref ? (
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
