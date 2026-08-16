/** Validation for external-action data — used only by mappers, at the DTO ->
 * Domain boundary. A malformed value becomes `null` here, the same as an
 * absent one: the UI layer (`IconActionButton`, `CTAButton`) already omits
 * an action for a `null` field, so validating here is what keeps a garbage
 * string from ever reaching a rendered `tel:`/`wa.me`/`href` in the first
 * place, without teaching every call site its own validation rules. */

/** `http(s)` only — a `javascript:` or malformed string must never become an
 * `href`. */
export function toValidUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/** Loose E.164-shaped check — optional leading `+`, 7-15 digits once
 * spaces/dashes/parentheses are stripped. Good enough to reject obvious
 * garbage ("N/A", "-", empty) without rejecting real international numbers
 * this client can't fully validate offline. */
function digitsOf(raw: string): { plus: boolean; digits: string } {
  const trimmed = raw.trim();
  return { plus: trimmed.startsWith("+"), digits: trimmed.replace(/[^0-9]/g, "") };
}

export function toValidPhone(raw: string | null): string | null {
  if (!raw) return null;
  const { plus, digits } = digitsOf(raw);
  if (digits.length < 7 || digits.length > 15) return null;
  return plus ? `+${digits}` : digits;
}

/** `wa.me` links take digits only, no leading `+` — a separate return shape
 * from `toValidPhone`, not just reused, since a WhatsApp number and a phone
 * number happen to share a validation rule but not a wire format.
 *
 * This platform is Egypt-only, and Studio editors overwhelmingly enter
 * local mobile numbers (`01XXXXXXXXX`, 11 digits, no country code) — the
 * format Egyptian phone numbers are normally written in locally. `wa.me`
 * requires the country code with the leading `0` dropped; passed through
 * unchanged, a stored local number produces a link WhatsApp reports as an
 * invalid phone number rather than opening a chat (confirmed live against
 * a real published venue, `v00001`). The one unambiguous case — an
 * 11-digit number starting with a single leading `0` — is converted to
 * `20` + the remaining 10 digits; every other shape (already has a `+`,
 * or doesn't match this pattern at all) passes through as before, so this
 * doesn't narrow acceptance for any number this function previously
 * accepted. */
export function toValidWhatsapp(raw: string | null): string | null {
  if (!raw) return null;
  const { digits } = digitsOf(raw);
  if (digits.length < 7 || digits.length > 15) return null;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `20${digits.slice(1)}`;
  }
  return digits;
}

/** `instagram_handle` on the wire is usually a bare handle (`"arabica_eg"`,
 * 100/113 populated values in the live catalog) but sometimes a full profile
 * URL editors pasted directly (`"https://www.instagram.com/alaghaegypt"`,
 * 13/113) — both are handled here rather than only the majority shape.
 * A full URL is passed through `toValidUrl` unchanged; anything else is
 * treated as a bare handle, defensively stripped of a leading `@` and any
 * leading/trailing slashes (an editor pasting `@handle` or a partial URL
 * fragment), then rejected if a `/` remains (an accidental partial URL
 * paste) rather than building a broken `instagram.com/still/has/a/slash`
 * link. Whitespace-only and empty strings resolve to `null`, same as every
 * other validator here. */
export function toValidInstagramUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return toValidUrl(trimmed);
  const handle = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (!handle || handle.includes("/")) return null;
  return `https://instagram.com/${handle}`;
}
