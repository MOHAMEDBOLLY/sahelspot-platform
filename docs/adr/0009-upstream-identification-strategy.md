# ADR 0009 — Upstream Identification Strategy

**Status:** Accepted

## Context

Production nginx (`sahelspot-web`) proxies to the API container via
`proxy_pass http://api:8000;`, where `api` was a Docker network alias
(`--network-alias api`) attached to the `sahelspot-api` container at
`docker run` time. That flag was silently omitted the last time the API
container was recreated (a plain `docker run`, no compose file, no
deploy script encoding the required flags). The alias never resolved
again, and `nginx -t` failed with `host not found in upstream "api"`
from that point on — undetected until the next config reload was
attempted, roughly 10 hours later (OPS-001).

The site stayed up throughout only because the running nginx process
held the old container's IP in memory from its last successful load,
and the recreated container happened to be reassigned that same address
— coincidence, not resilience. Any subsequent `nginx -s reload`, or any
restart of `sahelspot-web` itself, would have failed outright.

## Decision

**`proxy_pass` targets the Docker container's own name
(`http://sahelspot-api:8000`), not a network alias.**

Docker's embedded DNS resolves a container's name on a user-defined
network automatically, with no extra flag required. Unlike an alias, a
name is not optional: Docker refuses to run two containers with the
same name at once, so it cannot be silently dropped the way
`--network-alias` was — any error in preserving it surfaces immediately,
as a failed `docker run`, not as a several-hour-old landmine discovered
at the next unrelated operation.

**Rejected: restore the alias and "guarantee" it going forward.**
Same DNS mechanism, but the fix would have required either
disconnecting and reconnecting the container's network (which reassigns
its IP — the exact address the coincidentally-still-running nginx was
depending on) or recreating the container outright (the same kind of
operation that caused this incident, on a host where nginx could not
safely restart). The "guarantee" also doesn't exist until deployment
automation is built to enforce it — which is real, valuable work, but a
distinct, later concern (see Consequences).

## Consequences

- The fix (`docker run --network-alias api` → `proxy_pass
  http://sahelspot-api:8000`) is a one-line, config-only change with no
  container action required — applied via an inode-preserving rewrite
  of the (bind-mounted) nginx config file plus `nginx -s reload`. See
  `docs/DEPLOYMENT.md`'s deploy/rollback commands for the exact
  procedure, including why `sed -i` must not be used on that file (it
  replaces the file's inode, which a single-file bind mount is pinned
  to — a second, independent lesson from the same incident).
- This is a Docker-specific identifier, not a portable one. The
  documented long-term target is Docker Compose service names, which
  become the canonical DNS record and make this whole class of
  divergence structurally impossible (a compose file *is* the recorded,
  reviewable set of run flags — there's no "flag someone forgot to type
  this time"). That migration is deliberately out of scope here: it
  would mean recreating all three production containers at a moment
  when nginx could not yet safely restart, i.e. the higher-risk version
  of the very problem this ADR closes. Tracked as future work (see
  `docs/RELEASE_NOTES_PRODUCTION_STABILIZATION.md`'s Future Work
  section), not implemented now.
- Any future container recreation must reuse the exact name
  `sahelspot-api` (and `sahelspot-consumer`, `sahelspot-web`) — already
  true in practice throughout this project's deploy history, now also
  the thing this ADR's fix structurally depends on.
