import type { CSSProperties } from "react";

export type IconProps = {
  /** Material Symbols Outlined glyph name, e.g. `arrow_back`, `favorite`. */
  name: string;
  /** FILL 1 — the "active" state: selected nav tab, saved heart, rating star. */
  filled?: boolean;
  /** Pixel size. Stitch uses 24 almost everywhere, with 16/20 in dense rows. */
  size?: number;
  className?: string;
};

/** Every icon in the Stitch export is a Material Symbols Outlined glyph, so
 * that font — not Lucide — is the system. Lucide is available for the rare
 * shape Material has no equivalent for.
 *
 * Always `aria-hidden`. An icon never carries an accessible name: either it
 * sits inside a control that has its own label (`IconButton` requires one), or
 * it is decorative beside text that already says the same thing. This is the
 * component-level fix for the audit's "no accessible name for any icon button"
 * finding — there is no prop here that could accidentally make an icon the
 * only label. */
export function Icon({ name, filled = false, size = 24, className = "" }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      data-filled={filled ? "true" : undefined}
      style={{ fontSize: `${size}px`, "--icon-size": `${size}px` } as CSSProperties}
    >
      {name}
    </span>
  );
}
