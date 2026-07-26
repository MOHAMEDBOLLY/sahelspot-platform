import { Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { Dashboard } from './pages/Dashboard'
import { Venues } from './pages/Venues'
import { Destinations } from './pages/Destinations'
import { Publishing } from './pages/Publishing'
import { Activity } from './pages/Activity'
import { Users } from './pages/Users'
import { Settings } from './pages/Settings'
import { LoginPage } from './features/auth/LoginPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/destinations" element={<Destinations />} />
            <Route path="/publishing" element={<Publishing />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

export default App
