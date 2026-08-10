import type { NoQrAreaDTO, NoQrPlaceDTO } from "@/lib/api/dto";
import type { NoQrArea, NoQrPlace } from "@/lib/domain/noQr";

function toNoQrPlace(dto: NoQrPlaceDTO): NoQrPlace {
  return { id: dto.id, name: dto.name, venue: dto.venue };
}

export function toNoQrArea(dto: NoQrAreaDTO): NoQrArea {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    places: dto.places.map(toNoQrPlace),
  };
}
