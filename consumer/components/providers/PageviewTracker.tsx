"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { capture } from "@/lib/analytics/analytics";

/** One `page_view` per actual navigation — App Router client-side routing
 * doesn't fire a browser `load`/navigation event PostHog's own autocapture
 * could hook into (see `initPostHog`'s `capture_pageview: false`), so this
 * fires manually off `usePathname`/`useSearchParams`, which update on every
 * route change including `router.back()`/`router.forward()` and browser
 * back/forward — not just on mount. */
function PageviewTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    capture("page_view", { pathname, search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return null;
}

/** `useSearchParams` requires a Suspense boundary to prerender — same
 * constraint `SearchClient` already works around for the same reason. */
export function PageviewTracker() {
  return (
    <Suspense fallback={null}>
      <PageviewTrackerInner />
    </Suspense>
  );
}
