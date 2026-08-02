import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export const metadata: Metadata = { title: "Welcome" };

/** Standalone — no bottom nav, no top app bar. */
export default function OnboardingPage() {
  return <PhasePlaceholder phase="Phase 9" screen="Onboarding" />;
}
