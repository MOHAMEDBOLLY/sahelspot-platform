import { apiGetList } from "./client";
import type { NoQrAreaDTO } from "./dto";

/** No QR Independent Entity — reads `/public/discover/no-qr-areas`, the
 * `no_qr_areas`/`no_qr_places` projection, never the legacy
 * `/public/discover/no-qr` (Venue `access_type`-based, unrelated model). */
export function fetchNoQrAreas(): Promise<NoQrAreaDTO[]> {
  return apiGetList<NoQrAreaDTO>("/public/discover/no-qr-areas");
}
