/** Sprint 32 — mirrors `UserOut` (api/app/api/schemas.py). */
export interface AppUser {
  id: string
  email: string | null
  role: string
  created_at: string
}
