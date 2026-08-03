import type { Event } from "./event";

/** "Sep 1, 2026" style, in the visitor's locale — used by both `EventCard`
 * and the event details page so date formatting only exists once. */
export function formatEventDateRange(event: Pick<Event, "startDate" | "endDate">): string {
  const start = new Date(`${event.startDate}T00:00:00`);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (!event.endDate || event.endDate === event.startDate) return startLabel;

  const end = new Date(`${event.endDate}T00:00:00`);
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

/** "7:00 PM" style — omitted entirely by callers when a time is absent
 * (an all-day event), never rendered as "12:00 AM". */
export function formatEventTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
