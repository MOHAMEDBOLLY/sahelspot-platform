import { useQuery } from "@tanstack/react-query";
import { fetchEvent } from "@/lib/api/events";
import { toEvent } from "@/lib/domain/mappers/event";

/** `data === null` (fetched, but doesn't exist or isn't published) vs.
 * `isError` (the request itself failed) stays distinct, same reasoning
 * `useVenue` already documents. Keyed by slug — the public lookup is
 * slug-based, not id-based (see `fetchEvent`). */
export function useEvent(eventSlug: string) {
  return useQuery({
    queryKey: ["event", eventSlug],
    queryFn: async () => {
      const dto = await fetchEvent(eventSlug);
      return dto ? toEvent(dto) : null;
    },
  });
}
