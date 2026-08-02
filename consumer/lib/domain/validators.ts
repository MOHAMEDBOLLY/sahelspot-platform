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
 * number happen to share a validation rule but not a wire format. */
export function toValidWhatsapp(raw: string | null): string | null {
  if (!raw) return null;
  const { digits } = digitsOf(raw);
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}
