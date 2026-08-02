import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type CTAButtonVariant = "primary" | "secondary";

type CTAButtonOwnProps = {
  children: ReactNode;
  variant?: CTAButtonVariant;
  /** Material Symbols glyph. Position varies by instance in the export:
   * "Directions" and "Open Calendar" lead with the icon, "View Collection"
   * trails it — both are real, not an inconsistency to normalize. */
  icon?: string;
  iconPosition?: "leading" | "trailing";
  fullWidth?: boolean;
  /** Renders a Next `<Link>` instead of a `<button>`. */
  href?: string;
  className?: string;
};

type CTAButtonProps = CTAButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CTAButtonOwnProps>;

/** The filled pill CTA — "Directions" (Venue Details), "View Collection" and
 * "Open Calendar" (Explore), "Next"/"Get Started" (Onboarding), and the action
 * inside `EmptyState`.
 *
 * `h-12` is both the Stitch height and the 48dp touch minimum, so there is
 * deliberately no smaller size: a shorter CTA would fail WCAG 2.5.5, and the
 * export has no instance of one. */
const VARIANTS: Record<CTAButtonVariant, string> = {
  primary: "bg-primary text-white shadow-md",
  secondary:
    "bg-surface-container-lowest text-primary shadow-md border border-outline-variant/20",
};

export function CTAButton({
  children,
  variant = "primary",
  icon,
  iconPosition = "leading",
  fullWidth = false,
  href,
  className = "",
  ...props
}: CTAButtonProps) {
  const classes = [
    "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6",
    "font-bold transition-all active:scale-95",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {icon && iconPosition === "leading" ? <Icon name={icon} /> : null}
      {children}
      {icon && iconPosition === "trailing" ? <Icon name={icon} /> : null}
    </>
  );

  if (href) {
    const isExternal = href.startsWith("http");
    return (
      <Link
        className={classes}
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} type="button" {...props}>
      {content}
    </button>
  );
}
