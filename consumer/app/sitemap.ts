import type { MetadataRoute } from "next";
import { fetchVenues } from "@/lib/api/venues";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sahelspot.com";

const STATIC_ROUTES = ["/", "/explore", "/map", "/search", "/saved", "/more", "/about"];

/** Runs server-side at build/request time, so this reaches `/public/venues`
 * directly — no browser CORS involved. Only real published venues are
 * listed; if the fetch fails, the sitemap degrades to the static routes
 * rather than failing the whole route (a missing sitemap update is much
 * less bad than a 500 on `/sitemap.xml`). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  try {
    const venues = await fetchVenues();
    const venueEntries: MetadataRoute.Sitemap = venues.map((venue) => ({
      url: `${SITE_URL}/venues/${venue.id}`,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...staticEntries, ...venueEntries];
  } catch {
    return staticEntries;
  }
}
