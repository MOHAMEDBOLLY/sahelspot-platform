import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "@/lib/api/events";
import { toEvent } from "@/lib/domain/mappers/event";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const dtos = await fetchEvents();
      return dtos.map(toEvent);
    },
  });
}
