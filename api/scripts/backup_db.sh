#!/usr/bin/env bash
#
# SahelSpot Platform — Database Backup
#
# Dumps the database `DATABASE_URL` points at (env var, or read from
# api/.env if unset) to a timestamped, gzip-compressed SQL file.
#
# Usage:
#   ./scripts/backup_db.sh [output_directory]
#
#   output_directory   Where to write the backup. Defaults to $BACKUP_DIR,
#                       or ./backups (relative to this script) if that's
#                       unset too.
#
# Examples:
#   ./scripts/backup_db.sh                    # writes to api/backups/
#   ./scripts/backup_db.sh /var/backups/sahel  # writes there instead
#   BACKUP_DIR=/var/backups/sahel ./scripts/backup_db.sh
#
# Requires: pg_dump, gzip (both standard on any host with a Postgres
# client installed). Exits non-zero on any failure — a partial or missing
# backup is never left looking like a successful one.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${1:-${BACKUP_DIR:-$SCRIPT_DIR/../backups}}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install the PostgreSQL client tools first." >&2
  exit 1
fi

# DATABASE_URL is usually only set in api/.env (see .env.example), not
# exported in the shell — fall back to reading it from there, same as the
# app itself does via pydantic-settings' env_file.
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

# pg_dump doesn't understand SQLAlchemy's "+psycopg" driver suffix.
PG_URL="${DATABASE_URL/postgresql+psycopg:\/\//postgresql://}"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$OUTPUT_DIR/sahelspot_backup_${TIMESTAMP}.sql.gz"

echo "Backing up database to $BACKUP_FILE ..."

if pg_dump "$PG_URL" | gzip > "$BACKUP_FILE"; then
  echo "Backup complete: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  echo "ERROR: backup failed." >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi
