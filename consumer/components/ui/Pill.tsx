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
 * `weather` neutral surface container — Home hero ("31C Sunny"). Not an
 *           accent color: weather is informational, not actionable, per the
 *           frozen SahelSpot Mobile 2027 Design System's yellow-discipline
 *           rule (docs/consumer/MOBILE_2027_DESIGN_FREEZE.md §4).
 * `counter` translucent black over imagery — gallery position ("1/15")
 * `status`  DEPRECATED — duplicates `components/patterns/StatusBadge.tsx`,
 *           which is the canonical OPEN/CLOSED implementation actually used
 *           by `VenueCard`. Verified zero remaining call sites for
 *           `variant="status"` as of the Mobile 2027 migration
 *           (docs/consumer/MOBILE_2027_COMPONENT_MAPPING.md, Approval Note
 *           2) — kept, not deleted yet, per "deprecation precedes removal".
 *           Do not add new usages; use `StatusBadge` instead. */
const VARIANTS: Record<PillVariant, string> = {
  tag: "bg-cream text-primary text-xs font-semibold px-2 py-1 rounded-full",
  weather:
    "bg-surface-container-high text-on-surface text-sm font-bold px-4 py-2 rounded-lg shadow-sm",
  counter:
    "bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full",
  /** @deprecated Use `StatusBadge` instead. Retained only until removal is explicitly approved. */
  status: "bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-sm",
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
