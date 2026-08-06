import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** The L-shaped accent bracket — two accent-colored border lines in a card's
 * top-right corner, matched exactly to the canonical Stitch export. Used by
 * every card-family member that has adopted the Coastal-Fold construction:
 * `SignatureCard`'s own corner, and `VenueCard`'s `horizontal-row` thumbnail
 * at a smaller scale. `size="lg"` (`h-8 w-8`, 4px lines) is the full-card
 * treatment; `size="sm"` (`h-3.5 w-3.5`, 2px lines) is the thumbnail
 * treatment — same geometry rule, no separate implementation. */
export function LBracketAccent({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 right-0 z-10 border-accent ${
        size === "sm" ? "h-3.5 w-3.5 border-t-2 border-r-2" : "h-8 w-8 border-t-4 border-r-4"
      }`}
    />
  );
}

/** The canonical Stitch card shell — `.signature-card` matched exactly:
 * `1.5rem` radius on three corners, sharp top-right, `overflow-hidden`,
 * plus the L-shaped accent bracket in that corner and the bottom filler
 * strip that continues the rounded silhouette past the overlap panel.
 * Renders as the card's single `Link` — the bookmark tab nests inside it as
 * a `<button>` that calls `preventDefault()` on click, the same pattern
 * every other variant in this file already uses, so the whole card stays
 * one click target except for that one button. */
export function SignatureCard({
  className = "",
  href,
  children,
}: {
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={`signature-card relative block shrink-0 snap-start overflow-hidden rounded-3xl rounded-tr-none bg-surface shadow-sm transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${className}`}
      href={href}
    >
      <LBracketAccent size="lg" />
      {children}
      <div aria-hidden="true" className="h-4 w-full rounded-b-3xl bg-surface" />
    </Link>
  );
}

/** The overlapping info panel — `.card-overlap-panel` matched exactly:
 * `1.25rem` radius, sharp bottom-left (the mirror image of the card's own
 * sharp top-right), pulled up over the photo by a net 16px
 * (`margin-top: -32px` then `transform: translateY(16px)`). `tone="light"`
 * is the white/bordered treatment used for venues; `tone="dark"` is the
 * navy fill used for destinations — same construction, different surface,
 * per the canonical export. */
export function OverlapPanel({
  children,
  tone = "light",
  border = false,
  layout = "row",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
  border?: boolean;
  /** `row` (default): `flex items-end justify-between` — a title/location
   * block with an optional trailing element (venue cards, destination
   * cards). `column`: `flex flex-col gap-2` — stacked rows of content, used
   * where the panel carries more than one line of information after the
   * title (Upcoming Events: title+badge row, then a date row, then a
   * location row). Same shared shell either way; only the internal layout
   * is contextual, per the frozen card system's own rule that construction
   * is shared but layout adapts to each variant's content density. */
  layout?: "row" | "column";
}) {
  return (
    <div
      className={`relative z-[5] mx-4 rounded-[1.25rem] rounded-bl-none p-4 shadow-md ${
        layout === "column" ? "flex flex-col gap-2" : "flex items-end justify-between"
      } ${tone === "dark" ? "bg-primary" : "bg-surface-container-lowest"} ${
        border ? "border border-outline-variant/20" : ""
      }`}
      style={{ marginTop: "-32px", transform: "translateY(16px)" }}
    >
      {children}
    </div>
  );
}

/** The bookmark tab — a right-rounded pill flush against the card's left
 * edge, matched exactly to the canonical export. Exactly the same save
 * behavior, API, and position as the rest of the family; only the shape
 * differs from the plain circular `SaveBadge` used by the variants still
 * pending their own fidelity pass. */
export function BookmarkTab({
  venueId,
  saved,
  onToggleSaved,
}: {
  venueId: string;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
}) {
  return (
    <button
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this place"}
      className="absolute top-4 left-0 z-10 flex items-center rounded-r-full bg-accent px-3 py-1.5 text-on-accent shadow-md transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={(event) => {
        event.preventDefault();
        onToggleSaved?.(venueId);
      }}
      type="button"
    >
      <Icon filled name="bookmark" size={20} />
    </button>
  );
}
