"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sahelspot:recent-searches";
const MAX_ENTRIES = 5;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(entries: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Recent search terms — device-local only, same "device preference, not
 * user data" category as the Saved repository and the onboarding-seen flag
 * (docs/consumer/ARCHITECTURE.md §4). Simpler than `SavedRepository`
 * deliberately: nothing here is ever meant to sync to an account, so the
 * interface/implementation split that lets Saved swap to a future backend
 * has no purpose for this data. */
export function useRecentSearches() {
  const [entries, setEntries] = useState<string[]>([]);

  useEffect(() => {
    setEntries(read());
  }, []);

  const add = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setEntries((prev) => {
      const next = [trimmed, ...prev.filter((entry) => entry !== trimmed)].slice(0, MAX_ENTRIES);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    write([]);
  }, []);

  return { recentSearches: entries, addRecentSearch: add, clearRecentSearches: clear };
}
