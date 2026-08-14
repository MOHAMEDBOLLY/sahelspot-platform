"use client";

import type { ComponentProps } from "react";
import { SearchField } from "@/components/patterns/SearchField";

type HomeHeroProps = {
  searchProps: Omit<ComponentProps<typeof SearchField>, "variant" | "className">;
};

/** Home Hero — Home UI Refinement pass. The greeting, wordmark, and
 * notification bell already live in `TopAppBar` above this component, so
 * this no longer duplicates them with a second headline/eyebrow treatment.
 * No decorative artwork of any kind (the previous inline-SVG "coastline"
 * shapes and dot-grid/grain background are removed entirely, not replaced
 * with another illustration) — this is just the search bar, positioned so
 * the user reaches real discovery content (categories, Best Beaches, ...)
 * in one short scroll from the top of Home. */
export function HomeHero({ searchProps }: HomeHeroProps) {
  return (
    <section className="pt-3">
      <SearchField {...searchProps} />
    </section>
  );
}
