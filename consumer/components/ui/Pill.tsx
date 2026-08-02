import type { ReactNode } from "react";
import { Icon } from "./Icon";

type PillVariant = "tag" | "weather" | "counter" | "status";

type PillProps = {
  children: ReactNode;
  variant?: PillVariant;
  icon?: string;
  className?: string;
};

/** The small labelled shapes that aren't buttons.
 *
 * `tag`     cream pill, navy text — Venue Details ("Beach Club", "Beachfront")
 * `weather` teal container — Home hero ("31C Sunny")
 * `counter` translucent black over imagery — gallery position ("1/15")
 * `status`  teal-tinted OPEN/CLOSED badge on every VenueCard
 *
 * `status` is the one the handoff docs missed entirely; it appears on every
 * venue card in the Home export. */
const VARIANTS: Record<PillVariant, string> = {
  tag: "bg-cream text-primary text-xs font-semibold px-2 py-1 rounded-full",
  weather:
    "bg-secondary-container text-on-secondary-container text-sm font-bold px-4 py-2 rounded-lg shadow-sm",
  counter:
    "bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full",
  status: "bg-secondary/10 text-secondary text-xs font-bold px-2 py-1 rounded-sm",
};

export function Pill({ children, variant = "tag", icon, className = "" }: PillProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${VARIANTS[variant]} ${className}`}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}
