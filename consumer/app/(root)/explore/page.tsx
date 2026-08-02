import type { Metadata } from "next";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <>
      <TopAppBar title="Explore" />
      <PhasePlaceholder
        note="Blocked on the Studio collections content model — see docs/consumer/API_REQUIREMENTS.md."
        phase="Phase 8"
        screen="Explore"
      />
    </>
  );
}
