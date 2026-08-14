import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { Pill } from "@/components/ui/Pill";
import { CardFrame, DateBadge, LBracketAccent, SaveButton } from "@/components/patterns/CardShell";
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
      /** Location Context Label refinement — set only by a caller that
       * knows the venue is shown in a Destination-related list (Venue
       * Details' Similar Experiences, Search's `?destination=` results)
       * and has already determined (via `lib/domain/destination.ts`'s
       * `areaLabel`) that this venue belongs to a *different* destination
       * in the same real-world area. `horizontal-row` only — see that
       * variant's render for why. Never computed inside this component:
       * `VenueCard` stays presentational and takes the answer, not the
       * destination list needed to work it out. */
      areaLabel?: string | null;
    }
  | {
      variant: "event";
      event: Event;
      venue?: never;
      saved?: never;
      onToggleSaved?: never;
      areaLabel?: never;
    };

type VenueCardProps = VenueCardOwnProps;

const EVENT_PHASE_LABEL: Record<NonNullable<EventPhase>, string> = {
  upcoming: "Upcoming",
  live: "Happening now",
  ended: "Ended",
};

/** `"Public"` is the overwhelmingly common case (see
 * lib/domain/accessType.ts) — surfacing it on every card would be clutter,
 * not information. Only a genuine restriction (QR code, paid entry, a
 * reservation requirement, ...) is worth a visitor's attention before they
 * tap in, so that's the only case this returns non-null for. */
function notableAccessType(venue: Venue): string | null {
  return venue.accessType && venue.accessType !== "Public" ? venue.accessType : null;
}

type StandardSize = "lg" | "compact";

const STANDARD_SIZE: Record<StandardSize, { width: string; image: string; title: string }> = {
  lg: { width: "w-52", image: "h-32", title: "text-sm" },
  compact: { width: "w-40", image: "h-24", title: "text-xs" },
};

/** The one card family in the product — one component, four variants, never
 * four components. Card System Redesign (SAHELSPOT CONSUMER — CARD SYSTEM
 * REDESIGN ONLY): all four now share the same flat `CardFrame` construction
 * (image, then content directly below it — no floating overlap panel), the
 * same `SaveButton`/`DateBadge` top-left slot, and the same typography and
 * metadata ordering (title → location → rating/distance), rather than three
 * different pre-existing treatments each waiting on its own "fidelity
 * pass." `vertical-lg` and `vertical-compact` are now one internal
 * `StandardVenueCard`, sized by prop, instead of two parallel
 * implementations — same data, same hierarchy, different scale only. */
export function VenueCard(props: VenueCardProps) {
  if (props.variant === "event") {
    return <EventVariant event={props.event} />;
  }

  const { venue, variant = "vertical-lg", saved = false, onToggleSaved, areaLabel = null } = props;

  if (variant === "horizontal-row") {
    return (
      <HorizontalVenueCard
        areaLabel={areaLabel}
        onToggleSaved={onToggleSaved}
        saved={saved}
        venue={venue}
      />
    );
  }

  return (
    <StandardVenueCard
      onToggleSaved={onToggleSaved}
      saved={saved}
      size={variant === "vertical-compact" ? "compact" : "lg"}
      venue={venue}
    />
  );
}

/** Standard card — Home's rails, Saved, Map's bottom sheet. Anatomy, in
 * scan order: image → save action (top-left, over the image) → title +
 * open/closed status → location → rating/distance/access-type. One primary
 * accent (lime, via `LBracketAccent` and the save button's active state)
 * per card, exactly as the brief's color-restraint section asks — no
 * per-category color, no second accent competing for attention. Closed
 * venues de-emphasize via opacity + a light grayscale on the photo, plus the
 * "CLOSED" text already carried by `StatusBadge`, rather than a second
 * "giant badge" ribbon stacked on top of the same information. */
function StandardVenueCard({
  venue,
  size,
  saved,
  onToggleSaved,
}: {
  venue: Venue;
  size: StandardSize;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
}) {
  const isClosed = venue.isOpenNow === false;
  const { width, image, title } = STANDARD_SIZE[size];

  return (
    <CardFrame className={`${width} ${isClosed ? "opacity-70" : ""}`} href={`/venues/${venue.id}`}>
      <div className={`relative ${image} bg-cream ${isClosed ? "grayscale-[30%]" : ""}`}>
        {venue.coverImageUrl ? (
          <Image alt={venue.name} className="object-cover" fill sizes="256px" src={venue.coverImageUrl} />
        ) : null}
      </div>
      <SaveButton onToggleSaved={onToggleSaved} saved={saved} venueId={venue.id} />
      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`truncate font-bold leading-tight text-on-surface ${title}`}>{venue.name}</h3>
          {venue.isOpenNow !== null ? <StatusBadge isOpen={venue.isOpenNow} /> : null}
        </div>
        <p className="flex items-center gap-1 text-xs text-on-surface-variant">
          <Icon className="shrink-0" name="location_on" size={16} />
          <span className="truncate">{venue.destinationName}</span>
        </p>
        {venue.rating !== null || venue.distanceLabel || notableAccessType(venue) ? (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5">
            {venue.rating !== null ? (
              <RatingBadge compact reviewCount={venue.reviewCount ?? undefined} value={venue.rating} />
            ) : null}
            {venue.distanceLabel ? (
              <span className="text-xs text-on-surface-variant">· {venue.distanceLabel}</span>
            ) : null}
            {notableAccessType(venue) ? <Pill variant="tag">{notableAccessType(venue)}</Pill> : null}
          </div>
        ) : null}
      </div>
    </CardFrame>
  );
}

/** Horizontal card — Search results, Venue Details' Nearby/Similar lists.
 * Same title → location → rating hierarchy as the standard card, laid out
 * as a row (compact photo on the left) for a dense, scannable list rather
 * than a rail. Its own small `LBracketAccent` sits on the thumbnail corner
 * (`CardFrame`'s full-card bracket is turned off via `bracket={false}` so
 * the two don't stack), and the save action moves to a small trailing
 * `IconButton` next to the chevron — a left-edge save button would sit
 * awkwardly mid-row here, unlike the standard card's image-corner slot. */
function HorizontalVenueCard({
  venue,
  saved,
  onToggleSaved,
  areaLabel,
}: {
  venue: Venue;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
  areaLabel: string | null;
}) {
  return (
    <CardFrame bracket={false} className="flex w-full items-center gap-3 p-3" href={`/venues/${venue.id}`}>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl rounded-tr-none bg-cream">
        {venue.coverImageUrl ? (
          <Image alt={venue.name} className="object-cover" fill sizes="64px" src={venue.coverImageUrl} />
        ) : null}
        <LBracketAccent size="sm" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="truncate text-sm font-bold text-on-surface">{venue.name}</h3>
        <p className="flex items-center gap-1 text-xs text-on-surface-variant">
          <Icon className="shrink-0" name="location_on" size={16} />
          <span className="truncate">
            {venue.distanceLabel ? `${venue.destinationName} · ${venue.distanceLabel}` : venue.destinationName}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {venue.rating !== null ? (
            <RatingBadge compact reviewCount={venue.reviewCount ?? undefined} value={venue.rating} />
          ) : null}
          {/* Location Context Label refinement — the venue's own destination
            * name above is never overwritten; this is an additive, visually
            * subordinate badge explaining *why* a venue from a different
            * destination is showing up here. */}
          {areaLabel ? <Pill variant="tag">{areaLabel}</Pill> : null}
          {notableAccessType(venue) ? <Pill variant="tag">{notableAccessType(venue)}</Pill> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          aria-pressed={saved}
          className="h-9 w-9"
          filled={saved}
          icon="bookmark"
          label={saved ? "Remove from saved" : "Save this place"}
          onClick={(event) => {
            event.preventDefault();
            onToggleSaved?.(venue.id);
          }}
          variant={saved ? "accent" : "plain"}
        />
        <Icon className="text-primary" name="chevron_right" size={20} />
      </div>
    </CardFrame>
  );
}

/** Simple flat triangle corner mark — kept only for
 * `components/editorial/FeatureCard.tsx` (Explore's Editor's Picks /
 * Weekend Planner), which is outside the Card System Redesign's scope and
 * still imports this export directly. Not used anywhere in this file
 * anymore — every variant here now uses `LBracketAccent` instead. */
export function CornerAccent() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 right-0 h-4 w-4 bg-accent"
      style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
    />
  );
}

/** Event card — Events list, Home's Upcoming Events rail (non-lead cards;
 * the rail's lead card is `FeaturedSignatureCard` instead, per Home's
 * existing "feature the first card" pattern). Coral appears in exactly one
 * place — the `DateBadge` — per the brief's "small event accent, never the
 * whole card" rule; everything else on this card (frame, bracket, typography)
 * is identical to every other card in the family. No save action: events
 * aren't saveable, so that top-left slot is free for the date instead. */
function EventVariant({ event }: { event: Event }) {
  return (
    <CardFrame className="w-72" href={`/events/${event.slug}`}>
      <div className="relative h-36 bg-cream">
        {event.coverImageUrl ? (
          <Image alt={event.title} className="object-cover" fill sizes="288px" src={event.coverImageUrl} />
        ) : null}
        <DateBadge>{formatEventDateRange(event)}</DateBadge>
        {event.featured ? (
          <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            Featured
          </span>
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base leading-tight font-bold text-on-surface">{event.title}</h3>
          {event.phase ? (
            <span className="shrink-0 rounded-md bg-surface-container px-2 py-1 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
              {EVENT_PHASE_LABEL[event.phase]}
            </span>
          ) : null}
        </div>
        {event.venue || event.destination ? (
          <p className="flex items-center gap-1 text-xs text-on-surface-variant">
            <Icon className="shrink-0" name="location_on" size={16} />
            <span className="truncate">{event.venue?.name ?? event.destination?.name}</span>
          </p>
        ) : null}
      </div>
    </CardFrame>
  );
}
