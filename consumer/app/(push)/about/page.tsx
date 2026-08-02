import type { Metadata } from "next";
import { LogoLockup } from "@/components/brand/LogoLockup";
import { IconButton } from "@/components/ui/IconButton";

export const metadata: Metadata = { title: "About" };

/** Brand description only — non-legal, safe to author directly. Privacy
 * Policy and Terms of Service are not: those are real legal documents that
 * must come from SahelSpot itself, not be drafted here — they route to
 * `/coming-soon` instead of inventing legal copy. */
export default function AboutPage() {
  return (
    <div className="min-h-dvh px-4 pb-12">
      <header className="flex items-center gap-2 py-3">
        <IconButton href="/more" icon="arrow_back" label="Go back" variant="plain" />
        <h1 className="text-xl font-bold text-primary">About SahelSpot</h1>
      </header>

      <div className="flex flex-col items-center gap-8 pt-8">
        <LogoLockup />
        <p className="max-w-sm text-center text-sm text-on-surface-variant">
          SahelSpot helps you discover the best beaches, restaurants, cafes, and hidden
          gems along Egypt&apos;s North Coast — Marassi, Hacienda Bay, and beyond.
          Every place on SahelSpot is reviewed and published through the SahelSpot
          Studio editorial team, so you&apos;re always seeing places that are real,
          current, and worth the trip.
        </p>
      </div>
    </div>
  );
}
