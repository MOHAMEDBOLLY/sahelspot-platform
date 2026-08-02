import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type EmptyStateProps = {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

/** Cream icon tile + navy headline + grey subtext + optional CTA. Used for
 * Search's no-results state and Saved's empty tabs (Collections, Want to go —
 * both empty by default in v1). `/public/*` returning `[]` before a first
 * publish is this same state, not an error. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-cream">
        <Icon className="text-primary" name={icon} size={32} />
      </span>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-primary">{title}</h3>
        {description ? (
          <p className="max-w-xs text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
