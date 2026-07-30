import {
  LayoutDashboard,
  Store,
  MapPin,
  UploadCloud,
  Activity as ActivityIcon,
  Users as UsersIcon,
  Settings as SettingsIcon,
  ShieldCheck,
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
  { to: '/quality', label: 'Data Quality', icon: ShieldCheck },
  { to: '/venues', label: 'Venues', icon: Store },
  { to: '/destinations', label: 'Destinations', icon: MapPin },
  { to: '/publishing', label: 'Publishing', icon: UploadCloud },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/users', label: 'Users', icon: UsersIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]
