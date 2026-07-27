import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
};

/** Centers content and caps its width — the one layout primitive every
 * page section needs, so page content doesn't stretch edge-to-edge on
 * wide viewports. */
export function Container({ children }: ContainerProps) {
  return <div className="mx-auto w-full max-w-5xl px-6">{children}</div>;
}
