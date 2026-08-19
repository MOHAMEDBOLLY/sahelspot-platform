"use client";

import posthog from "posthog-js";

let initialized = false;

/** Gated purely on `NEXT_PUBLIC_POSTHOG_KEY` being set — no separate
 * production/development branch. A dev pointing `.env.local` at a PostHog
 * dev project gets tracking locally without polluting the prod project; an
 * environment with no key configured (e.g. CI, a contributor without
 * credentials) simply never initializes and every `capture()` call below is
 * a silent no-op. `capture_pageview: false` — verified live (Aug 2026 QA)
 * that this SDK's `capture_pageview: "history_change"` extension does not
 * reliably patch `history.pushState` in this environment (confirmed via
 * `historyAutocapture.isEnabled === true` yet `history.pushState` staying the
 * untouched native function after real navigations and a manual
 * `pushState()` call — zero `$pageview` events resulted). `PageviewTracker`
 * sends `$pageview` manually instead, which is fully supported by PostHog
 * for exactly this "autocapture doesn't fit my router" case and was proven
 * reliable in the same testing (one event per navigation, zero misses). */
export function initPostHog() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,
    // Disabled for the same reason as capture_pageview: PostHog ties its own
    // automatic $pageleave to capture_pageview, so it never fires here
    // either. `PageviewTracker` sends $pageleave manually alongside its
    // manual $pageview — PostHog's documented pattern for this exact case.
    capture_pageleave: false,
    // No accounts in v1 (Consumer is Public API only, no auth) — every
    // visitor stays anonymous. "always" still creates a person profile per
    // anonymous device so visitor/session counts are meaningful without
    // ever calling `posthog.identify()`.
    person_profiles: "always",
  });
  initialized = true;
}

export { posthog };
