import { TopAppBar } from "@/components/nav/TopAppBar";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function HomePage() {
  return (
    <>
      <TopAppBar size="lg" title="SahelSpot" />
      <PhasePlaceholder phase="Phase 4" screen="Home" />
    </>
  );
}
