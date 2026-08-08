/** Mirrors the backend's `GET /health` response. `database` is only present
 * on a `200` — a `503` response body carries `{status, database}` too, but
 * `useApiHealth` surfaces that case via the query's own error state instead
 * of parsing the error body, so this type only describes the success shape. */
export interface ApiHealth {
  status: string
  database: string
}

/** Mirrors the backend's `GET /version` response, which returns
 * `version.json` (repo root of the `api/` build context) verbatim — the
 * single source of truth for Consumer/Studio/Backend version info. */
export interface VersionInfo {
  consumer_version: string
  studio_version: string
  backend_version: string
  environment: string
  git_commit: string
  last_deployment: string
  publish_revision: number
  schema_revision: string
}

/** Mirrors the backend's `GET /system/health` response
 * (`api/app/api/routes/system_health.py`) — live runtime data, read fresh
 * on every request, never cached server-side. `server`/`database` fields
 * can be `null` when their source isn't available (a DB failure, or an
 * OS-level read failure for `server`) — the response itself is still a
 * `200` in that case, since a partial reading is still a real reading,
 * not a failure of this endpoint. `docker` is always `{ available: false
 * }` — Phase 2A intentionally defers Docker monitoring (no socket mount,
 * no SDK, no CLI inspection); this is not a degraded/error state, it's
 * this phase's permanent shape. */
export interface SystemHealth {
  timestamp: string
  status: 'healthy' | 'warning' | 'critical'
  server: {
    cpu_percent: number | null
    cpu_cores: number | null
    load_average: { '1m': number; '5m': number; '15m': number } | null
    memory: { used_percent: number; used_gb: number; total_gb: number } | null
    disk: { used_percent: number; used_gb: number; total_gb: number } | null
  }
  database: {
    status: string
    latency_ms: number | null
    publish_revision: number | null
    schema_revision: string | null
  }
  api: {
    workers: number
    uptime_seconds: number
    uptime: string
    version: string | null
    git_commit: string | null
  }
  docker: {
    available: false
  }
}

/** Mirrors the backend's `GET /system/backups` response
 * (`api/app/api/routes/system_backups.py`) — reads `api/backups/`
 * read-only, never writes/moves/deletes anything there. All fields are
 * `null` (and `status` is `"warning"`) when the directory is missing or
 * empty — not an error, just nothing to report yet. */
export interface BackupInfo {
  last_backup: string | null
  backup_size: string | null
  backup_location: string
  backup_age: string | null
  status: 'healthy' | 'warning' | 'critical'
}

/** Mirrors the backend's `GET /system/logs` response
 * (`api/app/api/routes/system_logs.py`) — summary counts only, never log
 * content. `nginx_errors` is always `null`: nginx runs in a separate
 * container this phase doesn't reach into (same boundary Phase 2A drew
 * around Docker). */
export interface LogsInfo {
  api_errors: number | null
  nginx_errors: number | null
  last_restart: string | null
  last_deploy: string | null
  status: 'healthy' | 'warning' | 'critical'
}
