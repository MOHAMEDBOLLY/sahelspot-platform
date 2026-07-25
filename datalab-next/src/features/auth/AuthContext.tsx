import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSession, onAuthStateChange, signInWithPassword, signOut } from './authService'
import { AuthContext, type AuthContextValue } from './authContextValue'

/** Owns the one piece of session state the rest of Studio needs: who (if
 * anyone) is logged in. Restoring the session on load and staying in sync
 * with sign-in/out is entirely `authService.onAuthStateChange`'s job —
 * this component only holds the result in React state. Consumed via
 * `useAuth()`, never imported directly by feature code. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSession().then((session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const unsubscribe = onAuthStateChange((nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signIn: signInWithPassword,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
