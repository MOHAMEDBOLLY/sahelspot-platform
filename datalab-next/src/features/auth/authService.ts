import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

/** The only module in the app that imports the Supabase SDK directly (see
 * `supabaseClient.ts`). Every other module — `apiClient.ts`, `AuthContext`,
 * `LoginPage`, `Header` — goes through the functions below instead of
 * touching `supabase.auth` itself, so if the SDK, its API, or the auth
 * provider ever changes, this is the one file that has to change with it.
 */

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** The current access token, if any — the one thing `apiClient.ts` needs
 * to attach `Authorization: Bearer <token>` to a mutation request. Reads
 * the session fresh each call rather than caching it, so it's always the
 * (auto-refreshed) current token, never a stale one. */
export async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.access_token ?? null
}

/** Fires immediately with the current state, then on every sign-in/out/
 * token-refresh. Returns an unsubscribe function — callers (just
 * `AuthContext`) are responsible for calling it on unmount. */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}
