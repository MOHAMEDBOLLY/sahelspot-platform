import { useQuery } from "@tanstack/react-query";
import { fetchNoQrAreas } from "@/lib/api/noQr";
import { toNoQrArea } from "@/lib/domain/mappers/noQr";

export function useNoQrAreas() {
  return useQuery({
    queryKey: ["no-qr-areas"],
    queryFn: async () => {
      const dtos = await fetchNoQrAreas();
      return dtos.map(toNoQrArea);
    },
  });
}
