# ADR 0008 — Rate Limit Attachment Strategy

**Status:** Accepted

## Context

H1 added reverse-proxy rate limiting for the production API: three
zones (search, public, editor) at different rates, enforced by nginx's
native `limit_req`. The production `api.sahelspot.com` server block has
a single catch-all `location /` proxying every request to the API
container — there is no existing per-path routing to attach three
different rates to.

Two ways to attach three zones to three different URL prefixes
(`/public/search/*`, the rest of `/public/*`, `/editor/*`) were
evaluated.

**Option A — three `map` directives + the existing catch-all location.**
`map $uri $key { ... }` blocks at `http` scope compute a per-request key
that is the client's address for exactly one zone and empty for the
other two (nginx skips a `limit_req` whose key is empty). All three
`limit_req` lines then attach to the single existing `location /`.

**Option B — dedicated location blocks.** Add
`location /public/search/ { limit_req ...; proxy_pass ...; }` and two
siblings, each duplicating the six `proxy_pass`/header directives the
original `location /` already has, with `location /` remaining for
`/`/`/health`.

## Decision

**Option A.** Routing stays exactly as it is — one location, matching
every request identically to before. The `map` blocks are additive at
`http` scope and don't touch the server block's structure at all.

Evaluated and rejected reasons for B: it duplicates six proxy directives
three times, changes nginx's location-precedence matching (which the
next editor now has to reason about) for a change whose only goal was
rate limiting, and restructures live routing on a production API where
that risk isn't justified by the objective.

## Consequences

- A reader must understand nginx's empty-key-skips-the-limit behavior to
  follow the config — documented inline in `deploy/nginx.conf`.
- `map` keys are computed from `$uri` (normalized, query string
  stripped), not `$request_uri` — deliberate, so a client can't escape
  the tighter search-zone rate by appending a query string.
- If a URL prefix later needs genuinely different *proxy* behavior (not
  just a different rate limit) — a different timeout, different
  buffering, a different upstream — that specific prefix should become a
  real `location` block at that time, with evidence for why. Converting
  one `map` key into a location is a small, well-understood change; this
  ADR does not preclude it, it just declines to build it speculatively
  now.
