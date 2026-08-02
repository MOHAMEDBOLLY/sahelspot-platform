"use client";

import { useCallback, useEffect, useState } from "react";
import { savedRepository } from "./repository";

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

  const toggle = useCallback(
    async (venueId: string) => {
      if (ids.includes(venueId)) {
        await savedRepository.remove(venueId);
      } else {
        await savedRepository.add(venueId);
      }
    },
    [ids],
  );

  return { savedIds: ids, isSaved, toggle };
}
