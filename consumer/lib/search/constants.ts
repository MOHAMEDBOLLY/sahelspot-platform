/** Search Autocomplete P0/P1 — centralized tuning values, per the audit's
 * §10-11 recommendations. Kept here as the one source every autocomplete
 * surface reads from, rather than magic numbers scattered across
 * `useSearchSuggestions`/`SearchAutocomplete`. */

/** Below this length, autocomplete shows the default/recent-searches state
 * instead of firing a network request — audit §11. */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/** Trailing-edge debounce applied to the raw typed query before it's used as
 * an autocomplete search param — audit §12. */
export const SEARCH_DEBOUNCE_MS = 200;

/** Visible suggestions per group (Destinations / Categories / Venues) —
 * audit §16, "cap the visible suggestions client-side". */
export const SEARCH_MAX_SUGGESTIONS_PER_GROUP = 6;
