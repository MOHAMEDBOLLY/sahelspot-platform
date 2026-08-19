import type { MetadataRoute } from "next";

/** PWA manifest — Brand Assets Implementation. Next's App Router convention:
 * this file is auto-detected and served at `/manifest.webmanifest`, with no
 * manual `<link rel="manifest">` needed in `layout.tsx`.
 *
 * Icons use the official supplied PO mark's black-background exports
 * (`sahelspot-po-black-*.png`), not the plain transparent-white ones — the
 * PO artwork itself is white-only, so on a transparent background it is
 * invisible against the light launcher/app-list surfaces most platforms
 * actually show these icons on. The black-background versions are the
 * brand handoff's own supplied "presentation" variant for exactly this
 * problem ("not a redesign" per `CLAUDE_BRAND_HANDOFF.md`) — no artwork was
 * edited, only an already-supplied variant was selected. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SahelSpot",
    short_name: "SahelSpot",
    description: "Discover the North Coast — beaches, restaurants, and hidden gems.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2e2a25",
    icons: [
      {
        src: "/brand/exports/sahelspot-po-black-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/exports/sahelspot-po-black-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
