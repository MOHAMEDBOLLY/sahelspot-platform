import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

type CategoryChipOwnProps = {
  label: string;
  icon: string;
};

type CategoryChipProps = CategoryChipOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CategoryChipOwnProps>;

/** Square cream tile + icon + uppercase label — Home's mood grid
 * (`grid-cols-5`) and Search's Popular Categories.
 *
 * Home's square tile is canonical over Explore's circular Quick Browse
 * chip — the audit resolved that shape conflict in Home's favour, and
 * `QuickBrowseChip` is the separate component for Explore's own shape. */
export function CategoryChip({
  label,
  icon,
  className = "",
  ...props
}: CategoryChipProps) {
  return (
    <button
      className={`group flex flex-col items-center gap-2 focus-visible:outline-none ${className}`}
      type="button"
      {...props}
    >
      <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-cream shadow-sm transition-all group-hover:bg-primary-container group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-primary/20">
        <Icon className="text-primary" name={icon} size={28} />
      </span>
      <span className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
        {label}
      </span>
    </button>
  );
}
