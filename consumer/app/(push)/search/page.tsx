import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return <PhasePlaceholder phase="Phase 7" screen="Search" />;
}
