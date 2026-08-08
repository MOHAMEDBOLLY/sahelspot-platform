import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return <ExploreClient />;
}
