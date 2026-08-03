import { CTAButton } from "@/components/ui/CTAButton";
import { Icon } from "@/components/ui/Icon";

/** A 404 here is the expected result for an unpublished or nonexistent
 * event, not an error — same reasoning as venues' `not-found.tsx`. */
export default function EventNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-cream">
        <Icon className="text-primary" name="event_busy" size={32} />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-primary">Event not found</h1>
        <p className="max-w-xs text-sm font-medium text-on-surface-variant">
          This event isn&apos;t published, or the link is out of date.
        </p>
      </div>
      <CTAButton href="/">Back to Home</CTAButton>
    </div>
  );
}
