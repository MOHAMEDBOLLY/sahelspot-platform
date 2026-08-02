/** `opening_hours`'s real shape, confirmed against publish revision 1071 (one
 * populated venue, `v00001`): a day-keyed object, each day an array of
 * `[start, end]` 24h `"HH:MM"` tuples — an array, not a single range, so a
 * venue with a lunch/dinner split can list two. Previously undocumented in
 * API_REQUIREMENTS.md §7 beyond "shape not agreed with Studio yet"; now it
 * has been observed directly, though only 1 of 401 venues (0.2%) has it
 * populated today. */
export type DayCode = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type OpeningHours = Partial<Record<DayCode, [string, string][]>>;

const DAY_CODES: readonly DayCode[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Validates the untyped JSON blob into `OpeningHours`, or `null` if it
 * doesn't match the confirmed shape — malformed data degrades the same way
 * absent data does, rather than crashing a render. */
export function toOpeningHours(raw: Record<string, unknown> | null): OpeningHours | null {
  if (!raw) return null;
  const result: OpeningHours = {};
  for (const day of DAY_CODES) {
    const ranges = raw[day];
    if (ranges === undefined) continue;
    if (!Array.isArray(ranges)) return null;
    const validated: [string, string][] = [];
    for (const range of ranges) {
      if (!Array.isArray(range) || range.length !== 2) return null;
      const [start, end] = range;
      if (typeof start !== "string" || typeof end !== "string") return null;
      if (parseTime(start) === null || parseTime(end) === null) return null;
      validated.push([start, end]);
    }
    result[day] = validated;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function isOpenAt(hours: OpeningHours, date: Date): boolean {
  const ranges = hours[DAY_CODES[date.getDay()]];
  if (!ranges) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return ranges.some(([start, end]) => {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    return startMin !== null && endMin !== null && minutes >= startMin && minutes <= endMin;
  });
}

/** "Until 7:00 PM" — Venue Details' hours `InfoPill`, matching the export
 * exactly. Only produced while genuinely open; there is no Stitch-designed
 * "closed, opens at X" copy to fall back to, so a closed venue simply omits
 * this pill rather than inventing text the design never specified. */
export function formatOpenUntil(hours: OpeningHours, date: Date): string | null {
  const ranges = hours[DAY_CODES[date.getDay()]];
  if (!ranges) return null;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const active = ranges.find(([start, end]) => {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    return startMin !== null && endMin !== null && minutes >= startMin && minutes <= endMin;
  });
  if (!active) return null;
  const [, end] = active;
  const [hoursStr, minutesStr] = end.split(":");
  const hour24 = Number(hoursStr);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `Until ${hour12}:${minutesStr} ${period}`;
}
