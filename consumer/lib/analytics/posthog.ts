"use client";

import posthog from "posthog-js";

let initialized = false;

/** Gated purely on `NEXT_PUBLIC_POSTHOG_KEY` being set — no separate
 * production/development branch. A dev pointing `.env.local` at a PostHog
 * dev project gets tracking locally without polluting the prod project; an
 * environment with no key configured (e.g. CI, a contributor without
 * credentials) simply never initializes and every `capture()` call below is
 * a silent no-op. `capture_pageview: false` because page views are sent
 * manually from `PageviewTracker` — the App Router doesn't emit a
 * navigation event PostHog's own autocapture can hook into. */
export function initPostHog() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,
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
