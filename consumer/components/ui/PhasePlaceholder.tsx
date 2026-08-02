import { CTAButton } from "./CTAButton";
import { Icon } from "./Icon";

type PhasePlaceholderProps = {
  screen: string;
  phase: string;
  note?: string;
};

/** Temporary scaffolding for routes whose screens land in a later phase.
 *
 * Phase 1's exit criterion is that every route is reachable and the navigation
 * shell is correct, which needs each route to render *something*. This is that
 * something — deliberately generic and obviously provisional, so it can never
 * be mistaken for an implemented screen or for an inferred design.
 *
 * Deleted screen by screen as each phase lands. */
export function PhasePlaceholder({ screen, phase, note }: PhasePlaceholderProps) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-cream">
        <Icon className="text-primary" name="construction" size={32} />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-primary">{screen}</h2>
        <p className="text-sm font-medium text-on-surface-variant">
          Scheduled for {phase}.
        </p>
        {note ? (
          <p className="max-w-xs text-xs text-on-surface-variant">{note}</p>
        ) : null}
      </div>
      <CTAButton href="/" variant="secondary">
        Back to Home
      </CTAButton>
    </div>
  );
}
