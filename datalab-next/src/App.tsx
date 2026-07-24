import { Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { Dashboard } from './pages/Dashboard'
import { Venues } from './pages/Venues'
import { Destinations } from './pages/Destinations'
import { Publishing } from './pages/Publishing'
import { Activity } from './pages/Activity'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/venues" element={<Venues />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/publishing" element={<Publishing />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
