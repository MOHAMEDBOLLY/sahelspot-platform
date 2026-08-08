import { apiGet } from '../../lib/apiClient'
import type { ApiHealth, BackupInfo, LogsInfo, SystemHealth, VersionInfo } from './types'

/** `GET /health` — same unauthenticated-route note as above. A `503`
 * response makes `apiGet` throw an `ApiError`, which `useApiHealth`
 * surfaces through React Query's own error state rather than this
 * function trying to parse a failure body. */
export function fetchApiHealth(): Promise<ApiHealth> {
  return apiGet<ApiHealth>('/health')
}

/** `GET /version` — same unauthenticated-route note as above. */
export function fetchVersionInfo(): Promise<VersionInfo> {
  return apiGet<VersionInfo>('/version')
}

/** `GET /system/health` — same unauthenticated-route note as above. */
export function fetchSystemHealth(): Promise<SystemHealth> {
  return apiGet<SystemHealth>('/system/health')
}

/** `GET /system/backups` — same unauthenticated-route note as above. */
export function fetchBackupInfo(): Promise<BackupInfo> {
  return apiGet<BackupInfo>('/system/backups')
}

/** `GET /system/logs` — same unauthenticated-route note as above. */
export function fetchLogsInfo(): Promise<LogsInfo> {
  return apiGet<LogsInfo>('/system/logs')
}
