import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sahelspot.com";

/** `/coming-soon` and `/onboarding` are disallowed — neither is content
 * worth indexing (a placeholder page and a first-launch flow, respectively).
 * Everything else, including individual venue pages, is public and
 * crawlable by design — there is no auth boundary to protect on this app. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/coming-soon", "/onboarding"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
