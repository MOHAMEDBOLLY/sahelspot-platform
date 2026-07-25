import { apiGet } from '../../lib/apiClient'

export interface Me {
  id: string
  email: string | null
  role: string
}

/** Sprint 24's one new endpoint — who am I, and what's my role. Called
 * once a session exists, so `AuthContext` can expose `role` alongside the
 * Supabase `user` it already tracks. */
export function fetchMe(): Promise<Me> {
  return apiGet<Me>('/editor/me')
}
