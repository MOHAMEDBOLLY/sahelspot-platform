"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/patterns/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { CTAButton } from "@/components/ui/CTAButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { EventCard } from "@/components/event/EventCard";
import { useEvents } from "@/lib/hooks/useEvents";

/** Events Module v1 — the "Events List" screen the task requires. Same
 * loading/error/empty states every other data-backed screen in this app
 * already follows (Home, Search). Only Approved events ever reach here —
 * that's guaranteed by `/public/events` reading the frozen publish
 * snapshot, not a filter this page applies itself. */
export function EventsListClient() {
  const router = useRouter();
  const events = useEvents();

  return (
    <div className="min-h-dvh pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-surface p-4">
        <IconButton icon="arrow_back" label="Go back" onClick={() => router.back()} variant="plain" />
        <h1 className="text-xl font-bold text-primary">Events</h1>
      </header>

      <main className="space-y-4 px-4">
        {events.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : events.isError ? (
          <EmptyState
            action={
              <CTAButton onClick={() => events.refetch()} variant="secondary">
                Retry
              </CTAButton>
            }
            description="We couldn't reach SahelSpot Studio. Check your connection and try again."
            icon="error_outline"
            title="Something went wrong"
          />
        ) : (events.data?.length ?? 0) === 0 ? (
          <EmptyState
            description="Published events will appear here."
            icon="calendar_today"
            title="No events yet"
          />
        ) : (
          events.data?.map((event) => <EventCard event={event} key={event.id} />)
        )}
      </main>
    </div>
  );
}
