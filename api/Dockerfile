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

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
