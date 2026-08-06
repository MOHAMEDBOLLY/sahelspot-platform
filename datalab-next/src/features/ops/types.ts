/** Mirrors the backend's `GET /` response (`api/app/api/routes/system.py`). */
export interface SystemVersion {
  name: string
  version: string
}

/** Mirrors the backend's `GET /health` response. `database` is only present
 * on a `200` — a `503` response body carries `{status, database}` too, but
 * `useApiHealth` surfaces that case via the query's own error state instead
 * of parsing the error body, so this type only describes the success shape. */
export interface ApiHealth {
  status: string
  database: string
}
