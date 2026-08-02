import { Icon } from "@/components/ui/Icon";

type InfoPillProps = {
  icon: string;
  label: string;
};

/** Venue Details info row (hours, price, distance, family-friendly),
 * horizontally scrolling. `bg-surface-container px-3 py-2.5 rounded-xl
 * border-outline-variant/10`, teal 20px icon — read directly off the Boca
 * Beach export. */
export function InfoPill({ icon, label }: InfoPillProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-2.5">
      <Icon className="text-secondary" name={icon} size={20} />
      <span className="text-sm font-medium text-on-surface-variant">{label}</span>
    </div>
  );
}
