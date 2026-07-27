import type { ReactNode } from "react";

type SectionProps = {
  children: ReactNode;
};

/** Vertical spacing between page sections — kept separate from
 * `Container` since a section controls spacing, not width; a full-bleed
 * background could still wrap a `Container` inside a `Section` later. */
export function Section({ children }: SectionProps) {
  return <section className="py-12">{children}</section>;
}
