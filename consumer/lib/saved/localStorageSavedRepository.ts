import type { SavedRepository } from "./types";

const STORAGE_KEY = "sahelspot:saved-venue-ids";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Corrupt or inaccessible storage degrades to "nothing saved" rather
    // than throwing — this is device preference state, not content, so
    // losing it is recoverable and shouldn't break the screen.
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/** The v1 implementation of `SavedRepository`: `localStorage`, one JSON array
 * of venue ids, no account, no network, no sync. Every method is async
 * despite being synchronous under the hood — the interface is written for
 * whatever replaces this later, not for what this implementation happens to
 * need today. */
export class LocalStorageSavedRepository implements SavedRepository {
  private listeners = new Set<(ids: string[]) => void>();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY) this.notify();
      });
    }
  }

  private notify(): void {
    const ids = readIds();
    for (const listener of this.listeners) listener(ids);
  }

  async list(): Promise<string[]> {
    return readIds();
  }

  async has(venueId: string): Promise<boolean> {
    return readIds().includes(venueId);
  }

  async add(venueId: string): Promise<void> {
    const ids = readIds();
    if (!ids.includes(venueId)) {
      // Prepended, not appended — `useSaved`/`SavedClient` treat this list
      // as most-recently-saved-first for the "recent" sort.
      writeIds([venueId, ...ids]);
      this.notify();
    }
  }

  async remove(venueId: string): Promise<void> {
    const ids = readIds();
    const next = ids.filter((id) => id !== venueId);
    if (next.length !== ids.length) {
      writeIds(next);
      this.notify();
    }
  }

  subscribe(fn: (ids: string[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
