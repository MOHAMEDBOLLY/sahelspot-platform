# ADR 0001 — Public Venue URLs Use Stable IDs, Not Slugs

**Status:** Accepted

## Context

Release 1 of the consumer site (`consumer/`) needs a public URL scheme for
individual venue pages. `venues.slug` already exists, but it is only
unique **per destination** (`UniqueConstraint("destination_id", "slug")`,
`api/app/db/models.py`), not globally — two venues in different
destinations can share the same slug. A bare `/venues/{slug}` URL is
therefore not safe without a collision-handling scheme, and building one
is not in scope for Release 1's directory experience.

`venues.id` (a `Text` primary key, e.g. `v00001`), by contrast, is
globally unique by construction and already exposed on every `/public/*`
response.

## Decision

Public venue URLs use the venue's stable **`id`** for Release 1:
`GET /public/venues/{venue_id}` (added in M5), and `consumer/`'s venue
detail route is `/venues/[id]` (M6).

SEO-friendly slugs are intentionally deferred, not rejected. The planned
future migration path is:

```
/venues/<slug>--<id>
```

chosen specifically because the trailing `--<id>` keeps every URL that's
already indexed, shared, or bookmarked under the bare-id scheme resolving
correctly once slugs are introduced — the id remains parseable out of the
combined path with no redirect table, no lookup-by-slug ambiguity, and no
breaking change to anything published under this ADR's scheme.

## Consequences

- Release 1 venue URLs (e.g. `/venues/v00001`) are stable and will
  continue to work unchanged after slugs are added later.
- `venues.slug`'s existing per-destination uniqueness constraint is
  unaffected by this decision — it remains exactly what it already is
  (destination-scoped, not global), since public URLs don't depend on it
  yet.
- A future slug migration only needs to add the `<slug>--` prefix parsing
  on the consumer side and, if desired, a canonical-URL redirect from the
  bare-id form — it does not need to touch `GET /public/venues/{venue_id}`
  or invalidate any previously-shared link.
