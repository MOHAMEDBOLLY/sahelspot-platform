import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

/** Inter for Latin, IBM Plex Sans Arabic for RTL content. Both are declared in
 * every Stitch screen; Arabic is currently used only by the Splash tagline. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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

export const metadata: Metadata = {
  title: {
    default: "SahelSpot",
    template: "%s · SahelSpot",
  },
  description: "Discover the North Coast — beaches, restaurants, and hidden gems.",
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
    <html className={`${inter.variable} ${ibmPlexArabic.variable}`} lang="en">
      <head>
        {/* oxlint-disable-next-line next/no-page-custom-font --
         * That rule is about pages/_document.js; in the App Router a <link> in
         * the root layout head applies to every route, which is exactly the
         * intent here. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=block"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
