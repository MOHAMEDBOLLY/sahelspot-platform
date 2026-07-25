import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '../../components/LoadingState'
import { useAuth } from './useAuth'

/** Wraps the entire Studio route tree — see `App.tsx`. Redirects to
 * `/login` (preserving the attempted path so login returns here) when
 * there's no authenticated user once session restore has settled. */
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingState label="Restoring session…" />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
