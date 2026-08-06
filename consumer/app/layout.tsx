import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

/** Inter for Latin body text, IBM Plex Sans Arabic for RTL content, Space
 * Grotesk for headlines — per the frozen SahelSpot Mobile 2027 Design System
 * (docs/consumer/MOBILE_2027_DESIGN_FREEZE.md §Typography). Space Grotesk
 * gives the brand a distinct geometric voice; it is not merely a heavier
 * weight of the body face. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
});

/** Material Symbols Outlined — the icon system for every glyph in the design —
 * is loaded via <link> below rather than next/font: next/font's Google catalog
 * doesn't include it ("Unknown font"), and a Tailwind v4 `@import url(...)` in
 * globals.css is dropped before it reaches the browser. The <link> is the one
 * mechanism that actually delivers the @font-face. */

const SITE_DESCRIPTION = "Discover the North Coast — beaches, restaurants, and hidden gems.";

export const metadata: Metadata = {
  // Required for Next to resolve `openGraph.images`/`twitter.images` (or any
  // relative asset) into an absolute URL in the rendered <meta> tags —
  // without it, a relative image path silently fails to become a valid
  // og:image. Matches the production domain used throughout docs/ and
  // robots.txt/sitemap.xml.
  metadataBase: new URL("https://sahelspot.com"),
  title: {
    default: "SahelSpot",
    template: "%s · SahelSpot",
  },
  description: SITE_DESCRIPTION,
  // Next does not auto-populate openGraph/twitter from the plain
  // title/description fields above — omitting this block is exactly why
  // venue pages were rendering with zero og:* tags despite having a
  // correct <title>/<meta name="description">. Site-wide defaults here;
  // `venues/[id]/page.tsx` overrides with venue-specific values.
  openGraph: {
    title: "SahelSpot",
    description: SITE_DESCRIPTION,
    siteName: "SahelSpot",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SahelSpot",
    description: SITE_DESCRIPTION,
  },
};

/** Root layout holds fonts and providers only. Screen chrome (header, bottom
 * nav) belongs to the `(root)` and `(push)` route groups, so that a pushed
 * detail screen structurally cannot render a bottom nav. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexArabic.variable}`}
      lang="en"
    >
      <head>
        {/* oxlint-disable-next-line next/no-page-custom-font --
         * That rule is about pages/_document.js; in the App Router a <link> in
         * the root layout head applies to every route, which is exactly the
         * intent here. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
