import {
  LayoutDashboard,
  Store,
  MapPin,
  UploadCloud,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/venues', label: 'Venues', icon: Store },
  { to: '/destinations', label: 'Destinations', icon: MapPin },
  { to: '/publishing', label: 'Publishing', icon: UploadCloud },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]
