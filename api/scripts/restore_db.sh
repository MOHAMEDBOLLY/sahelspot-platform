#!/usr/bin/env bash
#
# SahelSpot Platform — Database Restore
#
# Restores a backup created by `backup_db.sh` into the database
# `DATABASE_URL` points at (env var, or read from api/.env if unset).
#
# WARNING: this overwrites the target database with the backup's
# contents. It does not delete or drop anything itself — `psql` simply
# replays the dumped statements against whatever is already there — but
# for anything other than an empty database, that means duplicate-row
# errors or conflicting state. Restoring into a database you intend to
# keep using afterward, rather than a fresh/empty one, is on you to get
# right; this script only guards against running it by accident.
#
# Usage:
#   ./scripts/restore_db.sh <backup_file.sql.gz>
#
# Example:
#   ./scripts/restore_db.sh api/backups/sahelspot_backup_20260727_120000.sql.gz
#
# Requires: psql, gunzip. Prompts for an explicit "yes" before touching
# the database — there is no --force/non-interactive flag, deliberately;
# this is a rare, high-consequence action, not something to script around.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found. Install the PostgreSQL client tools first." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  ENV_FILE="$SCRIPT_DIR/../.env"
  if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC2046
    export $(grep -E '^DATABASE_URL=' "$ENV_FILE" | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set (checked the environment and api/.env)." >&2
  exit 1
fi

PG_URL="${DATABASE_URL/postgresql+psycopg:\/\//postgresql://}"

echo "This will restore:"
echo "  $BACKUP_FILE"
echo "into:"
echo "  $PG_URL"
echo
read -r -p "Type 'yes' to continue: " CONFIRMATION
if [ "$CONFIRMATION" != "yes" ]; then
  echo "Aborted — no changes made."
  exit 1
fi

echo "Restoring..."

if gunzip -c "$BACKUP_FILE" | psql "$PG_URL"; then
  echo "Restore complete."
else
  echo "ERROR: restore failed partway through — the database may be in a mixed state. Verify manually." >&2
  exit 1
fi
