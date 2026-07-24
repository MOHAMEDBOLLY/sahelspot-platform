import { apiGet } from '../../lib/apiClient'
import type { ActivityLogEntry } from './types'

export function fetchActivity(): Promise<ActivityLogEntry[]> {
  return apiGet<ActivityLogEntry[]>('/activity')
}
