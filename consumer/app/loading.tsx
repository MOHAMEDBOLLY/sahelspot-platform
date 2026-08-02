import { LogoLockup } from "@/components/brand/LogoLockup";

/** Splash — implemented as Next's global route-loading UI, not a timed gate
 * a visitor must wait through before reaching Home. `ROADMAP.md`'s open
 * decisions flagged a mandatory ~1.5-2s splash as a native-app pattern that
 * would delay first paint and hurt SEO on the most important route; this is
 * the "brand loading state during initial fetch" alternative it recommended,
 * shown automatically by the App Router while a route segment is loading. */
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-cream">
      <LogoLockup />
      <div aria-hidden="true" className="flex gap-1.5">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      </div>
    </div>
  );
}
