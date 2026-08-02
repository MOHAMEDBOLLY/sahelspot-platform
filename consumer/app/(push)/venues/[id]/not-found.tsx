import { CTAButton } from "@/components/ui/CTAButton";
import { Icon } from "@/components/ui/Icon";

/** A 404 here is the expected result for an unpublished or nonexistent venue,
 * not an error — see docs/adr/0001-public-venue-urls.md. Restyled onto the
 * design tokens in Phase 0; the semantics are unchanged. */
export default function VenueNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-cream">
        <Icon className="text-primary" name="location_off" size={32} />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-primary">Venue not found</h1>
        <p className="max-w-xs text-sm font-medium text-on-surface-variant">
          This place isn&apos;t published, or the link is out of date.
        </p>
      </div>
      <CTAButton href="/">Back to Home</CTAButton>
    </div>
  );
}
