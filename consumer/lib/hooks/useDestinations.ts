import { useQuery } from "@tanstack/react-query";
import { fetchDestinations } from "@/lib/api/destinations";
import { toDestination } from "@/lib/domain/mappers/destination";

export function useDestinations() {
  return useQuery({
    queryKey: ["destinations"],
    queryFn: async () => {
      const dtos = await fetchDestinations();
      return dtos.map(toDestination);
    },
  });
}
