import type { Metadata } from "next";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <>
      <TopAppBar title="More" />
      <PhasePlaceholder phase="Phase 9" screen="More" />
    </>
  );
}
