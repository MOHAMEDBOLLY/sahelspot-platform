# ADR 0010 — Supabase Connection Pool Capacity

**Status:** Accepted

## Context

### The incident

During final production validation of H1 (reverse-proxy rate limiting),
a controlled concurrency test — 70 requests at 20 concurrent against
`/public/destinations` — produced 2× `HTTP 500`. API logs showed:

```
sqlalchemy.exc.OperationalError: (psycopg.OperationalError)
FATAL: (EMAXCONNSESSION) max clients reached in session mode
       - max clients are limited to pool_size: 15
```

Two uvicorn workers stayed healthy throughout — no crash, no worker
restart. Normal (non-concurrent) production traffic was unaffected; the
defect was reachable only above roughly 15 concurrent DB-touching
requests. H1's rate limiting behaved exactly as designed and was not the
cause: every zone enforced its configured rate, the 429 contract was
correct, and the editor zone's 50-request burst (the shape of a Studio
bulk action) produced zero rejections.

### Why this was reachable now and not earlier

H4 doubled the API from one uvicorn worker to two, each with its own
independent SQLAlchemy engine and connection pool. H4's investigation
sized the change against Postgres's `max_connections = 60`, explicitly
flagging the Supavisor pooler-level cap as **NOT VERIFIED**. That
unverified assumption was wrong, and this incident is the direct
consequence.

Local benchmarking during H4 never surfaced the defect because
connection *hold time* — not connection *count* — is what determines how
many concurrent checkouts a given request rate demands. Against
localhost Postgres (sub-millisecond round trips) even 200 concurrent
requests needed only ~10 held connections. Against Supabase over the
network (~200 ms per request, per H2's own measurements), the same
request rate holds each connection roughly 200× longer, so far more
concurrent checkouts are required to serve the same throughput. The
defect is a property of network latency, not of local test conditions —
which is also why P0's test-database isolation, correct on its own
terms, could not have caught it: an isolated local Postgres reproduces
none of the round-trip latency that makes the pool exhaustion visible.

## Investigation and measured evidence

**SQLAlchemy configuration** (`api/app/db/session.py`, unchanged
throughout this incident):

```python
engine = create_engine(settings.database_url, pool_pre_ping=True)
```

Effective values, measured directly from the running engine:

| Parameter | Value |
|---|---|
| `poolclass` | `QueuePool` |
| `pool_size` | 5 |
| `max_overflow` | 10 |
| `pool_timeout` | 30.0 s |
| `pool_recycle` | −1 (never) |
| `pool_pre_ping` | `True` |
| **Max connections per process** | **15** |

With H4's two workers, maximum theoretical demand is **2 × 15 = 30**
client connections.

**Supabase configuration**, read directly from the dashboard (Project →
Settings → Database → Connection Pooling) — not inferred:

| Field | Value |
|---|---|
| Compute Plan | Free |
| Compute Size | **Nano** |
| Pool Mode | Session (port `5432`; determined by connection port, not a dashboard field) |
| Connection pool size (before) | **15** |
| Max client connections | **200 — fixed, cannot be changed on this compute size** |

Dashboard help text, quoted verbatim: *"The maximum number of connections
made to the underlying Postgres cluster, per user+db combination. Pool
size has a default of 15 based on your compute size of Nano."*

**Runtime census**, read-only query against `pg_stat_activity`:
`max_connections = 60`, `superuser_reserved_connections = 3` (57
usable), 23 backends in use at rest — 11 `Supavisor`, plus PostgREST,
pg_cron, pg_net, postgres_exporter, and `supabase_admin`.

**Empirical concurrency envelope**, measured against production before
any change:

| Concurrency | 500s |
|---|---|
| 4 | 0 |
| 8 | 0 |
| 12 | 0 |
| 20 | 2 |

Consistent with a failure boundary between 12 and 20 concurrent — i.e.
at the 15-client cap.

## Why Pool Size 15 failed

Supabase's own documentation on Supavisor session mode: *"the max amount
of clients is restricted to the 'Pool Size' value in the Database
Settings… If the 'Pool Size' is set to 15… it will still be effectively
capped at 15 for each unique database-role+database combination."*
(Supavisor FAQ.)

This is a **client-connection** cap, distinct from Postgres's own
`max_connections`. The API's two workers could together demand 30
connections; Supavisor in session mode permitted only 15 for the
project's single database role. Requests beyond that were refused at the
pooler with `EMAXCONNSESSION`, which SQLAlchemy surfaced as an
`OperationalError` with no handler — an unhandled `500`.

The constraining resource was **not** Postgres capacity (23 of 60
backends in use; 57 usable) and **not** the compute tier's hard ceiling
(200 Max Client Connections). It was a configured value — Pool Size —
left at its Nano default, which nothing in the H4 investigation had
verified against.

## Why Pool Size 30 was selected

Pool Size 30 was chosen, over the dashboard, as the only change:

- **Exactly covers application demand.** 2 workers × 15 (`pool_size 5` +
  `max_overflow 10`) = 30. Nothing wasted, nothing short.
- **Far inside the fixed tier ceiling.** 30 of 200 Max Client
  Connections — the ceiling was never the binding constraint.
- **Leaves Postgres headroom.** At full application saturation, ~30
  Supavisor backends + ~12 other Supabase-internal backends ≈ 42 of 57
  usable — comfortable margin, not exhausted.
- **Clears the measured failure boundary** (defect appeared at 20
  concurrent; 30 sits above the full theoretical maximum, not just above
  the observed breach).
- **Not raised further on this tier.** Going materially above 30 would
  begin pressuring `max_connections = 60` well before it approached the
  200-client ceiling, which would convert a bounded, well-understood
  failure mode into a less predictable one.

Validated after the change: the identical 70-request/20-concurrent test
produced **zero** `HTTP 500` and **zero** `EMAXCONNSESSION`, at more than
double the prior throughput (30.1 req/s vs 12.5 req/s — the increase is
expected and correct: requests no longer stall queuing for a connection).
H1, H2, H3, and H4 were all re-verified unaffected by the same change.

## Why SQLAlchemy was left unchanged

`pool_size=5` and `max_overflow=10` are reasonable, unremarkable values
for a persistent-process backend — not the defect. Reducing them (e.g.
to `pool_size=3, max_overflow=4` per worker, yielding 2×7=14 under the
original 15-client cap) was investigated as an alternative and rejected
as the *primary* fix, though kept as a fallback if the dashboard change
proved infeasible:

- It treats the symptom, not the cause — the application would remain
  permanently capped at 7.5% of what the compute tier actually permits
  (15 of 200), for no benefit, indefinitely.
- The dashboard change requires **no code change, no image rebuild, no
  container restart, and no deployment** — strictly lower-risk than
  editing pool configuration on a production API that was, at the time,
  healthy under normal traffic.

Sessions were confirmed not to be leaking (`get_db`'s `finally: db.close()`
releases correctly; at-rest connection count returned to baseline both
before and after every test), and public endpoints were confirmed to
release connections promptly. The pool's *configuration* was never the
problem; its *ceiling relative to Supavisor* was.

## Why Transaction Pooling was rejected

Transaction mode (port `6543`) was evaluated and rejected for this
change, though not permanently ruled out for future reconsideration.

Supabase's documentation is explicit: session mode *"maintains
longer-lived pooled connections… better for persistent backend
applications,"* while transaction mode is *"designed for transient
connections… ideal for serverless and edge functions"* and *"does not
support prepared statements. To avoid errors, turn off prepared
statements for your connection library."*

This stack uses **psycopg3**, which auto-prepares statements after
`prepare_threshold` (default 5) executions of the same query — a
mismatch with transaction mode's documented restriction. An exploratory
connection test to port 6543 succeeded and eight repeated parameterised
queries completed without error, but this was **not treated as
validating compatibility**: a single sequential connection does not
exercise Supavisor's per-transaction backend reassignment, which is
where prepared-statement failures under transaction mode actually occur.
Certifying transaction mode would require concurrent load testing with
`prepare_threshold=0` explicitly configured — a dedicated piece of work,
not a byproduct of resolving this incident. Session mode's fit for a
long-lived FastAPI process, and Pool Size's straightforward
availability as the actual constraint, made it the correct choice for
this fix.

## Decision

Increase the Supabase Supavisor **Connection pool size** from **15** to
**30**, via the dashboard only (Project → Settings → Database →
Connection Pooling → Connection pool size). No other setting on that
page, no SQLAlchemy configuration, no application code, no Docker image,
no environment variable, no nginx configuration, and no worker count was
changed.

## Consequences

- Production can sustain up to 30 concurrent DB-touching requests across
  both API workers without exhausting the Supavisor session-mode client
  cap. Requests beyond that queue (up to SQLAlchemy's existing
  `pool_timeout=30s`) rather than erroring — a strictly better failure
  mode, converting `500`s into bounded latency.
- Roughly 42 of 57 usable Postgres backends are consumed at full
  application saturation, leaving margin but not a large one. This
  budget is specific to Nano/Free; any future compute-tier change
  should re-derive it rather than assume it carries over.
- The 200 Max Client Connections figure for Nano/Micro is **not** the
  binding constraint on this tier and should not be used alone to size
  future pool changes — `max_connections` (60, minus 3 reserved) is.

## Future review criteria

Revisit this decision if any of the following occur:

- **Worker count increases** (beyond H4's 2). Each additional worker
  adds up to 15 more potential client connections; Pool Size must scale
  with it, and the Postgres backend budget (57 usable) must be
  re-checked before assuming headroom exists.
- **`pool_size`/`max_overflow` change** in `api/app/db/session.py`. Any
  change to per-worker pool sizing changes the 30-client figure this
  ADR is built on; the Pool Size dashboard value should be re-derived,
  not left at 30 by default.
- **Compute tier changes** (upgrade or downgrade). `max_connections`,
  Max Client Connections, and the safe Pool Size all move together and
  must be re-measured from the dashboard and `pg_stat_activity`, not
  assumed from this document or from Supabase's general tier table.
- **A second database role is added** to the connection pooling
  configuration. Pool Size is documented as applying *"per unique
  database-role+database combination"* — a second pooled role would not
  share the 30-connection budget this ADR sized for a single role, and
  total backend demand would need to be recalculated.
- **Sustained `EMAXCONNSESSION` reappears**, at any Pool Size. Confirms
  the 30-client ceiling is now the binding constraint under real traffic
  rather than the theoretical maximum this ADR sized against, and Pool
  Size should be raised further only after re-verifying Postgres backend
  headroom via `pg_stat_activity`.
- **Real production concurrency metrics become available.** This
  decision was sized entirely from *theoretical* maximum demand and
  measured request latency, explicitly noted as a gap in the
  investigation that led to it (no APM exists). Once real traffic data
  exists, Pool Size should be re-tuned against observed peak concurrency
  rather than worst-case theoretical demand.
- **Transaction pooling is reconsidered.** Only after a dedicated
  concurrent-load test with `prepare_threshold=0` explicitly configured
  and validated — not as a response to hitting the session-mode ceiling
  again, which should be solved by adjusting Pool Size or application
  pool sizing first.
