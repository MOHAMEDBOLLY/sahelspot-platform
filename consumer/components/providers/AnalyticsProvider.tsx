"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/analytics/posthog";

/** Initializes PostHog exactly once per page load — `initPostHog` itself is
 * idempotent (an `initialized` module flag), but this still runs the call
 * inside `useEffect` rather than at module scope so it never executes
 * during SSR/RSC rendering, only after the client has mounted. */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <>{children}</>;
}
