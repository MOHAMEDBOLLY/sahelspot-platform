import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return <PhasePlaceholder phase="Phase 5" screen="Interactive Map" />;
}
