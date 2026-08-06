"use client";

import Image from "next/image";
import { notFound, useRouter } from "next/navigation";
import { EmptyState } from "@/components/patterns/EmptyState";
import { CTAButton } from "@/components/ui/CTAButton";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEvent } from "@/lib/hooks/useEvent";
import { formatEventDateRange, formatEventTime } from "@/lib/domain/formatEventDate";

const PHASE_LABEL = { upcoming: "Upcoming", live: "Happening now", ended: "Ended" } as const;

/** Events Module v1 — "Event Details" screen. Buy Ticket only renders when
 * `ticketUrl` is a real value (task spec: "Hidden when ticket_url is
 * empty") — there is no disabled placeholder state for it. Related Venue/
 * Destination are plain links to their own existing detail pages/search
 * filter — no new routing concept, reusing what already exists. */
export function EventDetailsClient({ eventSlug }: { eventSlug: string }) {
  const router = useRouter();
  const event = useEvent(eventSlug);

  if (event.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-6 pb-12">
        <Skeleton className="h-64 w-full rounded-none" />
        <div className="space-y-4 px-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (event.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <EmptyState
          action={
            <CTAButton onClick={() => event.refetch()} variant="secondary">
              Retry
            </CTAButton>
          }
          description="We couldn't reach SahelSpot Studio. Check your connection and try again."
          icon="error_outline"
          title="Something went wrong"
        />
      </div>
    );
  }

  if (!event.data) {
    notFound();
  }

  const data = event.data;

  return (
    <div className="mx-auto max-w-md pb-12">
      <div className="relative h-64 w-full bg-cream">
        {data.coverImageUrl ? (
          <Image alt={data.title} className="object-cover" fill sizes="448px" src={data.coverImageUrl} />
        ) : null}
        <div className="absolute top-4 left-4">
          <IconButton icon="arrow_back" label="Go back" onClick={() => router.back()} variant="solid" />
        </div>
        {data.featured ? (
          <span className="absolute top-4 right-4 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-on-accent">
            Featured
          </span>
        ) : null}
      </div>

      <div className="space-y-6 px-4 pt-6">
        <header className="space-y-2">
          <h1 className="text-3xl leading-none font-black tracking-tight text-primary">{data.title}</h1>

          <p className="flex items-center gap-1 font-medium text-on-surface-variant">
            <Icon name="calendar_today" size={18} />
            {formatEventDateRange(data)}
            {data.startTime ? ` · ${formatEventTime(data.startTime)}` : ""}
            {data.endTime ? ` – ${formatEventTime(data.endTime)}` : ""}
          </p>

          {data.phase ? (
            <span className="inline-block rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
              {PHASE_LABEL[data.phase]}
            </span>
          ) : null}
        </header>

        {data.ticketUrl ? (
          <CTAButton fullWidth href={data.ticketUrl} icon="confirmation_number">
            Buy Ticket{data.ticketProvider ? ` — ${data.ticketProvider}` : ""}
          </CTAButton>
        ) : null}

        {data.shortDescription ? (
          <p className="text-sm text-on-surface-variant">{data.shortDescription}</p>
        ) : null}

        {data.venue ? (
          <a
            className="flex items-center justify-between gap-2 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3 shadow-sm transition-colors hover:bg-surface-container"
            href={`/venues/${data.venue.id}`}
          >
            <div className="flex items-center gap-2">
              <Icon className="text-on-surface-variant" name="storefront" size={20} />
              <span className="font-medium text-on-surface">{data.venue.name}</span>
            </div>
            <Icon className="text-primary" name="chevron_right" size={20} />
          </a>
        ) : null}

        {data.destination ? (
          <a
            className="flex items-center justify-between gap-2 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3 shadow-sm transition-colors hover:bg-surface-container"
            href={`/search?destination=${encodeURIComponent(data.destination.id)}`}
          >
            <div className="flex items-center gap-2">
              <Icon className="text-on-surface-variant" name="location_on" size={20} />
              <span className="font-medium text-on-surface">{data.destination.name}</span>
            </div>
            <Icon className="text-primary" name="chevron_right" size={20} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
