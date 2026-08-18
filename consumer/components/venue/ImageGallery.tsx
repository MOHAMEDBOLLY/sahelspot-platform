"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { SaveIcon } from "@/components/patterns/CardShell";
import { IconButton } from "@/components/ui/IconButton";
import { Pill } from "@/components/ui/Pill";

type ImageGalleryProps = {
  images: string[];
  venueName: string;
  onBack?: () => void;
  onShare?: () => void;
  saved: boolean;
  onToggleSaved: () => void;
};

/** Venue Details hero: full-bleed h-80 image with hero-gradient, back FAB
 * top-left, share + save FAB pair top-right, "n/total" counter bottom-right —
 * all read directly from the Boca Beach export.
 *
 * The thumbnail strip (w-32 h-32 rounded-2xl) is a separate, simpler piece
 * rendered by the page below the hero; this component owns only the hero
 * carousel and its controls, since that's the piece with real interaction
 * (position, back/share/save).
 *
 * Motion Pass 02 (Venue Card -> Venue Details continuity) — a true
 * shared-element (`layoutId`) transition from the tapped card's image was
 * evaluated and found not safely supported by this app's route
 * architecture: `PageTransition` is deliberately enter-only (no
 * `AnimatePresence`, no exit phase — see its own doc comment), the route
 * change crosses two different layout groups (`(root)`/`(push)`), and this
 * page's own data — including the hero image URL — is fetched client-side
 * after mount (`useVenue`), so there is no guaranteed moment where the
 * source card and this hero coexist in the tree for Framer Motion to
 * bridge. Forcing `layoutId` across that gap would be fragile (see the
 * task's own fail-safe guidance). Instead: this hero plays a brief
 * mount-only fade "arriving" entrance — not positionally linked to the
 * tapped card, but a deliberate settle rather than a static cut, closest
 * safe analog to "this is the same place I just selected." Runs
 * identically on a direct URL visit (there's no source element to miss)
 * and does not replay on save-toggle or other re-renders, since it's tied
 * to this component's mount, not to `images`/`index`.
 *
 * Opacity-only, deliberately no `scale` — a scale transform stuck
 * mid-animation (verified to happen intermittently in this app's preview
 * environment even on pre-existing, unrelated `motion` components) would
 * leave the hero's bounding box larger than its `overflow-hidden`
 * section, at risk of contributing to page-level horizontal overflow.
 * Opacity can't do that in either its start, end, or any stuck
 * in-between state, so the entrance is safe regardless of whether the
 * animation runs to completion. */
export function ImageGallery({
  images,
  venueName,
  onBack,
  onShare,
  saved,
  onToggleSaved,
}: ImageGalleryProps) {
  const [index] = useState(0);
  const total = images.length;
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative h-80 w-full overflow-hidden">
      {images[index] ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          initial={reduceMotion ? false : { opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <Image
            alt={venueName}
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={images[index]}
          />
        </motion.div>
      ) : (
        <div className="h-full w-full bg-cream" />
      )}
      <div className="hero-gradient absolute inset-0" />

      <div className="absolute top-4 left-4">
        <IconButton icon="arrow_back" label="Go back" onClick={onBack} variant="solid" />
      </div>
      <div className="absolute top-4 right-4 flex gap-2">
        <IconButton icon="share" label="Share this place" onClick={onShare} variant="solid" />
        {/* Save Action Unification — was its own "favorite" (heart) icon in
          * a manually-tinted `solid` circle; now the same icon, active-state
          * color, and label semantics every card's `SaveButton` already
          * uses (unsaved = `solid`'s white/90 circle, saved = `accent`'s
          * filled-accent circle — see `IconButton`'s `accent` variant,
          * built for exactly this). Still a plain `IconButton` (not
          * `CardShell`'s `SaveButton`) because this sits in-flow in the
          * back/share FAB row at the hero's 48px control scale, not
          * absolutely positioned over a card photo — reusing `IconButton`
          * here is the smaller change and keeps that trio's existing
          * sizing untouched. */}
        <IconButton
          aria-pressed={saved}
          icon="bookmark"
          iconElement={<SaveIcon saved={saved} size={24} />}
          label={saved ? "Remove from saved" : "Save this place"}
          onClick={onToggleSaved}
          variant={saved ? "accent" : "solid"}
        />
      </div>

      {total > 0 ? (
        <div className="absolute right-4 bottom-4">
          <Pill variant="counter">
            {index + 1}/{total}
          </Pill>
        </div>
      ) : null}
    </section>
  );
}
