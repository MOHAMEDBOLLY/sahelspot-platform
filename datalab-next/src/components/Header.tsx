import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { navItems } from '../config/navigation'
import { useAuth } from '../features/auth/useAuth'

export function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const current = navItems.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
      <h1 className="text-base font-semibold text-gray-900">
        {current?.label ?? 'Studio'}
      </h1>
      <div className="flex items-center gap-3">
        {user?.email && <span className="text-sm text-gray-600">{user.email}</span>}
        <div className="h-8 w-8 rounded-full bg-gray-200" aria-hidden="true" />
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
