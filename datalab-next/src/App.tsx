import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { Dashboard } from './pages/Dashboard'
import { QualityCenter } from './pages/QualityCenter'
import { Venues } from './pages/Venues'
import { Destinations } from './pages/Destinations'
import { Events } from './pages/Events'
import { Publishing } from './pages/Publishing'
import { Activity } from './pages/Activity'
import { Users } from './pages/Users'
import { Settings } from './pages/Settings'
import { Operations } from './pages/Operations'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoadingState } from './components/LoadingState'

// `mapbox-gl` is a large dependency (~200KB+ gzipped) — code-split so it
// only loads when someone actually visits /map, never inflating every
// other page's bundle.
const MapExplorer = lazy(() => import('./pages/MapExplorer').then((m) => ({ default: m.MapExplorer })))

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/quality" element={<QualityCenter />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/destinations" element={<Destinations />} />
            <Route path="/events" element={<Events />} />
            <Route path="/publishing" element={<Publishing />} />
            <Route
              path="/map"
              element={
                <Suspense fallback={<LoadingState label="Loading map…" />}>
                  <MapExplorer />
                </Suspense>
              }
            />
            <Route path="/activity" element={<Activity />} />
            <Route path="/users" element={<Users />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

export default App
