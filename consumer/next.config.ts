import type { NextConfig } from "next";

// Security hardening PR 2 — conservative, zero-compatibility-risk response
// headers on every route. Declared via Next.js's own `headers()` config
// rather than custom middleware: no extra request-handling code to
// maintain, applied consistently to every route including static assets,
// and it's the framework-native way to do this. Deliberately *not*
// Content-Security-Policy/HSTS/COOP/COEP/CORP — those need their own
// dedicated review, later.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stops browsers from MIME-sniffing a response into a
          // different content type than what's declared.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sends the full URL as a referrer only for same-origin
          // requests; cross-origin requests get the origin only, never
          // the full path (which could otherwise leak search query
          // strings to a third party).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Explicitly denies browser features this app never uses — an
          // allowlist of nothing, not a restriction of something in use
          // today.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // This site is never meant to be framed by anything; DENY is
          // simpler and more broadly supported than CSP's
          // frame-ancestors, which is explicitly out of scope for this PR.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
