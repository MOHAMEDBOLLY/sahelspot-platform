"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { posthog } from "@/lib/analytics/posthog";

/** Module-level, not `useRef` — `PageviewTrackerInner` remounts on every
 * client-side navigation (the `useSearchParams()`-in-`Suspense` pattern Next
 * recommends here re-suspends and remounts its subtree on each navigation,
 * confirmed live: a `useRef` reset to empty on every route change). `$pageview`
 * doesn't care since each capture is self-contained, but `$pageleave` needs
 * the previous page's identity to survive the remount, so it lives at module
 * scope instead, same pattern as `initialized` in `lib/analytics/posthog.ts`.
 *
 * `currentPageviewId`/`currentPageviewTimestamp` mirror what PostHog's own
 * automatic pageleave capture tracks internally (`PageViewManager.doPageView`/
 * `doPageLeave` in the installed `posthog-js` SDK, `dist/module.js`): an
 * opaque per-page id and the page's own start time, both stamped on `$pageview`. */
let currentUrl = "";
let currentPathname = "";
let currentPageviewId = "";
let currentPageviewTimestamp = 0;
let hasSentLeaveFor = "";

/** Matches the shape (not the exact algorithm) of the id PostHog's own SDK
 * generates per pageview — any unique-enough string works, since it's opaque
 * correlation data (`$pageview_id`/`$prev_pageview_id`), never displayed or
 * parsed. `crypto.randomUUID` is universally available in this app's target
 * browsers; the fallback only guards a runtime without it. */
function nextPageviewId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** One `$pageview` per actual navigation — the reserved PostHog event name,
 * not a custom one (a prior version of this file sent a custom `page_view`
 * event, which is why PostHog's Installation Health reported `$pageview` as
 * failing despite pageviews genuinely being tracked). `capture_pageview` is
 * `false` in `initPostHog` because this SDK's `"history_change"` autocapture
 * mode doesn't reliably patch `history.pushState` in this environment (see
 * that file's doc comment) — sending `$pageview` manually off
 * `usePathname`/`useSearchParams` covers initial load and every route change
 * including `router.back()`/`router.forward()` and browser back/forward. */
function PageviewTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    // Not routed through the typed `capture()` wrapper in lib/analytics —
    // that wrapper's EventMap is the app's own product-event taxonomy;
    // `$pageview` is PostHog's reserved system event with its own
    // conventions ($current_url), so it's captured directly here. Same
    // "analytics must never break the product" guarantee via try/catch.
    try {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
        pathname,
        search,
      });
    } catch {
      // Deliberately swallowed — analytics failures must never break navigation.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // $pageleave — `capture_pageleave: false` in `initPostHog` disables
  // PostHog's own automatic pageleave (it's tied to `capture_pageview`,
  // which we also don't use — see that file). PostHog's own guidance for
  // this exact situation: a manual `$pageview` needs "a matching $pageleave
  // capture on route changes and page unload". `hasSentLeaveFor` (module
  // state, see top of file) ensures each URL gets exactly one `$pageleave`,
  // whichever fires first — the SPA route change below, or the tab-hide
  // listener — so a route change right after a tab-hide (or vice versa)
  // never double-sends for the same URL.
  //
  // Payload mirrors PostHog's own automatic pageleave (`PageViewManager.mi()`
  // in `posthog-js`'s `dist/module.js`): `$prev_pageview_id`/`_pathname`
  // identify which pageview this leave belongs to, and `$prev_pageview_duration`
  // — seconds, `(leaveTime - pageviewTime) / 1000`, same division the SDK
  // itself uses — is what PostHog's session-duration/bounce-rate math reads.
  useEffect(() => {
    const previousUrl = currentUrl;
    const previousPathname = currentPathname;
    const previousPageviewId = currentPageviewId;
    const previousPageviewTimestamp = currentPageviewTimestamp;
    if (previousUrl && previousUrl !== window.location.href && hasSentLeaveFor !== previousUrl) {
      try {
        posthog.capture("$pageleave", {
          $current_url: previousUrl,
          $prev_pageview_pathname: previousPathname,
          $prev_pageview_id: previousPageviewId,
          $prev_pageview_duration: (Date.now() - previousPageviewTimestamp) / 1000,
        });
        hasSentLeaveFor = previousUrl;
      } catch {
        // Deliberately swallowed — analytics failures must never break navigation.
      }
    }
    // Recorded for the page now being entered — read back by both the next
    // route-change leave and the visibilitychange leave below.
    currentUrl = window.location.href;
    currentPathname = pathname;
    currentPageviewId = nextPageviewId();
    currentPageviewTimestamp = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && currentUrl && hasSentLeaveFor !== currentUrl) {
        try {
          posthog.capture("$pageleave", {
            $current_url: currentUrl,
            $prev_pageview_pathname: currentPathname,
            $prev_pageview_id: currentPageviewId,
            $prev_pageview_duration: (Date.now() - currentPageviewTimestamp) / 1000,
          });
          hasSentLeaveFor = currentUrl;
        } catch {
          // Deliberately swallowed — analytics failures must never break navigation.
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

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
