import { useLocation } from 'react-router-dom'
import { navItems } from '../config/navigation'

export function Header() {
  const { pathname } = useLocation()
  const current = navItems.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
      <h1 className="text-base font-semibold text-gray-900">
        {current?.label ?? 'Studio'}
      </h1>
      <div className="h-8 w-8 rounded-full bg-gray-200" aria-hidden="true" />
    </header>
  )
}
