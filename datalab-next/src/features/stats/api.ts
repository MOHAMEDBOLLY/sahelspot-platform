import { apiGet } from '../../lib/apiClient'
import type { PlatformStats } from './types'

export function fetchPlatformStats(): Promise<PlatformStats> {
  return apiGet<PlatformStats>('/editor/stats')
}
