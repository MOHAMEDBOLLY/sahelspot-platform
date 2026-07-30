import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { navItems } from '../config/navigation'
import { useAuth } from '../features/auth/useAuth'

type HeaderProps = {
  onMenuClick: () => void
}

/** `h-16`/`px-8` unchanged at `lg:` and up. Below `lg:`, padding shrinks
 * and a hamburger button (opens the Sidebar's Drawer) appears in its
 * place — desktop never renders it. The user email hides on the
 * narrowest phones (`hidden sm:inline`) rather than wrapping/overflowing;
 * sign-out and the avatar stay visible at every width. */
export function Header({ onMenuClick }: HeaderProps) {
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
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="truncate text-base font-semibold text-gray-900">
          {current?.label ?? 'Studio'}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {user?.email && <span className="hidden text-sm text-gray-600 sm:inline">{user.email}</span>}
        <div className="h-8 w-8 rounded-full bg-gray-200" aria-hidden="true" />
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:h-auto lg:w-auto lg:p-1.5"
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
