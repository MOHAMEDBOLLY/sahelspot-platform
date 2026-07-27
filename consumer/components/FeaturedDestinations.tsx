import { fetchPublishedDestinations } from "@/lib/api";

// No `is_featured` concept exists for destinations (unlike venues), and
// there's no pagination/search yet — capped to keep the homepage grid the
// same shape M3 established, not an unbounded list of everything published.
const MAX_DESTINATIONS = 4;

export async function FeaturedDestinations() {
  let destinations: Awaited<ReturnType<typeof fetchPublishedDestinations>> = [];
  let unavailable = false;

  try {
    destinations = (await fetchPublishedDestinations()).slice(0, MAX_DESTINATIONS);
  } catch {
    unavailable = true;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
        Featured Destinations
      </h2>

      {unavailable && (
        <p className="mt-6 text-sm text-gray-500">Destinations are unavailable right now.</p>
      )}

      {!unavailable && destinations.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">No destinations published yet.</p>
      )}

      {!unavailable && destinations.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((destination) => (
            <div key={destination.id} className="overflow-hidden rounded-lg border border-gray-200">
              <div className="aspect-video bg-gray-100" />
              <div className="p-4">
                <p className="font-medium text-gray-900">{destination.name}</p>
                <p className="text-sm text-gray-500">{destination.region}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
