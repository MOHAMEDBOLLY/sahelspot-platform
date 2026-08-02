import { apiGetList } from "./client";
import type { PublishedDestinationDTO } from "./dto";

export function fetchDestinations(): Promise<PublishedDestinationDTO[]> {
  return apiGetList<PublishedDestinationDTO>("/public/destinations");
}
