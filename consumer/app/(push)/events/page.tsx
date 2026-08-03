import type { Metadata } from "next";
import { EventsListClient } from "./EventsListClient";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming events across the North Coast.",
};

export default function EventsPage() {
  return <EventsListClient />;
}
