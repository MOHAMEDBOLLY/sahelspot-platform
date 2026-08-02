import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

type IconButtonVariant = "solid" | "glass" | "outlined" | "plain";

type IconButtonOwnProps = {
  /** Material Symbols glyph name. */
  icon: string;
  /** Accessible name. Required — see note below. */
  label: string;
  variant?: IconButtonVariant;
  filled?: boolean;
  href?: string;
  className?: string;
};

type IconButtonProps = IconButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof IconButtonOwnProps>;

/** Every icon-only control in the app.
 *
 * Two things are enforced here rather than left to each caller, because the
 * audit found both violated on all four canonical screens:
 *
 * 1. `label` is a required prop, so an unlabelled icon button cannot compile.
 *    Stitch has no `aria-label` on any icon button anywhere.
 * 2. The tap target is always 48x48. Stitch renders these at 40px in several
 *    places (hero back/share/save, map locate/layers), which fails WCAG 2.5.5's
 *    44x44 minimum. There is intentionally no size prop — a 40px variant is the
 *    bug we are fixing, so it must not be expressible.
 *
 * The *visual* circle stays at the Stitch size where it differs; only the hit
 * area is expanded, so nothing looks redesigned.
 *
 * Forwards its ref — `BottomSheet` needs to move focus to its close button
 * on open. The `href` form can't take a ref forwarded to an `<a>` the same
 * way, so the ref only ever targets the `<button>` case in practice. */
const VARIANTS: Record<IconButtonVariant, string> = {
  /** Floating over imagery — hero controls, card save button. */
  solid: "bg-white/90 backdrop-blur-md shadow-lg text-on-surface",
  /** Floating over the map. */
  glass: "bg-white/95 backdrop-blur-md shadow-lg text-on-surface",
  /** Venue Details action row — call / WhatsApp / website. */
  outlined:
    "border-2 border-outline-variant/20 text-primary active:bg-surface-container",
  /** In-flow controls: header bell, sheet close, list chevron. */
  plain: "text-on-surface-variant hover:bg-surface-container",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "plain", filled = false, href, className = "", ...props },
  ref,
) {
  const classes = [
    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
    "transition-all active:scale-90",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
    VARIANTS[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = <Icon filled={filled} name={icon} />;

  if (href) {
    return (
      <Link aria-label={label} className={classes} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button aria-label={label} className={classes} ref={ref} type="button" {...props}>
      {content}
    </button>
  );
});
