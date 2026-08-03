import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Event } from "@/lib/domain/event";
import { formatEventDateRange } from "@/lib/domain/formatEventDate";

type EventCardProps = {
  event: Event;
};

const PHASE_LABEL: Record<NonNullable<Event["phase"]>, string> = {
  upcoming: "Upcoming",
  live: "Happening now",
  ended: "Ended",
};

/** Events Module v1 — one card variant, adapted from `VenueCard`'s
 * `vertical-lg` layout (rounded-3xl, h-48 image). No saved/rating rows —
 * neither concept exists for events yet. */
export function EventCard({ event }: EventCardProps) {
  return (
    <Link
      className="card-hover-lift block overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-lowest shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      href={`/events/${event.slug}`}
    >
      <div className="relative h-48 bg-cream">
        {event.coverImageUrl ? (
          <Image alt={event.title} className="object-cover" fill sizes="280px" src={event.coverImageUrl} />
        ) : null}
        {event.featured ? (
          <span className="absolute top-3 left-3 rounded-full bg-tertiary px-2.5 py-1 text-xs font-bold text-on-tertiary">
            Featured
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg leading-tight font-bold text-on-surface">{event.title}</h3>
          <p className="flex items-center gap-1 text-sm text-on-surface-variant">
            <Icon className="shrink-0" name="calendar_today" size={16} />
            <span className="truncate">{formatEventDateRange(event)}</span>
          </p>
          {event.venue || event.destination ? (
            <p className="flex items-center gap-1 text-sm text-on-surface-variant">
              <Icon className="shrink-0" name="location_on" size={16} />
              <span className="truncate">{event.venue?.name ?? event.destination?.name}</span>
            </p>
          ) : null}
        </div>
        {event.phase ? (
          <span className="inline-block rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
            {PHASE_LABEL[event.phase]}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
