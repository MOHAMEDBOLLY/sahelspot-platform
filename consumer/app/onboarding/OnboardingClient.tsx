"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoLockup } from "@/components/brand/LogoLockup";
import { PageDots } from "@/components/patterns/PageDots";
import { CTAButton } from "@/components/ui/CTAButton";
import { useOnboardingSeen } from "@/lib/onboarding/useOnboardingSeen";

/** `SahelSpot_Remaining_Screens_Spec.md`'s 3-slide sequence — content, order,
 * and button labels straight from the spec. One route with client-side slide
 * state, as the spec itself recommends, not three separate pages.
 *
 * No slide has real imagery in either Stitch export (this screen was never
 * exported at all — spec-only, like Search). The hero is infrastructure, not
 * content: it exists only to occupy space until real brand photography
 * exists, so it deliberately reuses Splash's own placeholder language
 * (`bg-cream` + centered `LogoLockup`, docs/consumer/MOBILE_2027_DESIGN_FREEZE.md
 * §9-adjacent placeholder decision) rather than inventing a second one. No
 * gradient, no illustration, no accent-yellow fill — a large decorative
 * yellow surface would violate Design Rule 1 ("yellow is structural, never
 * decorative"). */
const SLIDES = [
  {
    headline: "Discover Amazing Places",
    body: "Find the best beaches, restaurants, and hidden gems along Egypt's North Coast.",
    button: "Next",
  },
  {
    headline: "Explore with the Map",
    body: "See what's nearby, filter by category, and never miss a hidden gem.",
    button: "Next",
  },
  {
    headline: "Save Your Favorites",
    body: "Bookmark places you love and plan your perfect North Coast getaway.",
    button: "Get Started",
  },
] as const;

export function OnboardingClient() {
  const router = useRouter();
  const { markSeen } = useOnboardingSeen();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function finish() {
    markSeen();
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative flex h-[60vh] shrink-0 items-center justify-center overflow-hidden rounded-b-3xl bg-cream">
        <button
          aria-label="Skip onboarding"
          className="absolute top-4 right-4 text-sm font-semibold text-primary/90 hover:underline"
          onClick={finish}
          type="button"
        >
          Skip
        </button>
        <LogoLockup showTagline={false} />
      </div>

      <div className="flex flex-grow flex-col items-center justify-between px-6 py-8 text-center">
        <div className="space-y-3">
          <h1 className="font-headline text-xl font-bold text-primary">{slide.headline}</h1>
          <p className="text-sm text-on-surface-variant">{slide.body}</p>
        </div>

        <div className="w-full space-y-6">
          <PageDots activeIndex={index} count={SLIDES.length} />
          <CTAButton
            fullWidth
            icon="arrow_forward"
            iconPosition="trailing"
            onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
          >
            {slide.button}
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
