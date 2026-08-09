import type { Venue } from "@/lib/domain/venue";

export type MapPoint = { venue: Venue; lng: number; lat: number };

type LocatedVenue = Venue & { coordinates: { lat: number; lng: number } };

const METERS_PER_DEGREE_LAT = 111_320;
const BASE_SPREAD_RADIUS_METERS = 20;
const SPREAD_RADIUS_STEP_METERS = 10;
const MAX_SPREAD_RADIUS_METERS = 80;
/** Venues within this many meters of each other are treated as "the same
 * spot" for spreading purposes. Real-world geocoding for venues inside the
 * same compound/mall routinely scatters by tens of meters even when every
 * venue is genuinely at "the same place" — grouping only exact-duplicate
 * coordinates (the original approach) missed almost all of these in
 * practice, confirmed visually against production data: dense venue
 * clusters still rendered fully stacked. 40m catches that real-world
 * scatter without merging two genuinely distinct, merely-nearby venues
 * (e.g. across a street) into one group. */
const PROXIMITY_THRESHOLD_METERS = 40;

function metersToLatDegrees(meters: number): number {
  return meters / METERS_PER_DEGREE_LAT;
}

function metersToLngDegrees(meters: number, atLatitude: number): number {
  return meters / (METERS_PER_DEGREE_LAT * Math.cos((atLatitude * Math.PI) / 180));
}

/** Equirectangular approximation — accurate enough at the scale this
 * function cares about (tens to low hundreds of meters), much cheaper than
 * haversine, and this only ever runs once per venue-list change (memoized
 * by callers), not per frame. */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const avgLatRad = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLat = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dLng = (a.lng - b.lng) * METERS_PER_DEGREE_LAT * Math.cos(avgLatRad);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Minimal union-find — groups venues transitively: if A is close to B and
 * B is close to C, all three end up in one group even if A and C alone
 * are slightly past the threshold, which is the correct behavior for a
 * scattered compound (the alternative, pairwise-only grouping, would
 * arbitrarily split one real compound into two touching groups). */
class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootA] = rootB;
  }
}

/** Groups venues within `PROXIMITY_THRESHOLD_METERS` of each other and
 * distributes each group evenly around its real centroid, so venues
 * genuinely clustered at the same compound/mall — whether at literally
 * identical coordinates or just geocoded within a few tens of meters of
 * one another, which is the common case — render as distinguishable,
 * individually tappable markers instead of stacking on top of one
 * another. Groups of one are returned untouched.
 *
 * This changes only the *displayed* marker position, by the allowed
 * 20-80m band (growing slightly with group size, capped). `venue.
 * coordinates` itself — what Venue Details, Directions, and every other
 * consumer of a venue's location reads — is never touched; callers still
 * hold the original `Venue` object, this function only supplies where its
 * marker draws on the map. */
export function spreadOverlappingVenues(venues: Venue[]): MapPoint[] {
  const located = venues.filter((venue): venue is LocatedVenue => venue.coordinates !== null);

  const unionFind = new UnionFind(located.length);
  for (let i = 0; i < located.length; i++) {
    for (let j = i + 1; j < located.length; j++) {
      if (distanceMeters(located[i].coordinates, located[j].coordinates) <= PROXIMITY_THRESHOLD_METERS) {
        unionFind.union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  located.forEach((_, index) => {
    const root = unionFind.find(index);
    const group = groups.get(root);
    if (group) group.push(index);
    else groups.set(root, [index]);
  });

  const points: MapPoint[] = [];
  for (const indices of groups.values()) {
    if (indices.length === 1) {
      const venue = located[indices[0]];
      points.push({ venue, lat: venue.coordinates.lat, lng: venue.coordinates.lng });
      continue;
    }
    const centerLat = indices.reduce((sum, i) => sum + located[i].coordinates.lat, 0) / indices.length;
    const centerLng = indices.reduce((sum, i) => sum + located[i].coordinates.lng, 0) / indices.length;
    const radiusMeters = Math.min(
      MAX_SPREAD_RADIUS_METERS,
      BASE_SPREAD_RADIUS_METERS + (indices.length - 1) * SPREAD_RADIUS_STEP_METERS,
    );
    indices.forEach((venueIndex, position) => {
      const angle = (2 * Math.PI * position) / indices.length;
      const dLat = metersToLatDegrees(radiusMeters * Math.sin(angle));
      const dLng = metersToLngDegrees(radiusMeters * Math.cos(angle), centerLat);
      points.push({ venue: located[venueIndex], lat: centerLat + dLat, lng: centerLng + dLng });
    });
  }
  return points;
}
