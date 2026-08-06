import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

type CategoryChipOwnProps = {
  label: string;
  /** Material Symbols glyph name — the one icon language this app uses.
   * No emoji alternative: production UI carries zero emoji, enforced here
   * by this prop being the only way to put a glyph in the tile at all. */
  icon: string;
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
      <span className="flex aspect-square w-full items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm transition-all group-hover:bg-primary-container group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-primary/20">
        <Icon className="text-primary" name={icon} size={28} />
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
