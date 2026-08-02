import { TopAppBar } from "@/components/nav/TopAppBar";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default function HomePage() {
  return (
    <>
      <TopAppBar greeting="Good Morning 👋" title="SahelSpot" variant="greeting" />
      <PhasePlaceholder phase="Phase 4" screen="Home" />
    </>
  );
}
