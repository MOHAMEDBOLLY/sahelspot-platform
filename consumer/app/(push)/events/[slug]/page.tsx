import type { Metadata } from "next";
import { fetchEvent } from "@/lib/api/events";
import { toEvent } from "@/lib/domain/mappers/event";
import { EventDetailsClient } from "./EventDetailsClient";

type Props = { params: Promise<{ slug: string }> };

/** Runs server-side, same reasoning `venues/[id]/page.tsx` already gives:
 * reaches `/public/events/{slug}` directly, no browser CORS. A 404/failure
 * here degrades to a generic title rather than throwing —
 * `EventDetailsClient`'s own `useEvent` call is what actually renders the
 * 404/error UI a visitor sees.
 *
 * Slug-based, not id-based — unlike venues' `[id]`, this route is
 * `/events/{slug}` per Events Module v1's stable-public-slug requirement.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const dto = await fetchEvent(slug);
    if (!dto) return { title: "Event not found" };
    const event = toEvent(dto);
    const description = event.shortDescription ?? `${event.title} — North Coast, Egypt.`;
    const images = event.coverImageUrl ? [{ url: event.coverImageUrl }] : undefined;
    return {
      title: event.title,
      description,
      openGraph: {
        title: event.title,
        description,
        siteName: "SahelSpot",
        type: "website",
        locale: "en_US",
        images,
      },
      twitter: {
        card: images ? "summary_large_image" : "summary",
        title: event.title,
        description,
        images,
      },
    };
  } catch {
    return { title: "Event" };
  }
}

export default async function EventDetailsPage({ params }: Props) {
  const { slug } = await params;
  return <EventDetailsClient eventSlug={slug} />;
}
