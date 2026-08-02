import type { Metadata } from "next";
import { CTAButton } from "@/components/ui/CTAButton";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Coming Soon" };

const LABELS: Record<string, { title: string; description: string }> = {
  trending: {
    title: "Trending, in full",
    description: "A dedicated page for everything trending on the North Coast is on its way.",
  },
  destinations: {
    title: "All destinations",
    description: "A full destinations directory is on its way.",
  },
  privacy: {
    title: "Privacy Policy",
    description:
      "Our privacy policy is being finalized and will be published here before launch.",
  },
  terms: {
    title: "Terms of Service",
    description:
      "Our terms of service are being finalized and will be published here before launch.",
  },
};

const DEFAULT_LABEL = {
  title: "Coming soon",
  description: "This part of SahelSpot is still being built.",
};

/** Real landing target for a "See All" action that has no listing screen yet
 * in the 9-screen inventory — e.g. Home's Trending Today and Explore
 * Destinations. Per review guidance, an action with nowhere to go still
 * routes somewhere real rather than shipping as a disabled label. */
export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const { feature } = await searchParams;
  const copy = (feature && LABELS[feature]) || DEFAULT_LABEL;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-cream">
        <Icon className="text-primary" name="hourglass_top" size={32} />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p className="max-w-xs text-sm font-medium text-on-surface-variant">
          {copy.description}
        </p>
      </div>
      <CTAButton href="/">Back to Home</CTAButton>
    </div>
  );
}
