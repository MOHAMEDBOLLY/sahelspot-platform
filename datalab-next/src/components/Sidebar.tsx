import { NavLink } from 'react-router-dom'
import { navItems } from '../config/navigation'
import { Drawer } from './Drawer'

type SidebarProps = {
  /** Phone-only drawer state. Ignored by the `lg:` static rendering,
   * which is always visible exactly as before this sprint. */
  mobileOpen: boolean
  onMobileClose: () => void
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ].join(' ')
          }
        >
          <Icon size={18} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Desktop (`lg:` and up): unchanged static sidebar, always rendered,
 * exactly as before this sprint. Phone/tablet (below `lg:`): the static
 * sidebar is hidden and a `Drawer` (generic primitive, not Sidebar-
 * specific) renders the same nav list instead, closing on navigation or
 * Escape via the Drawer's own behavior. */
export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            SahelSpot <span className="text-gray-400">Studio</span>
          </span>
        </div>
        <SidebarNav />
      </aside>

      <Drawer open={mobileOpen} onClose={onMobileClose} title="SahelSpot Studio">
        <SidebarNav onNavigate={onMobileClose} />
      </Drawer>
    </>
  )
}
