import { fetchPublishedVenues } from "@/lib/api";
import { VenueCard } from "./VenueCard";

// Mirrors the real `is_featured` flag venues actually have (destinations
// have no equivalent — see FeaturedDestinations.tsx). Capped for the same
// "keep the M3 grid shape" reason, not a real pagination limit.
const MAX_VENUES = 6;

export async function FeaturedVenues() {
  let venues: Awaited<ReturnType<typeof fetchPublishedVenues>> = [];
  let unavailable = false;

  try {
    const allVenues = await fetchPublishedVenues();
    venues = allVenues.filter((venue) => venue.is_featured).slice(0, MAX_VENUES);
  } catch {
    unavailable = true;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
        Featured Venues
      </h2>

      {unavailable && (
        <p className="mt-6 text-sm text-gray-500">Venues are unavailable right now.</p>
      )}

      {!unavailable && venues.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No featured venues published yet.</p>
      )}

      {!unavailable && venues.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </div>
  );
}
