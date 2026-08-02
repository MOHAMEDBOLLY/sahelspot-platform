import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type IconActionButtonOwnProps = {
  label: string;
  icon?: string;
  /** For the one instance that isn't a Material Symbol — WhatsApp's brand SVG
   * at #25D366 is the single place in the product where a brand mark
   * overrides the icon system. */
  children?: ReactNode;
};

type IconActionButtonProps = IconActionButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof IconActionButtonOwnProps>;

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
  className = "",
  ...props
}: IconActionButtonProps) {
  return (
    <button
      aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-outline-variant/20 text-primary transition-colors active:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${className}`}
      type="button"
      {...props}
    >
      {icon ? <Icon name={icon} /> : children}
    </button>
  );
}
