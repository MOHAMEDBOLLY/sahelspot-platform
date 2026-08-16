"use client";

import { useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

type TopAppBarProps = {
  /** `greeting` is Home's: greeting line above the SahelSpot wordmark.
   *  `title` is every other root tab's: the screen name alone. */
  variant?: "greeting" | "title";
  /** Wordmark on Home, screen name elsewhere. */
  title: string;
  /** Home only. Static by design — Stitch shows "Good Morning 👋" and defines
   * no time-of-day behaviour, so none is inferred. */
  greeting?: string;
  /** Home Hero/Header Integration — renders the bar as a transparent layer
   * absolutely positioned over whatever sits behind it (Home's hero photo)
   * instead of its own sticky `bg-surface` block, and switches its text/icon
   * color to white so it stays readable over a photograph. Opt-in and used
   * by Home only; every other screen keeps the default sticky bar
   * unchanged. */
  overlay?: boolean;
};

/** Sticky header for root-tab screens, matching the export exactly.
 *
 * The avatar and notification bell have no functionality in v1 — there are no
 * accounts and no notifications — but both are kept at full visual fidelity
 * with their interactions disabled. The bell deliberately does *not* take the
 * dimmed disabled styling used for genuinely disabled actions: the intent is
 * to look identical to Stitch, not to look broken.
 *
 * The two variants differ in more than text: Home's bell is navy and its
 * avatar sits on `primary-container`, while Explore's bell is grey and its
 * avatar carries a hairline ring. Both are reproduced. */
export function TopAppBar({ variant = "title", title, greeting, overlay = false }: TopAppBarProps) {
  // P0.2 (Design & Motion Audit) — replaces a raw `window.addEventListener
  // ("scroll", ...)` with Framer Motion's `useScroll`, which already backs
  // every other motion primitive in this app (`PageTransition`, `Reveal`,
  // `BottomSheet`). `useScroll()` with no target tracks the page's own
  // scrollY, matching the previous `window.scrollY` read exactly; Framer
  // batches the underlying listener through its own rAF-scheduled update
  // loop instead of firing a component callback synchronously on every
  // native scroll event, which is what made the direct listener a
  // main-thread risk. `useMotionValueEvent` subscribes to that same batched
  // stream without re-deriving another window listener of its own.
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 10));

  const isGreeting = variant === "greeting";

  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-20 bg-transparent"
          : `sticky top-0 z-40 transition-shadow duration-300 ${
              scrolled ? "bg-surface/90 shadow-md backdrop-blur-md" : "bg-surface"
            }`
      }
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar bordered={!isGreeting} />
          {isGreeting ? (
            <div>
              <p
                className={`text-xs font-medium ${overlay ? "text-white/90 [text-shadow:0_1px_3px_rgb(0_0_0_/_0.35)]" : "text-on-surface-variant"}`}
              >
                {greeting}
              </p>
              <h1
                className={`font-headline text-xl font-bold tracking-tight ${overlay ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.35)]" : "text-primary"}`}
              >
                {title}
              </h1>
            </div>
          ) : (
            <h1 className="font-headline text-2xl font-black tracking-tight text-primary">{title}</h1>
          )}
        </div>

        {/* Notifications don't exist in v1. The control keeps its designed
          * position and appearance, but is inert and out of the tab order. */}
        <button
          aria-disabled="true"
          aria-label="Notifications (not available yet)"
          className={`flex h-10 w-10 items-center justify-center rounded-full ${
            overlay
              ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.35)]"
              : isGreeting
                ? "text-primary"
                : "text-on-surface-variant"
          }`}
          disabled
          tabIndex={-1}
          type="button"
        >
          <Icon name="notifications" />
        </button>
      </div>
    </header>
  );
}
