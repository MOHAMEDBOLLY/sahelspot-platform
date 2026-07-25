import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // A warning, not a throw: `apiClient.ts` (and everything that imports
  // it — every feature's `api.ts`) pulls this module in transitively, so
  // a hard failure here would break unrelated code (and the test suite)
  // just from missing local env setup. Real auth calls will fail loudly
  // on their own once actually invoked without real credentials.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill them in. Auth will not work until this is set.',
  )
}

/** Not exported outside `features/auth/` — `authService.ts` is the only
 * module allowed to import this. Everything else in the app consumes
 * `authService`, never the Supabase SDK directly, so there is exactly one
 * place that knows how to talk to Supabase Auth. */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
