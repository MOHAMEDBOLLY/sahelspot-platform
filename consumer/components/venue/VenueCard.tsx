import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import type { Venue } from "@/lib/domain/venue";
import type { Event, EventPhase } from "@/lib/domain/event";
import { formatEventDateRange } from "@/lib/domain/formatEventDate";

type VenueCardVariant = "vertical-lg" | "vertical-compact" | "horizontal-row" | "event";

type VenueCardOwnProps =
  | {
      variant?: Exclude<VenueCardVariant, "event">;
      venue: Venue;
      event?: never;
      saved?: boolean;
      onToggleSaved?: (venueId: string) => void;
    }
  | {
      variant: "event";
      event: Event;
      venue?: never;
      saved?: never;
      onToggleSaved?: never;
    };

type VenueCardProps = VenueCardOwnProps;

const EVENT_PHASE_LABEL: Record<NonNullable<EventPhase>, string> = {
  upcoming: "Upcoming",
  live: "Happening now",
  ended: "Ended",
};

/** The one card family in the product — one component, five variants, never
 * five components.
 *
 * `vertical-lg` (Home Trending Today, Saved list — and the visual reference
 * for the whole family, Best Beaches) is implemented pixel-faithfully
 * against the canonical Stitch export (`.signature-card` /
 * `.card-overlap-panel`, see docs/consumer/MOBILE_2027_DESIGN_FREEZE.md):
 * a sharp top-right corner, an L-shaped accent bracket in that corner (two
 * 4px accent lines, not a fill or a diagonal cut), a bookmark tab as a
 * right-rounded pill flush against the left edge, and an overlapping info
 * panel with its own sharp bottom-left corner. This is the canonical
 * construction — do not reinterpret it.
 *
 * `vertical-compact` (Map bottom sheet Popular Nearby), `horizontal-row`
 * (Venue Details Nearby Places, Search results), and `event` (Events
 * Module v1) keep the simpler pre-existing treatment pending their own
 * fidelity pass — they are explicitly out of scope for this change, not
 * finished in a different style on purpose. */
export function VenueCard(props: VenueCardProps) {
  if (props.variant === "event") {
    return <EventVariant event={props.event} />;
  }

  const { venue, variant = "vertical-lg", saved = false, onToggleSaved } = props;
  const href = `/venues/${venue.id}`;

  if (variant === "horizontal-row") {
    return (
      <Link
        className="flex items-center gap-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3 shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        href={href}
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl rounded-tr-none bg-cream">
          {venue.coverImageUrl ? (
            <Image
              alt={venue.name}
              className="object-cover"
              fill
              sizes="80px"
              src={venue.coverImageUrl}
            />
          ) : null}
          <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 z-10 h-3.5 w-3.5 border-t-2 border-r-2 border-accent" />
          <button
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved" : "Save this place"}
            className="absolute top-1.5 left-0 z-10 flex items-center rounded-r-full bg-accent px-1.5 py-1 text-on-accent shadow-sm transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={(event) => {
              event.preventDefault();
              onToggleSaved?.(venue.id);
            }}
            type="button"
          >
            <Icon filled name="bookmark" size={12} />
          </button>
        </div>
        <div className="min-w-0 flex-grow space-y-1">
          <h3 className="truncate font-headline font-bold leading-tight text-primary">
            {venue.name}
          </h3>
          {venue.distanceLabel ? (
            <div className="flex items-center gap-1">
              <Icon className="text-on-surface-variant" name="location_on" size={16} />
              <span className="text-xs font-medium text-on-surface-variant">
                {venue.distanceLabel}
              </span>
            </div>
          ) : null}
          {venue.rating !== null ? (
            <RatingBadge compact reviewCount={venue.reviewCount ?? undefined} value={venue.rating} />
          ) : null}
        </div>
        <Icon className="text-primary" name="chevron_right" size={20} />
      </Link>
    );
  }

  if (variant === "vertical-compact") {
    return (
      <Link
        className="w-56 shrink-0 snap-start overflow-hidden rounded-3xl bg-surface-container-lowest shadow-md transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        href={href}
      >
        <div className="relative h-32 bg-cream">
          {venue.coverImageUrl ? (
            <Image alt={venue.name} className="object-cover" fill sizes="224px" src={venue.coverImageUrl} />
          ) : null}
          <CornerAccent />
          <span className="absolute top-3 left-3">
            <SaveBadge onToggleSaved={onToggleSaved} saved={saved} venueId={venue.id} />
          </span>
        </div>
        <div className="-mt-4 mx-3 space-y-2 rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-headline text-lg leading-tight font-bold text-on-surface">
                {venue.name}
              </h3>
              <p className="flex items-center gap-1 text-sm text-on-surface-variant">
                <Icon className="shrink-0" name="location_on" size={16} />
                <span className="truncate">{venue.destinationName}</span>
              </p>
            </div>
            {venue.isOpenNow !== null ? <StatusBadge isOpen={venue.isOpenNow} /> : null}
          </div>
          <div className="flex items-center gap-1 pt-1">
            {venue.rating !== null ? (
              <RatingBadge reviewCount={venue.reviewCount ?? undefined} value={venue.rating} />
            ) : null}
            {venue.distanceLabel ? (
              <span className="text-xs text-on-surface-variant">· {venue.distanceLabel}</span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  // vertical-lg — the canonical construction, matched to the Stitch export.
  const isClosed = venue.isOpenNow === false;
  return (
    <SignatureCard className={`w-64 ${isClosed ? "opacity-70" : ""}`} href={href}>
      <div className={`relative h-48 bg-cream ${isClosed ? "grayscale-[30%]" : ""}`}>
        {isClosed ? (
          <span className="absolute top-0 left-0 z-20 bg-error px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
            Closed
          </span>
        ) : null}
        {venue.coverImageUrl ? (
          <Image alt={venue.name} className="object-cover" fill sizes="280px" src={venue.coverImageUrl} />
        ) : null}
      </div>
      <BookmarkTab onToggleSaved={onToggleSaved} saved={saved} venueId={venue.id} />
      <OverlapPanel border tone="light">
        <div className="flex flex-col">
          <h3 className="font-headline text-lg leading-tight font-bold text-on-surface">{venue.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-on-surface-variant">
            <Icon size={14} name="location_on" />
            {venue.destinationName}
          </p>
        </div>
        {venue.isOpenNow !== null ? <StatusBadge isOpen={venue.isOpenNow} /> : null}
      </OverlapPanel>
      {(venue.rating !== null || venue.distanceLabel) ? (
        <div className="mx-4 flex items-center gap-1 pb-1">
          {venue.rating !== null ? (
            <RatingBadge reviewCount={venue.reviewCount ?? undefined} value={venue.rating} />
          ) : null}
          {venue.distanceLabel ? (
            <span className="text-xs text-on-surface-variant">· {venue.distanceLabel}</span>
          ) : null}
        </div>
      ) : null}
    </SignatureCard>
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
      <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 z-10 h-8 w-8 border-t-4 border-r-4 border-accent" />
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
function BookmarkTab({
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

/** Simple flat triangle corner mark — the pre-Coastal-Fold treatment, kept
 * for `vertical-compact`, `horizontal-row`, `event`, and (via
 * `CollectionCard`/`FeatureCard`) other card-family members still pending
 * their own fidelity pass against the canonical export. */
export function CornerAccent() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 right-0 h-4 w-4 bg-accent"
      style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
    />
  );
}

function SaveBadge({
  venueId,
  saved,
  onToggleSaved,
  compact = false,
}: {
  venueId: string;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
  compact?: boolean;
}) {
  return (
    <IconButton
      aria-pressed={saved}
      className={compact ? "h-6 w-6" : undefined}
      icon="bookmark"
      filled
      label={saved ? "Remove from saved" : "Save this place"}
      onClick={(event) => {
        event.preventDefault();
        onToggleSaved?.(venueId);
      }}
      variant="accent"
    />
  );
}

/** The `event` variant's body — matched to the canonical Stitch export's
 * Upcoming Events card: the same `SignatureCard`/`OverlapPanel` shell as
 * every other card, `layout="column"` because an event's panel stacks a
 * title+status row, a date row, and a location row rather than the
 * title/location pair every venue card panel holds. No bookmark tab —
 * events aren't saveable, so that affordance simply doesn't apply here,
 * per the frozen system's own rule that the bookmark tab appears "only
 * where save functionality exists." No standalone component; this is
 * inlined here because it is only ever reached through `VenueCard`'s
 * `event` variant. */
function EventVariant({ event }: { event: Event }) {
  return (
    <SignatureCard className="w-80" href={`/events/${event.slug}`}>
      <div className="relative h-48 bg-cream">
        {event.coverImageUrl ? (
          <Image alt={event.title} className="object-cover" fill sizes="320px" src={event.coverImageUrl} />
        ) : null}
        {event.featured ? (
          <span className="absolute top-0 left-0 z-20 bg-accent px-2 py-1 text-[10px] font-bold tracking-wider text-on-accent uppercase">
            Featured
          </span>
        ) : null}
      </div>
      <OverlapPanel border layout="column" tone="light">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-headline text-lg leading-tight font-bold text-on-surface">{event.title}</h3>
          {event.phase ? (
            <span className="shrink-0 rounded-md bg-surface-container px-2 py-1 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
              {EVENT_PHASE_LABEL[event.phase]}
            </span>
          ) : null}
        </div>
        <p className="flex items-center gap-1 text-sm font-bold text-accent">
          <Icon size={16} name="calendar_month" />
          {formatEventDateRange(event)}
        </p>
        {event.venue || event.destination ? (
          <p className="flex items-center gap-1 text-sm text-on-surface-variant">
            <Icon size={16} name="location_on" />
            <span className="truncate">{event.venue?.name ?? event.destination?.name}</span>
          </p>
        ) : null}
      </OverlapPanel>
    </SignatureCard>
  );
}
