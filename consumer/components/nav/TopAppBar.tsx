"use client";

import { useEffect, useState } from "react";

type TopAppBarProps = {
  /** Screen title. Home shows the "SahelSpot" wordmark; other tabs show their
   * own name ("Explore", "Saved", "More"). */
  title: string;
  /** `lg` is Home's wordmark treatment; `md` is the plain screen title. */
  size?: "md" | "lg";
};

/** Sticky header for root-tab screens.
 *
 * The avatar and notification bell present in the Stitch export are omitted:
 * v1 has no user accounts and no notifications, so both are controls with
 * nothing behind them. Everything else — sticky positioning, the blur+shadow
 * that fades in past 10px of scroll — matches the export.
 *
 * The scroll listener is passive and only flips a boolean, so it does no work
 * per frame beyond the class toggle. */
export function TopAppBar({ title, size = "md" }: TopAppBarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-shadow duration-300 ${
        scrolled ? "bg-surface/90 shadow-md backdrop-blur-md" : "bg-surface"
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <h1
          className={`font-bold tracking-tight text-primary ${
            size === "lg" ? "text-xl" : "text-2xl font-black"
          }`}
        >
          {title}
        </h1>
      </div>
    </header>
  );
}
