import type { Metadata } from "next";
import { SearchClient } from "./SearchClient";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return <SearchClient />;
}
