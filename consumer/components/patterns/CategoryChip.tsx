import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

type CategoryChipOwnProps = {
  label: string;
  /** Material Symbols glyph name — the one icon language this app uses.
   * No emoji alternative: production UI carries zero emoji, enforced here
   * by this prop being the only way to put a glyph in the tile at all. */
  icon: string;
  /** Category Button Redesign (Home) — `"surface"` (default, every
   * pre-existing caller: Search's Popular Categories, the hidden Essential
   * Services grid) keeps today's look byte-for-byte: opaque white tile,
   * solid border, `shadow-sm`. `"dock"` is opt-in, used only by
   * `DockCategoryRail` (Home's "What do you want to do?" rail) — a
   * premium glass-*inspired* surface: translucent fill (70% white, up
   * from an earlier 55% pass that read as barely-there against this
   * page's flat, textureless cream background — confirmed via live
   * computed-style inspection, not assumed) + `backdrop-blur-md`, a more
   * visible translucent border, a soft layered shadow (elevation, not a
   * dark drop shadow), and a faint inset top highlight so the tile reads
   * as a thin glass surface catching light. Pressed state goes more
   * opaque/darker, never lime. */
  variant?: "surface" | "dock";
};

type CategoryChipProps = CategoryChipOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CategoryChipOwnProps>;

/** Square white tile + icon + uppercase label — Home's mood grid
 * (`grid-cols-5`) and Search's Popular Categories. Surface moved from cream
 * to pure white with a subtle border and soft shadow (2026-08-06 polish
 * pass) as the first step toward a future Glass/Soft 3D card language —
 * deliberately restrained today (no blur, transparency, or glow).
 *
 * Home's square tile is canonical over Explore's circular Quick Browse
 * chip — the audit resolved that shape conflict in Home's favour, and
 * `QuickBrowseChip` is the separate component for Explore's own shape. */
export function CategoryChip({
  label,
  icon,
  variant = "surface",
  className = "",
  ...props
}: CategoryChipProps) {
  return (
    <button
      // Explicit aria-label rather than relying on name-from-content: the
      // icon's glyph ligature text ("restaurant", "coffee", ...) sits right
      // next to the visible label inside the same button, and accessible-
      // name computation across browsers/assistive tech is inconsistent
      // about excluding aria-hidden siblings cleanly in that shape. Every
      // other icon-bearing control in this app takes an explicit label for
      // the same reason (see IconButton); this one relied on implicit
      // text-content naming and is the exception, not the pattern.
      aria-label={label}
      // `w-full`: without an explicit width, a `flex` element sizes to fit
      // its own content (shrink-to-fit) rather than filling its parent —
      // harmless where the parent is a CSS Grid cell (Grid already stretches
      // items by default, e.g. Search's Popular Categories), but load-
      // bearing wherever the parent is a plain flex row of fixed-width
      // columns (Home's Activities rail): without it, every chip's icon
      // square silently shrinks or grows to match its own label's text
      // width instead of the intended uniform size.
      className={`group flex w-full flex-col items-center gap-2 focus-visible:outline-none ${className}`}
      type="button"
      {...props}
    >
      <span
        className={`flex aspect-square w-full items-center justify-center border transition-all duration-150 group-focus-visible:ring-2 group-focus-visible:ring-primary/20 ${
          variant === "dock"
            ? // Premium glass-inspired, not "slightly lighter cream": a
              // 70%-opacity white fill (up from 55%, the threshold where
              // it stopped disappearing into this page's flat cream
              // background in live testing) over `backdrop-blur-md`, a
              // clearly-visible-but-still-translucent border, and a
              // layered shadow — an inset top highlight (the thin-glass
              // "catching light" cue) plus a soft warm-charcoal-tinted
              // elevation shadow (COLOR SYSTEM V2 — was navy), neither
              // one a dark drop shadow or a glow.
              // `rounded-lg` (16px, this app's own scale) stays well
              // short of the shared tile's `rounded-xl` (24px, which
              // reads almost circular at this size).
              "rounded-lg border-white/70 bg-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_4px_12px_-4px_rgba(46,42,37,0.18)] backdrop-blur-md group-active:scale-95 group-active:border-white/90 group-active:bg-white/90"
            : "rounded-xl border-outline-variant/15 bg-surface-container-lowest shadow-sm group-hover:bg-primary-container group-active:scale-95"
        }`}
      >
        <Icon className="text-primary" name={icon} size={variant === "dock" ? 24 : 22} />
      </span>
      {/* `min-h-[26px]` reserves room for two lines at this size/leading —
       * a one-word label (one line) and a two-word label that wraps (two
       * lines, e.g. "Quick Bites") then bottom out at the same tile height
       * instead of producing a ragged row. `text-center` keeps a wrapped
       * label's second line centered under the icon rather than defaulting
       * left within the (unstretched) label box. */}
      <span className="min-h-[26px] text-center text-[10px] font-bold tracking-wider text-on-surface-variant uppercase leading-tight">
        {label}
      </span>
    </button>
  );
}
