"use client";

import { useCallback, useEffect, useState } from "react";
import { savedRepository } from "./repository";
import { capture } from "@/lib/analytics/analytics";

/** The only way any component touches saved state — no component imports
 * `savedRepository` or the storage key directly. Mirrors the repository's ids
 * into local state and subscribes for changes made elsewhere (another tab,
 * a future sync implementation). */
export function useSaved() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    savedRepository.list().then((list) => {
      if (!cancelled) setIds(list);
    });
    const unsubscribe = savedRepository.subscribe((next) => {
      if (!cancelled) setIds(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const isSaved = useCallback((venueId: string) => ids.includes(venueId), [ids]);

  // Centralized here rather than at each `onToggleSaved` call site — every
  // caller (VenueCard, VenueDetailsClient) already funnels through this one
  // `toggle`, so this is the single place a favorite state change actually
  // happens, guaranteeing one user action produces exactly one event. Only
  // `venue_id` is available at this layer — the hook only ever deals in ids,
  // never full `Venue` objects — so `venue_name`/`destination`/`category`
  // aren't sent rather than fabricated.
  const toggle = useCallback(
    async (venueId: string) => {
      if (ids.includes(venueId)) {
        await savedRepository.remove(venueId);
        capture("favorite_remove", { venue_id: venueId });
      } else {
        await savedRepository.add(venueId);
        capture("favorite_add", { venue_id: venueId });
      }
    },
    [ids],
  );

  return { savedIds: ids, isSaved, toggle };
}
