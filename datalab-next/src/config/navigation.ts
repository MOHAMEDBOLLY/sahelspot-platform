import {
  LayoutDashboard,
  Store,
  MapPin,
  Map,
  CalendarDays,
  UploadCloud,
  Activity as ActivityIcon,
  Users as UsersIcon,
  Settings as SettingsIcon,
  ShieldCheck,
  Gauge,
  Waves,
  QrCode,
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
  // Studio Content Organization — Beaches and No QR are both views over
  // the existing Venue model, not new entities (see docs on
  // api/app/db/models.py's `Venue.parent_venue_id`). Beaches is a plain
  // redirect into Venues' own category filter (`Beach Club`, where real
  // beach venues are already filed) — no separate page exists for it.
  { to: '/beaches', label: 'Beaches', icon: Waves },
  { to: '/no-qr', label: 'No QR', icon: QrCode },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/destinations', label: 'Destinations', icon: MapPin },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/publishing', label: 'Publishing', icon: UploadCloud },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/users', label: 'Users', icon: UsersIcon },
  { to: '/operations', label: 'Operations', icon: Gauge },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]
