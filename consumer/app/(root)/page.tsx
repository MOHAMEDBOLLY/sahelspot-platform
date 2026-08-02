import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = {
  description: "Discover the best beaches, restaurants, cafes, and hidden gems along Egypt's North Coast.",
};

export default function HomePage() {
  return <HomeClient />;
}
