import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/Icon";

type ListRowItemOwnProps = {
  icon: string;
  label: string;
  trailingValue?: string;
  href?: string;
};

type ListRowItemProps = ListRowItemOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ListRowItemOwnProps>;

/** Icon + label + optional trailing value + chevron. First use: More's
 * Preferences/About/Support/Share groups. `surface-container-low` background,
 * 48dp minimum row height. */
export function ListRowItem({
  icon,
  label,
  trailingValue,
  href,
  className = "",
  ...props
}: ListRowItemProps) {
  const classes = `flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-left transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${className}`;

  const content = (
    <>
      <Icon className="text-primary" name={icon} size={22} />
      <span className="flex-grow text-sm font-medium text-on-surface">{label}</span>
      {trailingValue ? (
        <span className="text-sm text-on-surface-variant">{trailingValue}</span>
      ) : null}
      <Icon className="text-on-surface-variant" name="chevron_right" size={20} />
    </>
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
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
