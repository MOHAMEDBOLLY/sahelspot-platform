import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type IconActionButtonOwnProps = {
  label: string;
  icon?: string;
  /** For the one instance that isn't a Material Symbol — WhatsApp's brand SVG
   * at #25D366 is the single place in the product where a brand mark
   * overrides the icon system. */
  children?: ReactNode;
  /** `tel:`, `https://wa.me/...`, or a venue's own website — plain anchors,
   * not Next `Link`, since none of these are internal routes. */
  href?: string;
};

type IconActionButtonProps = IconActionButtonOwnProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof IconActionButtonOwnProps
  >;

/** Outlined circular action button — Venue Details' call / WhatsApp / website
 * row. `w-12 h-12` (48dp): unlike the hero FABs, this row is already correct
 * on touch targets in the export.
 *
 * Distinct from `IconButton`, which is filled and floats over imagery — this
 * one is a plain in-flow secondary action. */
export function IconActionButton({
  label,
  icon,
  children,
  href,
  className = "",
  ...props
}: IconActionButtonProps) {
  const classes = `flex h-12 w-12 items-center justify-center rounded-full border-2 border-outline-variant/20 text-primary transition-colors active:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${className}`;
  const content = icon ? <Icon name={icon} /> : children;

  if (href) {
    return (
      <a
        aria-label={label}
        className={classes}
        href={href}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        target={href.startsWith("http") ? "_blank" : undefined}
        {...props}
      >
        {content}
      </a>
    );
  }

  return (
    <button aria-label={label} className={classes} type="button" {...props}>
      {content}
    </button>
  );
}
