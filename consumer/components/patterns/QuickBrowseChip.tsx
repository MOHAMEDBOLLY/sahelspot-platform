import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type QuickBrowseChipProps = {
  href: string;
  label: string;
  icon: string;
};

/** Explore's Quick Browse row — white `rounded-2xl` squares with coloured
 * icons, `w-16 h-16`. Distinct from `CategoryChip` (Home's cream squares):
 * the audit resolved the shape *conflict* between these two screens in
 * Home's favour, but Explore's own circular-icon-chip shape in Quick Browse
 * is a different component for a different row, confirmed in the export. */
export function QuickBrowseChip({ href, label, icon }: QuickBrowseChipProps) {
  return (
    <Link aria-label={label} className="flex shrink-0 flex-col items-center gap-2" href={href}>
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
        <Icon className="text-primary" name={icon} size={28} />
      </span>
      <span className="text-xs font-medium text-on-surface-variant">{label}</span>
    </Link>
  );
}
