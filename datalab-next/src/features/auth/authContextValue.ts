import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: User | null
  /** Sprint 24 — this application's role for the current user, fetched
   * from `GET /editor/me` once a session exists. `null` while there's no
   * session, or while it's still loading — never trust a non-null value
   * here as authorization; it's for deciding what to render only. */
  role: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
