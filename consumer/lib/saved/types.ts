/** Storage-agnostic contract for "which venue ids has this visitor saved."
 *
 * Named for what it does, not how it's implemented today — v1's only
 * implementation happens to be device-local, but nothing outside this file
 * should know that. A future authenticated implementation (a real backend,
 * synced across devices) satisfies this exact interface and is swapped in
 * without touching `useSaved` or any component.
 *
 * Only venue *ids* ever live here. Venue content always comes from
 * `/public/venues` through the domain layer — this repository is not a
 * second content data source, it's a list of references into the first one. */
export interface SavedRepository {
  list(): Promise<string[]>;
  has(venueId: string): Promise<boolean>;
  add(venueId: string): Promise<void>;
  remove(venueId: string): Promise<void>;
  /** Fires with the current id list on every change, including changes made
   * from another tab (`storage` event) for the localStorage implementation.
   * Returns an unsubscribe function. */
  subscribe(fn: (ids: string[]) => void): () => void;
}
