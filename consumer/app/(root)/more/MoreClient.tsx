"use client";

import { useState } from "react";
import { TopAppBar } from "@/components/nav/TopAppBar";
import { ListRowItem } from "@/components/patterns/ListRowItem";

const CONTACT_EMAIL = "hello@sahelspot.com";

/** More — application-level items only (approved decision: no accounts, so
 * the original spec's Account group — My Bookings, Notifications, My
 * Reviews, Visited Places — is dropped entirely, not stubbed).
 *
 * Every row here is a real action or a real destination, never a dead link:
 * Language/Theme are informational only (this app has one language and one
 * theme, so there's nothing to navigate to); About is a real page; Privacy/
 * Terms route to /coming-soon rather than inventing legal text no one at
 * SahelSpot has approved; Contact is a real mailto:; Share uses the real Web
 * Share API. */
export function MoreClient() {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  async function handleShare() {
    const shareData = { title: "SahelSpot", url: window.location.origin };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled — not an error.
      }
      return;
    }
    await navigator.clipboard.writeText(window.location.origin);
    setShareState("copied");
    setTimeout(() => setShareState("idle"), 2000);
  }

  return (
    <>
      <TopAppBar title="More" />
      <div className="space-y-6 px-4 pt-2">
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold tracking-wide text-on-surface-variant uppercase">
            Preferences
          </h2>
          <div className="space-y-2">
            <ListRowItem disabled icon="language" label="Language" trailingValue="English" />
            <ListRowItem disabled icon="dark_mode" label="Theme" trailingValue="Light" />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold tracking-wide text-on-surface-variant uppercase">
            About
          </h2>
          <div className="space-y-2">
            <ListRowItem href="/about" icon="info" label="About SahelSpot" />
            <ListRowItem href="/coming-soon?feature=privacy" icon="privacy_tip" label="Privacy Policy" />
            <ListRowItem href="/coming-soon?feature=terms" icon="gavel" label="Terms of Service" />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold tracking-wide text-on-surface-variant uppercase">
            Support
          </h2>
          <div className="space-y-2">
            <ListRowItem href={`mailto:${CONTACT_EMAIL}`} icon="mail" label="Contact" trailingValue={CONTACT_EMAIL} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold tracking-wide text-on-surface-variant uppercase">
            Share
          </h2>
          <div className="space-y-2">
            <ListRowItem icon="ios_share" label="Share App" onClick={handleShare} />
            <ListRowItem
              href={`mailto:${CONTACT_EMAIL}?subject=SahelSpot%20feedback`}
              icon="star_rate"
              label="Rate App"
            />
          </div>
          {shareState === "copied" ? (
            <p aria-live="polite" className="px-1 text-xs text-on-surface-variant">
              Link copied to clipboard
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
