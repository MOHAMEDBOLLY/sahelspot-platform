"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sahelspot:onboarding-seen";

/** Device-local flag, same "preference, not user data" category as Saved and
 * recent searches. First-launch-only per the spec; there is deliberately no
 * auto-redirect wired from Home to this route yet — see
 * `docs/consumer/ROADMAP.md`'s open decisions for why that's flagged rather
 * than assumed. */
export function useOnboardingSeen() {
  const [seen, setSeen] = useState(true); // default true avoids a flash before the effect runs

  useEffect(() => {
    setSeen(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const markSeen = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setSeen(true);
  }, []);

  return { seen, markSeen };
}
