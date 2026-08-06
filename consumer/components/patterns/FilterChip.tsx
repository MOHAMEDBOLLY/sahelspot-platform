import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

type FilterChipOwnProps = {
  label: string;
  icon?: string;
  active?: boolean;
};

type FilterChipProps = FilterChipOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof FilterChipOwnProps>;

/** Pill filter — the Map category row ("All", "Beaches", "Food", ...) and
 * Search's category/status row. Active = navy fill with accent-yellow text
 * (docs/consumer/MOBILE_2027_COMPONENT_MAPPING.md §4 — yellow is the frozen
 * system's single accent, not white, on the active state); inactive =
 * bordered white, matching the export's `interactive_map_1` chip row. */
export function FilterChip({
  label,
  icon,
  active = false,
  className = "",
  ...props
}: FilterChipProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
        active
          ? "bg-primary text-accent"
          : "border border-outline-variant/30 bg-white text-on-surface"
      } ${className}`}
      type="button"
      {...props}
    >
      {icon ? <Icon size={20} name={icon} /> : null}
      {label}
    </button>
  );
}
