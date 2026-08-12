import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** The L-shaped accent bracket — SahelSpot's one signature card detail: two
 * lime border lines in a card's top-right corner. Kept unchanged by the
 * Card System Redesign (SAHELSPOT CONSUMER — CARD SYSTEM REDESIGN ONLY):
 * evaluated honestly against the brief's "keep it only if it's still
 * valuable" test, and it earns its place — cheap, distinctive, ownable,
 * costs nothing in scannability. `HomeHero` also renders this directly (the
 * Hero is locked, out of this task's scope), so its size values and prop
 * shape are untouched here. `size="lg"` is the full-card treatment,
 * `size="sm"` the thumbnail treatment. */
export function LBracketAccent({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 right-0 z-10 border-accent ${
        size === "sm" ? "h-3.5 w-3.5 border-t-2 border-r-2" : "h-8 w-8 border-t-4 border-r-4"
      }`}
    />
  );
}

/** The shared card shell — Card System Redesign. Replaces the previous
 * `SignatureCard` + `OverlapPanel` construction (a floating white panel
 * pulled up over the image by a negative margin) with a flat card: image on
 * top, content directly below it, no overlap math, no second shadow layer.
 * Evaluated honestly per the brief rather than preserved by default — the
 * overlap panel was a distinctive flourish, but it added a layer of visual
 * complexity (float, negative margin, its own shadow, a bottom filler strip
 * just to close the silhouette past it) without helping scannability, and
 * UI/UX Pro Max's own style research favors exactly this flatter
 * Apple/Bento-style card construction (generous single radius, one soft
 * shadow, content directly below the image) for "premium, clean, easy to
 * scan." The sharp-top-right corner + `LBracketAccent` — the part of the old
 * construction that actually reads as "SahelSpot," not generic — is kept.
 *
 * `href` renders the whole card as one `Link`; children render below the
 * image area the caller composes itself (this component only owns the
 * outer frame, not the internal image/content split, since that differs
 * meaningfully between the standard, horizontal, and featured cards). */
export function CardFrame({
  className = "",
  href,
  /** `false` for the horizontal card: its own thumbnail carries a small
   * `LBracketAccent` in the image corner (matching the standard card's
   * "bracket sits on the photo" reading), so the frame's own full-card
   * bracket would otherwise double up above the metadata instead. */
  bracket = true,
  children,
}: {
  className?: string;
  href: string;
  bracket?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      // Motion & Micro-Interactions Upgrade, item 5 — "the card should feel
      // like one physical object": a single `transition-all` on the outer
      // frame drives press (scale down to ~0.98 + shadow drops away, as if
      // pressed into the surface) and desktop hover (a hairline lift +
      // slightly stronger shadow) together, rather than animating the
      // image/title/metadata independently. `ease-[cubic-bezier(...)]` is a
      // gentle back-out curve — the closest a single CSS transition gets to
      // "spring-like" for a change this small (0.98 → 1), without reaching
      // for Framer Motion on every card in every rail, which would cost far
      // more than this correction is worth. `md:hover:` scopes the lift to
      // pointer-capable/desktop viewports only — mobile keeps just the
      // press state, so touch never sees a lingering "hover" after a tap.
      //
      // Visual Richness / Art Direction Pass, item 4 — the resting/hover
      // shadows are navy-tinted (`rgb(13 59 102 / …)`), not generic black:
      // a "physical surface" reads as sitting in *this* interface's light,
      // not a default browser shadow. Kept soft and low-opacity on purpose
      // (8–16% alpha, wide/soft blur) — a "richer" shadow here means more
      // believable, not more visible. Border bumped 10% → 14% opacity for a
      // touch more definition against the light background, still a
      // hairline, not a stroke.
      className={`relative block shrink-0 snap-start overflow-hidden rounded-3xl rounded-tr-none border border-outline-variant/[0.14] bg-surface-container-lowest shadow-[0_2px_10px_-2px_rgb(13_59_102_/_0.08)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.98] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 md:hover:-translate-y-0.5 md:hover:shadow-[0_10px_28px_-6px_rgb(13_59_102_/_0.18)] ${className}`}
      href={href}
    >
      {bracket ? <LBracketAccent size="lg" /> : null}
      {children}
    </Link>
  );
}

/** The save/bookmark control — Card System Redesign. Replaces the previous
 * `BookmarkTab` (a wide accent-filled pill flush to the card's left edge)
 * with a small circular icon button, sized close to the 44×44 touch-target
 * guideline rather than a wide decorative shape. Unsaved = a plain navy
 * icon on a translucent white circle (an obvious but quiet affordance);
 * saved = a filled lime circle, the brief's own "selected/highlight state"
 * use for the accent color — the save action is the one place on a card
 * where lime is used as a fill, and only in its active state. */
export function SaveButton({
  venueId,
  saved,
  onToggleSaved,
  className = "absolute top-3 left-3",
}: {
  venueId: string;
  saved: boolean;
  onToggleSaved?: (venueId: string) => void;
  className?: string;
}) {
  return (
    <button
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save this place"}
      className={`z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        saved ? "bg-accent text-on-accent" : "bg-white/90 text-primary backdrop-blur-sm"
      } ${className}`}
      onClick={(event) => {
        event.preventDefault();
        onToggleSaved?.(venueId);
      }}
      type="button"
    >
      <Icon filled={saved} name="bookmark" size={18} />
    </button>
  );
}

/** Small solid-coral date marker — Card System Redesign. The one place coral
 * appears on a card, per the brief's explicit "small date badge, not the
 * whole card" rule for Events. Occupies the same top-left image slot
 * `SaveButton` uses on venue cards — events aren't saveable, so that slot is
 * otherwise empty rather than contested. Formatted date text is passed in by
 * the caller (`formatEventDateRange`, unchanged) — this component only owns
 * the chip's shape and color, not date logic. */
export function DateBadge({
  children,
  className = "absolute top-3 left-3",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`z-10 inline-flex items-center rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-white shadow-sm ${className}`}
    >
      {children}
    </span>
  );
}
