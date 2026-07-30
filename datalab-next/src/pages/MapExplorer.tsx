import { MapPinOff } from 'lucide-react'
import { MapEngine } from '../features/map/MapEngine'
import { PagePlaceholder } from '../components/PagePlaceholder'

const ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined

// North Coast, Egypt — a sensible default center. Placeholder until
// Phase 2/3 fit the view to real venue/destination data.
const DEFAULT_CENTER = { lng: 28.7, lat: 30.95 }
const DEFAULT_ZOOM = 10

/**
 * Full-bleed layout is solved entirely here, per the architecture
 * decision to avoid a special AppShell mode: `AppShell`'s `<main>` has a
 * fixed, responsive padding (`p-4 sm:p-6 lg:p-8`) and a fixed-height
 * header (`h-16` = 4rem, border-box, so its rendered height never
 * changes regardless of safe-area insets). This wrapper cancels exactly
 * that padding with matching negative margins and sizes itself to
 * `100vh` minus the header — filling all remaining viewport space
 * without AppShell needing to know Maps exists. Every other page is
 * completely unaffected.
 */
export function MapExplorer() {
  if (!ACCESS_TOKEN) {
    return (
      <PagePlaceholder
        icon={MapPinOff}
        title="Map unavailable"
        description="VITE_MAPBOX_ACCESS_TOKEN is not set. Copy .env.example to .env.local (or set it in the deployment environment) and reload."
      />
    )
  }

  return (
    <div className="-m-4 h-[calc(100vh-4rem)] sm:-m-6 lg:-m-8">
      <MapEngine accessToken={ACCESS_TOKEN} center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} layers={[]} />
    </div>
  )
}
