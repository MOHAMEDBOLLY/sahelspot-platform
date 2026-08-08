FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Security hardening PR 3 — the image previously ran as root (the base
# image's default) with no USER directive at all. This user gets exactly
# what it needs and nothing else: read access to the application code and
# the packages already installed above (both owned by root, world-
# readable by default, so no chown needed for those), and the OS temp
# directory for upload spooling (already world-writable in the base
# image). `--system` keeps it in the system UID range rather than a
# regular login UID; `--no-create-home`/`--shell /usr/sbin/nologin` since
# this account never needs a home directory or an interactive shell.
RUN useradd --system --no-create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# H4 — two worker processes instead of uvicorn's default of one.
#
# Why 2 and not more: the worker count is bounded by database connections,
# not by CPU. Each worker gets its own SQLAlchemy engine and therefore its
# own pool (pool_size=5 + max_overflow=10 = 15 per process). Production
# reports max_connections=60 with 3 superuser-reserved (57 usable) and
# ~18 already held by Supabase's own internals, leaving ~39 for this API.
# Two workers burst to 30 and fit; three would reach 45 and four 60, both
# of which exceed the budget. Raising the worker count therefore requires
# lowering the per-worker pool first — a separate change, deliberately not
# made here.
#
# Kept in exec form (JSON array) so uvicorn remains PID 1 and receives
# SIGTERM directly from Docker; its supervisor then drains in-flight
# requests in each worker. Shell form would insert /bin/sh as PID 1 and
# break that. Every other flag is unchanged.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips=*"]
