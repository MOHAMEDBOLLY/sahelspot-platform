import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSession, onAuthStateChange, signInWithPassword, signOut } from './authService'
import { fetchMe } from './api'
import { AuthContext, type AuthContextValue } from './authContextValue'

/** Owns the two pieces of session state the rest of Studio needs: who (if
 * anyone) is logged in, and — as of Sprint 24 — what role they hold.
 * Restoring the session on load and staying in sync with sign-in/out is
 * entirely `authService.onAuthStateChange`'s job; this component only
 * holds the result in React state, and fetches `role` from `GET
 * /editor/me` once a user exists. Consumed via `useAuth()`, never
 * imported directly by feature code. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function applyUser(nextUser: User | null) {
      setUser(nextUser)
      if (nextUser === null) {
        setRole(null)
        setLoading(false)
        return
      }
      fetchMe()
        .then((me) => setRole(me.role))
        .catch(() => setRole(null))
        .finally(() => setLoading(false))
    }

    // Sprint 31 — without a `.catch()` here, a rejected `getSession()` call
    // (e.g. Supabase misconfigured) left `loading` stuck `true` forever,
    // since `applyUser` — the only thing that flips it — was never
    // reached. Treat a failed session restore the same as "no session".
    getSession()
      .then((session) => applyUser(session?.user ?? null))
      .catch(() => applyUser(null))

    const unsubscribe = onAuthStateChange(applyUser)

    return unsubscribe
  }, [])

  const value: AuthContextValue = {
    user,
    role,
    loading,
    signIn: signInWithPassword,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
