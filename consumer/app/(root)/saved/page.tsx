import type { Metadata } from "next";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export const metadata: Metadata = { title: "Saved" };

export default function SavedPage() {
  return (
    <>
      <TopAppBar title="Saved" />
      <PhasePlaceholder
        note="Device-local only, behind SavedRepository. No account, no sync."
        phase="Phase 9"
        screen="Saved"
      />
    </>
  );
}
