import { apiGet } from '../../lib/apiClient'
import type { ApiHealth, SystemVersion } from './types'

/** `GET /` — unauthenticated system route, not under `/editor/*`, but
 * `apiGet` works unchanged: it just adds a Bearer header that this route
 * doesn't require and ignores. Reused as-is, per Sprint 1's "do not extend,
 * do not redesign" rule for these endpoints. */
export function fetchSystemVersion(): Promise<SystemVersion> {
  return apiGet<SystemVersion>('/')
}

/** `GET /health` — same unauthenticated-route note as above. A `503`
 * response makes `apiGet` throw an `ApiError`, which `useApiHealth`
 * surfaces through React Query's own error state rather than this
 * function trying to parse a failure body. */
export function fetchApiHealth(): Promise<ApiHealth> {
  return apiGet<ApiHealth>('/health')
}
