"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { ROOT_TABS, isTabActive } from "@/lib/navigation";

/** The 5-tab root navigation.
 *
 * Rendered only by the root-tab layout, never by a screen. That is what makes
 * approved decision 6 structural rather than a convention: a pushed detail
 * screen lives in the `(push)` route group, which has no BottomNav in its
 * layout, so it cannot show one by accident. The Stitch Venue Details export
 * does show one — with *Explore* marked active, on a venue page — which is
 * exactly the class of bug this prevents.
 *
 * Dock Integration (SAHELSPOT CONSUMER — DOCK INTEGRATION) — an evolution of
 * this exact component, not a second navigation system. A provided
 * Apple-style `Dock` demo (mouse-`pageX`-proximity magnification, a
 * `DockProvider`/context, `role="button"` item wrappers, gray/dark-mode
 * styling) was the brief; it was deliberately **not** ported literally:
 *
 * 1. Mouse-proximity magnification has no equivalent on a touch device —
 *    there is no continuous pointer position to magnify around on mobile,
 *    and this app's primary targets are 390×844/393×852. Porting it as-is
 *    would ship dead code to every real user of a mobile-first product.
 * 2. Its `DockItem` is a `tabIndex=0 role="button"` `<div>`, not a link —
 *    exactly what this task's own accessibility section says not to use
 *    "if proper `<a>`/Next.js navigation semantics are more appropriate."
 *    They are: these are real routes, so this stays `<Link>`-based.
 * 3. Running both would mean two navigation systems live at once, which the
 *    brief explicitly rules out ("do not leave the old navigation and the
 *    new Dock active simultaneously").
 *
 * What *is* taken from the Dock concept: a floating rounded pill container
 * (was full-bleed `inset-x-0`) and a spring-based per-item scale — replayed
 * off the route's active state instead of cursor position, which is the
 * touch-appropriate analogue of "the icon nearest the interaction gets
 * bigger." `framer-motion` is already a project dependency (used by
 * `PageTransition`/`Reveal`/`BottomSheet`), so this reuses it rather than
 * adding anything. The existing sliding lime dot indicator (CSS, unchanged)
 * still owns "which tab is active" — the spring scale sits alongside it,
 * not in place of it, per the brief's "integrate the Dock interaction
 * around it" instruction.
 *
 * Above `md` this is replaced by a top nav (Phase 11); until then it is
 * mobile-only chrome. */
export function BottomNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <nav
        aria-label="Main"
        // Visual Richness pass's warm-charcoal-tinted shadow language reused
        // here (same token family as `CardFrame`'s resting shadow, COLOR
        // SYSTEM V2 — was navy) — the pill reads as one more "physical
        // surface" in this interface, not a one-off. `max-w-full` + no
        // fixed width: five `min-w-12` items plus gaps naturally fit
        // 390–393px viewports with room to spare; verified at both, and on
        // desktop where the pill just centers with more surrounding
        // whitespace instead of stretching edge-to-edge like the previous
        // full-bleed bar did.
        className="flex max-w-full items-center gap-1 rounded-full border border-outline-variant/15 bg-surface-container-lowest px-2 py-2 shadow-[0_8px_28px_-6px_rgb(46_42_37_/_0.18)]"
      >
        {ROOT_TABS.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              // Explicit aria-label, not name-from-content — same reasoning as
              // CategoryChip: the icon glyph's ligature text sits right next
              // to the visible label, and that shape is unreliable across
              // accessible-name implementations.
              aria-label={tab.label}
              className={`relative flex h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-full px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                active ? "text-primary" : "text-on-surface-variant opacity-70 hover:opacity-100"
              }`}
              href={tab.href}
              key={tab.href}
            >
              {/* Sliding active-indicator — unchanged from the previous
                * pass, still the single source of truth for "which tab is
                * active" visually. */}
              <span
                aria-hidden="true"
                className={`absolute top-0 h-1 w-1 rounded-full bg-accent transition-all duration-200 ease-out ${
                  active ? "scale-100 opacity-100" : "scale-0 opacity-0"
                }`}
              />
              {/* The Dock-derived touch: a restrained spring scale/lift on
                * the active tab's icon (1 → 1.12, -2px) instead of the
                * demo's cursor-magnification — and a quick spring press on
                * every tap, replacing the plain CSS `active:scale-90` this
                * element used before. `useReducedMotion` swaps both to
                * static end-states rather than zero-duration springs, on
                * top of (not instead of) the blanket CSS override in
                * globals.css, matching every other Framer usage in this
                * app (`Reveal`, `PageTransition`, `HomeHero`). */}
              <motion.span
                animate={reduceMotion ? undefined : { scale: active ? 1.12 : 1, y: active ? -2 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                whileTap={reduceMotion ? undefined : { scale: 0.88 }}
              >
                <Icon filled={active} name={tab.icon} />
              </motion.span>
              <span className="text-xs font-medium transition-colors duration-200">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
