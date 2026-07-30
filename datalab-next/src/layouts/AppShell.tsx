import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { Header } from '../components/Header'

/** `p-8` (desktop, unchanged) shrinks to `p-4`/`p-6` below `lg:` so
 * content isn't crushed against the viewport edge on a phone; the bottom
 * inset adds the iPhone home-indicator safe area on top of the normal
 * padding rather than replacing it. */
export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
